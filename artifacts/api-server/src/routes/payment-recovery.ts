import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { logError } from "../lib/log-error";
import { emitBillingEvent } from "../lib/billing-event-bus";
import { transitionSubscription } from "../lib/subscription-fsm";
import { sendPushToUser } from "../lib/push";

export const paymentRecoveryRouter = Router();
paymentRecoveryRouter.use(authenticate);

/* ── POST /api/payment-recovery/schedule ───────────────────────────────── */
paymentRecoveryRouter.post("/schedule", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { subscriptionId, retryWindowHours = 48, maxAttempts = 3, notes } = req.body as {
      subscriptionId: number;
      retryWindowHours?: number;
      maxAttempts?: number;
      notes?: string;
    };
    if (!subscriptionId) { res.status(400).json({ error: "subscriptionId required" }); return; }

    const { rows: [sub] } = await pool.query(
      `SELECT id, account_id, status FROM subscriptions WHERE id = $1`,
      [subscriptionId],
    );
    if (!sub) { res.status(404).json({ error: "Subscription not found" }); return; }

    const { rows: [existing] } = await pool.query(
      `SELECT id FROM payment_recoveries WHERE subscription_id=$1 AND status IN ('retry_scheduled','pending') LIMIT 1`,
      [subscriptionId],
    );
    if (existing) {
      res.status(409).json({ error: "Recovery already scheduled for this subscription", existing_id: existing.id });
      return;
    }

    const nextRetry = new Date(Date.now() + 30 * 60 * 1000);
    const { rows: [recovery] } = await pool.query(
      `INSERT INTO payment_recoveries
         (subscription_id, user_id, status, attempts, max_attempts, next_retry_at, retry_window_hours, notes, created_at)
       VALUES ($1,$2,'retry_scheduled',0,$3,$4,$5,$6,NOW()) RETURNING *`,
      [subscriptionId, sub.account_id, maxAttempts, nextRetry.toISOString(), retryWindowHours, notes ?? null],
    );

    emitBillingEvent({
      type: "recovery_scheduled",
      entityId: recovery.id,
      entityType: "payment_recovery",
      userId: sub.account_id,
      payload: { subscription_id: subscriptionId, maxAttempts, retryWindowHours },
    });

    res.status(201).json({ recovery });
  } catch (err) {
    await logError(err, { route: "POST /api/payment-recovery/schedule" });
    res.status(500).json({ error: "Failed" });
  }
});

/* ── POST /api/payment-recovery/run-scheduled ──────────────────────────── */
paymentRecoveryRouter.post("/run-scheduled", requireRole("admin", "super_admin"), async (_req: AuthRequest, res: Response): Promise<void> => {
  const processed: number[] = [];
  const failed: number[] = [];
  const expired: number[] = [];

  try {
    const { rows: due } = await pool.query(
      `SELECT pr.*, s.status AS sub_status, s.account_id
       FROM payment_recoveries pr
       JOIN subscriptions s ON s.id = pr.subscription_id
       WHERE pr.status = 'retry_scheduled'
         AND pr.next_retry_at <= NOW()
         AND pr.attempts < pr.max_attempts
       FOR UPDATE SKIP LOCKED
       LIMIT 20`,
    );

    for (const recovery of due) {
      try {
        const retryDeadline = new Date(recovery.created_at.getTime() + recovery.retry_window_hours * 60 * 60 * 1000);
        if (Date.now() > retryDeadline.getTime() || recovery.attempts >= recovery.max_attempts) {
          await pool.query(
            `UPDATE payment_recoveries SET status='permanently_failed', resolved_at=NOW(), resolution='permanently_failed' WHERE id=$1`,
            [recovery.id],
          );
          await transitionSubscription({
            subscriptionId: recovery.subscription_id,
            to: "expired",
            reason: "Payment recovery exhausted — permanently failed",
            triggeredBy: "system",
          });
          emitBillingEvent({ type: "recovery_failed", entityId: recovery.id, entityType: "payment_recovery", userId: recovery.user_id });
          expired.push(recovery.id);
          continue;
        }

        const newAttempts = recovery.attempts + 1;
        const nextRetry = new Date(Date.now() + 8 * 60 * 60 * 1000);

        await pool.query(
          `UPDATE payment_recoveries SET
             attempts=$1, last_attempt_at=NOW(), next_retry_at=$2
           WHERE id=$3`,
          [newAttempts, nextRetry.toISOString(), recovery.id],
        );

        sendPushToUser(recovery.account_id, {
          title: "Payment Required",
          body: `Your subscription needs payment renewal. Attempt ${newAttempts} of ${recovery.max_attempts}. Please submit your Instapay code.`,
          url: "/account/subscription",
        }).catch(() => {});

        processed.push(recovery.id);
      } catch (itemErr) {
        failed.push(recovery.id);
        await logError(itemErr, { route: "payment-recovery/run-scheduled", recoveryId: recovery.id });
      }
    }

    res.json({ processed: processed.length, failed: failed.length, expired_permanently: expired.length, processed_ids: processed });
  } catch (err) {
    await logError(err, { route: "POST /api/payment-recovery/run-scheduled" });
    res.status(500).json({ error: "Failed" });
  }
});

/* ── POST /api/payment-recovery/admin/resolve/:id ──────────────────────── */
paymentRecoveryRouter.post("/admin/resolve/:id", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { resolution, notes } = req.body as { resolution: "recovered" | "permanently_failed" | "cancelled"; notes?: string };
    if (!["recovered", "permanently_failed", "cancelled"].includes(resolution)) {
      res.status(400).json({ error: "resolution must be: recovered | permanently_failed | cancelled" });
      return;
    }

    const { rows: [recovery] } = await pool.query(
      `UPDATE payment_recoveries SET status=$1, resolution=$1, resolved_at=NOW(), notes=COALESCE($2,notes)
       WHERE id=$3 RETURNING *`,
      [resolution, notes ?? null, id],
    );
    if (!recovery) { res.status(404).json({ error: "Not found" }); return; }

    emitBillingEvent({
      type: resolution === "recovered" ? "recovery_succeeded" : "recovery_failed",
      entityId: id,
      entityType: "payment_recovery",
      userId: recovery.user_id,
      payload: { resolution, admin_notes: notes },
    });

    res.json({ success: true, resolution });
  } catch (err) {
    await logError(err, { route: `POST /api/payment-recovery/admin/resolve/${req.params.id}` });
    res.status(500).json({ error: "Failed" });
  }
});

/* ── GET /api/payment-recovery/admin/all ───────────────────────────────── */
paymentRecoveryRouter.get("/admin/all", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.query as Record<string, string>;
    let q = `
      SELECT pr.*, a.display_name, a.username, a.email,
             s.status AS sub_status, sp.name AS plan_name
      FROM payment_recoveries pr
      JOIN accounts a ON a.id = pr.user_id
      LEFT JOIN subscriptions s ON s.id = pr.subscription_id
      LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
      WHERE 1=1`;
    const params: unknown[] = [];
    if (status) { q += ` AND pr.status = $1`; params.push(status); }
    q += ` ORDER BY pr.created_at DESC LIMIT 100`;
    const { rows } = await pool.query(q, params);

    const { rows: [counts] } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status='retry_scheduled')::int AS scheduled,
        COUNT(*) FILTER (WHERE status='recovered')::int       AS recovered,
        COUNT(*) FILTER (WHERE status='permanently_failed')::int AS permanently_failed,
        COUNT(*) FILTER (WHERE status='cancelled')::int       AS cancelled
      FROM payment_recoveries
    `);

    res.json({ recoveries: rows, counts: counts });
  } catch (err) {
    await logError(err, { route: "GET /api/payment-recovery/admin/all" });
    res.status(500).json({ error: "Failed" });
  }
});
