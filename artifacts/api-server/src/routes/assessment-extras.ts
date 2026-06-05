import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, AuthRequest, requireRole } from "../middleware/auth";
import { openaiChat } from "../lib/ai-config";

export const assessmentExtrasRouter = Router();

const teacherOrAdmin = [authenticate, requireRole("teacher", "admin")];
const anyAuth = [authenticate];

// ══════════════════════════════════════════════════════════════════
// ARCHIVE ENDPOINTS
// ══════════════════════════════════════════════════════════════════

// POST /api/assessments/:id/archive
assessmentExtrasRouter.post("/assessments/:id/archive", ...teacherOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { paper_file_url, mark_scheme_file_url, report_file_url } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO exam_archives (assessment_id, paper_file_url, mark_scheme_file_url, report_file_url)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [id, paper_file_url ?? null, mark_scheme_file_url ?? null, report_file_url ?? null]
    );
    await pool.query("UPDATE assessments SET status='archived', updated_at=NOW() WHERE id=$1", [id]);
    res.status(201).json({ archive: rows[0] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/archives
assessmentExtrasRouter.get("/archives", ...teacherOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.userId!;
    const { q, type, limit = "20", offset = "0" } = req.query as Record<string, string>;
    const conditions = ["a.teacher_id=$1"];
    const params: any[] = [teacherId];
    let p = 2;
    if (q) { conditions.push(`a.title ILIKE $${p}`); params.push(`%${q}%`); p++; }
    if (type) { conditions.push(`a.type=$${p}`); params.push(type); p++; }
    params.push(parseInt(limit), parseInt(offset));
    const { rows } = await pool.query(
      `SELECT ea.*, a.title, a.type, a.total_marks, a.created_at AS assessment_created
       FROM exam_archives ea
       JOIN assessments a ON a.id = ea.assessment_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY ea.archived_at DESC LIMIT $${p} OFFSET $${p+1}`,
      params
    );
    res.json({ archives: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════════════════
// EXAM MONITORING
// ══════════════════════════════════════════════════════════════════

// GET /api/assessments/:id/monitor — live status of all students
assessmentExtrasRouter.get("/assessments/:id/monitor", ...teacherOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT
         s.id AS student_id, a.display_name AS student_name,
         asub.status, asub.submitted_at, asub.security_flags,
         asub.score, asub.max_score,
         es.started_at AS exam_started, es.tab_switches, es.focus_losses,
         es.last_heartbeat, es.is_valid AS session_active
       FROM students s
       JOIN accounts a ON a.id = s.account_id
       LEFT JOIN assessment_submissions asub ON asub.student_id = s.id AND asub.assessment_id=$1
       LEFT JOIN exam_sessions es ON es.student_id = s.id AND es.assessment_id=$1
       WHERE asub.id IS NOT NULL OR es.id IS NOT NULL
       ORDER BY a.display_name`,
      [id]
    );

    const stats = {
      total: rows.length,
      not_started: rows.filter((r: any) => !r.status).length,
      in_progress: rows.filter((r: any) => r.status === "in_progress").length,
      submitted: rows.filter((r: any) => r.status === "submitted" || r.status === "graded").length,
      flagged: rows.filter((r: any) => (r.tab_switches ?? 0) > 3 || (r.focus_losses ?? 0) > 5).length,
    };

    res.json({ students: rows, stats });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/assessments/:id/extend-time
assessmentExtrasRouter.post("/assessments/:id/extend-time", ...teacherOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { student_id, extra_minutes } = req.body;
    await pool.query(
      `UPDATE exam_sessions
       SET device_info = device_info || $1
       WHERE assessment_id=$2 AND student_id=$3 AND is_valid=TRUE`,
      [JSON.stringify({ time_extension_minutes: extra_minutes, extended_at: new Date() }), id, student_id]
    );
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/assessments/:id/end-student-exam
assessmentExtrasRouter.post("/assessments/:id/end-student-exam", ...teacherOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { student_id } = req.body;
    await pool.query(
      "UPDATE exam_sessions SET is_valid=FALSE, ended_at=NOW() WHERE assessment_id=$1 AND student_id=$2",
      [id, student_id]
    );
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════════════════
// STUDENT SUBMISSION RESULTS (for results page)
// ══════════════════════════════════════════════════════════════════

// GET /api/submissions/:submissionId/results
assessmentExtrasRouter.get("/submissions/:submissionId/results", ...anyAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { submissionId } = req.params;
    const [subRes, answersRes] = await Promise.all([
      pool.query(
        `SELECT asub.*, assess.title, assess.type, assess.total_marks, assess.instructions
         FROM assessment_submissions asub
         JOIN assessments assess ON assess.id = asub.assessment_id
         WHERE asub.id=$1`,
        [submissionId]
      ),
      pool.query(
        `SELECT sa.*,
                COALESCE(qb.question_text, aq.custom_question->>'text') AS question_text,
                aq.marks AS max_marks, aq.question_type, aq.correct_answer,
                aq.options, qb.model_answer, aq.question_order
         FROM submission_answers sa
         JOIN assessment_questions aq ON aq.id = sa.question_id
         LEFT JOIN question_bank qb ON qb.id = aq.question_bank_id
         WHERE sa.submission_id=$1
         ORDER BY aq.question_order`,
        [submissionId]
      ),
    ]);
    if (!subRes.rows.length) return res.status(404).json({ error: "Submission not found" });
    res.json({ submission: subRes.rows[0], answers: answersRes.rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════════════════
// EXAM READINESS (Analytics)
// ══════════════════════════════════════════════════════════════════

// GET /api/analytics/exam-readiness/:studentId
assessmentExtrasRouter.get("/analytics/exam-readiness/:studentId", ...anyAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { studentId } = req.params;

    // Get recent performance
    const [perfRes, weakRes, subjectRes] = await Promise.all([
      pool.query(
        `SELECT assess.type, asub.percentage, asub.grade, assess.created_at,
                qb.topic, sa.marks_awarded, aq.marks AS max_marks
         FROM assessment_submissions asub
         JOIN assessments assess ON assess.id = asub.assessment_id
         LEFT JOIN submission_answers sa ON sa.submission_id = asub.id
         LEFT JOIN assessment_questions aq ON aq.id = sa.question_id
         LEFT JOIN question_bank qb ON qb.id = aq.question_bank_id
         WHERE asub.student_id=$1 AND asub.status IN ('graded','returned')
         ORDER BY assess.created_at DESC`,
        [studentId]
      ),
      pool.query(
        `SELECT topic, subtopic, COUNT(*) AS occurrences
         FROM misconceptions
         WHERE student_id=$1
         GROUP BY topic, subtopic ORDER BY occurrences DESC LIMIT 10`,
        [studentId]
      ).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT DISTINCT s.name AS subject_name, s.id AS subject_id
         FROM assessment_submissions asub
         JOIN assessments assess ON assess.id = asub.assessment_id
         JOIN subjects s ON s.id = assess.subject_id
         WHERE asub.student_id=$1`,
        [studentId]
      ).catch(() => ({ rows: [] })),
    ]);

    const submissions = perfRes.rows;
    const mockExams = submissions.filter((s: any) => ["mock_exam","final_exam"].includes(s.type));
    const quizzes = submissions.filter((s: any) => ["quiz","topic_test"].includes(s.type));

    const mockAvg = mockExams.length > 0
      ? Math.round(mockExams.reduce((s: number, r: any) => s + (parseFloat(r.percentage) || 0), 0) / mockExams.length)
      : null;
    const quizAvg = quizzes.length > 0
      ? Math.round(quizzes.reduce((s: number, r: any) => s + (parseFloat(r.percentage) || 0), 0) / quizzes.length)
      : null;

    // Topic strength map
    const topicMap: Record<string, { earned: number; possible: number }> = {};
    for (const r of submissions) {
      const topic = r.topic ?? "General";
      if (!topicMap[topic]) topicMap[topic] = { earned: 0, possible: 0 };
      topicMap[topic].earned += parseFloat(r.marks_awarded ?? "0");
      topicMap[topic].possible += parseFloat(r.max_marks ?? "0");
    }
    const topicScores = Object.entries(topicMap)
      .filter(([, d]) => d.possible > 0)
      .map(([topic, d]) => ({ topic, pct: Math.round((d.earned / d.possible) * 100) }))
      .sort((a, b) => a.pct - b.pct);

    const weakTopics = topicScores.slice(0, 5);
    const strongTopics = topicScores.slice(-5).reverse();

    // Overall readiness score
    const overallPct = submissions.length > 0
      ? Math.round(submissions.reduce((s: number, r: any) => {
          const pct = parseFloat(r.percentage ?? "0");
          return s + (isNaN(pct) ? 0 : pct);
        }, 0) / Math.max(1, [...new Set(submissions.map((r: any) => r.assessment_id))].length))
      : 0;

    const readinessScore = Math.min(100, Math.round(
      (mockAvg ?? overallPct) * 0.5 +
      (quizAvg ?? overallPct) * 0.3 +
      Math.max(0, 100 - (weakRes.rows.length ?? 0) * 5) * 0.2
    ));

    // AI prediction
    let aiInsights: any = null;
    if (submissions.length > 0) {
      const aiResponse = await openaiChat({
        systemPrompt: `You are an academic performance analyst. Based on student data, provide exam readiness insights.
Respond ONLY with JSON: {"predicted_grade":"<IGCSE grade>","confidence":"<low|medium|high>","summary":"<2 sentences>","recommendations":["<action 1>","<action 2>","<action 3>"]}`,
        userMessage: `Student has completed ${submissions.length} assessments. Mock exam average: ${mockAvg ?? "N/A"}%. Quiz average: ${quizAvg ?? "N/A"}%. Weak topics: ${weakTopics.map(t => t.topic).join(", ") || "none identified"}. Overall average: ${overallPct}%.`,
        maxTokens: 300,
      });
      if (aiResponse) {
        try { aiInsights = JSON.parse(aiResponse.trim()); } catch { /* use null */ }
      }
    }

    res.json({
      readiness_score: readinessScore,
      mock_exam_avg: mockAvg,
      quiz_avg: quizAvg,
      overall_avg: overallPct,
      total_assessments: submissions.length,
      weak_topics: weakTopics,
      strong_topics: strongTopics,
      weak_misconceptions: weakRes.rows.slice(0, 5),
      subjects: subjectRes.rows,
      ai_insights: aiInsights,
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════════════════
// AI QUESTION GENERATION (for builder)
// ══════════════════════════════════════════════════════════════════

// POST /api/assessments/:id/generate-questions
assessmentExtrasRouter.post("/assessments/:id/generate-questions", ...teacherOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { topic, subject, count = 3, difficulty = "medium", type = "written" } = req.body;
    const aiResponse = await openaiChat({
      systemPrompt: `You are an expert exam question writer. Generate high-quality exam questions.
Respond ONLY with a valid JSON array of ${count} questions in this format:
[{"question_text":"<question>","model_answer":"<answer>","marks":<number>,"command_word":"<Describe|Explain|Analyse|Evaluate|etc>","difficulty":"${difficulty}","type":"${type}"}]`,
      userMessage: `Generate ${count} ${difficulty} ${type} question${count > 1 ? "s" : ""} about "${topic}" for ${subject || "general science"} exam.`,
      maxTokens: 800,
    });

    if (!aiResponse) return res.status(503).json({ error: "AI unavailable" });
    const questions = JSON.parse(aiResponse.trim());
    res.json({ questions });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});
