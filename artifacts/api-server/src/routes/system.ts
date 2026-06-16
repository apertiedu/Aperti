import { Router, Request, Response } from "express";
import { requireRole } from "../middleware/auth";
import { logError } from "../lib/log-error";
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
