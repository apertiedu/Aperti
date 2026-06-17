import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth";
import { pool } from "@workspace/db";
import { accessGranted, isGracePeriod } from "../lib/subscription-fsm";

export async function getSubscriptionStatus(userId: number): Promise<{
  status: string;
  gracePeriodEndsAt: Date | null;
  endDate: Date | null;
  planType: string | null;
  adminOverride: boolean;
} | null> {
  try {
    const { rows } = await pool.query(
      `SELECT s.status, s.grace_period_ends_at, s.end_date, sp.type AS plan_type,
              COALESCE((s.fraud_flags::text) = '[]', TRUE) AS clean
       FROM subscriptions s
       LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
       WHERE s.account_id = $1
       ORDER BY s.created_at DESC LIMIT 1`,
      [userId],
    );
    if (rows.length === 0) return null;
    return {
      status: rows[0].status,
      gracePeriodEndsAt: rows[0].grace_period_ends_at ?? null,
      endDate: rows[0].end_date ?? null,
      planType: rows[0].plan_type ?? null,
      adminOverride: false,
    };
  } catch {
    return null;
  }
}

export function requireActiveSubscription(opts: { allowGrace?: boolean } = {}) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required", code: "AUTH_REQUIRED" });
      return;
    }

    const adminRoles = ["admin", "super_admin"];
    if (req.role && adminRoles.includes(req.role)) {
      next();
      return;
    }

    const sub = await getSubscriptionStatus(userId);

    if (!sub) {
      res.status(403).json({
        error: "An active subscription is required to access this feature.",
        code: "NO_SUBSCRIPTION",
        action: "upgrade",
        upgradeUrl: "/pricing",
      });
      return;
    }

    const status = sub.status as Parameters<typeof accessGranted>[0];

    if (!accessGranted(status)) {
      res.status(403).json({
        error: `Your subscription is currently ${sub.status}. Please renew to continue.`,
        code: "SUBSCRIPTION_INACTIVE",
        current_status: sub.status,
        action: sub.status === "expired" || sub.status === "inactive" ? "renew" : "contact_support",
        upgradeUrl: "/pricing",
      });
      return;
    }

    if (isGracePeriod(status)) {
      if (!opts.allowGrace) {
        res.status(403).json({
          error: "Your subscription is in grace period. Renew now to restore full access.",
          code: "GRACE_PERIOD",
          grace_period_ends_at: sub.gracePeriodEndsAt,
          action: "renew",
          upgradeUrl: "/pricing",
        });
        return;
      }
      (req as AuthRequest & { subscriptionGrace: boolean }).subscriptionGrace = true;
    }

    next();
  };
}
