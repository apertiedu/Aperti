import rateLimit from "express-rate-limit";

function perUserKeyGenerator(req: any): string {
  return `user:${req.userId ?? req.ip}`;
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
