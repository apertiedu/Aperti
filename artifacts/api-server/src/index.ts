import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import { execSync } from "child_process";
import path from "path";
import { logger } from "./lib/logger";
import { runMigrations } from "./db/migrate";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function main() {
  // ── API key + base URL aliasing ────────────────────────────────────────────
  // NVIDIA_API_KEY is stored in Replit secrets. Map it so all AI routes that
  // read process.env.OPENAI_API_KEY / OPENAI_BASE_URL work without code changes.
  if (process.env.NVIDIA_API_KEY) {
    if (!process.env.OPENAI_API_KEY) {
      process.env.OPENAI_API_KEY = process.env.NVIDIA_API_KEY;
    }
    if (!process.env.OPENAI_BASE_URL) {
      process.env.OPENAI_BASE_URL = "https://integrate.api.nvidia.com/v1";
    }
    if (!process.env.OPENAI_MODEL) {
      process.env.OPENAI_MODEL = "openai/gpt-oss-20b";
    }
  }

  // ── Environment validation ─────────────────────────────────────────────────
  const isProd = process.env.NODE_ENV === "production";

  // JWT_SECRET: fall back to SESSION_SECRET in development so the server
  // can start when only SESSION_SECRET is configured in Replit Secrets.
  if (!process.env["JWT_SECRET"] && process.env["SESSION_SECRET"]) {
    process.env["JWT_SECRET"] = process.env["SESSION_SECRET"];
    console.warn("[startup] WARN: JWT_SECRET not set — using SESSION_SECRET as fallback. Set JWT_SECRET explicitly for production.");
  }

  const requiredEnv = ["DATABASE_URL", "PORT", "JWT_SECRET"];
  const missingEnv = requiredEnv.filter(k => !process.env[k]);
  if (missingEnv.length > 0) {
    console.error(`[startup] FATAL: Missing required environment variables: ${missingEnv.join(", ")}`);
    process.exit(1);
  }
  const jwtSecret = process.env.JWT_SECRET!;
  if (jwtSecret.length < 32) {
    if (isProd) {
      console.error(`[startup] FATAL: JWT_SECRET must be at least 32 characters long. Current length: ${jwtSecret.length}`);
      process.exit(1);
    } else {
      console.warn(`[startup] WARN: JWT_SECRET is short (${jwtSecret.length} chars) — use ≥32 chars in production.`);
    }
  }
  if (isProd && jwtSecret === "aperti-dev-secret-change-in-prod") {
    console.error("[startup] FATAL: JWT_SECRET is set to the default insecure value. Please set a strong, unique secret.");
    process.exit(1);
  }
  const instapayVars = ["INSTAPAY_PHONE", "INSTAPAY_NAME"].filter(k => !process.env[k]);
  if (instapayVars.length > 0) {
    if (isProd) {
      console.error(`[startup] FATAL: Missing payment variables: ${instapayVars.join(", ")} — payment instructions will be broken in production`);
      process.exit(1);
    } else {
      console.warn(`[startup] WARN: ${instapayVars.join(", ")} not set — payment instructions will show placeholders (acceptable in development)`);
    }
  }
  const warnEnv = ["SESSION_SECRET", "OPENAI_API_KEY"];
  const missingWarn = warnEnv.filter(k => !process.env[k]);
  if (missingWarn.length > 0) {
    console.warn(`[startup] WARN: Missing recommended environment variables: ${missingWarn.join(", ")} — some features may be limited`);
  }
  logger.info("Environment validated");

  // ── Step 0: Push base Drizzle schema (creates accounts, students, etc.) ──────
  const wsRoot = path.resolve(process.cwd(), "../..");
  // tsx is installed in lib/db's local node_modules since it's a devDependency there
  const tsxBin = path.join(wsRoot, "lib/db/node_modules/.bin/tsx");
  const pushScript = path.join(wsRoot, "lib/db/push-schema.ts");
  try {
    execSync(`"${tsxBin}" "${pushScript}"`, {
      cwd: wsRoot,
      stdio: "inherit",
      env: process.env,
    });
    console.log("[startup] Base schema pushed successfully");
  } catch (err: any) {
    console.warn("[startup] push-schema warning (non-fatal):", err?.message || err);
  }

  // Run migrations first — must complete before anything else
  try {
    await runMigrations();
    logger.info("Database connected");
  } catch (err) {
    logger.error({ err }, "Migration error — continuing");
  }

  logger.info("Storage ready");

  // Import app AFTER migrations so seedDefaultAdmin runs against a ready DB
  const { default: app } = await import("./app");

  import("./lib/autopilot-service").then(({ startAutopilotService }) => {
    startAutopilotService();
  }).catch(() => {});

  const { setupParentNotifications } = await import("./socket/parent-notifications");

  const httpServer = createServer(app);

  const allowedWsOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  if (!allowedWsOrigins.length && isProd) {
    logger.warn("ALLOWED_ORIGINS is not set — Socket.IO will accept connections from any origin in production. Set ALLOWED_ORIGINS to restrict this.");
  }

  const io = new SocketServer(httpServer, {
    cors: {
      origin: allowedWsOrigins.length > 0 ? allowedWsOrigins : true,
      credentials: true,
    },
    transports: ["websocket", "polling"],
    path: "/socket.io",
  });

  setupParentNotifications(io);

  setupGracefulShutdown(httpServer);

  httpServer.listen(port, (err?: Error) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, `Server started on port ${port}`);
  });
}

// ── Graceful shutdown — drain in-flight requests before exit ─────────────────
function setupGracefulShutdown(server: ReturnType<typeof createServer>) {
  let isShuttingDown = false;

  const shutdown = (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info({ signal }, "Graceful shutdown initiated");

    server.close(async () => {
      logger.info("HTTP server closed — draining DB pool");
      try {
        const { pool: dbPool } = await import("@workspace/db");
        await dbPool.end();
        logger.info("DB pool closed cleanly");
      } catch (e) {
        logger.warn({ e }, "DB pool close warning");
      }
      logger.info("Shutdown complete");
      process.exit(0);
    });

    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 15_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  return shutdown;
}

// ── Process-level error capture ───────────────────────────────────────────────
process.on("uncaughtException", (err) => {
  console.error("[process] uncaughtException:", err.message, err.stack);
  // Attempt DB log — pool may not be ready, so wrap safely
  import("@workspace/db").then(({ pool }) => {
    pool.query(
      `INSERT INTO error_logs (level, message, stack, route, device, created_at) VALUES ($1,$2,$3,$4,$5,NOW())`,
      ["error", (err.message || "uncaughtException").slice(0, 1000), (err.stack || "").slice(0, 5000), "process", "node"],
    ).catch(() => {});
  }).catch(() => {});
});

process.on("unhandledRejection", (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  console.error("[process] unhandledRejection:", err.message);
  import("@workspace/db").then(({ pool }) => {
    pool.query(
      `INSERT INTO error_logs (level, message, stack, route, device, created_at) VALUES ($1,$2,$3,$4,$5,NOW())`,
      ["error", (err.message || "unhandledRejection").slice(0, 1000), (err.stack || "").slice(0, 5000), "process", "node"],
    ).catch(() => {});
  }).catch(() => {});
});

main().catch(err => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
