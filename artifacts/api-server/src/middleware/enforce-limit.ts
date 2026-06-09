import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth";
import { pool } from "@workspace/db";

const PLAN_DEFAULTS: Record<string, Record<string, number>> = {
  free: { courses: 2, students: 30, questions: 100, assessments: 5, revision_packs: 3, flashcard_sets: 10, storage_gb: 1 },
  essential: { courses: 5, students: 100, questions: 500, assessments: 20, revision_packs: 15, flashcard_sets: 50, storage_gb: 5 },
  plus: { courses: 15, students: 300, questions: 2000, assessments: 60, revision_packs: 50, flashcard_sets: 200, storage_gb: 20 },
  pro: { courses: 50, students: 1000, questions: 10000, assessments: 200, revision_packs: 200, flashcard_sets: 1000, storage_gb: 50 },
  elite: { courses: 999, students: 9999, questions: 99999, assessments: 999, revision_packs: 999, flashcard_sets: 9999, storage_gb: 200 },
};

export async function getUserLimits(userId: number): Promise<{ limits: Record<string, number>; planName: string }> {
  try {
    const res = await pool.query(
      `SELECT sp.name, sp.limits
       FROM subscriptions s
       JOIN subscription_plans sp ON sp.id = s.plan_id
       WHERE s.account_id = $1 AND s.status IN ('active','trial')
       ORDER BY s.created_at DESC LIMIT 1`,
      [userId],
    );
    if (res.rows.length > 0) {
      const row = res.rows[0];
      const planLimits = typeof row.limits === "object" ? row.limits : {};
      const planName = (row.name || "free").toLowerCase();
      const defaults = PLAN_DEFAULTS[planName] ?? PLAN_DEFAULTS.free;
      return { limits: { ...defaults, ...planLimits }, planName };
    }
  } catch {}
  return { limits: PLAN_DEFAULTS.free, planName: "free" };
}

export async function getUserUsage(userId: number, resource: string): Promise<number> {
  try {
    const res = await pool.query(
      `SELECT current_count FROM usage_tracking WHERE user_id = $1 AND resource = $2`,
      [userId, resource],
    );
    return res.rows[0]?.current_count ?? 0;
  } catch {
    return 0;
  }
}

export async function incrementUsage(userId: number, resource: string, delta = 1): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO usage_tracking (user_id, resource, current_count, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, resource) DO UPDATE
       SET current_count = usage_tracking.current_count + $3, updated_at = NOW()`,
      [userId, resource, delta],
    );
  } catch {}
}

export async function decrementUsage(userId: number, resource: string, delta = 1): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO usage_tracking (user_id, resource, current_count, updated_at)
       VALUES ($1, $2, GREATEST(0, -$3), NOW())
       ON CONFLICT (user_id, resource) DO UPDATE
       SET current_count = GREATEST(0, usage_tracking.current_count - $3), updated_at = NOW()`,
      [userId, resource, delta],
    );
  } catch {}
}

export function enforceLimit(resource: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.userId;
    if (!userId) { next(); return; }

    try {
      const { limits, planName } = await getUserLimits(userId);
      const limit = limits[resource];
      if (limit === undefined) { next(); return; }

      const current = await getUserUsage(userId, resource);
      if (current >= limit) {
        res.status(403).json({
          error: `You have reached your ${resource.replace(/_/g, " ")} limit on the ${planName} plan. Please upgrade to continue.`,
          resource,
          limit,
          current,
          upgradeUrl: "/pricing",
          code: "LIMIT_EXCEEDED",
        });
        return;
      }
    } catch {
      // Don't block on enforcement errors
    }
    next();
  };
}
