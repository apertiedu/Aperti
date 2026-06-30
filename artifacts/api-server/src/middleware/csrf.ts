/**
 * CSRF protection — double-submit cookie pattern
 *
 * For every state-changing request (POST/PUT/PATCH/DELETE) on authenticated
 * endpoints the server compares the cookie `csrf_token` with the request
 * header `x-csrf-token`.  Both must be present and match.
 *
 * The frontend obtains a token from GET /api/auth/csrf-token and stores it
 * in memory (never localStorage) while setting the cookie via the server.
 */
import { Request, Response, NextFunction } from "express";
import { randomBytes, timingSafeEqual } from "crypto";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Paths that are intentionally public or handle their own CSRF-equivalent protection.
// Auth endpoints use rate-limiting + SameSite=lax cookies for primary CSRF defence;
// error-reporting endpoints are telemetry-only and carry no privileged state.
const CSRF_EXEMPT_PREFIXES = [
  // Public auth — protected by rate-limiter + SameSite lax cookies
  "/auth/login",
  "/auth/logout",
  "/auth/register",
  "/auth/student-register",
  "/auth/signup",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/google",           // OAuth callback redirect
  // Error telemetry — no privileged state-change
  "/api/errors/",
  "/api/founder/frontend-errors",
  // Public contact form — no auth; rate-limited separately
  "/api/contact",
  // Webhooks — use their own signature verification
  "/api/webhooks/",
  // Health / metrics
  "/api/health",
];

function isExempt(path: string): boolean {
  return CSRF_EXEMPT_PREFIXES.some(p => path.startsWith(p));
}

/**
 * Middleware — validates CSRF token on mutating requests.
 * Must be placed AFTER cookie-parser and BEFORE auth middleware that checks
 * userId, so unauthenticated mutations are caught by auth first and
 * authenticated mutations are caught here.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Skip safe HTTP methods
  if (SAFE_METHODS.has(req.method)) { next(); return; }

  // Skip exempt paths
  if (isExempt(req.path)) { next(); return; }

  const cookie = (req.cookies as Record<string, string | undefined>)["csrf_token"];
  const header = req.headers["x-csrf-token"] as string | undefined;

  if (!cookie || !header) {
    res.status(403).json({ error: "CSRF token missing" });
    return;
  }

  try {
    const a = Buffer.from(cookie);
    const b = Buffer.from(header);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      res.status(403).json({ error: "CSRF token invalid" });
      return;
    }
  } catch {
    res.status(403).json({ error: "CSRF token invalid" });
    return;
  }

  next();
}

/**
 * Issue a new CSRF token cookie + return it in the JSON body.
 * Frontend calls GET /api/auth/csrf-token on app boot and stores the token
 * in memory, attaching it as X-CSRF-Token on every mutating request.
 */
export function issueCsrfToken(req: Request, res: Response): void {
  const token = randomBytes(32).toString("hex");

  res.cookie("csrf_token", token, {
    httpOnly: false,          // must be readable by JS so the header can be set
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 24 * 60 * 60 * 1000, // 24 h
    path: "/",
  });

  res.json({ csrfToken: token });
}
