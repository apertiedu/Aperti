import { Router } from "express";
import { requireRole } from "../middleware/auth";
import { pool } from "@workspace/db";

export const adminDbHealthRouter = Router();
adminDbHealthRouter.use(requireRole("admin", "super_admin"));

/* ── GET /api/admin/db-health ─────────────────────────────────────────────── */
adminDbHealthRouter.get("/", async (_req, res) => {
  try {
    const [sizeResult, tableStats, errorCount, slowQueries, connStats] = await Promise.all([
      pool.query(`SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size,
                         pg_database_size(current_database()) AS db_size_bytes`),

      pool.query(`
        SELECT
          schemaname,
          relname AS table_name,
          n_live_tup AS row_count,
          pg_size_pretty(pg_total_relation_size('"' || schemaname || '"."' || relname || '"')) AS total_size,
          pg_total_relation_size('"' || schemaname || '"."' || relname || '"') AS size_bytes,
          last_vacuum::text,
          last_autovacuum::text,
          last_analyze::text
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size('"' || schemaname || '"."' || relname || '"') DESC
        LIMIT 20
      `),

      pool.query(`SELECT COUNT(*)::int AS cnt FROM frontend_error_logs WHERE created_at >= NOW() - INTERVAL '24h'`)
        .catch(() => ({ rows: [{ cnt: 0 }] })),

      pool.query(`
        SELECT endpoint, method,
               ROUND(MAX(duration_ms)) AS max_ms,
               ROUND(AVG(duration_ms)) AS avg_ms,
               COUNT(*) AS count
        FROM api_metrics
        WHERE duration_ms > 500 AND recorded_at >= NOW() - INTERVAL '24h'
        GROUP BY endpoint, method
        ORDER BY max_ms DESC
        LIMIT 10
      `).catch(() => ({ rows: [] })),

      pool.query(`SELECT count(*) AS total, count(*) FILTER (WHERE state='idle') AS idle,
                         count(*) FILTER (WHERE state='active') AS active
                  FROM pg_stat_activity WHERE datname = current_database()`)
        .catch(() => ({ rows: [{ total: 0, idle: 0, active: 0 }] })),
    ]);

    // 7-day growth trend (row count snapshots not available, so use created_at of largest tables)
    const growthTrend = await pool.query(`
      SELECT date_trunc('day', created_at)::date AS day, COUNT(*)::int AS new_accounts
      FROM accounts
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY 1 ORDER BY 1
    `).catch(() => ({ rows: [] }));

    res.json({
      dbSize: sizeResult.rows[0]?.db_size ?? "unknown",
      dbSizeBytes: parseInt(sizeResult.rows[0]?.db_size_bytes ?? "0"),
      tables: tableStats.rows,
      errorCount24h: errorCount.rows[0]?.cnt ?? 0,
      slowQueries: slowQueries.rows,
      connections: connStats.rows[0],
      growthTrend: growthTrend.rows,
      checkedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ── POST /api/admin/db-health/vacuum ─────────────────────────────────────── */
adminDbHealthRouter.post("/vacuum", async (_req, res) => {
  try {
    // VACUUM ANALYZE is safe and non-destructive; runs in background
    await pool.query("VACUUM ANALYZE");
    res.json({ ok: true, message: "VACUUM ANALYZE completed successfully.", ranAt: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
