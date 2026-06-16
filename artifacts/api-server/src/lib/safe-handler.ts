import { Request, Response, NextFunction } from "express";
import { logError } from "./log-error";
import { pool } from "@workspace/db";

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export function safeHandler(handler: AsyncHandler, errorCode = "HANDLER_EXCEPTION"): AsyncHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await handler(req, res, next);
    } catch (err: unknown) {
      const userId = (req as Record<string, unknown> & { user?: { id?: number } }).user?.id ?? null;

      await logError(err, { route: req.path, method: req.method, userId });

      const isAiRoute =
        req.path.includes("/ai") ||
        req.path.includes("/tutor") ||
        req.path.includes("/snap") ||
        req.path.includes("/mentor");

      if (isAiRoute) {
        pool
          .query(
            `INSERT INTO system_validation_errors
               (source, error_type, field_missing, raw_response, fallback_used, created_at)
             VALUES ($1, $2, $3, $4, true, NOW())`,
            [
              req.path,
              "ROUTE_EXCEPTION",
              null,
              JSON.stringify({ message: (err as Error)?.message?.slice(0, 500) }),
            ],
          )
          .catch(() => {});
      }

      if (!res.headersSent) {
        res.status(500).json({
          status: "degraded",
          message: "System temporarily operating in safe mode",
          requiresReview: true,
          error_code: errorCode,
        });
      }
    }
  };
}
