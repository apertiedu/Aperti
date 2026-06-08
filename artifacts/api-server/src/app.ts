import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import bcrypt from "bcryptjs";
import { db, accountsTable } from "@workspace/db";
import { metricsMiddleware } from "./lib/metrics";
import { authRouter } from "./routes/auth";
import { dashboardRouter } from "./routes/dashboard";
import { attendanceRouter } from "./routes/attendance";
import { lessonsRouter } from "./routes/lessons";
import { subscriptionsRouter } from "./routes/subscriptions";
import { studentsRouter } from "./routes/students";
import { liveClassRouter } from "./routes/live-class";
import { homeworkRouter } from "./routes/homework";
import { questionBankRouter } from "./routes/question-bank";
import { flashcardsRouter } from "./routes/flashcards";
import { mentorRouter } from "./routes/mentor";
import { revisitRouter } from "./routes/revisit";
import examsRouter from "./routes/exams";
import { uploadRouter } from "./routes/upload";
import { coursesRouter } from "./routes/courses";
import { parentRouter } from "./routes/parent";
import { parentDashboardRouter } from "./routes/parent-dashboard";
import { parentPhase4Router } from "./routes/parent-phase4";
import { adminUsersRouter } from "./routes/admin-users";
import { adminOrgsRouter } from "./routes/admin-organizations";
import { adminSubscriptionsRouter } from "./routes/admin-subscriptions";
import { adminPaymentsRouter } from "./routes/admin-payments";
import { adminAnalyticsRouter } from "./routes/admin-analytics";
import { adminHealthRouter } from "./routes/admin-health";
import { adminFeaturesRouter } from "./routes/admin-features";
import { adminAuditRouter } from "./routes/admin-audit";
import { adminSecurityRouter } from "./routes/admin-security";
import { adminSupportRouter } from "./routes/admin-support";
import { adminKbRouter } from "./routes/admin-kb";
import { adminComplianceRouter } from "./routes/admin-compliance";
import { adminRolesRouter } from "./routes/admin-roles";
import { adminCoursesRouter } from "./routes/admin-courses";
import { mfaRouter } from "./routes/mfa";
import { metricsRouter } from "./routes/prometheus";
import { queueAdminRouter } from "./routes/queue-admin";
import { performanceRouter } from "./routes/performance";
import { startBackupScheduler } from "./lib/backup-scheduler";

const app: Express = express();
const PgSession = connectPgSimple(session);

const isProduction = process.env.NODE_ENV === "production";
if (isProduction) {
  app.set("trust proxy", 1);
}

// ── Security headers ──────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled to allow Vite dev proxy; enable in production
    crossOriginEmbedderPolicy: false,
  }),
);

// ── Compression ───────────────────────────────────────────────────────────────
app.use(compression());

// ── Global rate limiting ──────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/api/health" || req.path === "/metrics",
  message: { error: "Too many requests — please slow down" },
});
app.use(globalLimiter);

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── HTTP logging ──────────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) { return { id: req.id, method: req.method, url: req.url?.split("?")[0] }; },
      res(res) { return { statusCode: res.statusCode }; },
    },
  }),
);

// ── Prometheus metrics ────────────────────────────────────────────────────────
app.use(metricsMiddleware());

// ── Session ───────────────────────────────────────────────────────────────────
app.use(
  session({
    store: new PgSession({ pool, tableName: "session" }),
    secret: process.env["SESSION_SECRET"] || "aperti-fallback-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

// ── API performance tracking middleware ───────────────────────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const endpoint = req.route?.path ?? req.path ?? "unknown";
    pool.query(
      "INSERT INTO api_metrics (method, endpoint, status_code, duration_ms, recorded_at) VALUES ($1,$2,$3,$4,NOW())",
      [req.method, endpoint.substring(0, 200), res.statusCode, duration],
    ).catch(() => {});
  });
  next();
});

// ── Static files (uploads) with cache headers ─────────────────────────────────
app.use("/uploads", express.static(path.join(process.cwd(), "uploads"), {
  maxAge: isProduction ? "1d" : 0,
  etag: true,
}));

// ── Prometheus metrics endpoint ───────────────────────────────────────────────
app.use("/metrics", metricsRouter);

// ── Public health check ───────────────────────────────────────────────────────
app.get("/api/health", async (_req, res) => {
  const start = Date.now();
  let dbOk = false;
  try { await pool.query("SELECT 1"); dbOk = true; } catch {}
  res.json({
    status: "ok",
    db: dbOk ? "connected" : "error",
    redis: "memory",
    uptime: Math.round(process.uptime()),
    latencyMs: Date.now() - start,
    version: process.env.COMMIT_HASH || "dev",
    timestamp: new Date().toISOString(),
  });
});

// ── Application routes ────────────────────────────────────────────────────────
app.use("/api", router);

app.use("/auth", authRouter);
app.use("/api/auth/mfa", mfaRouter);
app.use("/dashboard", dashboardRouter);
app.use("/attendance", attendanceRouter);
app.use("/lessons", lessonsRouter);
app.use("/subscriptions", subscriptionsRouter);
app.use("/students", studentsRouter);
app.use("/live-class", liveClassRouter);
app.use("/homework", homeworkRouter);
app.use("/question-bank", questionBankRouter);
app.use("/flashcards", flashcardsRouter);
app.use("/mentor", mentorRouter);
app.use("/revisit", revisitRouter);
app.use("/exams", examsRouter);
app.use("/upload", uploadRouter);
app.use("/courses", coursesRouter);
app.use("/parent", parentRouter);
app.use("/api", parentDashboardRouter);
app.use("/api", parentPhase4Router);

// Phase 9 — Admin OS
app.use("/api/admin/users", adminUsersRouter);
app.use("/api/admin/organizations", adminOrgsRouter);
app.use("/api/admin/subscriptions", adminSubscriptionsRouter);
app.use("/api/admin/payments", adminPaymentsRouter);
app.use("/api/admin/analytics", adminAnalyticsRouter);
app.use("/api/admin/health", adminHealthRouter);
app.use("/api/admin/feature-flags", adminFeaturesRouter);
app.use("/api/admin/audit-logs", adminAuditRouter);
app.use("/api/admin/security", adminSecurityRouter);
app.use("/api/admin/support", adminSupportRouter);
app.use("/api/admin/kb", adminKbRouter);
app.use("/api/admin/compliance", adminComplianceRouter);
app.use("/api/admin/roles", adminRolesRouter);
app.use("/api/admin/courses", adminCoursesRouter);

// Phase 10 — Infrastructure
app.use("/api/admin/queue", queueAdminRouter);
app.use("/api/admin/performance", performanceRouter);

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled error");
  res.status(err.status ?? 500).json({ error: err.message ?? "Internal server error" });
});

// ── Seed default admin & start scheduler ─────────────────────────────────────
async function seedDefaultAdmin() {
  try {
    const existing = await db.select().from(accountsTable);
    if (existing.length === 0) {
      const passwordHash = await bcrypt.hash("admin123", 10);
      await db.insert(accountsTable).values({ username: "admin", passwordHash, displayName: "Admin", role: "admin", status: "active" });
      logger.info("Default admin created: admin / admin123");
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed admin account");
  }
}

seedDefaultAdmin();
startBackupScheduler();

export default app;
