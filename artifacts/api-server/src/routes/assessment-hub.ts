import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, AuthRequest, requireRole } from "../middleware/auth";
import crypto from "crypto";
import { enforceLimit, incrementUsage, decrementUsage } from "../middleware/enforce-limit";

export const assessmentHubRouter = Router();

const teacherOrAdmin = [authenticate, requireRole("teacher", "admin")];
const anyAuth = [authenticate];

// ── CREATE ASSESSMENT ────────────────────────────────────────────────────────
assessmentHubRouter.post("/assessments", ...teacherOrAdmin, enforceLimit("assessments"), async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.userId!;
    const {
      title, type = "quiz", subject_id, course_id,
      instructions, time_limit_minutes, total_marks = 0,
      passing_mark, scheduled_for, due_at, settings = {},
    } = req.body;

    if (!title) return res.status(400).json({ error: "title is required" });

    const { rows } = await pool.query(
      `INSERT INTO assessments
         (teacher_id, title, type, subject_id, course_id, instructions,
          time_limit_minutes, total_marks, passing_mark, scheduled_for, due_at, settings)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [teacherId, title, type, subject_id ?? null, course_id ?? null,
       instructions ?? null, time_limit_minutes ?? null, total_marks,
       passing_mark ?? null, scheduled_for ?? null, due_at ?? null,
       JSON.stringify(settings)]
    );
    await incrementUsage(teacherId, "assessments");
    res.status(201).json({ assessment: rows[0] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── LIST ASSESSMENTS ─────────────────────────────────────────────────────────
assessmentHubRouter.get("/assessments", ...anyAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const role = (req as any).userRole ?? "teacher";
    const { status, type, limit = "20", offset = "0" } = req.query as Record<string, string>;

    let query: string;
    let params: any[];

    if (role === "student") {
      query = `
        SELECT a.*, asub.status AS submission_status, asub.score
        FROM assessments a
        LEFT JOIN assessment_submissions asub
          ON asub.assessment_id = a.id AND asub.student_id = (
            SELECT id FROM students WHERE account_id = $1 LIMIT 1
          )
        WHERE a.status IN ('published','active','completed')
        ${status ? `AND a.status = '${status.replace(/'/g, "''")}'` : ""}
        ORDER BY a.created_at DESC LIMIT $2 OFFSET $3`;
      params = [userId, parseInt(limit), parseInt(offset)];
    } else {
      query = `
        SELECT a.*,
          COUNT(DISTINCT asub.id) AS submission_count,
          ROUND(AVG(asub.score), 1) AS avg_score
        FROM assessments a
        LEFT JOIN assessment_submissions asub ON asub.assessment_id = a.id
        WHERE a.teacher_id = $1
        ${status ? `AND a.status = '${status.replace(/'/g, "''")}'` : ""}
        ${type ? `AND a.type = '${type.replace(/'/g, "''")}'` : ""}
        GROUP BY a.id
        ORDER BY a.created_at DESC LIMIT $2 OFFSET $3`;
      params = [userId, parseInt(limit), parseInt(offset)];
    }

    const { rows } = await pool.query(query, params);
    res.json({ assessments: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── GET ASSESSMENT DETAILS ────────────────────────────────────────────────────
assessmentHubRouter.get("/assessments/:id", ...anyAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const [assessRes, sectionsRes, questionsRes] = await Promise.all([
      pool.query("SELECT * FROM assessments WHERE id = $1", [id]),
      pool.query("SELECT * FROM assessment_sections WHERE assessment_id = $1 ORDER BY section_order", [id]),
      pool.query(
        `SELECT aq.*,
                qb.question_text, qb.topic, qb.subtopic, qb.difficulty,
                qb.model_answer, qb.image_url, qb.tags
         FROM assessment_questions aq
         LEFT JOIN question_bank qb ON qb.id = aq.question_bank_id
         WHERE aq.assessment_id = $1
         ORDER BY aq.section_id NULLS FIRST, aq.question_order`,
        [id]
      ),
    ]);

    if (!assessRes.rows.length) return res.status(404).json({ error: "Assessment not found" });

    res.json({
      assessment: assessRes.rows[0],
      sections: sectionsRes.rows,
      questions: questionsRes.rows,
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── UPDATE ASSESSMENT ─────────────────────────────────────────────────────────
assessmentHubRouter.put("/assessments/:id", ...teacherOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const teacherId = req.userId!;
    const {
      title, type, status, instructions, time_limit_minutes,
      total_marks, passing_mark, scheduled_for, due_at, settings,
    } = req.body;

    const { rows } = await pool.query(
      `UPDATE assessments
       SET title = COALESCE($2, title),
           type = COALESCE($3, type),
           status = COALESCE($4, status),
           instructions = COALESCE($5, instructions),
           time_limit_minutes = COALESCE($6, time_limit_minutes),
           total_marks = COALESCE($7, total_marks),
           passing_mark = COALESCE($8, passing_mark),
           scheduled_for = COALESCE($9, scheduled_for),
           due_at = COALESCE($10, due_at),
           settings = COALESCE($11, settings),
           updated_at = NOW()
       WHERE id = $1 AND teacher_id = $12
       RETURNING *`,
      [id, title, type, status, instructions, time_limit_minutes,
       total_marks, passing_mark, scheduled_for, due_at,
       settings ? JSON.stringify(settings) : null, teacherId]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found or unauthorized" });
    res.json({ assessment: rows[0] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── DELETE (ARCHIVE) ASSESSMENT ───────────────────────────────────────────────
assessmentHubRouter.delete("/assessments/:id", ...teacherOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const teacherId = req.userId!;
    await pool.query(
      `UPDATE assessments SET status = 'archived', updated_at = NOW()
       WHERE id = $1 AND teacher_id = $2`,
      [id, teacherId]
    );
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── ADD SECTION ───────────────────────────────────────────────────────────────
assessmentHubRouter.post("/assessments/:id/sections", ...teacherOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title = "Section", instructions } = req.body;
    const orderRes = await pool.query(
      "SELECT COALESCE(MAX(section_order),0)+1 AS next FROM assessment_sections WHERE assessment_id=$1", [id]
    );
    const next = orderRes.rows[0].next;
    const { rows } = await pool.query(
      "INSERT INTO assessment_sections (assessment_id, title, section_order, instructions) VALUES ($1,$2,$3,$4) RETURNING *",
      [id, title, next, instructions ?? null]
    );
    res.status(201).json({ section: rows[0] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── ADD QUESTION ──────────────────────────────────────────────────────────────
assessmentHubRouter.post("/assessments/:id/questions", ...teacherOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { section_id, question_bank_id, custom_question, marks = 1, question_type = "written", options, correct_answer, rubric_id } = req.body;
    const orderRes = await pool.query(
      "SELECT COALESCE(MAX(question_order),0)+1 AS next FROM assessment_questions WHERE assessment_id=$1", [id]
    );
    const next = orderRes.rows[0].next;

    const { rows } = await pool.query(
      `INSERT INTO assessment_questions
         (assessment_id, section_id, question_bank_id, custom_question, marks,
          question_order, question_type, options, correct_answer, rubric_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [id, section_id ?? null, question_bank_id ?? null,
       custom_question ? JSON.stringify(custom_question) : null,
       marks, next, question_type,
       options ? JSON.stringify(options) : null,
       correct_answer ?? null, rubric_id ?? null]
    );

    // Update total marks
    await pool.query(
      "UPDATE assessments SET total_marks = (SELECT COALESCE(SUM(marks),0) FROM assessment_questions WHERE assessment_id=$1), updated_at=NOW() WHERE id=$1",
      [id]
    );

    res.status(201).json({ question: rows[0] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── REORDER QUESTIONS ─────────────────────────────────────────────────────────
assessmentHubRouter.put("/assessments/:id/questions/reorder", ...teacherOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body as { ids: number[] };
    if (!Array.isArray(ids)) return res.status(400).json({ error: "ids[] required" });
    await Promise.all(ids.map((qId, idx) =>
      pool.query("UPDATE assessment_questions SET question_order=$1 WHERE id=$2", [idx, qId])
    ));
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── PUBLISH ───────────────────────────────────────────────────────────────────
assessmentHubRouter.post("/assessments/:id/publish", ...teacherOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const teacherId = req.userId!;
    const { scheduled_for, due_at } = req.body;
    const status = scheduled_for ? "scheduled" : "published";
    const { rows } = await pool.query(
      `UPDATE assessments SET status=$2, scheduled_for=COALESCE($3,scheduled_for),
       due_at=COALESCE($4,due_at), updated_at=NOW()
       WHERE id=$1 AND teacher_id=$5 RETURNING *`,
      [id, status, scheduled_for ?? null, due_at ?? null, teacherId]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json({ assessment: rows[0] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── STUDENT: START ATTEMPT ────────────────────────────────────────────────────
assessmentHubRouter.post("/assessments/:id/start", ...anyAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    // Get student id
    const stuRes = await pool.query("SELECT id FROM students WHERE account_id=$1 LIMIT 1", [userId]);
    if (!stuRes.rows.length) return res.status(403).json({ error: "Not a student" });
    const studentId = stuRes.rows[0].id;

    // Check existing
    const existing = await pool.query(
      "SELECT * FROM assessment_submissions WHERE assessment_id=$1 AND student_id=$2", [id, studentId]
    );
    if (existing.rows.length && existing.rows[0].status !== "in_progress") {
      return res.status(409).json({ error: "Submission already exists", submission: existing.rows[0] });
    }
    if (existing.rows.length) return res.json({ submission: existing.rows[0] });

    const assess = await pool.query("SELECT * FROM assessments WHERE id=$1", [id]);
    if (!assess.rows.length) return res.status(404).json({ error: "Assessment not found" });
    if (!["published", "active"].includes(assess.rows[0].status)) {
      return res.status(403).json({ error: "Assessment not available" });
    }

    const { rows } = await pool.query(
      `INSERT INTO assessment_submissions (assessment_id, student_id, max_score, device_info)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [id, studentId, assess.rows[0].total_marks, JSON.stringify(req.body.device_info ?? {})]
    );

    // Fetch questions
    const questions = await pool.query(
      `SELECT aq.*, qb.question_text, qb.image_url, qb.topic
       FROM assessment_questions aq
       LEFT JOIN question_bank qb ON qb.id = aq.question_bank_id
       WHERE aq.assessment_id = $1
       ORDER BY aq.section_id NULLS FIRST, aq.question_order`,
      [id]
    );

    res.json({ submission: rows[0], questions: questions.rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── STUDENT: SUBMIT ───────────────────────────────────────────────────────────
assessmentHubRouter.post("/assessments/:id/submit", ...anyAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const stuRes = await pool.query("SELECT id FROM students WHERE account_id=$1 LIMIT 1", [userId]);
    if (!stuRes.rows.length) return res.status(403).json({ error: "Not a student" });
    const studentId = stuRes.rows[0].id;

    const sub = await pool.query(
      "SELECT * FROM assessment_submissions WHERE assessment_id=$1 AND student_id=$2", [id, studentId]
    );
    if (!sub.rows.length) return res.status(404).json({ error: "No active submission" });
    if (sub.rows[0].status === "submitted") return res.status(409).json({ error: "Already submitted" });

    const submissionId = sub.rows[0].id;
    const { answers = [] } = req.body as { answers: Array<{ question_id: number; answer_text?: string; file_url?: string }> };

    // Save each answer
    for (const ans of answers) {
      await pool.query(
        `INSERT INTO submission_answers (submission_id, question_id, answer_text, file_url)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT DO NOTHING`,
        [submissionId, ans.question_id, ans.answer_text ?? null, ans.file_url ?? null]
      );
    }

    // Auto-grade MCQs
    const questions = await pool.query(
      "SELECT * FROM assessment_questions WHERE assessment_id=$1", [id]
    );
    let autoScore = 0;
    for (const q of questions.rows) {
      if (q.question_type === "mcq" && q.correct_answer) {
        const ans = answers.find(a => a.question_id === q.id);
        const isCorrect = ans?.answer_text?.trim() === q.correct_answer?.trim();
        const marksAwarded = isCorrect ? parseFloat(q.marks) : 0;
        autoScore += marksAwarded;
        await pool.query(
          `UPDATE submission_answers SET is_correct=$1, marks_awarded=$2, auto_graded=TRUE
           WHERE submission_id=$3 AND question_id=$4`,
          [isCorrect, marksAwarded, submissionId, q.id]
        );
      }
    }

    // Mark submitted
    const { rows } = await pool.query(
      `UPDATE assessment_submissions
       SET status='submitted', submitted_at=NOW(), score=$1
       WHERE id=$2 RETURNING *`,
      [autoScore || null, submissionId]
    );

    res.json({ submission: rows[0], auto_score: autoScore });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── TEACHER: VIEW ALL SUBMISSIONS ─────────────────────────────────────────────
assessmentHubRouter.get("/assessments/:id/submissions", ...teacherOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT asub.*, a.display_name AS student_name, s.grade_level
       FROM assessment_submissions asub
       JOIN students s ON s.id = asub.student_id
       JOIN accounts a ON a.id = s.account_id
       WHERE asub.assessment_id = $1
       ORDER BY asub.submitted_at DESC NULLS LAST`,
      [id]
    );
    res.json({ submissions: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── TEACHER: VIEW SPECIFIC STUDENT SUBMISSION ─────────────────────────────────
assessmentHubRouter.get("/assessments/:id/submissions/:studentId", ...teacherOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id, studentId } = req.params;
    const [subRes, answersRes] = await Promise.all([
      pool.query(
        `SELECT asub.*, a.display_name AS student_name
         FROM assessment_submissions asub
         JOIN students s ON s.id = asub.student_id
         JOIN accounts a ON a.id = s.account_id
         WHERE asub.assessment_id=$1 AND asub.student_id=$2`,
        [id, studentId]
      ),
      pool.query(
        `SELECT sa.*, aq.marks AS max_marks, aq.question_type,
                aq.correct_answer, aq.options,
                COALESCE(qb.question_text, aq.custom_question->>'text') AS question_text
         FROM submission_answers sa
         JOIN assessment_questions aq ON aq.id = sa.question_id
         LEFT JOIN question_bank qb ON qb.id = aq.question_bank_id
         WHERE sa.submission_id = (
           SELECT id FROM assessment_submissions WHERE assessment_id=$1 AND student_id=$2 LIMIT 1
         )
         ORDER BY aq.question_order`,
        [id, studentId]
      ),
    ]);
    if (!subRes.rows.length) return res.status(404).json({ error: "Submission not found" });
    res.json({ submission: subRes.rows[0], answers: answersRes.rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── QUESTION BANK: ADVANCED SEARCH ───────────────────────────────────────────
assessmentHubRouter.get("/question-bank/advanced-search", ...anyAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { q, subject, topic, difficulty, marks, command_word, paper_type, year, limit = "20" } = req.query as Record<string, string>;

    const conditions: string[] = [];
    const params: any[] = [];
    let p = 1;

    if (q) { conditions.push(`(qb.question_text ILIKE $${p} OR qb.topic ILIKE $${p} OR qb.tags ILIKE $${p})`); params.push(`%${q}%`); p++; }
    if (subject) { conditions.push(`(s.name ILIKE $${p} OR qb.subject_name ILIKE $${p})`); params.push(`%${subject}%`); p++; }
    if (topic) { conditions.push(`qb.topic ILIKE $${p}`); params.push(`%${topic}%`); p++; }
    if (difficulty) { conditions.push(`qb.difficulty = $${p}`); params.push(difficulty); p++; }
    if (marks) { conditions.push(`qb.max_marks = $${p}`); params.push(parseFloat(marks)); p++; }
    if (command_word) { conditions.push(`qb.command_word ILIKE $${p}`); params.push(`%${command_word}%`); p++; }
    if (paper_type) { conditions.push(`qb.paper_type ILIKE $${p}`); params.push(`%${paper_type}%`); p++; }
    if (year) { conditions.push(`qb.year_first_seen = $${p}`); params.push(parseInt(year)); p++; }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(parseInt(limit));

    const { rows } = await pool.query(
      `SELECT qb.*, s.name AS subject_name_full
       FROM question_bank qb
       LEFT JOIN subjects s ON s.id = qb.subject_id
       ${where}
       ORDER BY qb.times_used DESC, qb.created_at DESC
       LIMIT $${p}`,
      params
    );

    res.json({ questions: rows, total: rows.length });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── QUESTION BANK: CREATE VERSION ─────────────────────────────────────────────
assessmentHubRouter.post("/question-bank/:id/version", ...teacherOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { rows: [q] } = await pool.query("SELECT * FROM question_bank WHERE id=$1", [id]);
    if (!q) return res.status(404).json({ error: "Question not found" });

    const history = (q.version_history ?? []) as any[];
    history.push({ version: q.version, snapshot_at: new Date(), data: { question_text: q.question_text, model_answer: q.model_answer, max_marks: q.max_marks } });

    const updates = req.body;
    const { rows } = await pool.query(
      `UPDATE question_bank
       SET question_text = COALESCE($2, question_text),
           model_answer = COALESCE($3, model_answer),
           max_marks = COALESCE($4, max_marks),
           version = version + 1,
           version_history = $5
       WHERE id = $1 RETURNING *`,
      [id, updates.question_text ?? null, updates.model_answer ?? null, updates.max_marks ?? null, JSON.stringify(history)]
    );
    res.json({ question: rows[0] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── QUESTION BANK: STATS ──────────────────────────────────────────────────────
assessmentHubRouter.get("/question-bank/:id/stats", ...anyAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const [qRes, usageRes] = await Promise.all([
      pool.query("SELECT * FROM question_bank WHERE id=$1", [id]),
      pool.query(
        `SELECT COUNT(*) AS times_used,
                ROUND(AVG(sa.marks_awarded / NULLIF(aq.marks,0) * 100), 1) AS avg_score_pct
         FROM assessment_questions aq
         LEFT JOIN submission_answers sa ON sa.question_id = aq.id
         WHERE aq.question_bank_id = $1`,
        [id]
      ),
    ]);
    if (!qRes.rows.length) return res.status(404).json({ error: "Not found" });
    res.json({ question: qRes.rows[0], stats: usageRes.rows[0] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});
