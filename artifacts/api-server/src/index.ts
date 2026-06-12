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
  // ── Environment validation ─────────────────────────────────────────────────
  const requiredEnv = ["DATABASE_URL", "PORT"];
  const missingEnv = requiredEnv.filter(k => !process.env[k]);
  if (missingEnv.length > 0) {
    console.error(`[startup] FATAL: Missing required environment variables: ${missingEnv.join(", ")}`);
    process.exit(1);
  }
  // Warn about optional-but-important variables
  const warnEnv = ["JWT_SECRET", "SESSION_SECRET", "OPENAI_API_KEY"];
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

  const io = new SocketServer(httpServer, {
    cors: { origin: true, credentials: true },
    transports: ["websocket", "polling"],
    path: "/socket.io",
  });

  setupParentNotifications(io);

  httpServer.listen(port, (err?: Error) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, `Server started on port ${port}`);
  });
}

main().catch(err => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
