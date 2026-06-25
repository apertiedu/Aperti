import { Response, NextFunction } from "express";
import { pool } from "@workspace/db";
import type { AuthRequest } from "./auth";

export const ASSISTANT_PERMISSIONS = [
  "can_manage_courses",
  "can_manage_materials",
  "can_grade_exams",
  "can_approve_grades",
  "can_manage_enrollments",
  "can_view_students",
  "can_view_reports",
  "can_view_revenue",
  "can_manage_assistants",
  "manage_students",
  "approve_enrollments",
  "manage_attendance",
  "manage_flashcards",
  "manage_homework",
  "manage_exams",
  "view_analytics",
  "manage_sessions",
  "mark_payments",
] as const;

export type AssistantPermission = typeof ASSISTANT_PERMISSIONS[number];

export async function hasAssistantPermission(
  assistantId: number,
  permission: AssistantPermission,
): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM assistant_permissions WHERE assistant_id=$1 AND permission=$2 LIMIT 1`,
    [assistantId, permission],
  );
  return rows.length > 0;
}

export function requireAssistantPermission(permission: AssistantPermission) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (req.role === "admin" || req.role === "super_admin" || req.role === "teacher") {
      next();
      return;
    }
    if (req.role !== "assistant") {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const allowed = await hasAssistantPermission(req.userId, permission);
    if (!allowed) {
      res.status(403).json({ error: `Assistant requires permission: ${permission}` });
      return;
    }
    next();
  };
}
