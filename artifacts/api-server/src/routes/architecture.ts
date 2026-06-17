import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { logError } from "../lib/log-error";
import os from "os";

export const architectureRouter = Router();
architectureRouter.use(authenticate, requireRole("admin", "super_admin"));

const LAYERS = [
  {
    id: "frontend",
    name: "Frontend Layer",
    description: "React 19 + Vite + Tailwind — rendering, routing, state display only",
    responsibilities: ["rendering", "sending requests", "displaying states"],
    prohibited: ["business logic", "direct DB access", "financial calculations"],
    tech: ["React 19", "Vite 6", "TanStack Query", "Wouter", "Framer Motion"],
    status: "healthy",
  },
  {
    id: "api-gateway",
    name: "API Gateway Layer",
    description: "Single entry point for all requests — auth, rate limiting, validation",
    responsibilities: ["authentication", "rate limiting", "request validation", "role enforcement"],
    prohibited: ["direct service calls bypassing middleware", "unauthenticated data writes"],
    tech: ["Express 5", "JWT", "express-rate-limit", "helmet", "cors"],
    status: "healthy",
  },
  {
    id: "ai-service",
    name: "AI Service",
    description: "Grading, tutoring, prediction, and intervention system",
    responsibilities: ["grading", "tutoring", "grade prediction", "anomaly detection"],
    prohibited: ["direct payment writes", "unvalidated AI output"],
    tech: ["OpenAI GPT-4o", "NVIDIA API", "AI Gateway", "SSE streaming"],
    status: "degraded",
  },
  {
    id: "billing-service",
    name: "Billing Service",
    description: "Transactions, invoices, refunds, subscriptions",
    responsibilities: ["invoicing", "payment processing", "refund management", "subscription lifecycle"],
    prohibited: ["modifying ledger directly", "bypassing fraud check"],
    tech: ["billing_invoices", "payment_transactions", "refund_requests", "subscriptions"],
    status: "healthy",
  },
  {
    id: "ledger-service",
    name: "Ledger Service",
    description: "Double-entry accounting — source of financial truth",
    responsibilities: ["double-entry bookkeeping", "payout calculation", "revenue reconciliation"],
    prohibited: ["updates to existing entries", "deletes", "direct balance modifications"],
    tech: ["ledger_entries", "ledger_snapshots", "append-only"],
    status: "healthy",
  },
  {
    id: "fraud-service",
    name: "Fraud & Risk Service",
    description: "Risk scoring, anomaly detection, alert dispatch",
    responsibilities: ["risk scoring", "fraud signal analysis", "alert generation"],
    prohibited: ["blocking legitimate payments without review", "storing PII in alerts"],
    tech: ["fraud_audit_log", "fraud_alerts", "anomaly_predictions", "7-signal engine"],
    status: "healthy",
  },
  {
    id: "education-service",
    name: "Education Service",
    description: "Courses, exams, study plans, rubrics, assessments",
    responsibilities: ["course management", "exam delivery", "rubric grading", "attendance tracking"],
    prohibited: ["accessing financial data directly", "payment-gated content without subscription check"],
    tech: ["teacher_courses", "exams", "rubrics", "attendance", "question_bank"],
    status: "healthy",
  },
  {
    id: "data-layer",
    name: "Data Layer",
    description: "PostgreSQL primary, Redis caching, append-only audit logs",
    responsibilities: ["persistence", "caching", "audit trail"],
    prohibited: ["schema changes without migration", "dropping ledger records"],
    tech: ["PostgreSQL 17", "Drizzle ORM", "raw pool queries", "Redis (configured)"],
    status: "healthy",
  },
];

/* ── GET /api/architecture/status ──────────────────────────────────────── */
architectureRouter.get("/status", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows: dbStats } = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM accounts)                         AS total_accounts,
        (SELECT COUNT(*)::int FROM payment_transactions)             AS total_transactions,
        (SELECT COUNT(*)::int FROM billing_invoices)                 AS total_invoices,
        (SELECT COUNT(*)::int FROM ledger_entries)                   AS ledger_entries,
        (SELECT COUNT(*)::int FROM fraud_alerts)                     AS fraud_alerts,
        (SELECT COUNT(*)::int FROM domain_events)                    AS domain_events,
        (SELECT COUNT(*)::int FROM error_logs WHERE created_at > NOW() - INTERVAL '1 hour') AS errors_last_hour,
        (SELECT ROUND(AVG(duration_ms))::int FROM api_metrics WHERE recorded_at > NOW() - INTERVAL '5 minutes') AS avg_response_ms
    `);

    const stats = dbStats[0];
    const mem = process.memoryUsage();
    const loadAvg = os.loadavg();

    const aiOk = !!(process.env.OPENAI_API_KEY || process.env.NVIDIA_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY);
    const layers = LAYERS.map((l) => ({
      ...l,
      status: l.id === "ai-service" ? (aiOk ? "healthy" : "degraded") : l.status,
    }));

    res.json({
      layers,
      stats,
      runtime: {
        node: process.version,
        uptime_seconds: Math.round(process.uptime()),
        memory_mb: Math.round(mem.heapUsed / 1024 / 1024),
        load_avg_1m: loadAvg[0].toFixed(2),
        ai_configured: aiOk,
      },
      principles: [
        "No system writes directly across domains without events or validation",
        "Ledger is append-only — no updates, no deletes",
        "All requests pass through API gateway (auth + rate limit)",
        "Frontend has zero business logic",
        "AI output is validated before persisting",
        "Every major action emits a domain event",
      ],
      event_types: [
        "transaction.created", "transaction.failed",
        "invoice.paid", "invoice.created", "invoice.voided",
        "refund.processed", "refund.rejected",
        "dispute.opened", "dispute.resolved",
        "fraud.detected", "anomaly.detected",
        "grade.generated", "enrollment.created",
      ],
    });
  } catch (err) {
    await logError(err, { route: "GET /api/architecture/status" });
    res.status(500).json({ error: "Failed" });
  }
});

/* ── GET /api/architecture/events ──────────────────────────────────────── */
architectureRouter.get("/events", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string ?? "100", 10), 500);
    const type = req.query.type as string | undefined;

    const { rows } = await pool.query(
      `SELECT de.*, a.display_name AS actor_name
       FROM domain_events de
       LEFT JOIN accounts a ON a.id = de.actor_id
       ${type ? "WHERE de.event_type = $2" : ""}
       ORDER BY de.created_at DESC LIMIT $1`,
      type ? [limit, type] : [limit],
    );

    const { rows: typeCounts } = await pool.query(`
      SELECT event_type, COUNT(*)::int AS cnt
      FROM domain_events
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY event_type
      ORDER BY cnt DESC
    `);

    res.json({ events: rows, type_counts: typeCounts, total: rows.length });
  } catch (err) {
    await logError(err, { route: "GET /api/architecture/events" });
    res.status(500).json({ error: "Failed" });
  }
});

/* ── GET /api/architecture/layers ──────────────────────────────────────── */
architectureRouter.get("/layers", async (_req: AuthRequest, res: Response): Promise<void> => {
  const aiOk = !!(process.env.OPENAI_API_KEY || process.env.NVIDIA_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY);
  res.json({
    layers: LAYERS.map((l) => ({
      ...l,
      status: l.id === "ai-service" ? (aiOk ? "healthy" : "degraded") : l.status,
    })),
  });
});
