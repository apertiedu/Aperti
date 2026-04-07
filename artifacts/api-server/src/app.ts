import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import router from "./routes";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import bcrypt from "bcryptjs";
import { db, accountsTable } from "@workspace/db";

const app: Express = express();
const PgSession = connectPgSimple(session);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    store: new PgSession({ pool, tableName: "session" }),
    secret: process.env["SESSION_SECRET"] || "aperti-fallback-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 },
  })
);

// Auth guard: all /api routes except /api/auth/* require a session
app.use("/api", (req: Request, res: Response, next: NextFunction): void => {
  if (req.path.startsWith("/auth/")) {
    next();
    return;
  }
  if (!(req.session as any).accountId) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  next();
});

app.use("/api", router);

// Seed default admin account if none exist
async function seedDefaultAdmin() {
  try {
    const existing = await db.select().from(accountsTable);
    if (existing.length === 0) {
      const passwordHash = await bcrypt.hash("aperti2024", 10);
      await db.insert(accountsTable).values({
        username: "admin",
        passwordHash,
        displayName: "Admin",
      });
      logger.info("Default admin account created: admin / aperti2024");
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed admin account");
  }
}

seedDefaultAdmin();

export default app;
