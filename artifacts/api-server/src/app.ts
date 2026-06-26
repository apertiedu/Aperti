import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import jwt from "jsonwebtoken";
import cron from "node-cron";
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
import { adminPasswordResetsRouter } from "./routes/admin-password-resets";
import { adminOrgsRouter } from "./routes/admin-organizations";
import { adminSubscriptionsRouter } from "./routes/admin-subscriptions";
import { adminPaymentsRouter } from "./routes/admin-payments";
import { adminAnalyticsRouter } from "./routes/admin-analytics";
import { adminHealthRouter } from "./routes/admin-health";
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
import { governanceRouter } from "./routes/governance";
import { launchCmsRouter } from "./routes/launch-cms";
import { phase14PublicRouter } from "./routes/phase14-public";
import { commerceRouter } from "./routes/commerce";
import { mobileRouter } from "./routes/mobile";
import { adminDocsRouter } from "./routes/admin-docs";
import { adminLaunchAuditRouter } from "./routes/admin-launch-audit";
import { userExportRouter } from "./routes/user-export";
import { i18nRouter } from "./routes/i18n";
// Phase 19 — Founder Control Center & Operational Layer
import { founderRouter } from "./routes/founder";
import { launchCmdRouter, releasesRouter } from "./routes/launch-releases";
import { notificationRulesRouter } from "./routes/notification-rules-admin";
import { searchRouter } from "./routes/search";
import { contentQualityRouter, aiCostsRouter } from "./routes/content-quality-admin";
import { revisionV3Router } from "./routes/revision-v3";
import { flashcardV3Router } from "./routes/flashcard-v3";
import { startFounderAlertsWorker } from "./routes/founder-alerts-worker";
// Phase 21 — Experience, Delight, Conversion & Product Excellence
import { revisionPlanRouter } from "./routes/revision-plan";
import { questionExtractionRouter } from "./routes/question-extraction";
// Phase 29 — Intelligence, Efficiency & Educational Excellence
import { teacherFocusRouter } from "./routes/teacher-focus";
import { studentMomentumRouter } from "./routes/student-momentum";
import { courseHealthRouter } from "./routes/course-health";
import { feedbackRouter } from "./routes/feedback";
import { revisionModesRouter } from "./routes/revision-modes";
import { ensurePerformanceIndexes } from "./routes/db-indexes";
// Phase 30 — Deployment Stability, Error Intelligence & Production Readiness
import { errorIntelligenceRouter } from "./routes/admin-error-intelligence";
import { learningEfficiencyRouter } from "./routes/admin-learning-efficiency";
import { adminContentValidationRouter } from "./routes/admin-content-validation";
// Phase 32 — Zero-Defect Initiative
import { adminRouteHealthRouter } from "./routes/admin-route-health";
import { adminLaunchDashboardRouter } from "./routes/admin-launch-dashboard";
// Phase 33 — Platform Perfection
import { adminDbHealthRouter } from "./routes/admin-db-health";
// Phase 34 — AI Accuracy, Anti-Cheat V2, Assessment Intelligence
import { teacherInterventionsRouter } from "./routes/teacher-interventions";
import { shieldRouter } from "./routes/shield";
import { adminAnalyticsExtendedRouter } from "./routes/admin-analytics-extended";
// Phase 34 — Data Quality & Session Slots
import { adminDataQualityRouter } from "./routes/admin-data-quality";
import { sessionSlotsRouter } from "./routes/session-slots";
import { attendanceAuditRouter } from "./routes/attendance-audit";
import { enrollmentTimelineRouter } from "./routes/enrollment-timeline";
import { notificationsInboxRouter } from "./routes/notifications-inbox";
// Phase 33 — Error System & Performance
import { errorsLogRouter } from "./routes/errors-log";
// Phase 47 — AI Teaching Assistant, V2 Permissions, Repair System
import { adminRepairRouter } from "./routes/admin-repair";
import { classforgeRouter } from "./routes/classforge";
import { securePaymentsRouter } from "./routes/secure-payments";
import { secureDiscountsRouter } from "./routes/secure-discounts";
import { assistantAssignmentsRouter } from "./routes/assistant-assignments";
import { fraudDetectionRouter } from "./routes/fraud-detection";
import { refundEngineRouter } from "./routes/refund-engine";
import { teacherRevenueRouter } from "./routes/teacher-revenue";
import { subscriptionLifecycleRouter } from "./routes/subscription-lifecycle";
import { autoRenewRouter } from "./routes/auto-renew";
import { ledgerRouter } from "./routes/ledger";
import { fraudAlertsRouter } from "./routes/fraud-alerts";
import { teacherPayoutsRouter } from "./routes/teacher-payouts";
import { validateEnv } from "./config/env";
import { recordRequest, startPerfFlushInterval } from "./lib/perf-tracker";
import { sanitizeBody } from "./middleware/sanitize-body";
import { requestObserver } from "./lib/request-observer";
import { filesRouter } from "./routes/files";

const app: Express = express();
const PgSession = connectPgSimple(session);

validateEnv();

const isProduction = process.env.NODE_ENV === "production";
const isReplit = !!process.env.REPL_ID;
if (isProduction || isReplit) {
  app.set("trust proxy", 1);
}

// ── Security headers ──────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: isProduction
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            connectSrc: ["'self'", "wss:", "ws:", "https:"],
            fontSrc: ["'self'", "data:", "https:"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            upgradeInsecureRequests: [],
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
  }),
);

// ── Extra security headers not fully covered by helmet defaults ───────────────
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

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

// ── Per-user / route-specific rate limiting ───────────────────────────────────
function extractRateLimitKey(req: Request): string {
  try {
    const token = (req as any).cookies?.["aperti_token"];
    if (token) {
      const decoded = jwt.decode(token) as { id?: number } | null;
      if (decoded?.id) return `u:${decoded.id}`;
    }
  } catch {}
  return req.ip ?? "guest";
}

const aiChatLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 200,
  keyGenerator: extractRateLimitKey,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  message: { error: "Daily AI request quota exceeded — try again tomorrow" },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts — please wait before trying again" },
});

const subInitiateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: extractRateLimitKey,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  message: { error: "Too many subscription requests — try again in an hour" },
});

// ── CORS ──────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
  : null;

if (!ALLOWED_ORIGINS && process.env.NODE_ENV === "production") {
  console.warn("[CORS] ALLOWED_ORIGINS is not set in production — cross-origin requests are unrestricted. Set ALLOWED_ORIGINS to lock down the API.");
}

app.use(cors({
  origin: ALLOWED_ORIGINS
    ? (origin, cb) => {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) cb(null, true);
        else cb(new Error("CORS: origin not allowed"));
      }
    : true,
  credentials: true,
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());
app.use(sanitizeBody);

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

// ── Request observability — logs every request to system_metrics_log ─────────
app.use(requestObserver);

// ── Session ───────────────────────────────────────────────────────────────────
app.use(
  session({
    store: new PgSession({ pool, tableName: "session" }),
    secret: (() => {
      const secret = process.env["SESSION_SECRET"] || process.env["JWT_SECRET"];
      if (!secret) {
        console.error("[app] FATAL: SESSION_SECRET (or JWT_SECRET) must be set for secure sessions.");
        process.exit(1);
      }
      return secret;
    })(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
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
    if (Math.random() < 0.1) {
      pool.query(
        "INSERT INTO api_metrics (method, endpoint, status_code, duration_ms, recorded_at) VALUES ($1,$2,$3,$4,NOW())",
        [req.method, endpoint.substring(0, 200), res.statusCode, duration],
      ).catch(() => {});
    }
    recordRequest(req.method, endpoint.substring(0, 200), duration);
  });
  next();
});

cron.schedule("0 3 * * *", () => {
  pool.query("DELETE FROM api_metrics WHERE recorded_at < NOW() - INTERVAL '30 days'").catch(() => {});
  pool.query("DELETE FROM system_metrics_log WHERE created_at < NOW() - INTERVAL '30 days'").catch(() => {});
}, { timezone: "UTC" });

// ── Authenticated file serving (replaces unauthenticated express.static) ──────
// Files are served via /files/:filename with ownership + tenant validation.
// Direct /uploads/* paths are blocked to prevent unauthenticated access.
app.use(filesRouter);
app.use("/uploads", (_req, res) => {
  res.status(403).json({ error: "Direct file access is not permitted. Use /files/:filename." });
});

// ── Prometheus metrics endpoint ───────────────────────────────────────────────
app.use("/metrics", metricsRouter);

// ── Root /api health ping (used by Replit deployment healthcheck) ─────────────
app.get("/api", (_req, res) => {
  res.json({ status: "ok", service: "aperti-api", version: process.env.COMMIT_HASH || "dev" });
});

// ── Root /health for Railway & other deployment platforms ─────────────────────
app.get("/health", async (_req, res) => {
  const start = Date.now();
  let dbOk = false;
  let dbLatencyMs = 0;
  let storageOk = false;
  let uploadCount = 0;

  // Database check
  try {
    const t0 = Date.now();
    await pool.query("SELECT 1");
    dbLatencyMs = Date.now() - t0;
    dbOk = true;
  } catch {}

  // Storage check — verify uploads dir is writable and count registered files
  try {
    const { existsSync, mkdirSync, writeFileSync, unlinkSync } = await import("fs");
    const uploadDir = path.join(process.cwd(), "uploads");
    mkdirSync(uploadDir, { recursive: true });
    const probe = path.join(uploadDir, `.health-${Date.now()}`);
    writeFileSync(probe, "ok");
    unlinkSync(probe);
    storageOk = true;
    const { rows } = await pool.query("SELECT COUNT(*) FROM upload_registry");
    uploadCount = parseInt(rows[0]?.count ?? "0", 10);
  } catch {}

  const mem = process.memoryUsage();
  const memUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
  const memTotalMb = Math.round(mem.heapTotal / 1024 / 1024);

  const allOk = dbOk && storageOk;
  const status = !dbOk ? "critical" : (dbLatencyMs > 800 ? "degraded" : "healthy");

  res.status(allOk ? 200 : 503).json({
    status,
    checks: {
      database: { ok: dbOk, latencyMs: dbLatencyMs },
      storage:  { ok: storageOk, registeredFiles: uploadCount },
      memory:   { ok: memUsedMb < 900, usedMb: memUsedMb, totalMb: memTotalMb },
    },
    uptime: Math.round(process.uptime()),
    latencyMs: Date.now() - start,
    version: process.env.COMMIT_HASH || "dev",
    env: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

// ── Public health check ───────────────────────────────────────────────────────
app.get("/api/health", async (_req, res) => {
  let dbOk = false;
  try {
    await pool.query("SELECT 1");
    dbOk = true;
  } catch {}
  const status = dbOk ? "healthy" : "critical";
  res.status(dbOk ? 200 : 503).json({
    status,
    db: dbOk,
    timestamp: new Date().toISOString(),
  });
});

// Phase 14 — Public stats & testimonials (no auth, must be BEFORE main router)
app.use("/api", phase14PublicRouter);

// Phase 16 — Commercialization (must be BEFORE main router for public plan endpoints)
app.use("/api", commerceRouter);

// Phase 17 — Mobile Ecosystem (must be BEFORE main router so /push/vapid-key is public)
app.use("/api", mobileRouter);

// Phase 18 — i18n (public endpoints, must be BEFORE main router)
app.use("/api", i18nRouter);

// Phase 19 — Public endpoints (must be BEFORE main router)
app.use("/api/search", searchRouter);
app.use("/api", releasesRouter);

// Phase 12 — Launch CMS & Growth (must be BEFORE main router for public /api/landing, /api/roadmap, /api/release-notes, /api/features/public, /api/branding)
app.use("/api", launchCmsRouter);

// Phase 33 — Error capture (public, rate-limited) — MUST be before main router
app.use("/api/errors", errorsLogRouter);

app.use("/api/ai/chat", aiChatLimiter);
app.use("/auth/login", loginLimiter);
app.use("/api/sub-engine/initiate", subInitiateLimiter);

// ── Application routes ────────────────────────────────────────────────────────
app.use("/api", router);

app.use("/auth", authRouter);
app.use("/api/auth/mfa", mfaRouter);
app.use("/dashboard", dashboardRouter);
app.use("/attendance", attendanceRouter);
app.use("/lessons", lessonsRouter);
app.use("/subscriptions", subscriptionsRouter);
app.use("/students", studentsRouter);
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
app.use("/api/admin/password-resets", adminPasswordResetsRouter);
app.use("/api/admin/organizations", adminOrgsRouter);
app.use("/api/admin/subscriptions", adminSubscriptionsRouter);
app.use("/api/admin/payments", adminPaymentsRouter);
app.use("/api/admin/analytics", adminAnalyticsRouter);
app.use("/api/admin/health", adminHealthRouter);
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

// Phase 11 — Governance
app.use("/api/admin/governance", governanceRouter);

// Phase 18 — Enterprise Readiness
app.use("/api/admin/docs", adminDocsRouter);
app.use("/api/admin/launch-audit", adminLaunchAuditRouter);
app.use("/api", userExportRouter);

// Phase 32 — Zero-Defect Initiative
app.use("/api/admin/route-health", adminRouteHealthRouter);
app.use("/api/admin/launch-dashboard", adminLaunchDashboardRouter);
// Phase 33 — Platform Perfection
app.use("/api/admin/db-health", adminDbHealthRouter);
app.use("/api/admin/analytics/extended", adminAnalyticsExtendedRouter);

// Phase 19 — Founder Control Center & Operational Layer
app.use("/api/founder", founderRouter);
app.use("/api/launch", launchCmdRouter);
app.use("/api/admin/notification-rules", notificationRulesRouter);
app.use("/api/admin/content-quality", contentQualityRouter);
app.use("/api/admin/ai", aiCostsRouter);
app.use("/api/revision", revisionV3Router);
app.use("/api/flashcards/v3", flashcardV3Router);

app.use("/api/revision", revisionPlanRouter);
app.use("/api/questions/extract", questionExtractionRouter);

app.use("/api/teacher", teacherFocusRouter);
app.use("/api/teacher/interventions", teacherInterventionsRouter);
app.use("/api/shield", shieldRouter);
app.use("/api/student", studentMomentumRouter);
app.use("/api/course-health", courseHealthRouter);
app.use("/api/feedback", feedbackRouter);
app.use("/api/revision-modes", revisionModesRouter);
// Phase 30
app.use("/api/admin/error-intelligence", errorIntelligenceRouter);
app.use("/api/admin/learning-efficiency", learningEfficiencyRouter);
app.use("/api/admin/content-validation", adminContentValidationRouter);
// Phase 34 — Data Quality & Session Slots
app.use("/api/admin/data-quality", adminDataQualityRouter);
app.use("/api/session-slots", sessionSlotsRouter);
app.use("/api/attendance-audit", attendanceAuditRouter);
app.use("/api/enrollment-timeline", enrollmentTimelineRouter);
app.use("/api/notifications/inbox", notificationsInboxRouter);
// Phase 47 — Repair Panel & Launch Score
app.use("/api/admin/repair", adminRepairRouter);
app.use("/api", classforgeRouter);
app.use("/api/secure-payments", securePaymentsRouter);
app.use("/api/secure-discounts", secureDiscountsRouter);
app.use("/api/assistant-assignments", assistantAssignmentsRouter);
app.use("/api/fraud", fraudDetectionRouter);
app.use("/api/fraud-alerts", fraudAlertsRouter);
app.use("/api/refunds", refundEngineRouter);
app.use("/api/revenue", teacherRevenueRouter);
app.use("/api/subscriptions/lifecycle", subscriptionLifecycleRouter);
app.use("/api/auto-renew", autoRenewRouter);
app.use("/api/ledger", ledgerRouter);
app.use("/api/payouts", teacherPayoutsRouter);

// ── Production: serve built React frontend + SPA fallback ─────────────────────
if (isProduction) {
  const frontendDist = path.resolve(process.cwd(), "artifacts/aperti/dist/public");
  app.use(express.static(frontendDist, {
    maxAge: "1y",
    immutable: true,
    etag: false,
    setHeaders(res, filePath) {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      }
    },
  }));
  // SPA fallback — all non-API routes get index.html
  app.get("/{*path}", (req, res, next) => {
    const url = req.path;
    if (
      url.startsWith("/api") ||
      url.startsWith("/auth") ||
      url.startsWith("/dashboard") ||
      url.startsWith("/attendance") ||
      url.startsWith("/lessons") ||
      url.startsWith("/subscriptions") ||
      url.startsWith("/students") ||
      url.startsWith("/homework") ||
      url.startsWith("/question-bank") ||
      url.startsWith("/flashcards") ||
      url.startsWith("/mentor") ||
      url.startsWith("/revisit") ||
      url.startsWith("/exams") ||
      url.startsWith("/upload") ||
      url.startsWith("/courses") ||
      url.startsWith("/parent") ||
      url.startsWith("/socket.io") ||
      url.startsWith("/metrics") ||
      url.startsWith("/uploads")
    ) {
      return next();
    }
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

// ── Ensure all API/auth routes always return JSON (never HTML) ────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  const isApiRoute = req.path.startsWith("/api") || req.path.startsWith("/auth") ||
    req.path.startsWith("/dashboard") || req.path.startsWith("/attendance") ||
    req.path.startsWith("/students") || req.path.startsWith("/courses") ||
    req.path.startsWith("/exams") || req.path.startsWith("/homework") ||
    req.path.startsWith("/flashcards") || req.path.startsWith("/mentor") ||
    req.path.startsWith("/parent") || req.path.startsWith("/subscriptions");
  if (isApiRoute && !res.headersSent) {
    res.status(404).json({ error: "Route not found" });
  } else {
    next();
  }
});

// ── Global error handler — never leaks stack traces to clients ───────────────
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const status = typeof err.status === "number" ? err.status : (typeof err.statusCode === "number" ? err.statusCode : 500);
  logger.error({ err, method: req.method, url: req.url, status }, "Unhandled error");

  // Log to error_logs (Phase 33)
  pool.query(
    `INSERT INTO error_logs (level, message, stack, route, device, created_at)
     VALUES ($1,$2,$3,$4,$5,NOW())`,
    ["error", (err.message ?? "unknown").slice(0, 1000), (err.stack ?? "").slice(0, 5000), req.path, `${req.method} ${req.path}`],
  ).catch(() => {});

  // Also log to legacy frontend_error_logs for backward compat
  pool.query(
    `INSERT INTO frontend_error_logs (user_id, user_role, error_message, error_stack, component_stack, route, browser_info, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
    [null, "server", err.message ?? "unknown", err.stack?.slice(0, 2000) ?? "", "", req.path, `${req.method} ${req.path}`],
  ).catch(() => {});

  if (!res.headersSent) {
    res.setHeader("Content-Type", "application/json");
    const isProd = process.env.NODE_ENV === "production";
    res.status(status).json({
      error: status >= 500
        ? "Something went wrong. We've logged the issue."
        : (err.message ?? "Request failed"),
      ...(isProd ? {} : { _detail: err.message }),
    });
  }
});

// ── Seed default admin & start scheduler ─────────────────────────────────────
async function seedDefaultAdmin() {
  try {
    const existing = await db.select().from(accountsTable);
    if (existing.length === 0) {
      const { randomBytes } = await import("crypto");
      const tempPassword = randomBytes(12).toString("hex");
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      await db.insert(accountsTable).values({ username: "admin", passwordHash, displayName: "Admin", role: "admin", status: "active", mustChangePassword: true });
      logger.warn({ tempPassword }, "[SEED] Default admin created — CHANGE THIS PASSWORD IMMEDIATELY: admin / " + tempPassword);
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed admin account");
  }
}

seedDefaultAdmin();
startBackupScheduler();
startFounderAlertsWorker();
startPerfFlushInterval();

// Phase 29 — ensure DB performance indexes exist at startup
ensurePerformanceIndexes().catch(err => logger.warn({ err }, "[startup] Could not ensure indexes"));

export default app;
