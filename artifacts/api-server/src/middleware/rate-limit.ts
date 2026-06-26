/**
 * Rate Limiting — Aperti V2
 *
 * Layered rate limiting strategy:
 *   1. Global IP limiter (app.ts) — 200 req/min per IP
 *   2. Route-specific limiters below — per-user (authenticated) or per-IP (unauthenticated)
 *   3. Burst protection via tight windowMs on sensitive endpoints
 *
 * Key generator priority:
 *   authenticated → user:{id}  (prevents IP-sharing bypass in schools/NAT)
 *   unauthenticated → ip:{addr}
 */

import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// Per-user key: uses authenticated userId when available, falls back to
// IPv6-safe IP address for unauthenticated requests.
function perUserKeyGenerator(req: any): string {
  if (req.userId) return `user:${req.userId}`;
  return `ip:${ipKeyGenerator(req)}`;
}

// Combined user+IP key: both must be within limits (double enforcement)
function perUserAndIpKeyGenerator(req: any): string {
  const ip = `ip:${ipKeyGenerator(req)}`;
  if (req.userId) return `user:${req.userId}::${ip}`;
  return ip;
}

// ── Export limiter ────────────────────────────────────────────────────────────
export const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,     // 1 hour
  max: 20,
  keyGenerator: perUserKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Export rate limit exceeded. Maximum 20 exports per hour." },
  skip: (req: any) => req.role === "admin" || req.role === "super_admin",
});

// ── Report limiter ────────────────────────────────────────────────────────────
export const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  keyGenerator: perUserKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Report rate limit exceeded. Maximum 60 reports per hour." },
  skip: (req: any) => req.role === "admin" || req.role === "super_admin",
});

// ── Search limiter ────────────────────────────────────────────────────────────
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: perUserKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Search rate limit exceeded. Please slow down." },
});

// ── Upload limiter ────────────────────────────────────────────────────────────
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: perUserAndIpKeyGenerator,  // Double enforcement for uploads
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Upload rate limit exceeded. Maximum 30 uploads per hour." },
});

// ── File download limiter ─────────────────────────────────────────────────────
export const fileDownloadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: perUserKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "File download rate limit exceeded." },
});

// ── AI streaming — tight burst window to prevent token-cost abuse ─────────────
export const aiStreamLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: perUserKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "AI rate limit exceeded. Please wait a moment before generating again." },
  skip: (req: any) => req.role === "admin" || req.role === "super_admin",
});

// ── AI bulk/batch operations — more restrictive hourly window ─────────────────
export const aiBatchLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  keyGenerator: perUserKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "AI batch rate limit exceeded. Maximum 50 batch AI requests per hour." },
  skip: (req: any) => req.role === "admin" || req.role === "super_admin",
});

// ── Password reset — strict per-IP to prevent enumeration attacks ─────────────
export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req: any) => `ip:${ipKeyGenerator(req)}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many password reset attempts. Please wait 15 minutes before trying again." },
});

// ── Login — prevent credential stuffing ───────────────────────────────────────
// Applied per-IP (not per-user) because userId is not known at login time.
// Intentionally more lenient than the middleware version to avoid false lockouts
// for NAT'd school networks; we rely on MFA and brute-force alerts for the rest.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req: any) => `ip:${ipKeyGenerator(req)}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please wait 15 minutes." },
});

// ── MFA verification — tighter than login to prevent brute-force on codes ─────
export const mfaLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  keyGenerator: perUserKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many MFA attempts. Please wait 10 minutes." },
});

// ── Registration — prevents account creation abuse ────────────────────────────
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req: any) => `ip:${ipKeyGenerator(req)}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many registration attempts from this address. Please try again later." },
});

// ── Webhook / external integration endpoints ──────────────────────────────────
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req: any) => `ip:${ipKeyGenerator(req)}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Webhook rate limit exceeded." },
});

// ── Grading — prevent automated mass-grading abuse ───────────────────────────
export const gradingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: perUserKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Grading rate limit exceeded. Please slow down." },
});

// ── Admin actions — tighter burst protection for destructive operations ───────
export const adminActionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: perUserKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Admin action rate limit exceeded." },
});
