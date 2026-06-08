import { Router } from "express";
import { requireRole } from "../middleware/auth";
import { pool } from "@workspace/db";

export const performanceRouter = Router();
performanceRouter.use(requireRole("admin", "super_admin"));

// GET /api/admin/performance/metrics
performanceRouter.get("/metrics", async (_req, res) => {
  try {
    const [endpoints, slowQueries, errorRates, dailyStats] = await Promise.all([
      pool.query(`
        SELECT endpoint, method,
               COUNT(*) as request_count,
               ROUND(AVG(duration_ms)) as avg_ms,
               ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)) as p95_ms,
               ROUND(MAX(duration_ms)) as max_ms,
               SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) as error_count
        FROM api_metrics
        WHERE recorded_at > NOW() - INTERVAL '1 hour'
        GROUP BY endpoint, method
        ORDER BY avg_ms DESC
        LIMIT 20
      `).catch(() => ({ rows: [] })),

      pool.query(`
        SELECT endpoint, method, duration_ms, status_code, recorded_at
        FROM api_metrics
        WHERE duration_ms > 1000 AND recorded_at > NOW() - INTERVAL '1 hour'
        ORDER BY duration_ms DESC
        LIMIT 10
      `).catch(() => ({ rows: [] })),

      pool.query(`
        SELECT status_code, COUNT(*) as count
        FROM api_metrics
        WHERE recorded_at > NOW() - INTERVAL '1 hour'
        GROUP BY status_code
        ORDER BY status_code
      `).catch(() => ({ rows: [] })),

      pool.query(`
        SELECT
          date_trunc('minute', recorded_at) as minute,
          COUNT(*) as requests,
          ROUND(AVG(duration_ms)) as avg_ms,
          SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) as errors
        FROM api_metrics
        WHERE recorded_at > NOW() - INTERVAL '1 hour'
        GROUP BY 1
        ORDER BY 1 DESC
        LIMIT 60
      `).catch(() => ({ rows: [] })),
    ]);

    const totalRequests = dailyStats.rows.reduce((s: number, r: any) => s + parseInt(r.requests), 0);
    const totalErrors = dailyStats.rows.reduce((s: number, r: any) => s + parseInt(r.errors), 0);

    res.json({
      summary: {
        totalRequests,
        errorRate: totalRequests > 0 ? Math.round((totalErrors / totalRequests) * 100 * 10) / 10 : 0,
        avgResponseMs: endpoints.rows.length > 0
          ? Math.round(endpoints.rows.reduce((s: number, r: any) => s + parseFloat(r.avg_ms), 0) / endpoints.rows.length)
          : 0,
      },
      endpoints: endpoints.rows,
      slowRequests: slowQueries.rows,
      statusCodes: errorRates.rows,
      timeline: [...dailyStats.rows].reverse(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/performance/health-summary
performanceRouter.get("/health-summary", async (_req, res) => {
  try {
    const [uptime, dbSize, tableStats] = await Promise.all([
      pool.query("SELECT NOW() - pg_postmaster_start_time() AS uptime").catch(() => ({ rows: [{ uptime: "N/A" }] })),
      pool.query("SELECT pg_size_pretty(pg_database_size(current_database())) AS size").catch(() => ({ rows: [{ size: "N/A" }] })),
      pool.query(`
        SELECT relname AS table_name, n_live_tup AS row_count
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC LIMIT 10
      `).catch(() => ({ rows: [] })),
    ]);

    res.json({
      dbUptime: uptime.rows[0]?.uptime,
      dbSize: dbSize.rows[0]?.size,
      topTables: tableStats.rows,
      processUptime: Math.round(process.uptime()),
      memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
