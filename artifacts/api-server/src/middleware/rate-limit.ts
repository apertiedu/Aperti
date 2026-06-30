/**
 * Rate Limiting — Aperti V2
 *
 * Layered rate limiting strategy:
 *   1. Global IP limiter (app.ts) — 200 req/min per IP
 *   2. Route-specific limiters below — per-user (authenticated) or per-IP (unauthenticated)
 *   3. Burst protection via tight windowMs on sensitive endpoints
 *
 * Store priority:
 *   Redis (when REDIS_URL is set) → shared across all processes / instances
 *   Memory (fallback)             → per-process only (single-instance deployments)
 */

import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { rateLimitStore } from "../lib/redis-rate-limit-store";

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

// Shared base options applied to every limiter
const BASE_OPTS = {
  standardHeaders: true,
  legacyHeaders: false,
  // When Redis store is available, all limiters share it automatically.
  // Undefined store → express-rate-limit defaults to in-memory.
  store: rateLimitStore,
  validate: { xForwardedForHeader: false },
} as const;

// ── Export limiter ────────────────────────────────────────────────────────────
export const exportLimiter = rateLimit({
  ...BASE_OPTS,
  windowMs: 60 * 60 * 1000,     // 1 hour
  max: 20,
  keyGenerator: perUserKeyGenerator,
  message: { error: "Export rate limit exceeded. Maximum 20 exports per hour." },
  skip: (req: any) => req.role === "admin" || req.role === "super_admin",
});

// ── Report limiter ────────────────────────────────────────────────────────────
export const reportLimiter = rateLimit({
  ...BASE_OPTS,
  windowMs: 60 * 60 * 1000,
  max: 60,
  keyGenerator: perUserKeyGenerator,
  message: { error: "Report rate limit exceeded. Maximum 60 reports per hour." },
  skip: (req: any) => req.role === "admin" || req.role === "super_admin",
});

// ── Search limiter ────────────────────────────────────────────────────────────
export const searchLimiter = rateLimit({
  ...BASE_OPTS,
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: perUserKeyGenerator,
  message: { error: "Search rate limit exceeded. Please slow down." },
});

// ── Upload limiter ────────────────────────────────────────────────────────────
export const uploadLimiter = rateLimit({
  ...BASE_OPTS,
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: perUserAndIpKeyGenerator,  // Double enforcement for uploads
  message: { error: "Upload rate limit exceeded. Maximum 30 uploads per hour." },
});

// ── File download limiter ─────────────────────────────────────────────────────
export const fileDownloadLimiter = rateLimit({
  ...BASE_OPTS,
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: perUserKeyGenerator,
  message: { error: "File download rate limit exceeded." },
});

// ── AI streaming — tight burst window to prevent token-cost abuse ─────────────
export const aiStreamLimiter = rateLimit({
  ...BASE_OPTS,
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: perUserKeyGenerator,
  message: { error: "AI rate limit exceeded. Please wait a moment before generating again." },
  skip: (req: any) => req.role === "admin" || req.role === "super_admin",
});

// ── AI bulk/batch operations — more restrictive hourly window ─────────────────
export const aiBatchLimiter = rateLimit({
  ...BASE_OPTS,
  windowMs: 60 * 60 * 1000,
  max: 50,
  keyGenerator: perUserKeyGenerator,
  message: { error: "AI batch rate limit exceeded. Maximum 50 batch AI requests per hour." },
  skip: (req: any) => req.role === "admin" || req.role === "super_admin",
});

// ── Password reset — strict per-IP to prevent enumeration attacks ─────────────
export const passwordResetLimiter = rateLimit({
  ...BASE_OPTS,
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req: any) => `ip:${ipKeyGenerator(req)}`,
  message: { error: "Too many password reset attempts. Please wait 15 minutes before trying again." },
});

// ── Login — prevent credential stuffing ───────────────────────────────────────
export const loginLimiter = rateLimit({
  ...BASE_OPTS,
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req: any) => `ip:${ipKeyGenerator(req)}`,
  message: { error: "Too many login attempts. Please wait 15 minutes." },
});

// ── MFA verification — tighter than login to prevent brute-force on codes ─────
export const mfaLimiter = rateLimit({
  ...BASE_OPTS,
  windowMs: 10 * 60 * 1000,
  max: 5,
  keyGenerator: perUserKeyGenerator,
  message: { error: "Too many MFA attempts. Please wait 10 minutes." },
});

// ── Registration — prevents account creation abuse ────────────────────────────
export const registerLimiter = rateLimit({
  ...BASE_OPTS,
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req: any) => `ip:${ipKeyGenerator(req)}`,
  message: { error: "Too many registration attempts from this address. Please try again later." },
});

// ── Webhook / external integration endpoints ──────────────────────────────────
export const webhookLimiter = rateLimit({
  ...BASE_OPTS,
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req: any) => `ip:${ipKeyGenerator(req)}`,
  message: { error: "Webhook rate limit exceeded." },
});

// ── Grading — prevent automated mass-grading abuse ───────────────────────────
export const gradingLimiter = rateLimit({
  ...BASE_OPTS,
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: perUserKeyGenerator,
  message: { error: "Grading rate limit exceeded. Please slow down." },
});

// ── Admin actions — tighter burst protection for destructive operations ───────
export const adminActionLimiter = rateLimit({
  ...BASE_OPTS,
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: perUserKeyGenerator,
  message: { error: "Admin action rate limit exceeded." },
});

// ── Notifications — prevent notification spam / mass-mark flooding ────────────
export const notificationsLimiter = rateLimit({
  ...BASE_OPTS,
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: perUserKeyGenerator,
  message: { error: "Notification rate limit exceeded. Please slow down." },
});

// ── Contact form — public endpoint; prevent spam ──────────────────────────────
export const contactLimiter = rateLimit({
  ...BASE_OPTS,
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: "Too many contact requests. Please try again later." },
});
