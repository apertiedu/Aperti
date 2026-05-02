import { Router, type IRouter } from "express";
import { requireTenantAccess } from "../middleware/tenant";
import { pool } from "@workspace/db";

const router: IRouter = Router();

// ── PUBLIC: list courses for a teacher ────────────────────────────────────────

router.get("/public/courses", async (req, res): Promise<void> => {
  const { teacherId } = req.query as Record<string, string>;
  const cond = teacherId ? `AND c.teacher_account_id = $1` : "";
  const params = teacherId ? [parseInt(teacherId, 10)] : [];
  const { rows } = await pool.query(`
    SELECT c.*, a.display_name AS teacher_name
    FROM courses c
    JOIN accounts a ON a.id = c.teacher_account_id
    WHERE c.is_active = TRUE ${cond}
    ORDER BY c.created_at DESC
  `, params);
  res.json(rows);
});

// ── TEACHER CRUD ──────────────────────────────────────────────────────────────

router.get("/courses", requireTenantAccess, async (req, res): Promise<void> => {
  const { teacherId, accountId, isAdmin } = req.tenant;
  const effectiveId = isAdmin ? null : (teacherId ?? accountId);
  const { rows } = await pool.query(
    effectiveId
      ? `SELECT * FROM courses WHERE teacher_account_id=$1 ORDER BY created_at DESC`
      : `SELECT c.*, a.display_name AS teacher_name FROM courses c JOIN accounts a ON a.id=c.teacher_account_id ORDER BY c.created_at DESC`,
    effectiveId ? [effectiveId] : []
  );
  res.json(rows);
});

router.post("/courses", requireTenantAccess, async (req, res): Promise<void> => {
  const { teacherId, accountId, isAdmin } = req.tenant;
  const effectiveId = isAdmin ? accountId : (teacherId ?? accountId);
  const { title, description, subject, difficulty, priceMonthly, pricePerSession, priceTrial, mode, maxStudents, syllabus } = req.body;
  if (!title?.trim()) { res.status(400).json({ message: "Title is required" }); return; }
  const { rows } = await pool.query(`
    INSERT INTO courses (teacher_account_id, title, description, subject, difficulty, price_monthly, price_per_session, price_trial, mode, max_students, syllabus)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
  `, [effectiveId, title.trim(), description?.trim() || null, subject?.trim() || null,
      difficulty || "beginner", priceMonthly || null, pricePerSession || null, priceTrial || null,
      mode || "online", maxStudents || null, syllabus?.trim() || null]);
  res.status(201).json(rows[0]);
});

router.patch("/courses/:id", requireTenantAccess, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const { teacherId, isAdmin } = req.tenant;
  const { title, description, subject, difficulty, priceMonthly, pricePerSession, priceTrial, mode, maxStudents, syllabus, isActive } = req.body;
  const sets: string[] = []; const params: unknown[] = []; let i = 1;
  if (title) { sets.push(`title=$${i++}`); params.push(title.trim()); }
  if ("description" in req.body) { sets.push(`description=$${i++}`); params.push(description?.trim() || null); }
  if ("subject" in req.body) { sets.push(`subject=$${i++}`); params.push(subject?.trim() || null); }
  if (difficulty) { sets.push(`difficulty=$${i++}`); params.push(difficulty); }
  if ("priceMonthly" in req.body) { sets.push(`price_monthly=$${i++}`); params.push(priceMonthly || null); }
  if ("pricePerSession" in req.body) { sets.push(`price_per_session=$${i++}`); params.push(pricePerSession || null); }
  if ("priceTrial" in req.body) { sets.push(`price_trial=$${i++}`); params.push(priceTrial || null); }
  if (mode) { sets.push(`mode=$${i++}`); params.push(mode); }
  if ("maxStudents" in req.body) { sets.push(`max_students=$${i++}`); params.push(maxStudents || null); }
  if ("syllabus" in req.body) { sets.push(`syllabus=$${i++}`); params.push(syllabus?.trim() || null); }
  if ("isActive" in req.body) { sets.push(`is_active=$${i++}`); params.push(!!isActive); }
  if (!sets.length) { res.status(400).json({ message: "Nothing to update" }); return; }
  const tenantCond = isAdmin ? "" : ` AND teacher_account_id=${teacherId}`;
  params.push(id);
  const { rows } = await pool.query(`UPDATE courses SET ${sets.join(",")} WHERE id=$${i}${tenantCond} RETURNING *`, params);
  if (!rows[0]) { res.status(404).json({ message: "Course not found" }); return; }
  res.json(rows[0]);
});

router.delete("/courses/:id", requireTenantAccess, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const { teacherId, isAdmin } = req.tenant;
  const tenantCond = isAdmin ? "" : ` AND teacher_account_id=${teacherId}`;
  await pool.query(`DELETE FROM courses WHERE id=$1${tenantCond}`, [id]);
  res.json({ message: "Deleted" });
});

export default router;
