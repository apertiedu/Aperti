import { Router, type IRouter } from "express";
import { requireTenantAccess } from "../middleware/tenant";
import { pool } from "@workspace/db";

const router: IRouter = Router();

// ── PUBLIC: book a trial (no auth) ────────────────────────────────────────────

router.post("/public/trials", async (req, res): Promise<void> => {
  const { courseId, studentName, studentPhone, studentEmail, mode, scheduledAt, centerIdParam } = req.body;
  if (!courseId || !studentName?.trim()) { res.status(400).json({ message: "courseId and studentName required" }); return; }

  // Get teacher from course
  const { rows: courseRows } = await pool.query(`SELECT teacher_account_id FROM courses WHERE id=$1 AND is_active=TRUE`, [courseId]);
  if (!courseRows[0]) { res.status(404).json({ message: "Course not found" }); return; }

  // Anti-overbooking: check existing non-cancelled for same slot/center
  if (scheduledAt && centerIdParam) {
    const { rows: conflict } = await pool.query(`
      SELECT id FROM trial_sessions
      WHERE center_id=$1 AND scheduled_at=$2 AND status NOT IN ('cancelled')
    `, [centerIdParam, scheduledAt]);
    if (conflict.length > 0) { res.status(409).json({ message: "That slot is already taken. Please choose another time." }); return; }
  }

  const { rows } = await pool.query(`
    INSERT INTO trial_sessions (course_id, teacher_account_id, center_id, student_name, student_phone, student_email, mode, scheduled_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
  `, [courseId, courseRows[0].teacher_account_id, centerIdParam || null, studentName.trim(),
      studentPhone?.trim() || null, studentEmail?.trim() || null, mode || "online", scheduledAt || null]);
  res.status(201).json(rows[0]);
});

// ── TEACHER: view + manage trial bookings ─────────────────────────────────────

router.get("/trials", requireTenantAccess, async (req, res): Promise<void> => {
  const { teacherId, accountId, isAdmin } = req.tenant;
  const effectiveId = isAdmin ? null : (teacherId ?? accountId);
  const { status } = req.query as Record<string, string>;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (effectiveId) { conditions.push(`ts.teacher_account_id=$${i++}`); params.push(effectiveId); }
  if (status) { conditions.push(`ts.status=$${i++}`); params.push(status); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await pool.query(`
    SELECT ts.*, c.title AS course_title, ct.name AS center_name
    FROM trial_sessions ts
    LEFT JOIN courses c ON c.id=ts.course_id
    LEFT JOIN centers ct ON ct.id=ts.center_id
    ${where} ORDER BY ts.created_at DESC
  `, params);
  res.json(rows);
});

router.patch("/trials/:id/status", requireTenantAccess, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { teacherId, isAdmin } = req.tenant;
  const { status, notes } = req.body;
  const allowed = ["pending", "confirmed", "cancelled", "completed"];
  if (!allowed.includes(status)) { res.status(400).json({ message: `status must be one of: ${allowed.join(", ")}` }); return; }
  const tenantCond = isAdmin ? "" : ` AND teacher_account_id=${teacherId}`;
  const { rows } = await pool.query(
    `UPDATE trial_sessions SET status=$1, notes=COALESCE($2,notes) WHERE id=$3${tenantCond} RETURNING *`,
    [status, notes?.trim() || null, id]
  );
  if (!rows[0]) { res.status(404).json({ message: "Trial not found" }); return; }
  res.json(rows[0]);
});

router.delete("/trials/:id", requireTenantAccess, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { teacherId, isAdmin } = req.tenant;
  const tenantCond = isAdmin ? "" : ` AND teacher_account_id=${teacherId}`;
  await pool.query(`DELETE FROM trial_sessions WHERE id=$1${tenantCond}`, [id]);
  res.json({ message: "Deleted" });
});

export default router;
