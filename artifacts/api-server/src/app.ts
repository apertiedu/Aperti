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

app.use("/api", (req: Request, res: Response, next: NextFunction): void => {
  if (req.path.startsWith("/auth/") || req.path.startsWith("/public/")) { next(); return; }
  if (!(req.session as any).accountId) { res.status(401).json({ message: "Not authenticated" }); return; }
  next();
});

app.use("/api", router);

async function seedDefaultAdmin() {
  try {
    const existing = await db.select().from(accountsTable);
    if (existing.length === 0) {
      const passwordHash = await bcrypt.hash("aperti2024", 10);
      await db.insert(accountsTable).values({ username: "admin", passwordHash, displayName: "Admin", role: "admin", status: "active" });
      logger.info("Default admin created: admin / aperti2024");
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed admin account");
  }
}

seedDefaultAdmin();

export default app;

import { authRouter } from "./routes/auth";
import { dashboardRouter } from "./routes/dashboard";
import { attendanceRouter } from "./routes/attendance";
import { lessonsRouter } from "./routes/lessons";
import { subscriptionsRouter } from "./routes/subscriptions";

app.use("/auth", authRouter);
app.use("/dashboard", dashboardRouter);
app.use("/attendance", attendanceRouter);
app.use("/lessons", lessonsRouter);
app.use("/subscriptions", subscriptionsRouter);

import { studentsRouter } from "./routes/students";
app.use("/students", studentsRouter);


import { liveClassRouter } from "./routes/live-class";
app.use("/live-class", liveClassRouter);

import { homeworkRouter } from "./routes/homework";
app.use("/homework", homeworkRouter);

import { questionBankRouter } from "./routes/question-bank";
app.use("/question-bank", questionBankRouter);

import { flashcardsRouter } from "./routes/flashcards";
app.use("/flashcards", flashcardsRouter);

import { mentorRouter } from "./routes/mentor";
app.use("/mentor", mentorRouter);


import { revisitRouter } from "./routes/revisit";
app.use("/revisit", revisitRouter);

import { examsRouter } from "./routes/exams";
app.use("/exams", examsRouter);
