/**
 * Correlation ID Middleware — Aperti V2
 *
 * Attaches a unique request ID to every request for end-to-end tracing.
 * Reads X-Request-Id from the client if present (useful for frontend-initiated
 * traces), otherwise generates a new one. The ID is propagated in responses
 * so log aggregators (e.g. Pino, Prometheus) can correlate entries.
 */

import { Request, Response, NextFunction } from "express";
import { randomBytes } from "crypto";

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

export function correlationId(req: Request, res: Response, next: NextFunction): void {
  const incoming =
    (req.headers["x-request-id"] as string | undefined)?.slice(0, 64) ||
    (req.headers["x-correlation-id"] as string | undefined)?.slice(0, 64);

  const id = incoming ?? `ap-${randomBytes(8).toString("hex")}`;
  (req as any).correlationId = id;

  res.setHeader("X-Request-Id", id);
  res.setHeader("X-Correlation-Id", id);
  next();
}
