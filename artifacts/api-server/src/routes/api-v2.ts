/**
 * V2 API Namespace — Aperti Phase 48
 *
 * Shadow deployment: all V2-native endpoints are available under /api/v2/*.
 * V1 endpoints remain untouched. Feature flags control progressive traffic routing.
 *
 * Current V2 surface:
 *   /api/v2/ai/teacher        → ai-agents teacher agent
 *   /api/v2/ai/student        → ai-agents student agent
 *   /api/v2/ai/admin/analyze  → ai-agents admin agent
 *   /api/v2/ai/chat           → streaming SSE gateway
 *   /api/v2/ai/grade          → ai gateway grader
 *   /api/v2/ai/generate       → ai gateway generator
 *   /api/v2/ai/health         → ai gateway health
 *   /api/v2/health            → enhanced health check
 *   /api/v2/features          → feature flag read (public to auth users)
 *
 * As V2 features stabilise, admin can toggle traffic in platform_feature_flags.
 */
import { Router, Request, Response } from "express";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { aiAgentsRouter } from "./ai-agents";
import { aiGatewayRouter } from "./ai-gateway";
import { pool } from "@workspace/db";

export const apiV2Router = Router();

// ── Mount V2 AI agents ────────────────────────────────────────────────────────
apiV2Router.use("/ai", aiAgentsRouter);

// ── Mount V2 AI gateway (streaming, grade, generate, health) ─────────────────
// Note: aiGatewayRouter has its own authenticate middleware
apiV2Router.use("/ai", aiGatewayRouter);

// ── GET /api/v2/health ────────────────────────────────────────────────────────
apiV2Router.get("/health", async (_req: Request, res: Response) => {
  const t0 = Date.now();
  let dbOk = false;
  let tableCount = 0;

  try {
    const [pingRow, tablesRow] = await Promise.all([
      pool.query("SELECT 1"),
      pool.query("SELECT count(*)::int AS cnt FROM information_schema.tables WHERE table_schema='public'"),
    ]);
    dbOk = pingRow.rowCount > 0;
    tableCount = tablesRow.rows[0]?.cnt ?? 0;
  } catch {}

  const aiConfigured = !!(
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||
    process.env.NVIDIA_API_KEY ||
    process.env.OPENAI_API_KEY
  );

  res.json({
    version: "v2",
    status: dbOk ? "healthy" : "degraded",
    db: { connected: dbOk, tables: tableCount, latencyMs: Date.now() - t0 },
    ai: { configured: aiConfigured, provider: process.env.NVIDIA_API_KEY ? "nvidia" : "openai" },
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// ── GET /api/v2/features — feature flag snapshot ──────────────────────────────
apiV2Router.get("/features", authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT key, enabled, rollout_pct, description FROM platform_feature_flags ORDER BY key`
    );
    res.json({ flags: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/v2/features/:key — toggle feature flag ───────────────────────────
apiV2Router.put("/features/:key", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const { key } = req.params;
  const { enabled, rollout_pct } = req.body as { enabled?: boolean; rollout_pct?: number };

  try {
    const { rows } = await pool.query(
      `UPDATE platform_feature_flags
       SET enabled = COALESCE($2, enabled),
           rollout_pct = COALESCE($3, rollout_pct),
           updated_at = NOW()
       WHERE key = $1
       RETURNING key, enabled, rollout_pct`,
      [key, enabled ?? null, rollout_pct ?? null],
    );
    if (!rows[0]) return res.status(404).json({ error: "Feature flag not found" });
    res.json({ ok: true, flag: rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
