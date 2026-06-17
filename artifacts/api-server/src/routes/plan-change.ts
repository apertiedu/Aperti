import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { logError } from "../lib/log-error";
import { emitBillingEvent } from "../lib/billing-event-bus";
import { transitionSubscription } from "../lib/subscription-fsm";
import { sendPushToUser } from "../lib/push";

export const planChangeRouter = Router();
planChangeRouter.use(authenticate);

/* ── POST /api/plan-change/initiate ────────────────────────────────────── */
planChangeRouter.post("/initiate", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { newPlanId, reason } = req.body as { newPlanId: number; reason?: string };
    if (!newPlanId) { res.status(400).json({ error: "newPlanId required" }); return; }

    const { rows: [sub] } = await pool.query(
      `SELECT s.*, sp.price_egp AS old_price, sp.name AS old_plan_name, sp.id AS old_plan_id
       FROM subscriptions s
       JOIN subscription_plans sp ON sp.id = s.plan_id
       WHERE s.account_id = $1 AND s.status IN ('active','grace_period')
       ORDER BY s.created_at DESC LIMIT 1`,
      [userId],
    );
    if (!sub) { res.status(404).json({ error: "No active subscription to change" }); return; }

    const { rows: [newPlan] } = await pool.query(
      `SELECT * FROM subscription_plans WHERE id = $1 AND (visibility=TRUE OR visibility IS NULL) AND scope='platform'`,
      [newPlanId],
    );
    if (!newPlan) { res.status(400).json({ error: "Target plan not found" }); return; }

    if (sub.plan_id === newPlanId) {
      res.status(409).json({ error: "Already on this plan" });
      return;
    }

    const oldPrice = parseFloat(sub.old_price ?? "0");
    const newPrice = parseFloat(newPlan.price_egp ?? "0");
    const isUpgrade = newPrice > oldPrice;
    const changeType = isUpgrade ? "upgrade" : "downgrade";

    let prorationAmount = 0;
    if (isUpgrade && sub.end_date) {
      const now = Date.now();
      const end = new Date(sub.end_date).getTime();
      const totalPeriod = 30 * 24 * 60 * 60 * 1000;
      const remaining = Math.max(0, end - now);
      const fractionRemaining = remaining / totalPeriod;
      prorationAmount = Math.round((newPrice - oldPrice) * fractionRemaining * 100) / 100;
    }

    const { rows: [pending] } = await pool.query(
      `SELECT id FROM plan_changes WHERE user_id=$1 AND status='pending' LIMIT 1`,
      [userId],
    );
    if (pending) {
      res.status(409).json({ error: "You already have a pending plan change. Cancel it first.", code: "PENDING_CHANGE" });
      return;
    }

    const { rows: [change] } = await pool.query(
      `INSERT INTO plan_changes
         (user_id, subscription_id, old_plan_id, new_plan_id, change_type, proration_amount,
          effective_date, status, notes, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,
         CASE WHEN $7='upgrade' THEN NOW() ELSE date_trunc('month',NOW()) + INTERVAL '1 month' END,
         'pending',$8,$1,NOW()) RETURNING *`,
      [userId, sub.id, sub.old_plan_id, newPlanId, changeType, prorationAmount, changeType, reason ?? null],
    );

    emitBillingEvent({
      type: isUpgrade ? "plan_upgraded" : "plan_downgraded",
      entityId: change.id,
      entityType: "plan_change",
      userId,
      payload: { from: sub.old_plan_name, to: newPlan.name, changeType, prorationAmount },
    });

    res.status(201).json({
      change_id: change.id,
      change_type: changeType,
      old_plan: sub.old_plan_name,
      new_plan: newPlan.name,
      proration_amount: prorationAmount,
      effective_date: change.effective_date,
      message: isUpgrade
        ? `Upgrade request received. ${prorationAmount > 0 ? `Proration of EGP ${prorationAmount} will be invoiced.` : ""} Admin will apply shortly.`
        : `Downgrade scheduled for next billing cycle: ${new Date(change.effective_date).toLocaleDateString()}.`,
    });
  } catch (err) {
    await logError(err, { route: "POST /api/plan-change/initiate" });
    res.status(500).json({ error: "Failed" });
  }
});

/* ── GET /api/plan-change/history ──────────────────────────────────────── */
planChangeRouter.get("/history", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      `SELECT pc.*, op.name AS old_plan_name, np.name AS new_plan_name
       FROM plan_changes pc
       LEFT JOIN subscription_plans op ON op.id = pc.old_plan_id
       LEFT JOIN subscription_plans np ON np.id = pc.new_plan_id
       WHERE pc.user_id = $1
       ORDER BY pc.created_at DESC LIMIT 20`,
      [req.userId],
    );
    res.json({ history: rows });
  } catch (err) {
    await logError(err, { route: "GET /api/plan-change/history" });
    res.status(500).json({ error: "Failed" });
  }
});

/* ── POST /api/plan-change/cancel/:id ──────────────────────────────────── */
planChangeRouter.post("/cancel/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      `UPDATE plan_changes SET status='cancelled' WHERE id=$1 AND user_id=$2 AND status='pending' RETURNING id`,
      [req.params.id, req.userId],
    );
    if (!rows[0]) { res.status(404).json({ error: "No pending change found" }); return; }
    res.json({ success: true });
  } catch (err) {
    await logError(err, { route: `POST /api/plan-change/cancel/${req.params.id}` });
    res.status(500).json({ error: "Failed" });
  }
});

/* ── ADMIN ─────────────────────────────────────────────────────────────── */

/* ── GET /api/plan-change/admin/all ────────────────────────────────────── */
planChangeRouter.get("/admin/all", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.query as Record<string, string>;
    let q = `
      SELECT pc.*, a.display_name, a.username,
             op.name AS old_plan_name, op.price_egp AS old_price,
             np.name AS new_plan_name, np.price_egp AS new_price
      FROM plan_changes pc
      JOIN accounts a ON a.id = pc.user_id
      LEFT JOIN subscription_plans op ON op.id = pc.old_plan_id
      LEFT JOIN subscription_plans np ON np.id = pc.new_plan_id
      WHERE 1=1`;
    const params: unknown[] = [];
    if (status) { q += ` AND pc.status = $1`; params.push(status); }
    q += ` ORDER BY pc.created_at DESC LIMIT 100`;
    const { rows } = await pool.query(q, params);
    res.json({ changes: rows });
  } catch (err) {
    await logError(err, { route: "GET /api/plan-change/admin/all" });
    res.status(500).json({ error: "Failed" });
  }
});

/* ── POST /api/plan-change/admin/apply/:id ─────────────────────────────── */
planChangeRouter.post("/admin/apply/:id", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const changeId = parseInt(req.params.id);
    const adminId = req.userId!;

    const { rows: [change] } = await pool.query(
      `SELECT pc.*, op.price_egp AS old_price, np.price_egp AS new_price, np.name AS new_plan_name,
              s.account_id, s.end_date
       FROM plan_changes pc
       LEFT JOIN subscription_plans op ON op.id = pc.old_plan_id
       LEFT JOIN subscription_plans np ON np.id = pc.new_plan_id
       LEFT JOIN subscriptions s ON s.id = pc.subscription_id
       WHERE pc.id = $1 AND pc.status = 'pending'`,
      [changeId],
    );
    if (!change) { res.status(404).json({ error: "Pending plan change not found" }); return; }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `UPDATE subscriptions SET plan_id = $1, updated_at = NOW() WHERE id = $2`,
        [change.new_plan_id, change.subscription_id],
      );

      if (change.change_type === "upgrade" && parseFloat(change.proration_amount) > 0) {
        const { rows: [le] } = await client.query(
          `INSERT INTO ledger_entries
             (account_id, entry_type, amount, currency, description, reference_id, reference_type, created_at)
           VALUES ($1,'credit',$2,'EGP',$3,$4,'plan_change',NOW()) RETURNING id`,
          [change.account_id, change.proration_amount, `Plan upgrade proration: ${change.new_plan_name}`, changeId],
        );
        await client.query(
          `UPDATE plan_changes SET status='applied', ledger_entry_id=$1 WHERE id=$2`,
          [le.id, changeId],
        );
      } else {
        await client.query(`UPDATE plan_changes SET status='applied' WHERE id=$1`, [changeId]);
      }

      await client.query("COMMIT");
    } catch (txErr) {
      await client.query("ROLLBACK").catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }

    sendPushToUser(change.account_id, {
      title: change.change_type === "upgrade" ? "Plan Upgraded" : "Plan Change Applied",
      body: `Your plan has been updated to ${change.new_plan_name}.`,
      url: "/account/subscription",
    }).catch(() => {});

    emitBillingEvent({
      type: change.change_type === "upgrade" ? "plan_upgraded" : "plan_downgraded",
      entityId: changeId,
      entityType: "plan_change",
      userId: change.user_id,
      payload: { applied_by: adminId, proration: change.proration_amount },
    });

    res.json({ success: true, message: "Plan change applied and ledger updated." });
  } catch (err) {
    await logError(err, { route: `POST /api/plan-change/admin/apply/${req.params.id}` });
    res.status(500).json({ error: "Failed" });
  }
});
