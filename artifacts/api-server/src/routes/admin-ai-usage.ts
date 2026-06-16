import { Router, Request, Response } from "express";
import { pool } from "@workspace/db";
import { requireRole } from "../middleware/auth";
import { AI_AVAILABLE } from "../services/ai";

export const adminAiUsageRouter = Router();
adminAiUsageRouter.use(requireRole("admin", "super_admin"));

const COST_PER_1K_TOKENS = 0.002;

adminAiUsageRouter.get("/summary", async (_req: Request, res: Response) => {
  try {
    const [dailyRows, roleRows, typeRows, totalRows, reliabilityRows, overrideRows] = await Promise.all([
      pool.query(`
        SELECT date_trunc('day', created_at)::text as day,
               COUNT(*)::int as calls,
               SUM(COALESCE(tokens_used, 0))::int as tokens,
               COUNT(CASE WHEN status = 'error' THEN 1 END)::int as failures
        FROM ai_interactions
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY 1 ORDER BY 1
      `).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT a.role, COUNT(*)::int as calls, SUM(COALESCE(ai.tokens_used, 0))::int as tokens
        FROM ai_interactions ai
        LEFT JOIN accounts a ON ai.account_id = a.id
        WHERE ai.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY a.role ORDER BY calls DESC
      `).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT COALESCE(interaction_type, module, 'unknown') as feature,
               COUNT(*)::int as calls,
               SUM(COALESCE(tokens_used, 0))::int as tokens,
               COUNT(CASE WHEN status = 'error' THEN 1 END)::int as failures,
               ROUND(AVG(latency_ms)::numeric, 0)::int as avg_latency_ms
        FROM ai_interactions
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY 1 ORDER BY calls DESC LIMIT 12
      `).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT COUNT(*)::int as total_calls,
               SUM(COALESCE(tokens_used, 0))::int as total_tokens,
               COUNT(CASE WHEN status = 'error' THEN 1 END)::int as total_failures,
               ROUND(AVG(CASE WHEN latency_ms > 0 THEN latency_ms END)::numeric, 0)::int as avg_latency_ms,
               SUM(COALESCE(estimated_cost_usd, 0))::numeric(12,6) as total_cost_usd
        FROM ai_interactions
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `).catch(() => ({ rows: [{ total_calls: 0, total_tokens: 0, total_failures: 0, avg_latency_ms: 0, total_cost_usd: 0 }] })),
      pool.query(`
        SELECT
          COUNT(*)::int as total_calls,
          COUNT(CASE WHEN status = 'error' THEN 1 END)::int as failures,
          ROUND(
            (COUNT(CASE WHEN status != 'error' THEN 1 END)::numeric / NULLIF(COUNT(*), 0)) * 100,
            1
          ) AS success_rate_pct,
          ROUND(AVG(latency_ms)::numeric, 0)::int as avg_latency_ms,
          ROUND(AVG(CASE WHEN latency_ms > 3000 THEN 1.0 ELSE 0.0 END) * 100, 1) AS slow_rate_pct
        FROM ai_interactions
        WHERE created_at >= NOW() - INTERVAL '7 days'
      `).catch(() => ({ rows: [{}] })),
      pool.query(`
        SELECT
          COUNT(*)::int AS total_reviews,
          COUNT(CASE WHEN decision='approved' THEN 1 END)::int AS approved,
          COUNT(CASE WHEN decision='modified' THEN 1 END)::int AS modified,
          COUNT(CASE WHEN decision='rejected' THEN 1 END)::int AS rejected,
          ROUND(
            COUNT(CASE WHEN decision='approved' THEN 1 END)::numeric / NULLIF(COUNT(*),0) * 100,
            1
          ) AS approval_rate_pct,
          ROUND(AVG(original_ai_confidence)::numeric, 3) AS avg_ai_confidence
        FROM ai_grade_reviews
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `).catch(() => ({ rows: [{}] })),
    ]);

    const totalTokens = parseInt(totalRows.rows[0]?.total_tokens ?? 0);
    const totalCalls = parseInt(totalRows.rows[0]?.total_calls ?? 0);
    const totalFailures = parseInt(totalRows.rows[0]?.total_failures ?? 0);
    const successRate = totalCalls > 0
      ? parseFloat(((totalCalls - totalFailures) / totalCalls * 100).toFixed(1))
      : 100;

    res.json({
      daily: dailyRows.rows,
      byRole: roleRows.rows,
      byFeature: typeRows.rows,
      total: {
        calls: totalCalls,
        tokens: totalTokens,
        failures: totalFailures,
        successRate,
        avgLatencyMs: parseInt(totalRows.rows[0]?.avg_latency_ms ?? 0),
        estimatedCostUSD: parseFloat(totalRows.rows[0]?.total_cost_usd ?? 0),
      },
      reliability7d: reliabilityRows.rows[0] ?? {},
      teacherOverrides: overrideRows.rows[0] ?? {},
      aiAvailable: AI_AVAILABLE,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch AI usage" });
  }
});

adminAiUsageRouter.get("/health", async (_req: Request, res: Response) => {
  try {
    const [last24h, pendingReview] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)::int AS calls,
          COUNT(CASE WHEN status = 'error' THEN 1 END)::int AS failures,
          ROUND(AVG(latency_ms)::numeric, 0)::int AS avg_latency_ms,
          MAX(created_at) AS last_call_at
        FROM ai_interactions
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      `).catch(() => ({ rows: [{}] })),
      pool.query(`
        SELECT COUNT(*)::int AS count
        FROM snapgrade_submissions
        WHERE (teacher_reviewed IS FALSE OR teacher_reviewed IS NULL)
          AND grade IS NOT NULL
          AND submitted_at >= NOW() - INTERVAL '7 days'
      `).catch(() => ({ rows: [{ count: 0 }] })),
    ]);

    const calls = parseInt(last24h.rows[0]?.calls ?? 0);
    const failures = parseInt(last24h.rows[0]?.failures ?? 0);
    const successRate = calls > 0 ? ((calls - failures) / calls) * 100 : 100;
    const avgLatency = parseInt(last24h.rows[0]?.avg_latency_ms ?? 0);

    let status: "healthy" | "degraded" | "down" = "healthy";
    if (!AI_AVAILABLE) status = "down";
    else if (successRate < 80 || avgLatency > 5000) status = "degraded";
    else if (successRate < 95) status = "degraded";

    res.json({
      status,
      aiAvailable: AI_AVAILABLE,
      last24h: {
        calls,
        failures,
        successRate: parseFloat(successRate.toFixed(1)),
        avgLatencyMs: avgLatency,
        lastCallAt: last24h.rows[0]?.last_call_at ?? null,
      },
      pendingReviews: parseInt(pendingReview.rows[0]?.count ?? 0),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch AI health" });
  }
});

adminAiUsageRouter.get("/threshold", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT value FROM platform_settings WHERE key = 'ai_daily_cost_threshold'`
    ).catch(() => ({ rows: [] }));
    res.json({ threshold: rows[0]?.value ?? "10.00" });
  } catch {
    res.json({ threshold: "10.00" });
  }
});

adminAiUsageRouter.put("/threshold", async (req: Request, res: Response) => {
  try {
    const { threshold } = req.body;
    await pool.query(
      `INSERT INTO platform_settings (key, value) VALUES ('ai_daily_cost_threshold', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1`,
      [String(parseFloat(threshold) || 10)]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update threshold" });
  }
});

adminAiUsageRouter.get("/pending-reviews", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT ss.id, ss.student_id, ss.grade, ss.ai_confidence, ss.ai_source,
             ss.submitted_at, s.student_name, s.student_code, h.title AS homework_title
      FROM snapgrade_submissions ss
      LEFT JOIN students s ON s.id = ss.student_id
      LEFT JOIN homework h ON h.id = ss.homework_id
      WHERE (ss.teacher_reviewed IS FALSE OR ss.teacher_reviewed IS NULL)
        AND ss.grade IS NOT NULL
        AND ss.submitted_at >= NOW() - INTERVAL '7 days'
      ORDER BY ss.ai_confidence ASC NULLS FIRST, ss.submitted_at DESC
      LIMIT 20
    `).catch(() => ({ rows: [] }));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch pending reviews" });
  }
});
