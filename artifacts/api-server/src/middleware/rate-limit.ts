import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// Per-user key: uses authenticated userId when available, falls back to
// IPv6-safe IP address for unauthenticated requests.
function perUserKeyGenerator(req: any): string {
  if (req.userId) return `user:${req.userId}`;
  return `ip:${ipKeyGenerator(req)}`;
}

export const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: perUserKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Export rate limit exceeded. Maximum 20 exports per hour." },
  skip: (req: any) => req.role === "admin" || req.role === "super_admin",
});

export const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  keyGenerator: perUserKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Report rate limit exceeded. Maximum 60 reports per hour." },
  skip: (req: any) => req.role === "admin" || req.role === "super_admin",
});

export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: perUserKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Search rate limit exceeded. Please slow down." },
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: perUserKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Upload rate limit exceeded. Maximum 30 uploads per hour." },
});

export const fileDownloadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: perUserKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "File download rate limit exceeded." },
});

// AI streaming — tight burst window to prevent token-cost abuse
export const aiStreamLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: perUserKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "AI rate limit exceeded. Please wait a moment before generating again." },
  skip: (req: any) => req.role === "admin" || req.role === "super_admin",
});

// AI bulk/batch operations — more restrictive hourly window
export const aiBatchLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  keyGenerator: perUserKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "AI batch rate limit exceeded. Maximum 50 batch AI requests per hour." },
  skip: (req: any) => req.role === "admin" || req.role === "super_admin",
});

// Password reset — strict per-IP to prevent enumeration attacks
export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req: any) => `ip:${ipKeyGenerator(req)}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many password reset attempts. Please wait 15 minutes before trying again." },
});

// Login — prevent credential stuffing (per-IP, not per-user)
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req: any) => `ip:${ipKeyGenerator(req)}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please wait 15 minutes." },
});

// MFA verification — tighter than login to prevent brute-force on codes
export const mfaLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  keyGenerator: perUserKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many MFA attempts. Please wait 10 minutes." },
});

// Registration — prevents account creation abuse
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req: any) => `ip:${ipKeyGenerator(req)}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many registration attempts from this address. Please try again later." },
});

// Webhook / external integration endpoints
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req: any) => `ip:${ipKeyGenerator(req)}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Webhook rate limit exceeded." },
});
