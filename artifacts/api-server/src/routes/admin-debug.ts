import { Router, Response } from "express";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { pool } from "@workspace/db";

export const adminDebugRouter = Router();

adminDebugRouter.use(authenticate);
adminDebugRouter.use(requireRole("admin", "super_admin"));

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
    res.status(500).json({ error: err.message });
  }
});
