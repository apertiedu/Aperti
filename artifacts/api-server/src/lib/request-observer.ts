import { Request, Response, NextFunction } from "express";
import { pool } from "@workspace/db";

const SKIP_PREFIXES = ["/uploads", "/metrics", "/favicon", "/_"];
const SKIP_EXACT = new Set(["/api/healthz", "/api/health"]);

type AuthReq = Request & { user?: { id?: number; role?: string } };

export function requestObserver(req: AuthReq, res: Response, next: NextFunction): void {
  const path = req.path;

  if (
    SKIP_EXACT.has(path) ||
    SKIP_PREFIXES.some((p) => path.startsWith(p))
  ) {
    return next();
  }

  const start = Date.now();

  res.on("finish", () => {
    if (Math.random() > 0.1) return;
    const latency_ms = Date.now() - start;
    const statusCode = res.statusCode;
    const success = statusCode < 400;
    const userId = req.user?.id ?? null;
    const role = req.user?.role ?? null;

    pool
      .query(
        `INSERT INTO system_metrics_log
           (method, path, status_code, latency_ms, user_id, role, success, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          req.method,
          path.slice(0, 200),
          statusCode,
          latency_ms,
          userId,
          role,
          success,
        ],
      )
      .catch(() => {});
  });

  next();
}
