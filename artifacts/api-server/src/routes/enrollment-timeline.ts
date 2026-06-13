import { Router, Request, Response } from "express";
import { pool } from "@workspace/db";
import { requireRole } from "../middleware/auth";
import type { AuthRequest } from "../middleware/auth";

export const enrollmentTimelineRouter = Router();
enrollmentTimelineRouter.use(requireRole("admin", "super_admin", "teacher"));

enrollmentTimelineRouter.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { studentId, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const conditions: string[] = [];
    const params: any[] = [];

    if (studentId) { conditions.push(`et.student_id = $${params.length + 1}`); params.push(parseInt(studentId)); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await pool.query(`
      SELECT et.*, s.name AS student_name, s.student_code
      FROM enrollment_timeline et
      LEFT JOIN students s ON s.id = et.student_id
      ${where}
      ORDER BY et.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, parseInt(limit), parseInt(offset)]);

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM enrollment_timeline et ${where}`, params
    );
    res.json({ rows, total: parseInt(countRows[0].count) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

enrollmentTimelineRouter.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const { studentId, action, entityType, entityId, entityName, previousValue, newValue, notes } = req.body;
    if (!studentId || !action) return res.status(400).json({ error: "studentId and action required" });

    const performedBy = (req as any).user?.id;
    const performedByName = (req as any).user?.displayName ?? (req as any).user?.email ?? "Unknown";

    const { rows } = await pool.query(`
      INSERT INTO enrollment_timeline
        (student_id, action, entity_type, entity_id, entity_name, previous_value, new_value, performed_by, performed_by_name, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `, [studentId, action, entityType, entityId, entityName, previousValue, newValue, performedBy, performedByName, notes]);

    res.status(201).json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

enrollmentTimelineRouter.get("/student/:studentId", async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT et.*, s.name AS student_name
      FROM enrollment_timeline et
      LEFT JOIN students s ON s.id = et.student_id
      WHERE et.student_id = $1
      ORDER BY et.created_at DESC
      LIMIT 100
    `, [parseInt(req.params.studentId)]);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
