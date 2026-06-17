import { Router, Request, Response } from "express";
import { requireRole } from "../middleware/auth";
import { logError } from "../lib/log-error";
import { isSafeModeEnabled, setSafeMode, getSafeModeStatus } from "../lib/safe-mode";
import { pool } from "@workspace/db";
import os from "os";

export const systemRouter = Router();

systemRouter.use(requireRole("admin", "super_admin"));

const NVIDIA_KEY   = process.env.NVIDIA_API_KEY;
const REPLIT_KEY   = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const REPLIT_BASE  = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const OPENAI_KEY   = process.env.OPENAI_API_KEY;
const OPENAI_BASE  = process.env.OPENAI_BASE_URL;

const API_KEY: string | null =
  NVIDIA_KEY ??
  (REPLIT_KEY && REPLIT_BASE ? REPLIT_KEY : null) ??
  OPENAI_KEY ??
  null;

const BASE_URL: string =
  (NVIDIA_KEY ? "https://integrate.api.nvidia.com/v1" : null) ??
  (REPLIT_KEY && REPLIT_BASE ? REPLIT_BASE : null) ??
  OPENAI_BASE ??
  "https://api.openai.com/v1";

const ACTIVE_MODEL: string =
  process.env.OPENAI_MODEL ??
  (NVIDIA_KEY ? "openai/gpt-oss-20b" : "gpt-4o-mini");

const ACTIVE_PROVIDER: string =
  NVIDIA_KEY ? "NVIDIA" :
  (REPLIT_KEY && REPLIT_BASE) ? "Replit AI Integration" :
  OPENAI_KEY ? "OpenAI" :
  "none";

async function pingOpenAI(): Promise<{ status: "healthy" | "error"; model: string; latency: number; provider: string; message?: string; timestamp: string }> {
  const timestamp = new Date().toISOString();

  if (!API_KEY) {
    return { status: "error", model: "none", latency: 0, provider: "none", message: "OPENAI_API_KEY missing", timestamp };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const start = Date.now();

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: ACTIVE_MODEL,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      }),
      signal: controller.signal,
    });

    const latency = Date.now() - start;
    clearTimeout(timeout);

    if (res.status === 401) {
      return { status: "error", model: ACTIVE_MODEL, latency, provider: ACTIVE_PROVIDER, message: "Invalid API key", timestamp };
    }
    if (res.status === 429) {
      return { status: "error", model: ACTIVE_MODEL, latency, provider: ACTIVE_PROVIDER, message: "Rate limit exceeded", timestamp };
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { status: "error", model: ACTIVE_MODEL, latency, provider: ACTIVE_PROVIDER, message: `HTTP ${res.status}: ${body.slice(0, 120)}`, timestamp };
    }

    return { status: "healthy", model: ACTIVE_MODEL, latency, provider: ACTIVE_PROVIDER, timestamp };
  } catch (err: unknown) {
    clearTimeout(timeout);
    const latency = Date.now() - start;
    const msg = err instanceof Error
      ? (err.name === "AbortError" ? "Request timed out (8s)" : err.message)
      : String(err);
    return { status: "error", model: ACTIVE_MODEL, latency, provider: ACTIVE_PROVIDER, message: msg, timestamp };
  }
}

systemRouter.get("/openai-health", async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pingOpenAI();
    const httpStatus = result.status === "healthy" ? 200 : 503;

    if (result.status === "error") {
      await logError(new Error(result.message ?? "OpenAI health check failed"), {
        route: "/api/system/openai-health",
        method: "GET",
      });
    }

    res.status(httpStatus).json(result);
  } catch (err) {
    await logError(err, { route: "/api/system/openai-health", method: "GET" });
    res.status(500).json({ status: "error", message: "Health check failed unexpectedly", timestamp: new Date().toISOString() });
  }
});

systemRouter.get("/diagnostics", async (_req: Request, res: Response): Promise<void> => {
  try {
    const [openaiResult, dbResult] = await Promise.allSettled([
      pingOpenAI(),
      (async () => {
        const start = Date.now();
        await pool.query("SELECT 1");
        return { status: "connected" as const, latencyMs: Date.now() - start };
      })(),
    ]);

    const openai = openaiResult.status === "fulfilled"
      ? openaiResult.value
      : { status: "error" as const, model: "none", latency: 0, provider: "none", message: String(openaiResult.reason), timestamp: new Date().toISOString() };

    const database = dbResult.status === "fulfilled"
      ? dbResult.value
      : { status: "error" as const, latencyMs: 0, message: String(dbResult.reason) };

    const totalMem  = os.totalmem();
    const freeMem   = os.freemem();
    const usedMemMB = Math.round((totalMem - freeMem) / 1024 / 1024);
    const totalMemMB = Math.round(totalMem / 1024 / 1024);
    const memPct    = Math.round(((totalMem - freeMem) / totalMem) * 100);

    const deployment = {
      nodeEnv:     process.env.NODE_ENV ?? "development",
      uptime:      Math.round(process.uptime()),
      memoryMB:    { used: usedMemMB, total: totalMemMB, percent: memPct },
      nodeVersion: process.version,
      platform:    process.platform,
      timestamp:   new Date().toISOString(),
    };

    const environment = {
      DATABASE_URL:      !!process.env.DATABASE_URL,
      JWT_SECRET:        !!process.env.JWT_SECRET,
      SESSION_SECRET:    !!process.env.SESSION_SECRET,
      OPENAI_API_KEY:    !!OPENAI_KEY,
      NVIDIA_API_KEY:    !!NVIDIA_KEY,
      AI_INTEGRATION:    !!(REPLIT_KEY && REPLIT_BASE),
      activeAiProvider:  ACTIVE_PROVIDER,
    };

    const allHealthy =
      openai.status === "healthy" &&
      database.status === "connected" &&
      environment.DATABASE_URL &&
      environment.JWT_SECRET;

    res.json({
      overall: allHealthy ? "healthy" : "degraded",
      openai,
      database,
      environment,
      deployment,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    await logError(err, { route: "/api/system/diagnostics", method: "GET" });
    res.status(500).json({ overall: "error", message: "Diagnostics check failed", timestamp: new Date().toISOString() });
  }
});

/* ── Self-Check — automated pre-deployment readiness checks ─────────────── */
systemRouter.get("/self-check", async (_req: Request, res: Response): Promise<void> => {
  type CheckStatus = "pass" | "fail" | "warn";
  interface Check { name: string; status: CheckStatus; latency_ms?: number; message?: string }
  const checks: Check[] = [];

  const [dbCheck, metricsCheck, aiCheck] = await Promise.allSettled([
    (async (): Promise<Check> => {
      const start = Date.now();
      await pool.query("SELECT 1");
      return { name: "database_connectivity", status: "pass", latency_ms: Date.now() - start };
    })(),
    (async (): Promise<Check> => {
      const { rows } = await pool.query(
        `SELECT
           COUNT(*)::int AS total,
           SUM(CASE WHEN success = false THEN 1 ELSE 0 END)::int AS failures
         FROM system_metrics_log
         WHERE created_at > NOW() - INTERVAL '1 hour'`,
      );
      const total    = rows[0]?.total    ?? 0;
      const failures = rows[0]?.failures ?? 0;
      const rate     = total > 0 ? failures / total : 0;
      return {
        name:    "error_rate_1h",
        status:  rate < 0.1 ? "pass" : "fail",
        message: `${(rate * 100).toFixed(1)}% error rate over ${total} requests`,
      };
    })(),
    (async (): Promise<Check> => {
      const aiAvailable = !!(
        process.env.NVIDIA_API_KEY ||
        process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||
        process.env.OPENAI_API_KEY
      );
      return {
        name:    "ai_provider_configured",
        status:  aiAvailable ? "pass" : "fail",
        message: aiAvailable ? ACTIVE_PROVIDER : "No AI provider key configured",
      };
    })(),
  ]);

  checks.push(
    dbCheck.status  === "fulfilled" ? dbCheck.value  : { name: "database_connectivity", status: "fail", message: String(dbCheck.reason) },
    metricsCheck.status === "fulfilled" ? metricsCheck.value : { name: "error_rate_1h", status: "warn", message: "Metrics table not ready yet" },
    aiCheck.status  === "fulfilled" ? aiCheck.value  : { name: "ai_provider_configured", status: "fail", message: String(aiCheck.reason) },
  );

  const requiredEnv = ["DATABASE_URL", "JWT_SECRET", "SESSION_SECRET"];
  const missing     = requiredEnv.filter((k) => !process.env[k]);
  checks.push({
    name:    "environment_variables",
    status:  missing.length === 0 ? "pass" : "fail",
    message: missing.length > 0 ? `Missing: ${missing.join(", ")}` : "All required secrets present",
  });

  const safeModeOn = await isSafeModeEnabled().catch(() => false);
  checks.push({
    name:    "safe_mode_status",
    status:  "pass",
    message: safeModeOn ? "SAFE_MODE_ACTIVE — some features reduced" : "normal",
  });

  const productionReady = checks
    .filter((c) => c.name !== "safe_mode_status")
    .every((c) => c.status === "pass");

  const overall = checks.every((c) => c.status === "pass") ? "pass"
    : checks.some((c) => c.status === "fail") ? "fail"
    : "warn";

  res.status(overall === "pass" ? 200 : 207).json({
    production_ready: productionReady,
    overall,
    checks,
    timestamp: new Date().toISOString(),
  });
});

/* ── Safe Mode — GET status / POST toggle ───────────────────────────────── */
systemRouter.get("/safe-mode", async (_req: Request, res: Response): Promise<void> => {
  try {
    const status = await getSafeModeStatus();
    res.json(status);
  } catch (err) {
    await logError(err, { route: "/api/system/safe-mode", method: "GET" });
    res.status(500).json({ error: "Failed to fetch safe mode status" });
  }
});

systemRouter.post("/safe-mode", async (req: Request, res: Response): Promise<void> => {
  try {
    const { enabled } = req.body as { enabled?: boolean };
    if (typeof enabled !== "boolean") {
      res.status(400).json({ error: "enabled must be a boolean" });
      return;
    }
    await setSafeMode(enabled);
    res.json({ success: true, enabled, timestamp: new Date().toISOString() });
  } catch (err) {
    await logError(err, { route: "/api/system/safe-mode", method: "POST" });
    res.status(500).json({ error: "Failed to update safe mode" });
  }
});

/* ── Validation Errors — recent AI validation failures ──────────────────── */
systemRouter.get("/validation-errors", async (_req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      `SELECT id, source, error_type, field_missing, fallback_used, created_at
       FROM system_validation_errors
       ORDER BY created_at DESC
       LIMIT 50`,
    );
    res.json({ errors: rows });
  } catch (err) {
    await logError(err, { route: "/api/system/validation-errors" });
    res.status(500).json({ error: "Failed to fetch validation errors" });
  }
});

/* ── Production Metrics — aggregated health data for dashboard ──────────── */
systemRouter.get("/production-metrics", async (_req: Request, res: Response): Promise<void> => {
  try {
    const [sysRows, uxRows, aiRows, valRows, safeModeResult, latPercRows] = await Promise.allSettled([
      pool.query(`
        SELECT
          COUNT(*)::int                                              AS total_requests,
          SUM(CASE WHEN success = false THEN 1 ELSE 0 END)::int     AS total_errors,
          ROUND(AVG(latency_ms))::int                               AS avg_latency_ms,
          ROUND(AVG(CASE WHEN success = false THEN 1.0 ELSE 0.0 END) * 100, 2)
                                                                    AS error_rate_pct
        FROM system_metrics_log WHERE created_at > NOW() - INTERVAL '24 hours'
      `),
      pool.query(`
        SELECT
          COUNT(*)::int                                              AS total_violations,
          SUM(CASE WHEN severity = 'error' THEN 1 ELSE 0 END)::int  AS critical_violations
        FROM ux_rule_violations WHERE created_at > NOW() - INTERVAL '24 hours'
      `),
      pool.query(`
        SELECT
          COUNT(*)::int                                              AS total_ai_calls,
          ROUND(AVG(confidence)::numeric, 3)                        AS avg_confidence,
          SUM(CASE WHEN accepted = false THEN 1 ELSE 0 END)::int    AS ai_failures,
          ROUND(AVG(latency_ms))::int                               AS ai_avg_latency_ms,
          COALESCE(SUM(tokens_used), 0)::int                        AS total_tokens
        FROM ai_interactions WHERE created_at > NOW() - INTERVAL '24 hours'
      `),
      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM system_validation_errors WHERE created_at > NOW() - INTERVAL '24 hours'
      `),
      isSafeModeEnabled(),
      pool.query(`
        SELECT
          ROUND(PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY latency_ms))::int AS p50_ms,
          ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms))::int AS p95_ms
        FROM system_metrics_log
        WHERE created_at > NOW() - INTERVAL '1 hour' AND latency_ms IS NOT NULL
      `),
    ]);

    const sys      = sysRows.status       === "fulfilled" ? sysRows.value.rows[0]       : {};
    const ux       = uxRows.status        === "fulfilled" ? uxRows.value.rows[0]        : {};
    const ai       = aiRows.status        === "fulfilled" ? aiRows.value.rows[0]        : {};
    const val      = valRows.status       === "fulfilled" ? valRows.value.rows[0]       : {};
    const safeMode = safeModeResult.status === "fulfilled" ? safeModeResult.value       : false;
    const latPerc  = latPercRows && latPercRows.status === "fulfilled" ? latPercRows.value.rows[0] : null;

    const uptimeSec = Math.round(process.uptime());

    res.json({
      safe_mode: safeMode,
      system: {
        uptime_seconds:        uptimeSec,
        total_requests_24h:    sys.total_requests   ?? 0,
        error_count_24h:       sys.total_errors     ?? 0,
        error_rate_pct:        parseFloat(sys.error_rate_pct ?? "0"),
        avg_latency_ms:        sys.avg_latency_ms   ?? 0,
        latency_p50_ms:        latPerc?.p50_ms      ?? 0,
        latency_p95_ms:        latPerc?.p95_ms      ?? 0,
        validation_errors_24h: val.total            ?? 0,
      },
      ux: {
        violations_24h:          ux.total_violations    ?? 0,
        critical_violations_24h: ux.critical_violations ?? 0,
      },
      ai: {
        total_calls_24h:   ai.total_ai_calls      ?? 0,
        failure_count_24h: ai.ai_failures         ?? 0,
        avg_confidence:    parseFloat(ai.avg_confidence ?? "0"),
        avg_latency_ms:    ai.ai_avg_latency_ms   ?? 0,
        total_tokens_24h:  ai.total_tokens        ?? 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    await logError(err, { route: "/api/system/production-metrics" });
    res.status(500).json({ error: "Failed to fetch production metrics" });
  }
});

/* ── Metrics Trend — hourly breakdown for sparkline charts ──────────────── */
systemRouter.get("/metrics-trend", async (_req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query<{
      hour: string;
      requests: number;
      errors: number;
    }>(`
      SELECT
        TO_CHAR(DATE_TRUNC('hour', created_at), 'HH24:MI') AS hour,
        COUNT(*)::int                                        AS requests,
        SUM(CASE WHEN success = false THEN 1 ELSE 0 END)::int AS errors
      FROM system_metrics_log
      WHERE created_at > NOW() - INTERVAL '12 hours'
      GROUP BY DATE_TRUNC('hour', created_at)
      ORDER BY DATE_TRUNC('hour', created_at)
    `);
    res.json({ hours: rows });
  } catch (err) {
    await logError(err, { route: "/api/system/metrics-trend" });
    res.status(500).json({ error: "Failed to fetch metrics trend" });
  }
});
