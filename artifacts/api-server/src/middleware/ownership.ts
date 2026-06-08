import { Request, Response, NextFunction } from "express";
import { pool } from "@workspace/db";
import { AuthRequest } from "./auth";

export async function requireOwnership(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const role = (req as any).role;
  if (role === "admin" || role === "super_admin") return next();

  const teacherId = (req as any).userId;
  const courseId = parseInt(req.params.courseId || req.params.id || "0");

  if (!courseId) return next();

  if (role === "teacher") {
    const result = await pool.query(
      `SELECT id FROM aperti_courses WHERE id = $1 AND teacher_id = $2 LIMIT 1`,
      [courseId, teacherId]
    );
    if (result.rows.length === 0) {
      return res.status(403).json({ error: "Access denied: you do not own this resource" });
    }
    return next();
  }

  if (role === "assistant") {
    const result = await pool.query(
      `SELECT ga.id FROM gov_assistant_approvals ga
       JOIN aperti_courses ac ON ac.teacher_id = ga.teacher_id
       WHERE ac.id = $1 AND ga.assistant_id = $2 AND ga.status = 'approved'
       LIMIT 1`,
      [courseId, teacherId]
    );
    if (result.rows.length === 0) {
      return res.status(403).json({ error: "Access denied: no approved assignment for this course" });
    }
    return next();
  }

  return res.status(403).json({ error: "Access denied" });
}

export function requireSelf(userIdParam = "userId") {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const role = (req as any).role;
    if (role === "admin" || role === "super_admin") return next();
    const targetId = parseInt(req.params[userIdParam] || "0");
    if (targetId && targetId !== (req as any).userId) {
      return res.status(403).json({ error: "Access denied: you can only access your own data" });
    }
    return next();
  };
}
