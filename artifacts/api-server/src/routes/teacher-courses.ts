import { Router, Response } from "express";
import { authenticate, AuthRequest, requireRole } from "../middleware/auth";
import { pool } from "@workspace/db";
import { enforceLimit, incrementUsage, decrementUsage } from "../middleware/enforce-limit";

export const teacherCoursesRouter = Router();

/* ── List my courses ──────────────────────────────────────────────────── */
teacherCoursesRouter.get(
  "/teacher-courses",
  authenticate,
  requireRole("teacher", "admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const tid = req.userId!;
      const { rows } = await pool.query(
        `SELECT tc.*,
                s.name AS subject_name,
                (SELECT COUNT(*) FROM course_units cu WHERE cu.course_id = tc.id) AS unit_count
           FROM teacher_courses tc
           LEFT JOIN subjects s ON tc.subject_id = s.id
          WHERE tc.teacher_account_id = $1
          ORDER BY tc.created_at DESC`,
        [tid],
      );
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: "An unexpected error occurred" });
    }
  },
);

/* ── Create course ────────────────────────────────────────────────────── */
teacherCoursesRouter.post(
  "/teacher-courses",
  authenticate,
  requireRole("teacher", "admin"),
  enforceLimit("courses"),
  async (req: AuthRequest, res: Response) => {
    try {
      const tid = req.userId!;
      const { name, description, subject_id, board, level, session, duration_weeks, language, visibility } = req.body;
      const { rows } = await pool.query(
        `INSERT INTO teacher_courses
           (teacher_account_id, subject_id, name, description, board, level, session, duration_weeks, language, visibility)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [tid, subject_id || null, name, description || null, board || "CAIE", level || "A-Level", session || null, duration_weeks || 12, language || "English", visibility || "draft"],
      );
      await incrementUsage(tid, "courses");
      res.status(201).json(rows[0]);
    } catch (e: any) {
      res.status(500).json({ error: "An unexpected error occurred" });
    }
  },
);

/* ── Get single course with units/topics/lessons ──────────────────────── */
teacherCoursesRouter.get(
  "/teacher-courses/:id",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { rows: courses } = await pool.query(
        `SELECT tc.*, s.name AS subject_name
           FROM teacher_courses tc
           LEFT JOIN subjects s ON tc.subject_id = s.id
          WHERE tc.id = $1`,
        [req.params.id],
      );
      if (!courses.length) return res.status(404).json({ error: "Not found" });
      const course = courses[0];

      const { rows: units } = await pool.query(
        `SELECT cu.*,
                json_agg(
                  json_build_object(
                    'id', ct.id, 'title', ct.title, 'ord', ct.ord,
                    'lessons', (
                      SELECT json_agg(json_build_object(
                        'id', cl.id, 'title', cl.title, 'type', cl.type,
                        'duration_min', cl.duration_min, 'content_id', cl.content_id
                      ) ORDER BY cl.ord)
                      FROM course_lessons_map cl WHERE cl.topic_id = ct.id
                    )
                  ) ORDER BY ct.ord
                ) FILTER (WHERE ct.id IS NOT NULL) AS topics
           FROM course_units cu
           LEFT JOIN course_topics ct ON ct.unit_id = cu.id
          WHERE cu.course_id = $1
          GROUP BY cu.id
          ORDER BY cu.ord`,
        [course.id],
      );
      res.json({ ...course, units });
    } catch (e: any) {
      res.status(500).json({ error: "An unexpected error occurred" });
    }
  },
);

/* ── Update course ────────────────────────────────────────────────────── */
teacherCoursesRouter.put(
  "/teacher-courses/:id",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { name, description, subject_id, board, level, session, duration_weeks, language, visibility } = req.body;
      await pool.query(
        `UPDATE teacher_courses
            SET name=$1, description=$2, subject_id=$3, board=$4, level=$5,
                session=$6, duration_weeks=$7, language=$8, visibility=$9, updated_at=NOW()
          WHERE id=$10 AND teacher_account_id=$11`,
        [name, description, subject_id || null, board, level, session, duration_weeks, language, visibility, req.params.id, req.userId!],
      );
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: "An unexpected error occurred" });
    }
  },
);

/* ── Delete course ────────────────────────────────────────────────────── */
teacherCoursesRouter.delete(
  "/teacher-courses/:id",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      await pool.query("DELETE FROM teacher_courses WHERE id=$1 AND teacher_account_id=$2", [req.params.id, req.userId!]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: "An unexpected error occurred" });
    }
  },
);

/* ── Unit CRUD ────────────────────────────────────────────────────────── */
teacherCoursesRouter.post("/teacher-courses/:courseId/units", authenticate, async (req: AuthRequest, res: Response) => {
  const { title, ord } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO course_units (course_id, title, ord) VALUES ($1,$2,$3) RETURNING *`,
    [req.params.courseId, title, ord ?? 0],
  );
  res.status(201).json(rows[0]);
});

teacherCoursesRouter.put("/teacher-courses/units/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const { title, ord } = req.body;
  const isAdmin = req.role === "admin" || req.role === "super_admin";
  const ownerCheck = isAdmin
    ? await pool.query("SELECT id FROM course_units WHERE id=$1 LIMIT 1", [req.params.id])
    : await pool.query(
        `SELECT cu.id FROM course_units cu
         JOIN teacher_courses tc ON tc.id = cu.course_id
         WHERE cu.id=$1 AND tc.teacher_account_id=$2 LIMIT 1`,
        [req.params.id, req.userId],
      );
  if (ownerCheck.rows.length === 0) { res.status(403).json({ error: "Forbidden" }); return; }
  await pool.query("UPDATE course_units SET title=$1, ord=$2 WHERE id=$3", [title, ord, req.params.id]);
  res.json({ success: true });
});

teacherCoursesRouter.delete("/teacher-courses/units/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const isAdmin = req.role === "admin" || req.role === "super_admin";
  const ownerCheck = isAdmin
    ? await pool.query("SELECT id FROM course_units WHERE id=$1 LIMIT 1", [req.params.id])
    : await pool.query(
        `SELECT cu.id FROM course_units cu
         JOIN teacher_courses tc ON tc.id = cu.course_id
         WHERE cu.id=$1 AND tc.teacher_account_id=$2 LIMIT 1`,
        [req.params.id, req.userId],
      );
  if (ownerCheck.rows.length === 0) { res.status(403).json({ error: "Forbidden" }); return; }
  await pool.query("DELETE FROM course_units WHERE id=$1", [req.params.id]);
  res.json({ success: true });
});

/* ── Topic CRUD ───────────────────────────────────────────────────────── */
teacherCoursesRouter.post("/teacher-courses/units/:unitId/topics", authenticate, async (req: AuthRequest, res: Response) => {
  const { title, ord } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO course_topics (unit_id, title, ord) VALUES ($1,$2,$3) RETURNING *`,
    [req.params.unitId, title, ord ?? 0],
  );
  res.status(201).json(rows[0]);
});

teacherCoursesRouter.delete("/teacher-courses/topics/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const isAdmin = req.role === "admin" || req.role === "super_admin";
  const ownerCheck = isAdmin
    ? await pool.query("SELECT id FROM course_topics WHERE id=$1 LIMIT 1", [req.params.id])
    : await pool.query(
        `SELECT ct.id FROM course_topics ct
         JOIN course_units cu ON cu.id = ct.unit_id
         JOIN teacher_courses tc ON tc.id = cu.course_id
         WHERE ct.id=$1 AND tc.teacher_account_id=$2 LIMIT 1`,
        [req.params.id, req.userId],
      );
  if (ownerCheck.rows.length === 0) { res.status(403).json({ error: "Forbidden" }); return; }
  await pool.query("DELETE FROM course_topics WHERE id=$1", [req.params.id]);
  res.json({ success: true });
});

/* ── Lesson CRUD ──────────────────────────────────────────────────────── */
teacherCoursesRouter.post("/teacher-courses/topics/:topicId/lessons", authenticate, async (req: AuthRequest, res: Response) => {
  const { title, type, duration_min, ord } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO course_lessons_map (topic_id, title, type, duration_min, ord) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.params.topicId, title, type || "lecture", duration_min || 60, ord ?? 0],
  );
  res.status(201).json(rows[0]);
});

teacherCoursesRouter.delete("/teacher-courses/lessons/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const isAdmin = req.role === "admin" || req.role === "super_admin";
  const ownerCheck = isAdmin
    ? await pool.query("SELECT id FROM course_lessons_map WHERE id=$1 LIMIT 1", [req.params.id])
    : await pool.query(
        `SELECT clm.id FROM course_lessons_map clm
         JOIN course_topics ct ON ct.id = clm.topic_id
         JOIN course_units cu ON cu.id = ct.unit_id
         JOIN teacher_courses tc ON tc.id = cu.course_id
         WHERE clm.id=$1 AND tc.teacher_account_id=$2 LIMIT 1`,
        [req.params.id, req.userId],
      );
  if (ownerCheck.rows.length === 0) { res.status(403).json({ error: "Forbidden" }); return; }
  await pool.query("DELETE FROM course_lessons_map WHERE id=$1", [req.params.id]);
  res.json({ success: true });
});
