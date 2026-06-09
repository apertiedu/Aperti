import { Router, Request, Response } from "express";
import { pool } from "@workspace/db";
import { requireRole } from "../middleware/auth";

export const adminAiUsageRouter = Router();
adminAiUsageRouter.use(requireRole("admin", "super_admin"));

const COST_PER_1K_TOKENS = 0.002;

adminAiUsageRouter.get("/summary", async (_req: Request, res: Response) => {
  try {
    const [dailyRows, roleRows, typeRows, totalRows] = await Promise.all([
      pool.query(`
        SELECT date_trunc('day', created_at)::text as day,
               COUNT(*)::int as calls,
               SUM(COALESCE(tokens_used, 0))::int as tokens
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
        SELECT interaction_type, COUNT(*)::int as calls, SUM(COALESCE(tokens_used, 0))::int as tokens
        FROM ai_interactions
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY interaction_type ORDER BY calls DESC LIMIT 10
      `).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT COUNT(*)::int as total_calls,
               SUM(COALESCE(tokens_used, 0))::int as total_tokens
        FROM ai_interactions
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `).catch(() => ({ rows: [{ total_calls: 0, total_tokens: 0 }] })),
    ]);

    const totalTokens = parseInt(totalRows.rows[0]?.total_tokens ?? 0);
    const estimatedCost = ((totalTokens / 1000) * COST_PER_1K_TOKENS).toFixed(4);

    res.json({
      daily: dailyRows.rows,
      byRole: roleRows.rows,
      byType: typeRows.rows,
      total: {
        calls: parseInt(totalRows.rows[0]?.total_calls ?? 0),
        tokens: totalTokens,
        estimatedCostUSD: parseFloat(estimatedCost),
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch AI usage" });
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
