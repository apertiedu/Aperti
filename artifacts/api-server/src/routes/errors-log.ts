import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { pool } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";

export const errorsLogRouter = Router();

const errorLogLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many error reports — slow down" },
});

export async function logErrorToDb(payload: {
  level?: string;
  message: string;
  stack?: string;
  route?: string;
  userId?: number | null;
  role?: string | null;
  device?: string;
  browser?: string;
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO error_logs (level, message, stack, route, user_id, role, device, browser, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
      [
        (payload.level || "error").slice(0, 20),
        (payload.message || "unknown").slice(0, 1000),
        (payload.stack || "").slice(0, 5000),
        (payload.route || "").slice(0, 500),
        payload.userId ?? null,
        (payload.role || null),
        (payload.device || "").slice(0, 300),
        (payload.browser || "").slice(0, 300),
      ],
    );
  } catch {
    // non-fatal
  }
}

/* ── POST /api/errors/log — public, rate-limited ─────────────────────────── */
errorsLogRouter.post("/log", errorLogLimiter, async (req: Request, res: Response) => {
  const { message, stack, route, browserInfo, source, level } = req.body || {};
  await logErrorToDb({
    level: level || "error",
    message: message || "frontend error",
    stack,
    route,
    device: source || "browser",
    browser: (browserInfo || "").slice(0, 300),
  });
  res.json({ ok: true });
});

/* ── POST /api/errors/ux-violation — authenticated, logs UX rule violations ── */
const uxViolationLimiter = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false });

errorsLogRouter.post("/ux-violation", uxViolationLimiter, (req, res, next) => {
  try { (authenticate as any)(req, res, next); } catch { next(); }
}, async (req: AuthRequest, res: Response) => {
  try {
    const { route, rule_id, description, severity } = req.body ?? {};
    if (!route || !rule_id) { res.status(400).json({ error: "route and rule_id are required" }); return; }
    const safeRoute = String(route).slice(0, 300);
    const safeRule = String(rule_id).slice(0, 100);
    const safeDesc = String(description ?? "").slice(0, 500);
    const safeSev = ["warn", "error"].includes(severity) ? severity : "warn";
    await pool.query(
      `INSERT INTO ux_rule_violations (route, rule_id, description, severity, created_at) VALUES ($1, $2, $3, $4, NOW())`,
      [safeRoute, safeRule, safeDesc, safeSev]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to log violation" });
  }
});

/* ── POST /api/errors/log-auth — authenticated, writes userId/role ───────── */
errorsLogRouter.post("/log-auth", (req, res, next) => {
  try { (authenticate as any)(req, res, next); } catch { next(); }
}, async (req: AuthRequest, res: Response) => {
  const { message, stack, route, browserInfo, source, level } = req.body || {};
  await logErrorToDb({
    level: level || "error",
    message: message || "frontend error",
    stack,
    route,
    userId: req.userId ?? null,
    role: req.role ?? null,
    device: source || "browser",
    browser: (browserInfo || "").slice(0, 300),
  });
  res.json({ ok: true });
});
