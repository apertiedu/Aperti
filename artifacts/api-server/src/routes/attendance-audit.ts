import { Router, Request, Response } from "express";
import { pool } from "@workspace/db";
import { requireRole } from "../middleware/auth";
import type { AuthRequest } from "../middleware/auth";

export const attendanceAuditRouter = Router();
attendanceAuditRouter.use(requireRole("admin", "super_admin", "teacher", "assistant"));

attendanceAuditRouter.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { studentId, lessonId, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const conditions: string[] = [];
    const params: any[] = [];

    if (studentId) { conditions.push(`aa.student_id = $${params.length + 1}`); params.push(parseInt(studentId)); }
    if (lessonId) { conditions.push(`aa.lesson_id = $${params.length + 1}`); params.push(parseInt(lessonId)); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await pool.query(`
      SELECT aa.*,
        s.name AS student_name, s.student_code,
        l.lesson_number, l.day_of_week
      FROM attendance_audit aa
      LEFT JOIN students s ON s.id = aa.student_id
      LEFT JOIN lessons l ON l.id = aa.lesson_id
      ${where}
      ORDER BY aa.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, parseInt(limit), parseInt(offset)]);

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM attendance_audit aa ${where}`, params
    );
    res.json({ rows, total: parseInt(countRows[0].count) });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

attendanceAuditRouter.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const {
      attendanceId, studentId, lessonId, action, oldStatus, newStatus,
      deviceInfo, scanMethod, notes,
    } = req.body;

    if (!studentId || !action) return res.status(400).json({ error: "studentId and action required" });

    const performedBy = (req as any).user?.id;
    const performedByName = (req as any).user?.displayName ?? (req as any).user?.email ?? "Unknown";
    const performedByRole = (req as any).user?.role ?? "unknown";
    const ipAddress = req.ip;

    const { rows } = await pool.query(`
      INSERT INTO attendance_audit
        (attendance_id, student_id, lesson_id, action, old_status, new_status,
         performed_by, performed_by_name, performed_by_role, device_info, ip_address, scan_method, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
    `, [attendanceId, studentId, lessonId, action, oldStatus, newStatus,
        performedBy, performedByName, performedByRole, deviceInfo, ipAddress, scanMethod, notes]);

    res.status(201).json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

attendanceAuditRouter.get("/summary", async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        action,
        scan_method,
        COUNT(*) AS count,
        DATE(created_at) AS date
      FROM attendance_audit
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY action, scan_method, DATE(created_at)
      ORDER BY date DESC
    `);

    const { rows: topActors } = await pool.query(`
      SELECT performed_by_name, COUNT(*) AS actions
      FROM attendance_audit
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY performed_by_name
      ORDER BY actions DESC LIMIT 5
    `);

    const { rows: recent } = await pool.query(`
      SELECT aa.*, s.name AS student_name
      FROM attendance_audit aa
      LEFT JOIN students s ON s.id = aa.student_id
      ORDER BY aa.created_at DESC LIMIT 10
    `);

    res.json({ byAction: rows, topActors, recent });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});
