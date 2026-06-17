import { Router, Response } from "express";
import { authenticate, AuthRequest, requireRole } from "../middleware/auth";
import { pool } from "@workspace/db";
import { enforceLimit, incrementUsage, decrementUsage } from "../middleware/enforce-limit";
import { validateBody } from "../middleware/validate-body";
import { z } from "zod";

const createCourseSchema = z.object({
  title:              z.string().min(1, "Title is required").max(200),
  description:        z.string().max(5000).optional(),
  subject:            z.string().max(100).optional(),
  priceEgp:           z.number().nonnegative().nullable().optional(),
  thumbnailUrl:       z.string().url().nullable().optional().or(z.literal("")),
  durationWeeks:      z.number().int().min(1).max(104).optional(),
  isPublished:        z.boolean().optional(),
  deliveryType:       z.enum(["Online","Offline","Hybrid"]).optional(),
  paymentModel:       z.enum(["monthly","one-time","subscription","free"]).optional(),
  recordingsIncluded: z.boolean().optional(),
  materialsFeeEgp:    z.number().nonnegative().nullable().optional(),
});

export const coursesRouter = Router();

// Idempotent migration: create aperti_courses if missing, then add columns
const COURSE_MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS aperti_courses (
    id          serial PRIMARY KEY,
    title       text NOT NULL,
    description text,
    created_at  timestamptz NOT NULL DEFAULT NOW(),
    updated_at  timestamptz NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE aperti_courses ADD COLUMN IF NOT EXISTS subject text`,
  `ALTER TABLE aperti_courses ADD COLUMN IF NOT EXISTS thumbnail_url text`,
  `ALTER TABLE aperti_courses ADD COLUMN IF NOT EXISTS duration_weeks integer NOT NULL DEFAULT 8`,
  `ALTER TABLE aperti_courses ADD COLUMN IF NOT EXISTS enrolled_count integer NOT NULL DEFAULT 0`,
  `ALTER TABLE aperti_courses ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false`,
  `ALTER TABLE aperti_courses ADD COLUMN IF NOT EXISTS teacher_account_id integer REFERENCES accounts(id) ON DELETE CASCADE`,
  `ALTER TABLE aperti_courses ADD COLUMN IF NOT EXISTS delivery_type text NOT NULL DEFAULT 'Online'`,
  `ALTER TABLE aperti_courses ADD COLUMN IF NOT EXISTS payment_model text NOT NULL DEFAULT 'monthly'`,
  `ALTER TABLE aperti_courses ADD COLUMN IF NOT EXISTS recordings_included boolean NOT NULL DEFAULT true`,
  `ALTER TABLE aperti_courses ADD COLUMN IF NOT EXISTS materials_fee_egp numeric(10,2)`,
  `CREATE TABLE IF NOT EXISTS course_enrollments (
    id                  serial PRIMARY KEY,
    course_id           integer NOT NULL REFERENCES aperti_courses(id) ON DELETE CASCADE,
    student_account_id  integer NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    status              text NOT NULL DEFAULT 'pending',
    approved_by         integer,
    approved_at         timestamptz,
    requested_at        timestamptz NOT NULL DEFAULT NOW()
  )`,
];
(async () => {
  for (const q of COURSE_MIGRATIONS) {
    await pool.query(q).catch(() => {});
  }
})();

// ── PUBLIC ────────────────────────────────────────────────────────────────────

coursesRouter.get("/", async (req, res: Response) => {
  try {
    const { search, subject } = req.query as Record<string, string>;
    let q = `
      SELECT c.*,
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
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
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
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
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
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
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
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
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
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

// ── TEACHER CRUD ──────────────────────────────────────────────────────────────

coursesRouter.post("/", authenticate, requireRole("teacher","admin"), enforceLimit("courses"), validateBody(createCourseSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, subject, priceEgp, thumbnailUrl, durationWeeks, isPublished,
      deliveryType, paymentModel, recordingsIncluded, materialsFeeEgp } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO aperti_courses
         (title,description,subject,price_egp,thumbnail_url,duration_weeks,is_published,teacher_account_id,created_at,
          delivery_type,payment_model,recordings_included,materials_fee_egp)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),$9,$10,$11,$12) RETURNING *`,
      [title, description||null, subject||null, priceEgp||null, thumbnailUrl||null,
       durationWeeks||8, isPublished??false, req.userId,
       deliveryType||'Online', paymentModel||'monthly',
       recordingsIncluded !== false, materialsFeeEgp||null]
    );
    await incrementUsage(req.userId!, "courses");
    res.status(201).json(rows[0]);
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

coursesRouter.put("/:id", authenticate, requireRole("teacher","admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, subject, priceEgp, thumbnailUrl, durationWeeks, isPublished,
      deliveryType, paymentModel, recordingsIncluded, materialsFeeEgp } = req.body;
    const { rowCount } = await pool.query(
      `UPDATE aperti_courses SET
         title=$1, description=$2, subject=$3, price_egp=$4, thumbnail_url=$5,
         duration_weeks=$6, is_published=$7,
         delivery_type=$8, payment_model=$9, recordings_included=$10, materials_fee_egp=$11
       WHERE id=$12 AND teacher_account_id=$13`,
      [title, description, subject, priceEgp, thumbnailUrl, durationWeeks, isPublished,
       deliveryType||'Online', paymentModel||'monthly',
       recordingsIncluded !== false, materialsFeeEgp||null,
       parseInt(req.params.id), req.userId]
    );
    if (!rowCount) return res.status(404).json({ error: "Not found or unauthorized" });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

coursesRouter.delete("/:id", authenticate, requireRole("teacher","admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM aperti_courses WHERE id=$1 AND teacher_account_id=$2", [parseInt(req.params.id), req.userId]);
    if (rowCount && rowCount > 0) await decrementUsage(req.userId!, "courses");
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
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
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

coursesRouter.put("/enrollments/:id", authenticate, requireRole("teacher","admin","assistant"), async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    if (!["approved","rejected"].includes(status)) return res.status(400).json({ error: "Invalid status" });
    const enrollmentId = parseInt(req.params.id);
    if (isNaN(enrollmentId)) return res.status(400).json({ error: "Invalid enrollment ID" });

    const { rows: ownerRows } = await pool.query(
      `SELECT e.id FROM course_enrollments e
       JOIN aperti_courses c ON c.id = e.course_id
       WHERE e.id = $1 AND (c.teacher_account_id = $2 OR $3 = 'admin')`,
      [enrollmentId, req.userId, req.role ?? ""],
    );
    if (!ownerRows.length) return res.status(403).json({ error: "Access denied" });

    await pool.query(
      "UPDATE course_enrollments SET status=$1,approved_by=$2,approved_at=NOW() WHERE id=$3",
      [status, req.userId, enrollmentId],
    );
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

// PATCH /:id/archive — soft-archive a course (teacher or admin)
coursesRouter.patch("/:id/archive", authenticate, requireRole("teacher","admin"), async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(
      `ALTER TABLE aperti_courses ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false`
    ).catch(() => {});
    const { rowCount } = await pool.query(
      `UPDATE aperti_courses SET is_archived=true, is_published=false WHERE id=$1 AND teacher_account_id=$2`,
      [parseInt(req.params.id as string), req.userId]
    );
    if (!rowCount) return res.status(404).json({ error: "Course not found or unauthorized" });
    res.json({ success: true, message: "Course archived" });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

// PATCH /:id/unarchive — restore an archived course
coursesRouter.patch("/:id/unarchive", authenticate, requireRole("teacher","admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await pool.query(
      `UPDATE aperti_courses SET is_archived=false WHERE id=$1 AND teacher_account_id=$2`,
      [parseInt(req.params.id as string), req.userId]
    );
    if (!rowCount) return res.status(404).json({ error: "Course not found or unauthorized" });
    res.json({ success: true, message: "Course restored" });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});
