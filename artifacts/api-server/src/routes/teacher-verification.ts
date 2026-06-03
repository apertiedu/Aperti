import { Router, Response } from "express";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export const teacherVerificationRouter = Router();

// Ensure is_verified column exists on accounts
async function ensureVerifiedColumn() {
  try {
    await db.execute(sql`
      ALTER TABLE accounts
        ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS verified_at timestamp,
        ADD COLUMN IF NOT EXISTS verified_by integer
    `);
  } catch (_) {}
}
ensureVerifiedColumn();

// GET /teacher-verification — list all teachers with enrollment counts
teacherVerificationRouter.get(
  "/",
  authenticate,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    const rows = await db.execute(sql`
      SELECT
        a.id,
        a.username,
        a.name,
        COALESCE(a.is_verified, false) AS is_verified,
        a.verified_at,
        COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'approved') AS enrolled_count
      FROM accounts a
      LEFT JOIN aperti_courses c ON c.teacher_id = a.id
      LEFT JOIN course_enrollments e ON e.course_id = c.id
      WHERE a.role = 'teacher'
      GROUP BY a.id
      ORDER BY enrolled_count DESC
    `);
    res.json((rows as any).rows ?? rows);
  }
);

// PUT /teacher-verification/:id/approve
teacherVerificationRouter.put(
  "/:id/approve",
  authenticate,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id);
    await db.execute(sql`
      UPDATE accounts SET is_verified = true, verified_at = NOW(), verified_by = ${req.userId}
      WHERE id = ${id}
    `);
    res.json({ success: true });
  }
);

// PUT /teacher-verification/:id/revoke
teacherVerificationRouter.put(
  "/:id/revoke",
  authenticate,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id);
    await db.execute(sql`
      UPDATE accounts SET is_verified = false, verified_at = NULL, verified_by = NULL
      WHERE id = ${id}
    `);
    res.json({ success: true });
  }
);
