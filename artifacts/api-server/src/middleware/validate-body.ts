import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map(e => ({
        field: e.path.join(".") || "body",
        message: e.message,
      }));
      res.status(400).json({ error: "Validation failed", errors });
      return;
    }
    req.body = result.data;
    next();
  };
}
