import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import app from "./app";
import { logger } from "./lib/logger";
import { setupParentNotifications } from "./socket/parent-notifications";
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

runMigrations().catch(err => logger.error({ err }, "Migration error — continuing"));

import("./lib/autopilot-service").then(({ startAutopilotService }) => {
  startAutopilotService();
}).catch(() => {});

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
  logger.info({ port }, "Server listening");
});
