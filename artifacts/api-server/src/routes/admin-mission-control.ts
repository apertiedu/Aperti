import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { requireRole, AuthRequest } from "../middleware/auth";

export const adminMissionControlRouter = Router();
adminMissionControlRouter.use(requireRole("admin", "super_admin") as any);

adminMissionControlRouter.get("/summary", async (_req, res: Response) => {
  try {
    const [totals, byLevel, topRoutes, trend] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour')::int AS last1h,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS last24h,
          COUNT(*) FILTER (WHERE level = 'critical' AND created_at > NOW() - INTERVAL '24 hours')::int AS critical24h,
          COUNT(*) FILTER (WHERE level = 'error' AND created_at > NOW() - INTERVAL '24 hours')::int AS error24h,
          COUNT(*) FILTER (WHERE level IN ('warn','warning') AND created_at > NOW() - INTERVAL '24 hours')::int AS warn24h
        FROM error_logs
      `),
      pool.query(`
        SELECT level, COUNT(*)::int AS count
        FROM error_logs
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY level ORDER BY count DESC
      `),
      pool.query(`
        SELECT route, COUNT(*)::int AS count
        FROM error_logs
        WHERE route IS NOT NULL AND route <> '' AND created_at > NOW() - INTERVAL '24 hours'
        GROUP BY route ORDER BY count DESC LIMIT 10
      `),
      pool.query(`
        SELECT date_trunc('hour', created_at)::text AS hour, COUNT(*)::int AS count
        FROM error_logs
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY 1 ORDER BY 1
      `),
    ]);

    res.json({
      summary: totals.rows[0] ?? { total: 0, last1h: 0, last24h: 0, critical24h: 0, error24h: 0, warn24h: 0 },
      byLevel: byLevel.rows,
      topRoutes: topRoutes.rows,
      trend: trend.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminMissionControlRouter.get("/recent", async (req: AuthRequest, res: Response) => {
  const level = (req.query.level as string) || "all";
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;

  try {
    const levelFilter = level !== "all" ? `AND level = $3` : "";
    const params: (string | number)[] = [limit, offset];
    if (level !== "all") params.push(level);

    const { rows } = await pool.query(
      `SELECT id, level, message, route, user_id, role, device, browser, created_at,
              LEFT(stack, 500) AS stack_preview
       FROM error_logs
       WHERE 1=1 ${levelFilter}
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      params
    );
    res.json({ errors: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminMissionControlRouter.get("/failed-logins", async (_req, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT ip_address, COUNT(*)::int AS attempts, MAX(created_at) AS last_attempt
      FROM audit_logs
      WHERE action = 'login_failed' AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY ip_address ORDER BY attempts DESC LIMIT 20
    `).catch(() => ({ rows: [] }));
    res.json({ failedLogins: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
