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
 * GET /api/admin/db/table-stats
 * Returns seq-scan counts, live tuple counts, and bloat indicators from
 * pg_stat_user_tables — the primary signal for missing indexes.
 */
adminSlowQueriesRouter.get("/table-stats", async (_req, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        relname                                   AS table_name,
        n_live_tup                                AS live_rows,
        n_dead_tup                                AS dead_rows,
        ROUND(
          n_dead_tup::numeric
          / NULLIF(n_live_tup + n_dead_tup, 0) * 100, 1
        )                                         AS bloat_pct,
        seq_scan                                  AS seq_scans,
        seq_tup_read                              AS seq_tuples_read,
        idx_scan                                  AS index_scans,
        ROUND(
          idx_scan::numeric
          / NULLIF(seq_scan + idx_scan, 0) * 100, 1
        )                                         AS index_hit_pct,
        last_vacuum::text,
        last_autovacuum::text,
        last_analyze::text,
        pg_size_pretty(
          pg_total_relation_size('"public"."' || relname || '"')
        )                                         AS total_size
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY seq_scan DESC NULLS LAST
      LIMIT 30
    `);

    const seqScanAlerts = rows.filter((r: any) =>
      parseInt(r.seq_scans ?? "0") > 1000 &&
      parseFloat(r.index_hit_pct ?? "100") < 50
    );

    res.json({
      tables: rows,
      seqScanAlerts,
      alertCount: seqScanAlerts.length,
      note: "Tables with >1 000 seq_scans and <50% index hit rate need index review.",
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Failed to fetch table stats" });
  }
});

/**
 * GET /api/admin/db/index-usage
 * Surfaces potentially unused or redundant indexes.
 */
adminSlowQueriesRouter.get("/index-usage", async (_req, res: Response) => {
  try {
    const [unused, topUsed] = await Promise.all([
      pool.query(`
        SELECT
          schemaname,
          relname   AS table_name,
          indexrelname AS index_name,
          idx_scan  AS scans,
          pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
          AND idx_scan = 0
          AND indexrelname NOT LIKE '%_pkey'
        ORDER BY pg_relation_size(indexrelid) DESC
        LIMIT 20
      `),
      pool.query(`
        SELECT
          relname AS table_name,
          indexrelname AS index_name,
          idx_scan AS scans,
          pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        ORDER BY idx_scan DESC
        LIMIT 20
      `),
    ]);

    res.json({
      unusedIndexes: unused.rows,
      unusedCount: unused.rows.length,
      topUsedIndexes: topUsed.rows,
      note: "Unused indexes (0 scans, not PK) are candidates for removal after confirming write-only use cases.",
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Failed to fetch index usage" });
  }
});

/**
 * GET /api/admin/db/scalability-report
 * Full production scalability report: slow queries, table health, index coverage,
 * cache stats, and composite scores. Used to generate SCALABILITY_HARDENING_REPORT.
 */
adminSlowQueriesRouter.get("/scalability-report", async (_req, res: Response) => {
  try {
    const statAvailable = await pgStatStatementsAvailable();

    const [
      dbSize,
      tableStats,
      indexUsage,
      connStats,
      apiLatency,
      vacuumAge,
    ] = await Promise.all([
      pool.query(`
        SELECT
          pg_size_pretty(pg_database_size(current_database())) AS size_pretty,
          pg_database_size(current_database())                  AS size_bytes
      `),
      pool.query(`
        SELECT relname AS table_name, n_live_tup AS live_rows, n_dead_tup AS dead_rows,
               seq_scan, idx_scan,
               ROUND(idx_scan::numeric / NULLIF(seq_scan + idx_scan, 0) * 100, 1) AS index_hit_pct,
               last_analyze::text
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
        ORDER BY n_live_tup DESC LIMIT 15
      `),
      pool.query(`
        SELECT COUNT(*) FILTER (WHERE idx_scan = 0 AND indexrelname NOT LIKE '%_pkey') AS unused_indexes,
               COUNT(*) AS total_indexes
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
      `),
      pool.query(`
        SELECT count(*) AS total,
               count(*) FILTER (WHERE state = 'idle')   AS idle,
               count(*) FILTER (WHERE state = 'active') AS active
        FROM pg_stat_activity WHERE datname = current_database()
      `).catch(() => ({ rows: [{ total: 0, idle: 0, active: 0 }] })),
      pool.query(`
        SELECT
          ROUND(AVG(duration_ms))  AS avg_latency_ms,
          ROUND(MAX(duration_ms))  AS max_latency_ms,
          ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)) AS p95_latency_ms,
          COUNT(*)                 AS requests_24h,
          COUNT(*) FILTER (WHERE duration_ms > 500) AS slow_requests
        FROM api_metrics
        WHERE recorded_at >= NOW() - INTERVAL '24h'
      `).catch(() => ({ rows: [{}] })),
      pool.query(`
        SELECT relname AS table_name,
               EXTRACT(EPOCH FROM (NOW() - GREATEST(last_vacuum, last_autovacuum))) / 3600 AS hours_since_vacuum
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
        ORDER BY hours_since_vacuum DESC NULLS FIRST
        LIMIT 5
      `).catch(() => ({ rows: [] })),
    ]);

    const slowQueries = statAvailable
      ? await pool.query(`
          SELECT LEFT(query, 100) AS query_preview, calls,
                 ROUND(mean_exec_time::numeric, 2) AS mean_exec_ms,
                 ROUND(total_exec_time::numeric, 2) AS total_exec_ms,
                 ROUND(shared_blks_hit::numeric / NULLIF(shared_blks_hit + shared_blks_read, 0) * 100, 1) AS cache_hit_pct
          FROM pg_stat_statements
          WHERE query NOT LIKE '%pg_stat_statements%' AND calls > 3
          ORDER BY mean_exec_time DESC LIMIT 10
        `).catch(() => ({ rows: [] }))
      : { rows: [] };

    const latency = apiLatency.rows[0] ?? {};
    const idxRow  = indexUsage.rows[0] ?? {};
    const totalIdx = parseInt(idxRow.total_indexes ?? "0");
    const unusedIdx = parseInt(idxRow.unused_indexes ?? "0");
    const usedIdxPct = totalIdx > 0 ? Math.round(((totalIdx - unusedIdx) / totalIdx) * 100) : 100;

    const avgLatencyMs  = parseFloat(latency.avg_latency_ms ?? "0");
    const slowReqs      = parseInt(latency.slow_requests ?? "0");
    const totalReqs     = parseInt(latency.requests_24h ?? "1");
    const slowReqPct    = totalReqs > 0 ? Math.round((slowReqs / totalReqs) * 100) : 0;

    // Health Scores (0–100)
    const dbHealthScore = Math.max(0, Math.min(100, Math.round(
      usedIdxPct * 0.4 +
      (avgLatencyMs < 50 ? 100 : avgLatencyMs < 200 ? 75 : avgLatencyMs < 500 ? 50 : 25) * 0.3 +
      (1 - Math.min(slowReqPct / 20, 1)) * 100 * 0.3
    )));

    const scalabilityScore = Math.max(0, Math.min(100, Math.round(
      dbHealthScore * 0.5 +
      usedIdxPct * 0.3 +
      (statAvailable ? 100 : 60) * 0.1 +
      Math.min(100, (1 - unusedIdx / Math.max(totalIdx, 1)) * 100) * 0.1
    )));

    res.json({
      generatedAt: new Date().toISOString(),
      scores: {
        dbHealthScore,
        scalabilityScore,
        grade: scalabilityScore >= 90 ? "A" : scalabilityScore >= 80 ? "B" : scalabilityScore >= 70 ? "C" : "D",
      },
      database: {
        size: dbSize.rows[0]?.size_pretty ?? "unknown",
        sizeBytes: parseInt(dbSize.rows[0]?.size_bytes ?? "0"),
        connections: connStats.rows[0],
      },
      indexes: {
        total: totalIdx,
        unused: unusedIdx,
        usedPct: usedIdxPct,
      },
      apiLatency: {
        avgMs: avgLatencyMs,
        p95Ms: parseFloat(latency.p95_latency_ms ?? "0"),
        maxMs: parseFloat(latency.max_latency_ms ?? "0"),
        requests24h: totalReqs,
        slowRequestsPct: slowReqPct,
      },
      pgStatStatements: {
        available: statAvailable,
        topSlowQueries: slowQueries.rows,
      },
      tables: tableStats.rows,
      vacuumAge: vacuumAge.rows,
      hardening: {
        redisRateLimiting: "active (all limiters share Redis store when REDIS_URL set; in-process fallback otherwise)",
        sessionStorage: "Redis (connect-redis) → PostgreSQL fallback (connect-pg-simple)",
        gradebookQuery: "CTE + hashmap O(S+E+M) — not O(S×M)",
        vacuumSchedule: "nightly 04:00 UTC — 16 tables",
        indexCount: totalIdx,
        pgStatStatements: statAvailable ? "enabled" : "not available on this host",
        caching: "plans (10 min) / subjects (5 min) / students (30 s) / gradebook (20 s) / analytics (2 min)",
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Failed to generate scalability report" });
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
