import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { logError } from "../lib/log-error";
import { auditLog, getClientIp } from "../lib/financial-audit";

export const subscriptionLifecycleRouter = Router();

subscriptionLifecycleRouter.use(authenticate);

/* ── GET /api/subscriptions/lifecycle/status ────────────────────────────── */
subscriptionLifecycleRouter.get("/status", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*, sp.name AS plan_name, sp.price_egp, sp.features,
              EXTRACT(EPOCH FROM (s.end_date - NOW())) / 86400 AS days_remaining,
              s.auto_renew
       FROM subscriptions s
       LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
       WHERE s.account_id = $1
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [req.userId],
    );

    if (rows.length === 0) {
      res.json({ subscription: null, message: "No active subscription found" });
      return;
    }

    const sub = rows[0];
    const daysRemaining = parseFloat(sub.days_remaining ?? "0");
    const isExpired = sub.status === "expired" || daysRemaining < 0;
    const isExpiringSoon = daysRemaining >= 0 && daysRemaining <= (sub.grace_period_days ?? 3);

    res.json({
      subscription: {
        ...sub,
        days_remaining: Math.max(0, Math.round(daysRemaining)),
        is_expired: isExpired,
        is_expiring_soon: isExpiringSoon,
        renewal_required: isExpired || isExpiringSoon,
      },
    });
  } catch (err) {
    await logError(err, { route: "/api/subscriptions/lifecycle/status" });
    res.status(500).json({ error: "Failed to fetch subscription status" });
  }
});

/* ── PATCH /api/subscriptions/lifecycle/auto-renew ─────────────────────── */
subscriptionLifecycleRouter.patch("/auto-renew", async (req: AuthRequest, res: Response): Promise<void> => {
  const ip = getClientIp(req as unknown as { ip?: string; headers: Record<string, string | string[] | undefined> });
  try {
    const { enabled } = req.body as { enabled: boolean };
    if (typeof enabled !== "boolean") {
      res.status(400).json({ error: "enabled (boolean) is required" });
      return;
    }

    const { rows } = await pool.query(
      `UPDATE subscriptions SET auto_renew = $1
       WHERE account_id = $2 AND status = 'active'
       RETURNING id, auto_renew`,
      [enabled, req.userId],
    );

    if (rows.length === 0) {
      res.status(404).json({ error: "No active subscription found to update" });
      return;
    }

    auditLog({ actorId: req.userId!, actorRole: req.role!, action: enabled ? "ENABLE_AUTO_RENEW" : "DISABLE_AUTO_RENEW", targetId: rows[0].id, targetType: "subscription", ip, result: "success" });
    res.json({ success: true, auto_renew: enabled, subscription_id: rows[0].id });
  } catch (err) {
    await logError(err, { route: "/api/subscriptions/lifecycle/auto-renew" });
    res.status(500).json({ error: "Failed to update auto-renew preference" });
  }
});

/* ── POST /api/subscriptions/lifecycle/run-expiry-check (admin + cron) ─── */
subscriptionLifecycleRouter.post(
  "/run-expiry-check",
  requireRole("admin", "super_admin"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const ip = getClientIp(req as unknown as { ip?: string; headers: Record<string, string | string[] | undefined> });
    try {
      const result = await runExpiryCheck(req.userId!, ip);
      res.json(result);
    } catch (err) {
      await logError(err, { route: "/api/subscriptions/lifecycle/run-expiry-check" });
      res.status(500).json({ error: "Expiry check failed" });
    }
  },
);

export async function runExpiryCheck(actorId: number, ip: string = "system") {
  const now = new Date().toISOString();
  const expired: number[] = [];
  const renewalPending: number[] = [];
  const errors: string[] = [];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: toExpire } = await client.query(
      `SELECT s.*, sp.price_egp
       FROM subscriptions s
       LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
       WHERE s.status = 'active'
         AND s.end_date < NOW()
         AND s.end_date IS NOT NULL
       FOR UPDATE SKIP LOCKED`,
    );

    for (const sub of toExpire) {
      try {
        if (sub.auto_renew) {
          const { rows: existing } = await client.query(
            `SELECT id FROM payment_transactions
             WHERE subscription_id = $1 AND status = 'pending'
               AND created_at > NOW() - INTERVAL '7 days' LIMIT 1`,
            [sub.id],
          );

          if (existing.length === 0) {
            await client.query(
              `INSERT INTO payment_transactions
                 (user_id, subscription_id, amount, currency, method, status, purpose, created_at)
               VALUES ($1, $2, $3, 'EGP', 'instapay', 'pending', 'platform_subscription', NOW())`,
              [sub.account_id, sub.id, sub.price_egp ?? "0"],
            );
            await client.query(
              `UPDATE subscriptions SET status = 'pending_renewal', renewal_attempted_at = NOW() WHERE id = $1`,
              [sub.id],
            );
            renewalPending.push(sub.id);
            auditLog({ actorId, actorRole: "system", action: "RENEWAL_PENDING_CREATED", targetId: sub.id, targetType: "subscription", ip, result: "success" });
          }
        } else {
          await client.query(
            `UPDATE subscriptions SET status = 'expired' WHERE id = $1`,
            [sub.id],
          );
          expired.push(sub.id);
          auditLog({ actorId, actorRole: "system", action: "SUBSCRIPTION_EXPIRED", targetId: sub.id, targetType: "subscription", ip, result: "success" });
        }
      } catch (subErr) {
        errors.push(`sub ${sub.id}: ${(subErr as Error)?.message}`);
      }
    }

    const { rows: pastGrace } = await client.query(
      `SELECT id FROM subscriptions
       WHERE status = 'pending_renewal'
         AND renewal_attempted_at < NOW() - INTERVAL '7 days'
       FOR UPDATE SKIP LOCKED`,
    );

    for (const sub of pastGrace) {
      try {
        await client.query(`UPDATE subscriptions SET status = 'expired' WHERE id = $1`, [sub.id]);
        expired.push(sub.id);
        auditLog({ actorId, actorRole: "system", action: "SUBSCRIPTION_EXPIRED_GRACE", targetId: sub.id, targetType: "subscription", ip, result: "success" });
      } catch (subErr) {
        errors.push(`grace_expire ${sub.id}: ${(subErr as Error)?.message}`);
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  return {
    run_at: now,
    expired_count: expired.length,
    renewal_pending_count: renewalPending.length,
    error_count: errors.length,
    expired_ids: expired,
    renewal_pending_ids: renewalPending,
    errors,
  };
}

/* ── POST /api/subscriptions/lifecycle/restore ──────────────────────────── */
subscriptionLifecycleRouter.post(
  "/restore/:id",
  requireRole("admin", "super_admin"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const ip = getClientIp(req as unknown as { ip?: string; headers: Record<string, string | string[] | undefined> });
    try {
      const id = parseInt(req.params.id);
      const { rows } = await pool.query("SELECT * FROM subscriptions WHERE id = $1 LIMIT 1", [id]);
      if (rows.length === 0) { res.status(404).json({ error: "Subscription not found" }); return; }

      const { new_end_date } = req.body as { new_end_date?: string };
      const endDate = new_end_date ? new Date(new_end_date) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await pool.query(
        `UPDATE subscriptions SET status = 'active', end_date = $1, renewal_attempted_at = NULL WHERE id = $2`,
        [endDate, id],
      );

      auditLog({ actorId: req.userId!, actorRole: req.role!, action: "SUBSCRIPTION_RESTORED", targetId: id, targetType: "subscription", ip, result: "success", metadata: { new_end_date: endDate } });
      res.json({ success: true, subscription_id: id, new_end_date: endDate });
    } catch (err) {
      await logError(err, { route: `/api/subscriptions/lifecycle/restore/${req.params.id}` });
      res.status(500).json({ error: "Failed to restore subscription" });
    }
  },
);

/* ── GET /api/subscriptions/lifecycle/overview (admin) ─────────────────── */
subscriptionLifecycleRouter.get(
  "/overview",
  requireRole("admin", "super_admin"),
  async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'active')::int AS active,
          COUNT(*) FILTER (WHERE status = 'expired')::int AS expired,
          COUNT(*) FILTER (WHERE status = 'pending_renewal')::int AS pending_renewal,
          COUNT(*) FILTER (WHERE status = 'trial')::int AS trial,
          COUNT(*) FILTER (WHERE auto_renew = TRUE AND status = 'active')::int AS auto_renew_enabled,
          COUNT(*) FILTER (WHERE end_date < NOW() + INTERVAL '7 days' AND end_date > NOW() AND status = 'active')::int AS expiring_soon
        FROM subscriptions
      `);
      res.json({ overview: rows[0] });
    } catch (err) {
      await logError(err, { route: "/api/subscriptions/lifecycle/overview" });
      res.status(500).json({ error: "Failed to fetch lifecycle overview" });
    }
  },
);
