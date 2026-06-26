import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { requireRole } from "../middleware/auth";
import { auditFromReq } from "../lib/audit";

export const adminContentValidationRouter = Router();
adminContentValidationRouter.use(requireRole("admin", "super_admin") as any);

/* GET /api/admin/content-validation/summary */
adminContentValidationRouter.get("/summary", async (req, res: Response) => {
  auditFromReq(req as any, "EXPORT_REPORT", "content_validation_summary", { result: "success" });
  try {
    const [overview, flagged, bySubject, dupes] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) as total_questions,
          COUNT(CASE WHEN (model_answer IS NULL OR model_answer = '') THEN 1 END) as missing_answers,
          COUNT(CASE WHEN (max_marks IS NULL OR max_marks = 0) THEN 1 END) as missing_marks,
          COUNT(CASE WHEN (topic IS NULL OR topic = '') THEN 1 END) as missing_topics,
          COUNT(CASE WHEN difficulty IS NULL THEN 1 END) as missing_difficulty,
          COUNT(CASE WHEN length(question_text) < 20 THEN 1 END) as too_short,
          COUNT(CASE WHEN length(question_text) > 2000 THEN 1 END) as too_long
        FROM question_bank
      `).catch(() => ({ rows: [{}] })),

      pool.query(`
        SELECT
          qb.id,
          qb.question_text,
          qb.topic,
          qb.difficulty,
          qb.max_marks,
          qb.model_answer,
          s.name as subject_name,
          qb.created_at,
          CASE
            WHEN (qb.model_answer IS NULL OR qb.model_answer = '') THEN 'missing_answer'
            WHEN (qb.max_marks IS NULL OR qb.max_marks = 0) THEN 'missing_marks'
            WHEN (qb.topic IS NULL OR qb.topic = '') THEN 'missing_topic'
            WHEN length(qb.question_text) < 20 THEN 'too_short'
            WHEN qb.difficulty IS NULL THEN 'missing_difficulty'
            ELSE NULL
          END as flag_reason
        FROM question_bank qb
        LEFT JOIN subjects s ON s.id = qb.subject_id
        WHERE
          (qb.model_answer IS NULL OR qb.model_answer = '')
          OR (qb.max_marks IS NULL OR qb.max_marks = 0)
          OR (qb.topic IS NULL OR qb.topic = '')
          OR length(qb.question_text) < 20
          OR qb.difficulty IS NULL
        ORDER BY qb.created_at DESC
        LIMIT 50
      `).catch(() => ({ rows: [] })),

      pool.query(`
        SELECT
          s.name as subject,
          COUNT(*) as total,
          COUNT(CASE WHEN (qb.model_answer IS NULL OR qb.model_answer = '') THEN 1 END) as flagged
        FROM question_bank qb
        LEFT JOIN subjects s ON s.id = qb.subject_id
        GROUP BY s.name
        ORDER BY total DESC
        LIMIT 15
      `).catch(() => ({ rows: [] })),

      pool.query(`
        SELECT
          a.id as q1_id,
          b.id as q2_id,
          a.question_text as q1_text,
          SIMILARITY(a.question_text, b.question_text) as similarity
        FROM question_bank a
        JOIN question_bank b ON b.id > a.id
        WHERE SIMILARITY(a.question_text, b.question_text) > 0.8
        ORDER BY similarity DESC
        LIMIT 10
      `).catch(() => ({ rows: [] })),
    ]);

    const o = overview.rows[0] ?? {};
    res.json({
      stats: {
        totalQuestions: parseInt(o.total_questions ?? "0"),
        missingAnswers: parseInt(o.missing_answers ?? "0"),
        missingMarks: parseInt(o.missing_marks ?? "0"),
        missingTopics: parseInt(o.missing_topics ?? "0"),
        missingDifficulty: parseInt(o.missing_difficulty ?? "0"),
        tooShort: parseInt(o.too_short ?? "0"),
        tooLong: parseInt(o.too_long ?? "0"),
      },
      flaggedQuestions: flagged.rows,
      bySubject: bySubject.rows,
      possibleDuplicates: dupes.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

/* GET /api/admin/content-validation/mark-schemes */
adminContentValidationRouter.get("/mark-schemes", async (req, res: Response) => {
  auditFromReq(req as any, "EXPORT_REPORT", "content_validation_mark_schemes", { result: "success" });
  try {
    const { rows } = await pool.query(`
      SELECT
        qb.id,
        qb.question_text,
        qb.topic,
        qb.max_marks,
        s.name as subject_name,
        ms.id as mark_scheme_id,
        ms.content as mark_scheme_content,
        ms.source_type
      FROM question_bank qb
      LEFT JOIN subjects s ON s.id = qb.subject_id
      LEFT JOIN mark_schemes ms ON ms.question_bank_id = qb.id
      ORDER BY qb.created_at DESC
      LIMIT 60
    `).catch(() => ({ rows: [] }));

    const withMs = rows.filter((r: any) => r.mark_scheme_id).length;
    const withoutMs = rows.filter((r: any) => !r.mark_scheme_id).length;

    res.json({ questions: rows, stats: { withMarkScheme: withMs, withoutMarkScheme: withoutMs } });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

/* GET /api/admin/content-validation/relationships */
adminContentValidationRouter.get("/relationships", async (req, res: Response) => {
  auditFromReq(req as any, "EXPORT_REPORT", "content_validation_relationships", { result: "success" });
  try {
    const [questions, markSchemes] = await Promise.all([
      pool.query(`
        SELECT
          qb.id,
          qb.question_text,
          qb.topic,
          qb.difficulty,
          qb.max_marks,
          s.name as subject_name,
          COUNT(DISTINCT ms.id) as mark_scheme_count,
          COUNT(DISTINCT qr.id) as relationship_count
        FROM question_bank qb
        LEFT JOIN subjects s ON s.id = qb.subject_id
        LEFT JOIN mark_schemes ms ON ms.question_bank_id = qb.id
        LEFT JOIN question_relationships qr ON qr.question_id = qb.id
        GROUP BY qb.id, qb.question_text, qb.topic, qb.difficulty, qb.max_marks, s.name
        ORDER BY qb.created_at DESC
        LIMIT 40
      `).catch(() => ({ rows: [] })),

      pool.query(`
        SELECT
          ms.id,
          ms.title,
          ms.content,
          ms.source_type,
          ms.question_bank_id,
          qb.question_text as linked_question
        FROM mark_schemes ms
        LEFT JOIN question_bank qb ON qb.id = ms.question_bank_id
        ORDER BY ms.created_at DESC
        LIMIT 30
      `).catch(() => ({ rows: [] })),
    ]);

    res.json({ questions: questions.rows, markSchemes: markSchemes.rows });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});
