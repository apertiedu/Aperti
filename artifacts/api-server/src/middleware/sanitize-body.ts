import type { Request, Response, NextFunction } from "express";

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim();
}

function sanitizeValue(val: unknown, depth = 0): unknown {
  if (depth > 8) return val;
  if (typeof val === "string") return stripHtml(val);
  if (Array.isArray(val)) return val.map(v => sanitizeValue(v, depth + 1));
  if (val !== null && typeof val === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      out[k] = sanitizeValue(v, depth + 1);
    }
    return out;
  }
  return val;
}

export function sanitizeBody(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeValue(req.body) as Record<string, unknown>;
  }
  next();
}
