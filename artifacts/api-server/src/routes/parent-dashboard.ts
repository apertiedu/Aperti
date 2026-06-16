import { Router, Response } from "express";
import { authenticate, AuthRequest, requireRole } from "../middleware/auth";
import { pool } from "@workspace/db";

export const parentDashboardRouter = Router();

const authParent = [authenticate, requireRole("parent")];

// ─── Helper: verify parent owns this student ──────────────────────────────
async function getLinkedStudentId(parentAccountId: number, studentId: number): Promise<boolean> {
  const { rows } = await pool.query(
    "SELECT id FROM guardian_links WHERE parent_account_id=$1 AND student_id=$2 AND status='active'",
    [parentAccountId, studentId]
  );
  return rows.length > 0;
}

// ─── GET /api/parent/dashboard ────────────────────────────────────────────
parentDashboardRouter.get("/parent/dashboard", ...authParent, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: links } = await pool.query(
      `SELECT gl.id AS link_id, gl.student_id,
              s.student_name, s.student_code,
              a.display_name, a.email, a.first_name, a.last_name
       FROM guardian_links gl
       JOIN students s ON gl.student_id = s.id
       LEFT JOIN accounts a ON s.account_id = a.id
       WHERE gl.parent_account_id = $1 AND gl.status = 'active'
       ORDER BY s.student_name`,
      [req.userId]
    );

    const children = await Promise.all(links.map(async (link) => {
      const sid = link.student_id;
      const name = link.display_name || link.student_name || "Student";

      // Attendance today & rate
      const today = new Date().toISOString().split("T")[0];
      const { rows: attToday } = await pool.query(
        "SELECT status FROM attendance WHERE student_id=$1 AND date::date=$2 LIMIT 1",
        [sid, today]
      );
      const { rows: attRate } = await pool.query(
        `SELECT COUNT(*) AS total, SUM(CASE WHEN LOWER(status)='present' THEN 1 ELSE 0 END) AS present
         FROM attendance WHERE student_id=$1`, [sid]
      );
      const total = parseInt(attRate[0]?.total || "0");
      const present = parseInt(attRate[0]?.present || "0");
      const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;

      // Upcoming homework (due this week)
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const { rows: upcoming } = await pool.query(
        `SELECT h.id, h.title, h.due_date, sub.name,
                hs.status AS submission_status
         FROM homework h
         LEFT JOIN subjects sub ON h.subject_id = sub.id
         LEFT JOIN homework_submissions hs ON hs.homework_id = h.id AND hs.student_id = $1
         WHERE h.due_date >= NOW() AND h.due_date <= $2
           AND (hs.status IS NULL OR hs.status NOT IN ('submitted','graded'))
         ORDER BY h.due_date ASC LIMIT 5`,
        [sid, nextWeek.toISOString()]
      );

      // Current avg grade (last 10 student_marks)
      const { rows: marks } = await pool.query(
        `SELECT sm.marks_scored, eq.max_marks FROM student_marks sm
         JOIN exam_questions eq ON sm.question_id = eq.id
         WHERE sm.student_id = $1
         ORDER BY sm.marked_at DESC LIMIT 20`,
        [sid]
      );
      let avgGrade = 0;
      if (marks.length > 0) {
        const scores = marks.map(m => m.max_marks > 0 ? (m.marks_scored / m.max_marks) * 100 : 0);
        avgGrade = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      }

      // Recent messages from teachers
      const { rows: messages } = await pool.query(
        `SELECT gm.id, gm.message, gm.created_at,
                a.display_name AS from_name
         FROM guardian_messages gm
         JOIN accounts a ON gm.from_account_id = a.id
         WHERE gm.to_account_id = $1
         ORDER BY gm.created_at DESC LIMIT 3`,
        [req.userId]
      );

      // Revision progress
      const { rows: revisionRows } = await pool.query(
        `SELECT COUNT(*) AS completed FROM student_goals
         WHERE student_id=$1 AND completed_at IS NOT NULL`, [sid]
      );
      const { rows: totalGoals } = await pool.query(
        "SELECT COUNT(*) AS total FROM student_goals WHERE student_id=$1", [sid]
      );

      // Intervention alerts
      const { rows: alerts } = await pool.query(
        "SELECT * FROM intervention_alerts WHERE student_id=$1 AND is_resolved=false ORDER BY created_at DESC LIMIT 5",
        [sid]
      );

      // Recent achievements
      const { rows: ascend } = await pool.query(
        "SELECT level, xp, rank, streak FROM ascend_profiles WHERE student_account_id=$1 LIMIT 1", [sid]
      );

      // Today's lessons
      const { rows: todayLessons } = await pool.query(
        `SELECT l.id, l.day_of_week, l.start_time, sub.name AS subject_name
         FROM lessons l
         LEFT JOIN subjects sub ON l.subject_id = sub.id
         WHERE l.is_active = true
         ORDER BY l.start_time LIMIT 5`
      ).catch(() => ({ rows: [] }));

      return {
        linkId: link.link_id,
        studentId: sid,
        name,
        email: link.email,
        studentCode: link.student_code,
        todayAttendance: attToday[0]?.status || "unknown",
        attendanceRate,
        todayLessons,
        upcomingDeadlines: upcoming,
        recentMessages: messages,
        avgGrade,
        revisionCompleted: parseInt(revisionRows[0]?.completed || "0"),
        revisionTotal: parseInt(totalGoals[0]?.total || "0"),
        interventionAlerts: alerts,
        ascend: ascend[0] || null,
      };
    }));

    res.json({ children });
  } catch (err: any) {
    console.error("parent/dashboard error", err);
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// ─── GET /api/parent/child/:studentId ─────────────────────────────────────
parentDashboardRouter.get("/parent/child/:studentId", ...authParent, async (req: AuthRequest, res: Response) => {
  try {
    const sid = parseInt(req.params.studentId);
    if (!(await getLinkedStudentId(req.userId!, sid))) return res.status(403).json({ error: "Not linked" });

    const { rows: studentRows } = await pool.query(
      `SELECT s.*, a.display_name, a.email, a.first_name, a.last_name
       FROM students s LEFT JOIN accounts a ON s.account_id=a.id
       WHERE s.id=$1`, [sid]
    );
    if (!studentRows.length) return res.status(404).json({ error: "Student not found" });
    const student = studentRows[0];

    // Subjects enrolled in
    const { rows: subjects } = await pool.query(
      `SELECT DISTINCT sub.id, sub.name
       FROM course_enrollments ce
       JOIN aperti_courses ac ON ac.id = ce.course_id
       JOIN subjects sub ON ac.teacher_account_id = sub.id
       WHERE ce.student_account_id = $1 AND ce.status = 'approved'`, [sid]
    ).catch(() => ({ rows: [] }));

    // Last 10 assessments
    const { rows: assessments } = await pool.query(
      `SELECT e.id, e.title, e.exam_date AS date, e.total_marks,
              SUM(sm.marks_scored) AS scored,
              COUNT(sm.id) AS q_count
       FROM exams e
       JOIN exam_questions eq ON eq.exam_id = e.id
       LEFT JOIN student_marks sm ON sm.question_id = eq.id AND sm.student_id=$1
       WHERE sm.student_id=$1
       GROUP BY e.id, e.title, e.exam_date, e.total_marks
       ORDER BY e.exam_date DESC LIMIT 10`, [sid]
    ).catch(() => ({ rows: [] }));

    // Attendance trends (last 12 weeks)
    const { rows: attTrend } = await pool.query(
      `SELECT DATE_TRUNC('week', date::date) AS week,
              COUNT(*) AS total,
              SUM(CASE WHEN LOWER(status)='present' THEN 1 ELSE 0 END) AS present
       FROM attendance WHERE student_id=$1 AND date >= NOW() - INTERVAL '12 weeks'
       GROUP BY week ORDER BY week`, [sid]
    );

    // Focus sessions grouped by day (heatmap)
    const { rows: focusHeatmap } = await pool.query(
      `SELECT DATE(started_at) AS day, SUM(duration_minutes) AS minutes
       FROM focus_sessions WHERE student_id=$1 AND started_at >= NOW() - INTERVAL '90 days'
       GROUP BY day ORDER BY day`, [sid]
    );

    // Assignment overview
    const { rows: hwOverview } = await pool.query(
      `SELECT
         COUNT(CASE WHEN hs.status IN ('submitted','graded') THEN 1 END) AS submitted,
         COUNT(CASE WHEN hs.status='pending' OR hs.status IS NULL THEN 1 END) AS pending,
         COUNT(CASE WHEN hs.status NOT IN ('submitted','graded') AND h.due_date < NOW() THEN 1 END) AS overdue
       FROM homework h
       LEFT JOIN homework_submissions hs ON hs.homework_id=h.id AND hs.student_id=$1`, [sid]
    );

    // Ascend profile
    const { rows: ascend } = await pool.query(
      "SELECT * FROM ascend_profiles WHERE student_account_id=$1 LIMIT 1", [sid]
    );

    res.json({
      student: {
        id: sid,
        name: student.display_name || student.student_name,
        email: student.email,
        studentCode: student.student_code,
        subjects,
      },
      assessments,
      attendanceTrend: attTrend,
      revisionHeatmap: focusHeatmap,
      assignmentOverview: hwOverview[0] || {},
      ascend: ascend[0] || null,
    });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// ─── GET /api/parent/child/:studentId/grades ──────────────────────────────
parentDashboardRouter.get("/parent/child/:studentId/grades", ...authParent, async (req: AuthRequest, res: Response) => {
  try {
    const sid = parseInt(req.params.studentId);
    if (!(await getLinkedStudentId(req.userId!, sid))) return res.status(403).json({ error: "Not linked" });

    // Per-subject marks breakdown
    const { rows: subjectGrades } = await pool.query(
      `SELECT sub.id, sub.name,
              COUNT(sm.id) AS total_questions,
              SUM(sm.marks_scored) AS total_scored,
              SUM(eq.max_marks) AS total_possible,
              AVG(sm.marks_scored::float / NULLIF(eq.max_marks,0) * 100) AS avg_pct,
              MAX(e.exam_date) AS last_exam
       FROM student_marks sm
       JOIN exam_questions eq ON eq.id = sm.question_id
       JOIN exams e ON e.id = eq.exam_id
       LEFT JOIN subjects sub ON e.subject_id = sub.id
       WHERE sm.student_id = $1
       GROUP BY sub.id, sub.name
       ORDER BY avg_pct DESC`, [sid]
    );

    // Grade trend (last 12 individual exams)
    const { rows: trend } = await pool.query(
      `SELECT e.id, e.title, e.exam_date, sub.name,
              SUM(sm.marks_scored) AS scored,
              SUM(eq.max_marks) AS possible,
              ROUND(SUM(sm.marks_scored)::numeric / NULLIF(SUM(eq.max_marks),0) * 100, 1) AS pct
       FROM exams e
       JOIN exam_questions eq ON eq.exam_id = e.id
       JOIN student_marks sm ON sm.question_id = eq.id AND sm.student_id = $1
       LEFT JOIN subjects sub ON e.subject_id = sub.id
       GROUP BY e.id, e.title, e.exam_date, sub.name
       ORDER BY e.exam_date DESC LIMIT 12`, [sid]
    );

    // Recent homework feedback
    const { rows: hwFeedback } = await pool.query(
      `SELECT h.title, sub.name, hs.marks_awarded, h.total_marks, hs.teacher_feedback, hs.graded_at
       FROM homework_submissions hs
       JOIN homework h ON h.id = hs.homework_id
       LEFT JOIN subjects sub ON h.subject_id = sub.id
       WHERE hs.student_id=$1 AND hs.status='graded'
       ORDER BY hs.graded_at DESC LIMIT 10`, [sid]
    );

    res.json({ subjectGrades, trend: trend.reverse(), hwFeedback });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// ─── GET /api/parent/child/:studentId/attendance ──────────────────────────
parentDashboardRouter.get("/parent/child/:studentId/attendance", ...authParent, async (req: AuthRequest, res: Response) => {
  try {
    const sid = parseInt(req.params.studentId);
    if (!(await getLinkedStudentId(req.userId!, sid))) return res.status(403).json({ error: "Not linked" });

    const { rows: records } = await pool.query(
      `SELECT a.date, a.status, a.method, ses.session_name,
              sub.name
       FROM attendance a
       LEFT JOIN sessions ses ON a.session_id = ses.id
       LEFT JOIN subjects sub ON ses.subject_id = sub.id
       WHERE a.student_id=$1
       ORDER BY a.date DESC LIMIT 90`, [sid]
    );

    const { rows: weekly } = await pool.query(
      `SELECT DATE_TRUNC('week', date::date) AS week,
              COUNT(*) AS total,
              SUM(CASE WHEN LOWER(status)='present' THEN 1 ELSE 0 END) AS present
       FROM attendance WHERE student_id=$1 AND date >= NOW()-INTERVAL '12 weeks'
       GROUP BY week ORDER BY week`, [sid]
    );

    const { rows: monthly } = await pool.query(
      `SELECT DATE_TRUNC('month', date::date) AS month,
              COUNT(*) AS total,
              SUM(CASE WHEN LOWER(status)='present' THEN 1 ELSE 0 END) AS present
       FROM attendance WHERE student_id=$1 AND date >= NOW()-INTERVAL '6 months'
       GROUP BY month ORDER BY month`, [sid]
    );

    const { rows: summary } = await pool.query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN LOWER(status)='present' THEN 1 ELSE 0 END) AS present,
              SUM(CASE WHEN LOWER(status)='absent' THEN 1 ELSE 0 END) AS absent,
              SUM(CASE WHEN LOWER(status)='late' THEN 1 ELSE 0 END) AS late
       FROM attendance WHERE student_id=$1`, [sid]
    );

    res.json({ records, weekly, monthly, summary: summary[0] });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// ─── GET /api/parent/child/:studentId/revision ────────────────────────────
parentDashboardRouter.get("/parent/child/:studentId/revision", ...authParent, async (req: AuthRequest, res: Response) => {
  try {
    const sid = parseInt(req.params.studentId);
    if (!(await getLinkedStudentId(req.userId!, sid))) return res.status(403).json({ error: "Not linked" });

    const { rows: sessions } = await pool.query(
      `SELECT date_trunc('day', started_at) AS day,
              SUM(duration_minutes) AS minutes,
              COUNT(*) AS session_count,
              SUM(xp_earned) AS xp
       FROM focus_sessions WHERE student_id=$1 AND started_at >= NOW()-INTERVAL '90 days'
       GROUP BY day ORDER BY day`, [sid]
    );

    const { rows: monthly } = await pool.query(
      `SELECT date_trunc('month', started_at) AS month,
              SUM(duration_minutes)/60.0 AS hours
       FROM focus_sessions WHERE student_id=$1 AND started_at >= NOW()-INTERVAL '6 months'
       GROUP BY month ORDER BY month`, [sid]
    );

    const { rows: goals } = await pool.query(
      `SELECT title, type, completed_at, xp_reward, source
       FROM student_goals WHERE student_id=$1
       ORDER BY created_at DESC LIMIT 20`, [sid]
    );

    const { rows: totals } = await pool.query(
      `SELECT SUM(duration_minutes) AS total_minutes,
              COUNT(*) AS total_sessions,
              COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) AS completed
       FROM focus_sessions WHERE student_id=$1`, [sid]
    );

    // Flashcard review count
    const { rows: flashcards } = await pool.query(
      `SELECT COUNT(*) AS reviewed FROM flashcard_progress WHERE student_id=$1`, [sid]
    );

    // Consistency score (days with sessions in last 30 days)
    const { rows: consistency } = await pool.query(
      `SELECT COUNT(DISTINCT DATE(started_at)) AS active_days
       FROM focus_sessions WHERE student_id=$1 AND started_at >= NOW()-INTERVAL '30 days'`, [sid]
    );

    res.json({
      heatmap: sessions,
      monthly,
      goals,
      totals: totals[0],
      flashcardsReviewed: parseInt(flashcards[0]?.reviewed || "0"),
      consistencyScore: Math.round((parseInt(consistency[0]?.active_days || "0") / 30) * 100),
    });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// ─── GET /api/parent/child/:studentId/assignments ─────────────────────────
parentDashboardRouter.get("/parent/child/:studentId/assignments", ...authParent, async (req: AuthRequest, res: Response) => {
  try {
    const sid = parseInt(req.params.studentId);
    if (!(await getLinkedStudentId(req.userId!, sid))) return res.status(403).json({ error: "Not linked" });

    const { rows } = await pool.query(
      `SELECT h.id, h.title, h.description, h.due_date, h.total_marks,
              sub.name,
              hs.status AS submission_status,
              hs.marks_awarded,
              hs.teacher_feedback,
              hs.submitted_at,
              hs.graded_at,
              CASE WHEN hs.status NOT IN ('submitted','graded') AND h.due_date < NOW() THEN true ELSE false END AS is_overdue
       FROM homework h
       LEFT JOIN subjects sub ON h.subject_id = sub.id
       LEFT JOIN homework_submissions hs ON hs.homework_id=h.id AND hs.student_id=$1
       ORDER BY h.due_date DESC LIMIT 50`, [sid]
    );

    const pending = rows.filter(r => !r.is_overdue && r.submission_status !== "submitted" && r.submission_status !== "graded");
    const submitted = rows.filter(r => r.submission_status === "submitted" || r.submission_status === "graded");
    const overdue = rows.filter(r => r.is_overdue);

    res.json({ pending, submitted, overdue, all: rows });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// ─── GET /api/parent/child/:studentId/exam-readiness ──────────────────────
parentDashboardRouter.get("/parent/child/:studentId/exam-readiness", ...authParent, async (req: AuthRequest, res: Response) => {
  try {
    const sid = parseInt(req.params.studentId);
    if (!(await getLinkedStudentId(req.userId!, sid))) return res.status(403).json({ error: "Not linked" });

    // Recent mock scores
    const { rows: mocks } = await pool.query(
      `SELECT e.id, e.title, e.exam_date, sub.name,
              ROUND(SUM(sm.marks_scored)::numeric / NULLIF(SUM(eq.max_marks),0) * 100, 1) AS score_pct
       FROM exams e
       JOIN exam_questions eq ON eq.exam_id=e.id
       JOIN student_marks sm ON sm.question_id=eq.id AND sm.student_id=$1
       LEFT JOIN subjects sub ON e.subject_id=sub.id
       GROUP BY e.id, e.title, e.exam_date, sub.name
       ORDER BY e.exam_date DESC LIMIT 10`, [sid]
    );

    // Per-subject readiness
    const { rows: subjectReadiness } = await pool.query(
      `SELECT sub.name,
              ROUND(AVG(sm.marks_scored::float / NULLIF(eq.max_marks,0) * 100), 1) AS readiness_pct,
              COUNT(DISTINCT e.id) AS exams_taken
       FROM student_marks sm
       JOIN exam_questions eq ON eq.id=sm.question_id
       JOIN exams e ON e.id=eq.exam_id
       LEFT JOIN subjects sub ON e.subject_id=sub.id
       WHERE sm.student_id=$1
       GROUP BY sub.name`, [sid]
    );

    // Trial vault attempts
    const { rows: trialAttempts } = await pool.query(
      `SELECT ta.created_at, ta.score, ta.topic_breakdown, sub.name
       FROM trial_vault_attempts ta
       LEFT JOIN subjects sub ON ta.subject_id=sub.id
       WHERE ta.student_id=$1
       ORDER BY ta.created_at DESC LIMIT 10`, [sid]
    );

    // Next exam
    const { rows: nextExam } = await pool.query(
      `SELECT e.id, e.title, e.exam_date, sub.name
       FROM exams e LEFT JOIN subjects sub ON e.subject_id=sub.id
       WHERE e.exam_date > NOW()
       ORDER BY e.exam_date ASC LIMIT 1`
    );

    const overallReadiness = subjectReadiness.length > 0
      ? Math.round(subjectReadiness.reduce((acc, s) => acc + parseFloat(s.readiness_pct || "0"), 0) / subjectReadiness.length)
      : 0;

    res.json({
      overallReadiness,
      subjectReadiness,
      mockHistory: mocks.reverse(),
      trialAttempts,
      nextExam: nextExam[0] || null,
    });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// ─── GET /api/parent/teachers ─────────────────────────────────────────────
parentDashboardRouter.get("/parent/teachers", ...authParent, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT a.id, a.display_name, a.email, sub.name
       FROM guardian_links gl
       JOIN students s ON gl.student_id=s.id
       JOIN accounts a ON s.teacher_account_id=a.id
       LEFT JOIN subjects sub ON s.lesson1_session_id IS NOT NULL AND EXISTS (
         SELECT 1 FROM sessions ses WHERE ses.id=s.lesson1_session_id AND ses.subject_id=sub.id
       )
       WHERE gl.parent_account_id=$1 AND gl.status='active'`, [req.userId]
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// ─── GET /api/parent/messages ─────────────────────────────────────────────
parentDashboardRouter.get("/parent/messages", ...authParent, async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.query.teacherId ? parseInt(req.query.teacherId as string) : undefined;
    let query: string;
    let params: any[];

    if (teacherId) {
      query = `SELECT gm.id, gm.message, gm.read, gm.created_at,
                      gm.from_account_id, gm.to_account_id,
                      fa.display_name AS from_name,
                      ta.display_name AS to_name
               FROM guardian_messages gm
               JOIN accounts fa ON fa.id=gm.from_account_id
               JOIN accounts ta ON ta.id=gm.to_account_id
               WHERE (gm.from_account_id=$1 AND gm.to_account_id=$2)
                  OR (gm.from_account_id=$2 AND gm.to_account_id=$1)
               ORDER BY gm.created_at ASC`;
      params = [req.userId, teacherId];
    } else {
      query = `SELECT DISTINCT ON (other_id)
                      other_id,
                      other_name,
                      last_msg,
                      last_time,
                      unread_count
               FROM (
                 SELECT
                   CASE WHEN gm.from_account_id=$1 THEN gm.to_account_id ELSE gm.from_account_id END AS other_id,
                   CASE WHEN gm.from_account_id=$1 THEN ta.display_name ELSE fa.display_name END AS other_name,
                   gm.message AS last_msg,
                   gm.created_at AS last_time,
                   SUM(CASE WHEN gm.to_account_id=$1 AND gm.read='false' THEN 1 ELSE 0 END) OVER (PARTITION BY
                     CASE WHEN gm.from_account_id=$1 THEN gm.to_account_id ELSE gm.from_account_id END
                   ) AS unread_count
                 FROM guardian_messages gm
                 JOIN accounts fa ON fa.id=gm.from_account_id
                 JOIN accounts ta ON ta.id=gm.to_account_id
                 WHERE gm.from_account_id=$1 OR gm.to_account_id=$1
                 ORDER BY gm.created_at DESC
               ) sub
               ORDER BY other_id, last_time DESC`;
      params = [req.userId];
    }

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// ─── POST /api/parent/messages ────────────────────────────────────────────
parentDashboardRouter.post("/parent/messages", ...authParent, async (req: AuthRequest, res: Response) => {
  try {
    const { toAccountId, message } = req.body;
    if (!toAccountId || !message) return res.status(400).json({ error: "toAccountId and message required" });
    const { rows } = await pool.query(
      `INSERT INTO guardian_messages (from_account_id, to_account_id, message, read, created_at)
       VALUES ($1, $2, $3, 'false', NOW()) RETURNING *`,
      [req.userId, toAccountId, message]
    );

    // Create notification for recipient
    await pool.query(
      `INSERT INTO parent_notifications (parent_id, type, title, message, is_read, created_at)
       VALUES ($1, 'message', 'New message', $2, false, NOW())
       ON CONFLICT DO NOTHING`,
      [toAccountId, `You have a new message from a parent`]
    ).catch(() => {});

    res.status(201).json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// ─── GET /api/parent/meetings ─────────────────────────────────────────────
parentDashboardRouter.get("/parent/meetings", ...authParent, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.*, a.display_name AS teacher_name
       FROM meetings m
       LEFT JOIN accounts a ON a.id=m.teacher_id
       WHERE m.parent_id=$1
       ORDER BY m.date DESC, m.time DESC`, [req.userId]
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// ─── POST /api/parent/meetings ────────────────────────────────────────────
parentDashboardRouter.post("/parent/meetings", ...authParent, async (req: AuthRequest, res: Response) => {
  try {
    const { teacherId, studentId, title, date, time, notes } = req.body;
    if (!teacherId || !title || !date || !time) return res.status(400).json({ error: "Missing required fields" });
    const { rows } = await pool.query(
      `INSERT INTO meetings (parent_id, teacher_id, student_id, title, date, time, status, notes, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,'requested',$7,NOW()) RETURNING *`,
      [req.userId, teacherId, studentId || null, title, date, time, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// ─── PUT /api/parent/meetings/:id ─────────────────────────────────────────
parentDashboardRouter.put("/parent/meetings/:id", ...authParent, async (req: AuthRequest, res: Response) => {
  try {
    const { status, notes, date, time } = req.body;
    const { rowCount } = await pool.query(
      `UPDATE meetings SET status=COALESCE($1,status), notes=COALESCE($2,notes),
       date=COALESCE($3,date), time=COALESCE($4,time)
       WHERE id=$5 AND parent_id=$6`,
      [status, notes, date, time, parseInt(req.params.id), req.userId]
    );
    if (!rowCount) return res.status(404).json({ error: "Meeting not found" });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// ─── GET /api/parent/notifications ───────────────────────────────────────
parentDashboardRouter.get("/parent/notifications", ...authParent, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM parent_notifications WHERE parent_id=$1 ORDER BY created_at DESC LIMIT 50",
      [req.userId]
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// ─── PUT /api/parent/notifications/:id/read ──────────────────────────────
parentDashboardRouter.put("/parent/notifications/:id/read", ...authParent, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(
      "UPDATE parent_notifications SET is_read=true WHERE id=$1 AND parent_id=$2",
      [parseInt(req.params.id), req.userId]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// ─── PUT /api/parent/notifications/read-all ──────────────────────────────
parentDashboardRouter.put("/parent/notifications/read-all", ...authParent, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query("UPDATE parent_notifications SET is_read=true WHERE parent_id=$1", [req.userId]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// ─── GET /api/parent/intervention-alerts ─────────────────────────────────
parentDashboardRouter.get("/parent/intervention-alerts", ...authParent, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: linkedStudents } = await pool.query(
      "SELECT student_id FROM guardian_links WHERE parent_account_id=$1 AND status='active'",
      [req.userId]
    );
    if (!linkedStudents.length) return res.json([]);
    const sids = linkedStudents.map(r => r.student_id);
    const { rows } = await pool.query(
      `SELECT ia.*, s.student_name, a.display_name
       FROM intervention_alerts ia
       JOIN students s ON s.id=ia.student_id
       LEFT JOIN accounts a ON a.id=s.account_id
       WHERE ia.student_id = ANY($1) AND ia.is_resolved=false
       ORDER BY ia.created_at DESC`,
      [sids]
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// ─── POST /api/parent/resolve-alert/:id ──────────────────────────────────
parentDashboardRouter.post("/parent/resolve-alert/:id", ...authParent, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: linkedStudents } = await pool.query(
      "SELECT student_id FROM guardian_links WHERE parent_account_id=$1 AND status='active'",
      [req.userId]
    );
    const sids = linkedStudents.map(r => r.student_id);
    const { rowCount } = await pool.query(
      "UPDATE intervention_alerts SET is_resolved=true WHERE id=$1 AND student_id=ANY($2)",
      [parseInt(req.params.id), sids]
    );
    if (!rowCount) return res.status(404).json({ error: "Alert not found" });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// ─── GET /api/parent/billing ──────────────────────────────────────────────
parentDashboardRouter.get("/parent/billing", ...authParent, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: linkedStudents } = await pool.query(
      `SELECT gl.student_id, s.student_name, a.display_name
       FROM guardian_links gl
       JOIN students s ON s.id=gl.student_id
       LEFT JOIN accounts a ON a.id=s.account_id
       WHERE gl.parent_account_id=$1 AND gl.status='active'`, [req.userId]
    );
    const sids = linkedStudents.map(r => r.student_id);

    if (!sids.length) return res.json({ invoices: [], subscriptions: [] });

    const { rows: invoices } = await pool.query(
      `SELECT inv.*, s.student_name
       FROM invoices inv
       JOIN students s ON s.id=inv.student_id
       WHERE inv.student_id=ANY($1)
       ORDER BY inv.created_at DESC LIMIT 20`, [sids]
    ).catch(() => ({ rows: [] }));

    const { rows: subscriptions } = await pool.query(
      `SELECT sub.*, sp.name AS plan_name, sp.price, sp.currency
       FROM subscriptions sub
       JOIN subscription_plans sp ON sp.id=sub.plan_id
       WHERE sub.student_id=ANY($1) AND sub.status='active'`, [sids]
    ).catch(() => ({ rows: [] }));

    res.json({ invoices, subscriptions, linkedStudents });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// ─── GET /api/parent/settings ─────────────────────────────────────────────
parentDashboardRouter.get("/parent/settings", ...authParent, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM parent_settings WHERE parent_id=$1", [req.userId]
    );
    if (!rows.length) {
      const defaults = { notification_preferences: { attendance: true, grades: true, assignments: true, messages: true }, language: "en", theme: "light" };
      res.json(defaults);
    } else {
      res.json(rows[0]);
    }
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// ─── PUT /api/parent/settings ─────────────────────────────────────────────
parentDashboardRouter.put("/parent/settings", ...authParent, async (req: AuthRequest, res: Response) => {
  try {
    const { notification_preferences, language, theme } = req.body;
    await pool.query(
      `INSERT INTO parent_settings (parent_id, notification_preferences, language, theme)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (parent_id) DO UPDATE
       SET notification_preferences=COALESCE($2, parent_settings.notification_preferences),
           language=COALESCE($3, parent_settings.language),
           theme=COALESCE($4, parent_settings.theme)`,
      [req.userId, notification_preferences ? JSON.stringify(notification_preferences) : null, language, theme]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// ─── POST /api/parent/ai-assistant ────────────────────────────────────────
parentDashboardRouter.post("/parent/ai-assistant", ...authParent, async (req: AuthRequest, res: Response) => {
  try {
    const { message, studentId } = req.body;
    if (!message) return res.status(400).json({ error: "message required" });

    let context = "";
    if (studentId) {
      const sid = parseInt(studentId);
      if (await getLinkedStudentId(req.userId!, sid)) {
        const { rows: attRows } = await pool.query(
          `SELECT COUNT(*) AS total, SUM(CASE WHEN LOWER(status)='present' THEN 1 ELSE 0 END) AS present
           FROM attendance WHERE student_id=$1`, [sid]
        );
        const total = parseInt(attRows[0]?.total || "0");
        const present = parseInt(attRows[0]?.present || "0");
        const attRate = total > 0 ? Math.round((present / total) * 100) : 0;
        context = `Student attendance rate: ${attRate}%. `;
      }
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return res.json({ response: getFallbackResponse(message) });
    }

    const response = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are GuardianAI, a helpful educational assistant for parents using the Aperti platform. 
You help parents understand their child's academic progress, interpret grades and attendance, 
and suggest strategies to support learning at home. ${context}
Be warm, supportive, and practical. Keep responses concise (2-3 paragraphs max).`
          },
          { role: "user", content: message }
        ],
        max_tokens: 400,
      })
    });

    if (!response.ok) {
      return res.json({ response: getFallbackResponse(message) });
    }

    const data = await response.json() as any;
    res.json({ response: data.choices?.[0]?.message?.content || getFallbackResponse(message) });
  } catch (err: any) {
    res.json({ response: getFallbackResponse(req.body?.message || "") });
  }
});

function getFallbackResponse(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("grade") || lower.includes("mark") || lower.includes("score")) {
    return "Grades reflect your child's understanding at a point in time. A grade between 70–80% is solid; above 80% is excellent. If grades have dipped recently, try reviewing the topic together using the revision tools available in their Student Portal, or message their teacher for specific guidance.";
  }
  if (lower.includes("attendance") || lower.includes("absent")) {
    return "Consistent attendance is strongly linked to academic success. An attendance rate above 90% is ideal. If your child has been absent frequently, it's worth reaching out to their teacher to catch up on missed content. The attendance records in this portal can help you track patterns.";
  }
  if (lower.includes("homework") || lower.includes("assignment")) {
    return "Regular homework completion builds study habits and reinforces classroom learning. If assignments are overdue, encourage your child to complete them as soon as possible — late submissions are often still accepted. You can message the teacher directly for an extension if needed.";
  }
  if (lower.includes("exam") || lower.includes("test")) {
    return "Exam preparation works best when spread over weeks rather than cramming. Encourage your child to use the TrialVault for practice papers, the Mentor for topic explanations, and the FocusZone for distraction-free revision sessions. The Exam Readiness page shows predicted outcomes based on recent performance.";
  }
  return "Thank you for your question. As a parent, your involvement in your child's education makes a significant difference. I'm here to help you understand the data in this portal and suggest ways to support learning at home. For specific concerns about your child's progress, the Messages section lets you connect directly with their teachers.";
}

// ─── POST /api/parent/generate-report ─────────────────────────────────────
parentDashboardRouter.post("/parent/generate-report", ...authParent, async (req: AuthRequest, res: Response) => {
  try {
    const { studentId, frequency } = req.body;
    if (!studentId) return res.status(400).json({ error: "studentId required" });
    const sid = parseInt(studentId);
    if (!(await getLinkedStudentId(req.userId!, sid))) return res.status(403).json({ error: "Not linked" });

    // Compile report data
    const [attRows, hwRows, gradeRows, studentRows] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total, SUM(CASE WHEN LOWER(status)='present' THEN 1 ELSE 0 END) AS present FROM attendance WHERE student_id=$1`, [sid]),
      pool.query(`SELECT COUNT(*) AS submitted, COUNT(CASE WHEN status NOT IN ('submitted','graded') AND due_date < NOW() THEN 1 END) AS overdue FROM homework_submissions WHERE student_id=$1`, [sid]),
      pool.query(`SELECT ROUND(AVG(marks_scored::float / NULLIF(eq.max_marks,0)*100),1) AS avg FROM student_marks sm JOIN exam_questions eq ON eq.id=sm.question_id WHERE sm.student_id=$1`, [sid]),
      pool.query(`SELECT s.student_name, a.display_name FROM students s LEFT JOIN accounts a ON a.id=s.account_id WHERE s.id=$1`, [sid]),
    ]);

    const total = parseInt(attRows.rows[0]?.total || "0");
    const present = parseInt(attRows.rows[0]?.present || "0");
    const attRate = total > 0 ? Math.round((present / total) * 100) : 0;
    const name = studentRows.rows[0]?.display_name || studentRows.rows[0]?.student_name || "Student";

    const report = {
      studentId: sid,
      studentName: name,
      frequency: frequency || "weekly",
      generatedAt: new Date().toISOString(),
      attendanceRate: attRate,
      hwSubmitted: parseInt(hwRows.rows[0]?.submitted || "0"),
      hwOverdue: parseInt(hwRows.rows[0]?.overdue || "0"),
      avgGrade: parseFloat(gradeRows.rows[0]?.avg || "0"),
    };

    // Store report (no dedicated table yet, store as notification)
    await pool.query(
      `INSERT INTO parent_notifications (parent_id, type, title, message, is_read, created_at)
       VALUES ($1,'report',$2,$3,false,NOW())`,
      [req.userId, `${frequency || "Weekly"} Report — ${name}`,
       `Attendance: ${attRate}% | Avg Grade: ${report.avgGrade}% | Homework Submitted: ${report.hwSubmitted}`]
    );

    res.json({ success: true, report });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});
