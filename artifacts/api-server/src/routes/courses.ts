import { Router, Response } from "express";
import { authenticate, AuthRequest, requireRole } from "../middleware/auth";
import { pool } from "@workspace/db";

export const coursesRouter = Router();

// ── PUBLIC ────────────────────────────────────────────────────────────────────

coursesRouter.get("/", async (req, res: Response) => {
  try {
    const { search, subject } = req.query as Record<string, string>;
    let q = `
      SELECT c.id, c.title, c.description, c.subject, c.price_egp, c.thumbnail_url,
             c.duration_weeks, c.enrolled_count, c.created_at,
             a.display_name AS teacher_name, a.username AS teacher_username
      FROM aperti_courses c
      LEFT JOIN accounts a ON c.teacher_account_id = a.id
      WHERE c.is_published = TRUE`;
    const params: any[] = [];
    if (subject) { params.push(subject); q += ` AND c.subject=$${params.length}`; }
    if (search) { params.push(`%${search}%`); q += ` AND (c.title ILIKE $${params.length} OR c.description ILIKE $${params.length})`; }
    q += " ORDER BY c.created_at DESC";
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

coursesRouter.get("/teacher/my", authenticate, requireRole("teacher","admin","assistant"), async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM course_enrollments WHERE course_id=c.id AND status='pending') AS pending_count,
        (SELECT COUNT(*) FROM course_enrollments WHERE course_id=c.id AND status='approved') AS approved_count
       FROM aperti_courses c WHERE c.teacher_account_id=$1 ORDER BY c.created_at DESC`,
      [req.userId]
    );
    res.json(rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

coursesRouter.get("/teacher/enrollments", authenticate, requireRole("teacher","admin","assistant"), async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.*, c.title AS course_title, a.display_name AS student_name, a.username AS student_username, a.email AS student_email
       FROM course_enrollments e
       JOIN aperti_courses c ON e.course_id=c.id
       JOIN accounts a ON e.student_account_id=a.id
       WHERE c.teacher_account_id=$1 ORDER BY e.requested_at DESC`,
      [req.userId]
    );
    res.json(rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

coursesRouter.get("/my/enrollments", authenticate, requireRole("student"), async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.*, c.title AS course_title, c.subject, c.price_egp, c.thumbnail_url, c.description, a.display_name AS teacher_name
       FROM course_enrollments e
       JOIN aperti_courses c ON e.course_id=c.id
       LEFT JOIN accounts a ON c.teacher_account_id=a.id
       WHERE e.student_account_id=$1 ORDER BY e.requested_at DESC`,
      [req.userId]
    );
    res.json(rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

coursesRouter.get("/:id", async (req, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, a.display_name AS teacher_name, a.username AS teacher_username,
        (SELECT COUNT(*) FROM course_enrollments WHERE course_id=c.id AND status='approved') AS enrolled_count_real
       FROM aperti_courses c LEFT JOIN accounts a ON c.teacher_account_id=a.id
       WHERE c.id=$1 AND c.is_published=TRUE`,
      [parseInt(req.params.id)]
    );
    if (!rows[0]) return res.status(404).json({ error: "Course not found" });
    res.json(rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── TEACHER CRUD ──────────────────────────────────────────────────────────────

coursesRouter.post("/", authenticate, requireRole("teacher","admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, subject, priceEgp, thumbnailUrl, durationWeeks, isPublished } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });
    const { rows } = await pool.query(
      `INSERT INTO aperti_courses (title,description,subject,price_egp,thumbnail_url,duration_weeks,is_published,teacher_account_id,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW()) RETURNING *`,
      [title, description||null, subject||null, priceEgp||null, thumbnailUrl||null, durationWeeks||8, isPublished??false, req.userId]
    );
    res.status(201).json(rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

coursesRouter.put("/:id", authenticate, requireRole("teacher","admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { title,description,subject,priceEgp,thumbnailUrl,durationWeeks,isPublished } = req.body;
    const { rowCount } = await pool.query(
      `UPDATE aperti_courses SET title=$1,description=$2,subject=$3,price_egp=$4,thumbnail_url=$5,duration_weeks=$6,is_published=$7
       WHERE id=$8 AND teacher_account_id=$9`,
      [title,description,subject,priceEgp,thumbnailUrl,durationWeeks,isPublished,parseInt(req.params.id),req.userId]
    );
    if (!rowCount) return res.status(404).json({ error: "Not found or unauthorized" });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

coursesRouter.delete("/:id", authenticate, requireRole("teacher","admin"), async (req: AuthRequest, res: Response) => {
  try {
    await pool.query("DELETE FROM aperti_courses WHERE id=$1 AND teacher_account_id=$2", [parseInt(req.params.id), req.userId]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── ENROLLMENT ────────────────────────────────────────────────────────────────

coursesRouter.post("/:id/enroll", authenticate, requireRole("student"), async (req: AuthRequest, res: Response) => {
  try {
    const courseId = parseInt(req.params.id);
    const { rows: ex } = await pool.query(
      "SELECT id FROM course_enrollments WHERE course_id=$1 AND student_account_id=$2", [courseId, req.userId]
    );
    if (ex.length) return res.status(409).json({ error: "Already requested enrollment" });
    const { rows } = await pool.query(
      "INSERT INTO course_enrollments (course_id,student_account_id) VALUES ($1,$2) RETURNING *",
      [courseId, req.userId]
    );
    res.status(201).json(rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

coursesRouter.put("/enrollments/:id", authenticate, requireRole("teacher","admin","assistant"), async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    if (!["approved","rejected"].includes(status)) return res.status(400).json({ error: "Invalid status" });
    await pool.query(
      "UPDATE course_enrollments SET status=$1,approved_by=$2,approved_at=NOW() WHERE id=$3",
      [status, req.userId, parseInt(req.params.id)]
    );
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});
