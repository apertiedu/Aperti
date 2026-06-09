import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, AuthRequest, requireRole } from "../middleware/auth";

export const contentQualityRouter = Router();
contentQualityRouter.use(authenticate as any);
contentQualityRouter.use(requireRole("admin", "super_admin") as any);

/* ── List all content quality scores ─────────────────────────────────────── */
contentQualityRouter.get("/scores", async (req: AuthRequest, res: Response) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const offset = (page - 1) * limit;
    const type = req.query.type as string | undefined;

    const where = type ? `WHERE content_type=$3` : "";
    const params: any[] = type ? [limit, offset, type] : [limit, offset];

    const { rows } = await pool.query(
      `SELECT * FROM content_quality_scores ${where}
       ORDER BY quality_score DESC, usage_count DESC LIMIT $1 OFFSET $2`, params
    );
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) AS total FROM content_quality_scores ${type ? "WHERE content_type=$1" : ""}`,
      type ? [type] : []
    );

    res.json({ scores: rows, total: parseInt(countRows[0]?.total || 0), page, limit });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Trigger quality recalculation ───────────────────────────────────────── */
contentQualityRouter.post("/refresh", async (_req: AuthRequest, res: Response) => {
  res.json({ ok: true, message: "Quality scan triggered" });

  // Run async after response
  setImmediate(async () => {
    try {
      // Questions
      const { rows: qs } = await pool.query(`SELECT id FROM question_bank LIMIT 500`).catch(() => ({ rows: [] as any[] }));
      for (const q of qs) {
        const { rows: usage } = await pool.query(
          `SELECT COUNT(*) AS cnt FROM exam_submissions es
           WHERE es.answers::text ILIKE '%"question_id":' || $1 || '%'`, [q.id]
        ).catch(() => ({ rows: [{ cnt: 0 }] }));
        const usageCount = parseInt(usage[0]?.cnt ?? 0);
        const qualityScore = Math.min(100, 50 + usageCount * 2 + Math.random() * 20);
        await pool.query(
          `INSERT INTO content_quality_scores (content_type, content_id, quality_score, usage_count, reviewed_at)
           VALUES ('question', $1, $2, $3, NOW())
           ON CONFLICT (content_type, content_id) DO UPDATE
           SET quality_score=$2, usage_count=$3, reviewed_at=NOW()`,
          [q.id, qualityScore.toFixed(2), usageCount]
        ).catch(() => {});
      }
      console.log("[content-quality] Refresh complete");
    } catch (e) {
      console.error("[content-quality] Refresh error:", e);
    }
  });
});

/* ── Question moderation ──────────────────────────────────────────────────── */
contentQualityRouter.put("/questions/:id/moderate", async (req: AuthRequest, res: Response) => {
  try {
    const { status, notes } = req.body;
    const validStatuses = ["approved", "rejected", "flagged", "pending"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const { rows } = await pool.query(
      `UPDATE question_bank
       SET moderation_status=$1, moderated_by=$2, moderated_at=NOW()
       WHERE id=$3
       RETURNING id, topic, moderation_status, moderated_at`,
      [status, req.userId, req.params.id]
    );

    if (rows.length === 0) return res.status(404).json({ error: "Question not found" });

    // Log to content quality if notes provided
    if (notes) {
      await pool.query(
        `INSERT INTO content_quality_scores (content_type, content_id, quality_score, reviewed_at)
         VALUES ('question', $1, $2, NOW())
         ON CONFLICT (content_type, content_id) DO UPDATE SET reviewed_at=NOW()`,
        [req.params.id, status === "approved" ? 75 : status === "rejected" ? 20 : 50]
      ).catch(() => {});
    }

    res.json({ ok: true, question: rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ── AI Cost Settings ─────────────────────────────────────────────────────── */
export const aiCostsRouter = Router();
aiCostsRouter.use(authenticate as any);
aiCostsRouter.use(requireRole("admin", "super_admin") as any);

aiCostsRouter.get("/costs", async (_req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS day,
        interaction_type,
        COUNT(*) AS calls,
        SUM(tokens_used) AS tokens,
        ROUND((SUM(tokens_used) / 1000.0 * 0.002)::numeric, 4) AS cost_usd
      FROM ai_interactions
      WHERE created_at >= NOW()-INTERVAL '30 days'
      GROUP BY 1, 2 ORDER BY 1 DESC, calls DESC`
    ).catch(() => ({ rows: [] }));

    const totalTokens = rows.reduce((s: number, r: any) => s + parseInt(r.tokens || 0), 0);
    const totalCost   = rows.reduce((s: number, r: any) => s + parseFloat(r.cost_usd || 0), 0);

    res.json({ breakdown: rows, totals: { tokens: totalTokens, costUSD: totalCost.toFixed(4) } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

aiCostsRouter.put("/settings", async (req: AuthRequest, res: Response) => {
  try {
    const { monthlyBudgetCap, enabledRoles, rateLimits } = req.body;
    const updates: Promise<any>[] = [];

    if (monthlyBudgetCap !== undefined) {
      updates.push(
        pool.query(
          `INSERT INTO platform_settings (key, value, updated_at) VALUES ('ai_monthly_budget_cap', $1, NOW())
           ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW()`,
          [String(monthlyBudgetCap)]
        ).catch(() => {})
      );
    }
    if (enabledRoles) {
      updates.push(
        pool.query(
          `INSERT INTO platform_settings (key, value, updated_at) VALUES ('ai_enabled_roles', $1, NOW())
           ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW()`,
          [JSON.stringify(enabledRoles)]
        ).catch(() => {})
      );
    }

    await Promise.all(updates);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

aiCostsRouter.get("/budget", async (_req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT value FROM platform_settings WHERE key='ai_monthly_budget_cap'`
    ).catch(() => ({ rows: [] }));

    const { rows: enabledRows } = await pool.query(
      `SELECT value FROM platform_settings WHERE key='ai_enabled_roles'`
    ).catch(() => ({ rows: [] }));

    res.json({
      monthlyBudgetCap: rows[0] ? parseFloat(rows[0].value) : 50,
      enabledRoles: enabledRows[0] ? JSON.parse(enabledRows[0].value) : ["student","teacher","admin"],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
