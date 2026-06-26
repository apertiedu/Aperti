/**
 * Slow-query ranking & pg_stat_statements management — Aperti
 *
 * Endpoints:
 *   GET  /api/admin/db/slow-queries          — ranked slow query report
 *   GET  /api/admin/db/query-stats           — top-N by calls / mean time
 *   POST /api/admin/db/enable-stat-statements — enable pg_stat_statements extension
 *   POST /api/admin/db/reset-stat-statements  — reset accumulated statistics
 *   POST /api/admin/db/vacuum                 — run VACUUM ANALYZE on core tables
 */
import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { requireRole } from "../middleware/auth";

export const adminSlowQueriesRouter = Router();
adminSlowQueriesRouter.use(requireRole("admin", "super_admin"));

// ── Check whether pg_stat_statements is available ────────────────────────────
async function pgStatStatementsAvailable(): Promise<boolean> {
  try {
    await pool.query("SELECT 1 FROM pg_stat_statements LIMIT 1");
    return true;
  } catch {
    return false;
  }
}

/**
 * GET /api/admin/db/slow-queries
 * Returns the top slow queries ranked by mean execution time.
 * Requires pg_stat_statements to be enabled.
 */
adminSlowQueriesRouter.get("/slow-queries", async (_req, res: Response) => {
  try {
    const available = await pgStatStatementsAvailable();
    if (!available) {
      res.status(503).json({
        available: false,
        error: "pg_stat_statements is not enabled. POST /api/admin/db/enable-stat-statements first.",
      });
      return;
    }

    const { rows } = await pool.query(`
      SELECT
        LEFT(query, 120)                                    AS query_preview,
        calls,
        ROUND(total_exec_time::numeric, 2)                 AS total_exec_ms,
        ROUND(mean_exec_time::numeric, 2)                  AS mean_exec_ms,
        ROUND(max_exec_time::numeric, 2)                   AS max_exec_ms,
        ROUND(stddev_exec_time::numeric, 2)                AS stddev_exec_ms,
        rows                                               AS total_rows_returned,
        ROUND(shared_blks_hit::numeric
              / NULLIF(shared_blks_hit + shared_blks_read, 0) * 100, 1)
                                                           AS cache_hit_pct,
        shared_blks_read                                   AS disk_reads,
        temp_blks_written                                  AS temp_blocks_written
      FROM pg_stat_statements
      WHERE query NOT LIKE '%pg_stat_statements%'
        AND query NOT LIKE 'COMMIT%'
        AND query NOT LIKE 'BEGIN%'
        AND calls > 3
      ORDER BY mean_exec_time DESC
      LIMIT 25
    `);

    // Compute a simple "slowness rank score": mean_ms * log(calls+1)
    const ranked = rows.map((r: any, i: number) => ({
      rank: i + 1,
      ...r,
      slowness_score: Math.round(
        parseFloat(r.mean_exec_ms) * Math.log10(parseInt(r.calls) + 1)
      ),
    }));

    res.json({
      available: true,
      count: ranked.length,
      generatedAt: new Date().toISOString(),
      slowQueries: ranked,
      note: "Queries ranked by mean execution time. slowness_score = mean_ms × log10(calls+1).",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Failed to fetch slow queries" });
  }
});

/**
 * GET /api/admin/db/query-stats
 * Top queries by call volume and aggregate CPU time.
 */
adminSlowQueriesRouter.get("/query-stats", async (_req, res: Response) => {
  try {
    const available = await pgStatStatementsAvailable();
    if (!available) {
      res.json({ available: false, byTotalTime: [], byCalls: [] });
      return;
    }

    const [byTotalTime, byCalls] = await Promise.all([
      pool.query(`
        SELECT LEFT(query, 100) AS query_preview, calls,
               ROUND(total_exec_time::numeric, 2) AS total_exec_ms,
               ROUND(mean_exec_time::numeric, 2)  AS mean_exec_ms
        FROM pg_stat_statements
        WHERE query NOT LIKE '%pg_stat_statements%' AND calls > 5
        ORDER BY total_exec_time DESC LIMIT 10
      `),
      pool.query(`
        SELECT LEFT(query, 100) AS query_preview, calls,
               ROUND(mean_exec_time::numeric, 2) AS mean_exec_ms
        FROM pg_stat_statements
        WHERE query NOT LIKE '%pg_stat_statements%' AND calls > 5
        ORDER BY calls DESC LIMIT 10
      `),
    ]);

    res.json({
      available: true,
      byTotalTime: byTotalTime.rows,
      byCalls: byCalls.rows,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Failed to fetch query stats" });
  }
});

/**
 * POST /api/admin/db/enable-stat-statements
 * Enables pg_stat_statements extension (requires superuser in some setups).
 */
adminSlowQueriesRouter.post("/enable-stat-statements", async (_req, res: Response) => {
  try {
    await pool.query("CREATE EXTENSION IF NOT EXISTS pg_stat_statements");
    const available = await pgStatStatementsAvailable();
    res.json({
      ok: available,
      message: available
        ? "pg_stat_statements enabled. Stats will accumulate from now."
        : "Extension created but view not yet accessible — may need a DB restart or superuser grant.",
    });
  } catch (err: any) {
    res.status(500).json({
      error: err.message ?? "Failed to enable extension",
      hint: "pg_stat_statements requires a postgresql.conf entry: shared_preload_libraries = 'pg_stat_statements'. Contact your DBA or hosting provider.",
    });
  }
});

/**
 * POST /api/admin/db/reset-stat-statements
 * Resets accumulated statistics (useful after schema changes / index additions).
 */
adminSlowQueriesRouter.post("/reset-stat-statements", async (_req, res: Response) => {
  try {
    await pool.query("SELECT pg_stat_statements_reset()");
    res.json({ ok: true, message: "pg_stat_statements statistics reset.", resetAt: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Failed to reset stats" });
  }
});

/**
 * POST /api/admin/db/vacuum
 * Runs VACUUM ANALYZE on the core high-write tables.
 */
adminSlowQueriesRouter.post("/vacuum", async (_req, res: Response) => {
  const CORE_TABLES = [
    "attendance",
    "student_marks",
    "audit_logs",
    "api_metrics",
    "accounts",
    "subscriptions",
    "payment_transactions",
    "error_logs",
  ];

  const results: { table: string; ok: boolean; ms: number; error?: string }[] = [];

  for (const table of CORE_TABLES) {
    const t0 = Date.now();
    try {
      // VACUUM ANALYZE cannot run inside a transaction block — use pool.query directly
      await pool.query(`VACUUM ANALYZE ${table}`);
      results.push({ table, ok: true, ms: Date.now() - t0 });
    } catch (err: any) {
      results.push({ table, ok: false, ms: Date.now() - t0, error: err.message });
    }
  }

  const failed = results.filter(r => !r.ok);
  res.json({
    ok: failed.length === 0,
    message: failed.length === 0
      ? "VACUUM ANALYZE completed on all core tables."
      : `VACUUM ANALYZE completed with ${failed.length} error(s).`,
    results,
    ranAt: new Date().toISOString(),
  });
});
