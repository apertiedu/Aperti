import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { requireRole, AuthRequest } from "../middleware/auth";

export const errorIntelligenceRouter = Router();
errorIntelligenceRouter.use(requireRole("admin", "super_admin") as any);

/* GET /api/admin/error-intelligence/summary */
errorIntelligenceRouter.get("/summary", async (_req, res: Response) => {
  try {
    const [errors, failedLogins, recentErrors, topRoutes, topComponents] = await Promise.all([
      pool.query(`
        SELECT COUNT(*) as total,
               COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as last24h,
               COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 hour' THEN 1 END) as last1h
        FROM frontend_error_logs
      `).catch(() => ({ rows: [{ total: 0, last24h: 0, last1h: 0 }] })),

      pool.query(`
        SELECT COUNT(*) as total,
               COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as last24h
        FROM audit_logs
        WHERE action = 'login_failed'
      `).catch(() => ({ rows: [{ total: 0, last24h: 0 }] })),

      pool.query(`
        SELECT id, user_id, user_role, error_message, route, browser_info, created_at
        FROM frontend_error_logs
        ORDER BY created_at DESC
        LIMIT 20
      `).catch(() => ({ rows: [] })),

      pool.query(`
        SELECT route, COUNT(*) as count
        FROM frontend_error_logs
        WHERE route IS NOT NULL
        GROUP BY route
        ORDER BY count DESC
        LIMIT 10
      `).catch(() => ({ rows: [] })),

      pool.query(`
        SELECT component_stack, COUNT(*) as count
        FROM frontend_error_logs
        WHERE component_stack IS NOT NULL AND component_stack != ''
        GROUP BY component_stack
        ORDER BY count DESC
        LIMIT 10
      `).catch(() => ({ rows: [] })),
    ]);

    res.json({
      summary: {
        totalErrors: parseInt(errors.rows[0].total) || 0,
        last24h: parseInt(errors.rows[0].last24h) || 0,
        last1h: parseInt(errors.rows[0].last1h) || 0,
        failedLoginsTotal: parseInt(failedLogins.rows[0].total) || 0,
        failedLogins24h: parseInt(failedLogins.rows[0].last24h) || 0,
      },
      recentErrors: recentErrors.rows,
      topRoutes: topRoutes.rows,
      topComponents: topComponents.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

/* GET /api/admin/error-intelligence/failed-logins */
errorIntelligenceRouter.get("/failed-logins", async (_req, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        ip_address,
        COUNT(*) as attempts,
        MAX(created_at) as last_attempt,
        array_agg(DISTINCT details->>'identifier') FILTER (WHERE details->>'identifier' IS NOT NULL) as identifiers
      FROM audit_logs
      WHERE action = 'login_failed'
        AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY ip_address
      ORDER BY attempts DESC
      LIMIT 50
    `).catch(() => ({ rows: [] }));

    res.json({ failedLogins: rows });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

/* GET /api/admin/error-intelligence/route-errors */
errorIntelligenceRouter.get("/route-errors", async (_req, res: Response) => {
  try {
    const { rows: errorRows } = await pool.query(`
      SELECT
        route,
        COUNT(*) as errors,
        COUNT(DISTINCT user_id) as affected_users,
        MAX(created_at) as last_seen,
        array_agg(DISTINCT error_message ORDER BY error_message) FILTER (WHERE error_message IS NOT NULL) as messages
      FROM frontend_error_logs
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY route
      ORDER BY errors DESC
      LIMIT 20
    `).catch(() => ({ rows: [] }));

    res.json({ routeErrors: errorRows });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

/* GET /api/admin/error-intelligence/trends */
errorIntelligenceRouter.get("/trends", async (_req, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        date_trunc('hour', created_at) as hour,
        COUNT(*) as errors
      FROM frontend_error_logs
      WHERE created_at > NOW() - INTERVAL '48 hours'
      GROUP BY hour
      ORDER BY hour ASC
    `).catch(() => ({ rows: [] }));

    res.json({ trends: rows });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

/* POST /api/admin/error-intelligence/run-route-test */
errorIntelligenceRouter.post("/run-route-test", async (req: AuthRequest, res: Response) => {
  const testRoutes = [
    { path: "/api/health", method: "GET", role: "public" },
    { path: "/api/landing/stats", method: "GET", role: "public" },
    { path: "/api/dashboard", method: "GET", role: "admin" },
    { path: "/api/admin/health", method: "GET", role: "admin" },
    { path: "/api/courses", method: "GET", role: "public" },
    { path: "/question-bank", method: "GET", role: "teacher" },
    { path: "/api/questions/extract", method: "GET", role: "teacher" },
    { path: "/api/founder/metrics", method: "GET", role: "admin" },
  ];

  const results = await Promise.all(testRoutes.map(async (route) => {
    const start = Date.now();
    try {
      const baseUrl = `http://localhost:${process.env.PORT || 3001}`;
      const headers: Record<string, string> = {};
      if (route.role !== "public" && req.headers.authorization) {
        headers["Authorization"] = req.headers.authorization as string;
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const fetchRes = await fetch(`${baseUrl}${route.path}`, {
        method: route.method,
        headers,
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));
      const latencyMs = Date.now() - start;
      return {
        path: route.path,
        method: route.method,
        status: fetchRes.status,
        latencyMs,
        ok: fetchRes.status < 400,
        role: route.role,
      };
    } catch (err: any) {
      return {
        path: route.path,
        method: route.method,
        status: 0,
        latencyMs: Date.now() - start,
        ok: false,
        error: err.name === "AbortError" ? "timeout" : err.message,
        role: route.role,
      };
    }
  }));

  const summary = {
    total: results.length,
    passed: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    avgLatencyMs: Math.round(results.reduce((s, r) => s + r.latencyMs, 0) / results.length),
    ranAt: new Date().toISOString(),
  };

  res.json({ results, summary });
});
