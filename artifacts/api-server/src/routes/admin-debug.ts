import { Router, Response } from "express";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { pool } from "@workspace/db";

export const adminDebugRouter = Router();

adminDebugRouter.use(authenticate);
adminDebugRouter.use(requireRole("admin", "super_admin"));

// ── GET /api/admin/debug/stream — real-time SSE debug feed ───────────────────
adminDebugRouter.get("/stream", async (_req: AuthRequest, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  async function pushSnapshot() {
    if (res.writableEnded) return;
    try {
      const [errRow, aiRow, sesRow, flagRow] = await Promise.allSettled([
        pool.query<{ cnt: number; routes: string }>(
          `SELECT count(*)::int AS cnt,
                  STRING_AGG(DISTINCT route, ', ' ORDER BY route) FILTER (WHERE created_at > NOW() - INTERVAL '5m') AS routes
           FROM error_logs WHERE created_at > NOW() - INTERVAL '1h' AND level = 'error'`
        ),
        pool.query<{ cnt: number; cost: number }>(
          `SELECT count(*)::int AS cnt, COALESCE(SUM(estimated_cost_usd),0)::float AS cost
           FROM ai_interactions WHERE created_at > NOW() - INTERVAL '1h'`
        ),
        pool.query<{ cnt: number }>(
          `SELECT count(*)::int AS cnt FROM device_sessions WHERE created_at > NOW() - INTERVAL '24h'`
        ),
        pool.query<{ key: string; enabled: boolean }>(
          `SELECT key, enabled FROM platform_feature_flags ORDER BY key LIMIT 20`
        ),
      ]);

      const snapshot = {
        ts: new Date().toISOString(),
        errors: {
          count1h: errRow.status === "fulfilled" ? errRow.value.rows[0]?.cnt ?? 0 : 0,
          hotRoutes: errRow.status === "fulfilled" ? errRow.value.rows[0]?.routes ?? "" : "",
        },
        ai: {
          calls1h: aiRow.status === "fulfilled" ? aiRow.value.rows[0]?.cnt ?? 0 : 0,
          cost1h:  aiRow.status === "fulfilled" ? Number(aiRow.value.rows[0]?.cost ?? 0).toFixed(4) : "0.0000",
        },
        sessions: sesRow.status === "fulfilled" ? sesRow.value.rows[0]?.cnt ?? 0 : 0,
        flags: flagRow.status === "fulfilled" ? flagRow.value.rows : [],
        uptime: Math.round(process.uptime()),
        memory: {
          heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        },
      };
      res.write(`data: ${JSON.stringify(snapshot)}\n\n`);
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: "Snapshot failed", ts: new Date().toISOString() })}\n\n`);
    }
  }

  await pushSnapshot();
  const interval = setInterval(pushSnapshot, 10_000);

  res.on("close", () => {
    clearInterval(interval);
  });
});

adminDebugRouter.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const [failedApi, aiLogs, permErrors, dbHealth, activeSessionsResult] = await Promise.allSettled([
      pool.query(`
        SELECT id, route, method, status_code, error_message, user_role, created_at
        FROM error_logs
        WHERE created_at > NOW() - INTERVAL '24 hours'
          AND status_code >= 400
        ORDER BY created_at DESC
        LIMIT 100
      `),
      pool.query(`
        SELECT id, type, success, latency_ms, failure_reason, created_at
        FROM ai_logs
        WHERE created_at > NOW() - INTERVAL '24 hours'
        ORDER BY created_at DESC
        LIMIT 200
      `),
      pool.query(`
        SELECT route, COUNT(*) as count, MAX(created_at) as last_seen
        FROM error_logs
        WHERE status_code = 403
          AND created_at > NOW() - INTERVAL '24 hours'
        GROUP BY route
        ORDER BY count DESC
        LIMIT 50
      `),
      pool.query("SELECT 1"),
      pool.query("SELECT COUNT(*) as count FROM device_sessions WHERE created_at > NOW() - INTERVAL '24 hours'"),
    ]);

    const aiConfigured = !!(process.env.OPENAI_API_KEY || process.env.NVIDIA_API_KEY);

    res.json({
      failedApiCalls: failedApi.status === "fulfilled" ? failedApi.value.rows : [],
      aiLogs: aiLogs.status === "fulfilled" ? aiLogs.value.rows : [],
      permissionErrors: permErrors.status === "fulfilled" ? permErrors.value.rows : [],
      systemHealth: {
        dbConnected: dbHealth.status === "fulfilled",
        aiConfigured,
        sessionCount: activeSessionsResult.status === "fulfilled"
          ? parseInt(activeSessionsResult.value.rows[0]?.count ?? "0")
          : 0,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});
