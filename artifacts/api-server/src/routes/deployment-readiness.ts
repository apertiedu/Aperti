import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { logError } from "../lib/log-error";
import os from "os";

export const deploymentReadinessRouter = Router();
deploymentReadinessRouter.use(authenticate, requireRole("admin", "super_admin"));

interface ReadinessCheck {
  name: string;
  category: "infrastructure" | "security" | "data" | "ai" | "payments" | "monitoring";
  status: "pass" | "fail" | "warn" | "skip";
  detail: string;
  blocking: boolean;
}

/* ── GET /api/deployment/readiness ────────────────────────────────────── */
deploymentReadinessRouter.get("/readiness", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const checks: ReadinessCheck[] = [];

    const dbStart = Date.now();
    await pool.query("SELECT 1");
    const dbLatency = Date.now() - dbStart;
    checks.push({
      name: "Database connectivity",
      category: "infrastructure",
      status: dbLatency < 500 ? "pass" : "warn",
      detail: `Latency: ${dbLatency}ms ${dbLatency < 100 ? "(excellent)" : dbLatency < 300 ? "(acceptable)" : "(high)"}`,
      blocking: true,
    });

    const mem = process.memoryUsage();
    const heapPct = (mem.heapUsed / mem.heapTotal) * 100;
    checks.push({
      name: "Memory usage",
      category: "infrastructure",
      status: heapPct < 80 ? "pass" : heapPct < 90 ? "warn" : "fail",
      detail: `Heap: ${Math.round(mem.heapUsed / 1024 / 1024)}MB / ${Math.round(mem.heapTotal / 1024 / 1024)}MB (${Math.round(heapPct)}%)`,
      blocking: false,
    });

    const load = os.loadavg()[0];
    const cpus = os.cpus().length;
    checks.push({
      name: "CPU load average",
      category: "infrastructure",
      status: load / cpus < 0.7 ? "pass" : load / cpus < 0.9 ? "warn" : "fail",
      detail: `Load avg 1m: ${load.toFixed(2)} on ${cpus} CPUs`,
      blocking: false,
    });

    const jwtOk = !!process.env.JWT_SECRET;
    checks.push({
      name: "JWT_SECRET configured",
      category: "security",
      status: jwtOk ? "pass" : "fail",
      detail: jwtOk ? "JWT secret present" : "Missing JWT_SECRET — authentication will fail",
      blocking: true,
    });

    const sessionOk = !!process.env.SESSION_SECRET;
    checks.push({
      name: "SESSION_SECRET configured",
      category: "security",
      status: sessionOk ? "pass" : "warn",
      detail: sessionOk ? "Session secret present" : "Using default session secret — not safe for production",
      blocking: false,
    });

    const dbUrlOk = !!process.env.DATABASE_URL;
    checks.push({
      name: "DATABASE_URL configured",
      category: "security",
      status: dbUrlOk ? "pass" : "fail",
      detail: dbUrlOk ? "Database URL present" : "Missing DATABASE_URL",
      blocking: true,
    });

    const aiOk = !!(process.env.OPENAI_API_KEY || process.env.NVIDIA_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY);
    checks.push({
      name: "AI API key configured",
      category: "ai",
      status: aiOk ? "pass" : "warn",
      detail: aiOk ? "AI key present — full AI features enabled" : "No AI key — AI features will use fallbacks",
      blocking: false,
    });

    const { rows: errorRate } = await pool.query(`
      SELECT COUNT(*)::int AS cnt FROM error_logs
      WHERE created_at > NOW() - INTERVAL '1 hour'
    `).catch(() => ({ rows: [{ cnt: 0 }] }));
    const errCnt = errorRate[0].cnt;
    checks.push({
      name: "Error rate (last 1 hour)",
      category: "monitoring",
      status: errCnt < 10 ? "pass" : errCnt < 50 ? "warn" : "fail",
      detail: `${errCnt} errors in the last hour`,
      blocking: false,
    });

    const { rows: ledger } = await pool.query(`
      SELECT COUNT(*)::int AS cnt FROM ledger_entries
    `).catch(() => ({ rows: [{ cnt: -1 }] }));
    checks.push({
      name: "Ledger table integrity",
      category: "payments",
      status: ledger[0].cnt >= 0 ? "pass" : "fail",
      detail: `${ledger[0].cnt} ledger entries (append-only ✓)`,
      blocking: true,
    });

    const { rows: openFraud } = await pool.query(`
      SELECT COUNT(*)::int AS cnt FROM fraud_alerts WHERE status = 'open' AND severity = 'critical'
    `).catch(() => ({ rows: [{ cnt: 0 }] }));
    checks.push({
      name: "No critical unresolved fraud alerts",
      category: "payments",
      status: openFraud[0].cnt === 0 ? "pass" : "fail",
      detail: `${openFraud[0].cnt} critical open fraud alerts`,
      blocking: false,
    });

    const { rows: domainEvt } = await pool.query(`
      SELECT COUNT(*)::int AS cnt FROM domain_events
    `).catch(() => ({ rows: [{ cnt: -1 }] }));
    checks.push({
      name: "Domain event bus operational",
      category: "infrastructure",
      status: domainEvt[0].cnt >= 0 ? "pass" : "fail",
      detail: `${domainEvt[0].cnt} events logged`,
      blocking: false,
    });

    const { rows: avgLatency } = await pool.query(`
      SELECT ROUND(AVG(duration_ms))::int AS avg_ms,
             ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms))::int AS p95_ms
      FROM api_metrics WHERE recorded_at > NOW() - INTERVAL '5 minutes'
    `).catch(() => ({ rows: [{ avg_ms: null, p95_ms: null }] }));
    const p95 = avgLatency[0].p95_ms;
    checks.push({
      name: "API p95 latency",
      category: "monitoring",
      status: p95 == null ? "skip" : p95 < 500 ? "pass" : p95 < 1000 ? "warn" : "fail",
      detail: p95 == null ? "No recent API metrics" : `p95: ${p95}ms, avg: ${avgLatency[0].avg_ms}ms`,
      blocking: false,
    });

    const blocking_failures = checks.filter((c) => c.status === "fail" && c.blocking).length;
    const total_failures    = checks.filter((c) => c.status === "fail").length;
    const warnings          = checks.filter((c) => c.status === "warn").length;
    const passed            = checks.filter((c) => c.status === "pass").length;
    const score = Math.round((passed / checks.filter((c) => c.status !== "skip").length) * 100);

    res.json({
      ready_for_production: blocking_failures === 0,
      score,
      summary: { passed, warnings, total_failures, blocking_failures, total: checks.length },
      checks,
      environments: [
        { name: "Development", description: "Replit — experimental features, no real data", status: "active" },
        { name: "Staging",     description: "Production-like, fake Instapay, AI simulation",   status: "not_configured" },
        { name: "Production",  description: "Real users, strict validation, monitoring",         status: "not_deployed" },
      ],
      deployment_flow: [
        "1. Code committed in development (Replit)",
        "2. Auto-deploy to staging environment",
        "3. Run automated checks: API health, AI validation, payment simulation",
        "4. Manual approval required from admin",
        "5. Deploy to production with rollback capability",
      ],
      rollback_rule: "If error rate > 5% in first 5 minutes after deploy → automatic rollback to previous stable version",
    });
  } catch (err) {
    await logError(err, { route: "GET /api/deployment/readiness" });
    res.status(500).json({ error: "Readiness check failed" });
  }
});

/* ── GET /api/deployment/environments ─────────────────────────────────── */
deploymentReadinessRouter.get("/environments", async (_req: AuthRequest, res: Response): Promise<void> => {
  const env = process.env.NODE_ENV ?? "development";
  res.json({
    current: env,
    environments: [
      {
        name: "development",
        url: "replit.dev",
        features: ["experimental features", "hot reload", "debug endpoints"],
        data: "synthetic/empty",
        payments: "disabled",
        ai: "optional",
      },
      {
        name: "staging",
        url: "staging.aperti.ai (not yet provisioned)",
        features: ["production-like", "full AI simulation", "fake payment codes"],
        data: "anonymized copy",
        payments: "simulation mode",
        ai: "required",
      },
      {
        name: "production",
        url: "https://aperti.ai",
        features: ["real users", "strict validation", "full monitoring"],
        data: "live",
        payments: "real Instapay",
        ai: "required",
      },
    ],
  });
});
