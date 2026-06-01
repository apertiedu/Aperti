import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { requireStudentAccess, requireTenantAccess } from "../middleware/tenant";
import { AuthRequest } from "../middleware/auth";

const router: IRouter = Router();

router.get("/portal/online-exams", requireStudentAccess as any, async (req: AuthRequest, res): Promise<void> => {
  const studentId: number = (req as any).studentId;
  const teacherId: number = (req as any).teacherAccountId;

  const { rows } = await pool.query(`
    SELECT
      e.id, e.name, e.exam_date, e.total_marks,
      s.name AS subject_name,
      COUNT(eq.id)::int AS question_count,
      oes.id AS session_id,
      oes.status AS session_status,
      oes.submitted_at,
      oes.auto_score,
      oes.max_score,
      oes.started_at AS session_started_at
    FROM exams e
    LEFT JOIN subjects s ON s.id = e.subject_id
    LEFT JOIN exam_questions eq ON eq.exam_id = e.id AND eq.parent_id IS NULL
    LEFT JOIN online_exam_sessions oes ON oes.exam_id = e.id AND oes.student_id = $2
    WHERE e.teacher_account_id = $1
    GROUP BY e.id, e.name, e.exam_date, e.total_marks, s.name,
             oes.id, oes.status, oes.submitted_at, oes.auto_score, oes.max_score, oes.started_at
    HAVING COUNT(eq.id) > 0
    ORDER BY e.exam_date DESC NULLS LAST, e.created_at DESC
  `, [teacherId, studentId]);

  res.json(rows);
});

router.post("/portal/online-exams/:examId/start", requireStudentAccess as any, async (req: AuthRequest, res): Promise<void> => {
  const examId = parseInt(req.params.examId as string, 10);
  const studentId: number = (req as any).studentId;
  const accountId: number = req.userId!;
  const teacherId: number = (req as any).teacherAccountId;

  const { rows: examRows } = await pool.query(
    `SELECT * FROM exams WHERE id=$1 AND teacher_account_id=$2`, [examId, teacherId]
  );
  if (!examRows[0]) { res.status(404).json({ message: "Exam not found" }); return; }

  const { rows: existing } = await pool.query(
    `SELECT * FROM online_exam_sessions WHERE exam_id=$1 AND student_id=$2`, [examId, studentId]
  );
  if (existing[0]) {
    if (existing[0].status === "submitted") { res.status(400).json({ message: "Exam already submitted" }); return; }
    res.json(existing[0]); return;
  }

  const { rows } = await pool.query(`
    INSERT INTO online_exam_sessions (exam_id, student_id, student_account_id, time_limit_minutes)
    VALUES ($1, $2, $3, $4) RETURNING *
  `, [examId, studentId, accountId, examRows[0].time_limit_minutes ?? null]);

  res.status(201).json(rows[0]);
});

router.get("/portal/online-exams/:examId/session", requireStudentAccess as any, async (req: AuthRequest, res): Promise<void> => {
  const examId = parseInt(req.params.examId as string, 10);
  const studentId: number = (req as any).studentId;
  const teacherId: number = (req as any).teacherAccountId;

  const { rows: examRows } = await pool.query(
    `SELECT e.*, s.name AS subject_name FROM exams e LEFT JOIN subjects s ON s.id=e.subject_id WHERE e.id=$1 AND e.teacher_account_id=$2`,
    [examId, teacherId]
  );
  if (!examRows[0]) { res.status(404).json({ message: "Exam not found" }); return; }

  const { rows: sessionRows } = await pool.query(
    `SELECT * FROM online_exam_sessions WHERE exam_id=$1 AND student_id=$2`, [examId, studentId]
  );
  if (!sessionRows[0]) { res.status(404).json({ message: "No active session. Start the exam first." }); return; }

  const { rows: questions } = await pool.query(`
    SELECT id, question_text, topic, max_marks, question_order, question_type, options
    FROM exam_questions WHERE exam_id=$1 AND parent_id IS NULL ORDER BY question_order ASC
  `, [examId]);

  const oes = sessionRows[0];
  let secondsRemaining: number | null = null;
  if (oes.time_limit_minutes && oes.status === "in_progress") {
    const elapsed = Date.now() - new Date(oes.started_at).getTime();
    secondsRemaining = Math.max(0, Math.floor((oes.time_limit_minutes * 60 * 1000 - elapsed) / 1000));
    if (secondsRemaining === 0) {
      await pool.query(`UPDATE online_exam_sessions SET status='expired', submitted_at=NOW() WHERE id=$1`, [oes.id]);
      oes.status = "expired";
    }
  }

  res.json({ exam: examRows[0], session: { ...oes, secondsRemaining }, questions });
});

router.patch("/portal/online-exams/:examId/answers", requireStudentAccess as any, async (req: AuthRequest, res): Promise<void> => {
  const examId = parseInt(req.params.examId as string, 10);
  const studentId: number = (req as any).studentId;
  const { answers } = req.body;
  if (!answers || typeof answers !== "object") { res.status(400).json({ message: "answers required" }); return; }

  const { rows } = await pool.query(
    `UPDATE online_exam_sessions SET answers=$1 WHERE exam_id=$2 AND student_id=$3 AND status='in_progress' RETURNING id`,
    [JSON.stringify(answers), examId, studentId]
  );
  if (!rows[0]) { res.status(400).json({ message: "No active session to save" }); return; }
  res.json({ saved: true });
});

router.post("/portal/online-exams/:examId/submit", requireStudentAccess as any, async (req: AuthRequest, res): Promise<void> => {
  const examId = parseInt(req.params.examId as string, 10);
  const studentId: number = (req as any).studentId;
  const { answers } = req.body;

  const { rows: sessionRows } = await pool.query(
    `SELECT * FROM online_exam_sessions WHERE exam_id=$1 AND student_id=$2 AND status='in_progress'`,
    [examId, studentId]
  );
  if (!sessionRows[0]) { res.status(400).json({ message: "No active session" }); return; }

  const finalAnswers = answers ?? sessionRows[0].answers;
  const { rows: questions } = await pool.query(
    `SELECT id, max_marks, question_type, correct_option FROM exam_questions WHERE exam_id=$1 AND parent_id IS NULL`,
    [examId]
  );

  let autoScore = 0;
  let maxScore = 0;
  const mcqOnly = questions.filter((q: any) => q.question_type === "mcq");
  for (const q of questions) maxScore += parseFloat(q.max_marks ?? "1");
  for (const q of mcqOnly) {
    if (finalAnswers && parseInt(finalAnswers[String(q.id)], 10) === q.correct_option)
      autoScore += parseFloat(q.max_marks ?? "1");
  }

  const { rows } = await pool.query(`
    UPDATE online_exam_sessions
    SET status='submitted', submitted_at=NOW(), answers=$1, auto_score=$2, max_score=$3
    WHERE id=$4 RETURNING *
  `, [JSON.stringify(finalAnswers), mcqOnly.length > 0 ? autoScore : null, maxScore, sessionRows[0].id]);

  res.json({
    session: rows[0],
    autoScore: mcqOnly.length > 0 ? autoScore : null,
    maxScore,
    pct: mcqOnly.length > 0 ? Math.round((autoScore / maxScore) * 100) : null,
    pendingMarking: mcqOnly.length < questions.length || mcqOnly.length === 0,
    totalQuestions: questions.length,
    mcqQuestions: mcqOnly.length,
  });
});

router.get("/online-exams/:examId/monitor", requireTenantAccess as any, async (req: AuthRequest, res): Promise<void> => {
  const examId = parseInt(req.params.examId as string, 10);
  const { teacherId, isAdmin } = req.tenant;
  const teacherCond = isAdmin ? "" : `AND e.teacher_account_id = ${teacherId}`;

  const { rows: exam } = await pool.query(
    `SELECT e.*, s.name AS subject_name FROM exams e LEFT JOIN subjects s ON s.id=e.subject_id WHERE e.id=$1 ${teacherCond}`,
    [examId]
  );
  if (!exam[0]) { res.status(404).json({ message: "Exam not found" }); return; }

  const { rows: sessions } = await pool.query(`
    SELECT oes.*, st.student_name, st.student_code,
      (SELECT COUNT(*)::int FROM exam_questions WHERE exam_id = oes.exam_id AND parent_id IS NULL) AS total_questions,
      CASE WHEN oes.time_limit_minutes IS NULL THEN NULL
        ELSE GREATEST(0, EXTRACT(EPOCH FROM (oes.started_at + (oes.time_limit_minutes || ' minutes')::interval - NOW()))::int)
      END AS seconds_remaining
    FROM online_exam_sessions oes
    JOIN students st ON st.id = oes.student_id
    WHERE oes.exam_id = $1 ORDER BY oes.started_at ASC
  `, [examId]);

  res.json({
    exam: exam[0], sessions,
    summary: {
      inProgress: sessions.filter((s: any) => s.status === "in_progress").length,
      submitted: sessions.filter((s: any) => s.status === "submitted").length,
      expired: sessions.filter((s: any) => s.status === "expired").length,
      total: sessions.length,
    },
  });
});

router.patch("/online-exams/:examId/sessions/:sessionId/extend", requireTenantAccess as any, async (req: AuthRequest, res): Promise<void> => {
  const sessionId = parseInt(req.params.sessionId as string, 10);
  const { minutes } = req.body;
  if (!minutes || minutes < 1) { res.status(400).json({ message: "minutes required" }); return; }
  const { rows } = await pool.query(
    `UPDATE online_exam_sessions SET time_limit_minutes = COALESCE(time_limit_minutes, 0) + $1 WHERE id=$2 RETURNING *`,
    [minutes, sessionId]
  );
  if (!rows[0]) { res.status(404).json({ message: "Session not found" }); return; }
  res.json(rows[0]);
});

export default router;
