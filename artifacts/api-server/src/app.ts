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

const app: Express = express();
const PgSession = connectPgSimple(session);

const isProduction = process.env.NODE_ENV === "production";
if (isProduction) {
  app.set("trust proxy", 1);
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) { return { id: req.id, method: req.method, url: req.url?.split("?")[0] }; },
      res(res) { return { statusCode: res.statusCode }; },
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
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

// Auth is enforced per-route via JWT middleware (authenticate) — no global session guard needed.

app.use("/api", router);

app.use("/auth", authRouter);
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

export default app;
