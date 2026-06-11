import { Router, Response } from "express";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { pool } from "@workspace/db";

export const teacherFocusRouter = Router();

teacherFocusRouter.use(authenticate);
teacherFocusRouter.use(requireRole(["teacher", "admin", "assistant"]));

// GET /api/teacher/daily-focus — Teacher's personalised daily action list
teacherFocusRouter.get("/daily-focus", async (req: AuthRequest, res: Response) => {
  try {
    const accountId = req.user!.id;
    const today = new Date();
    const dayOfWeek = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][today.getDay()];

    // 1. Ungraded submissions
    const { rows: ungradedRows } = await pool.query(`
      SELECT COUNT(*)::int AS count
      FROM student_submissions ss
      JOIN exams e ON e.id = ss.exam_id
      JOIN aperti_courses c ON c.id = e.course_id
      WHERE c.teacher_id = $1
        AND ss.status = 'submitted'
        AND ss.graded_at IS NULL
    `, [accountId]).catch(() => ({ rows: [{ count: 0 }] }));

    // 2. Students needing attention (attendance < 70% last 30 days)
    const { rows: atRiskRows } = await pool.query(`
      SELECT s.id, a_stats.display_name, a_stats.pct
      FROM students s
      JOIN aperti_courses c ON c.id = s.course_id
      JOIN accounts a_acct ON a_acct.id = s.account_id
      JOIN LATERAL (
        SELECT a_acct2.display_name,
               ROUND(100.0 * SUM(CASE WHEN att.status='present' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0)) AS pct
        FROM attendance att
        JOIN sessions sess ON sess.id = att.session_id
        JOIN accounts a_acct2 ON a_acct2.id = s.account_id
        WHERE att.student_id = s.id
          AND sess.date >= NOW() - INTERVAL '30 days'
        GROUP BY a_acct2.display_name
      ) a_stats ON TRUE
      WHERE c.teacher_id = $1
        AND a_stats.pct < 70
      ORDER BY a_stats.pct ASC
      LIMIT 5
    `, [accountId]).catch(() => ({ rows: [] }));

    // 3. Upcoming exams (next 7 days)
    const { rows: upcomingExams } = await pool.query(`
      SELECT e.id, e.name, e.exam_date, c.name AS course_name
      FROM exams e
      JOIN aperti_courses c ON c.id = e.course_id
      WHERE c.teacher_id = $1
        AND e.exam_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'
        AND e.status = 'published'
      ORDER BY e.exam_date ASC
      LIMIT 5
    `, [accountId]).catch(() => ({ rows: [] }));

    // 4. Pending enrollment requests
    const { rows: enrollRows } = await pool.query(`
      SELECT COUNT(*)::int AS count
      FROM student_approvals
      WHERE teacher_id = $1 AND status = 'pending'
    `, [accountId]).catch(() => ({ rows: [{ count: 0 }] }));

    // 5. Unread parent messages
    const { rows: msgRows } = await pool.query(`
      SELECT COUNT(*)::int AS count
      FROM messages m
      WHERE m.recipient_id = $1
        AND m.read_at IS NULL
        AND m.sender_type = 'parent'
    `, [accountId]).catch(() => ({ rows: [{ count: 0 }] }));

    // 6. Today's sessions
    const { rows: todaySessions } = await pool.query(`
      SELECT s.id, s.lesson_number, s.start_time, s.type,
             sub.name AS subject_name,
             c.name AS course_name
      FROM sessions s
      JOIN subjects sub ON sub.id = s.subject_id
      JOIN aperti_courses c ON c.id = sub.course_id
      WHERE c.teacher_id = $1
        AND LOWER(s.day_of_week) = LOWER($2)
        AND s.is_active = TRUE
      ORDER BY s.start_time ASC
      LIMIT 10
    `, [accountId, dayOfWeek]).catch(() => ({ rows: [] }));

    // 7. Recently submitted homework
    const { rows: homeworkRows } = await pool.query(`
      SELECT COUNT(*)::int AS count
      FROM homework_submissions hs
      JOIN homework h ON h.id = hs.homework_id
      JOIN aperti_courses c ON c.id = h.course_id
      WHERE c.teacher_id = $1
        AND hs.status = 'submitted'
        AND hs.graded = FALSE
        AND hs.submitted_at >= NOW() - INTERVAL '48 hours'
    `, [accountId]).catch(() => ({ rows: [{ count: 0 }] }));

    const priorityScore =
      (ungradedRows[0]?.count || 0) * 3 +
      (atRiskRows.length) * 5 +
      (enrollRows[0]?.count || 0) * 4 +
      (msgRows[0]?.count || 0) * 2 +
      (homeworkRows[0]?.count || 0) * 1;

    res.json({
      dayOfWeek,
      priorityScore,
      ungradedSubmissions: ungradedRows[0]?.count || 0,
      atRiskStudents: atRiskRows,
      upcomingExams,
      pendingEnrollments: enrollRows[0]?.count || 0,
      unreadParentMessages: msgRows[0]?.count || 0,
      todaySessions,
      ungradedHomework: homeworkRows[0]?.count || 0,
    });
  } catch (err) {
    console.error("teacher-focus error:", err);
    res.status(500).json({ error: "Failed to load daily focus" });
  }
});

// GET /api/teacher/weekly-summary
teacherFocusRouter.get("/weekly-summary", async (req: AuthRequest, res: Response) => {
  try {
    const accountId = req.user!.id;

    const { rows: perfRows } = await pool.query(`
      SELECT
        sub.name AS subject_name,
        ROUND(AVG(sm.score)::numeric, 1) AS avg_score,
        COUNT(DISTINCT sm.student_id)::int AS student_count,
        ROUND(AVG(CASE WHEN sm.score >= sm.max_score * 0.7 THEN 100.0 ELSE 0.0 END)) AS pass_rate
      FROM student_marks sm
      JOIN exams e ON e.id = sm.exam_id
      JOIN subjects sub ON sub.id = e.subject_id
      JOIN aperti_courses c ON c.id = sub.course_id
      WHERE c.teacher_id = $1
        AND sm.created_at >= NOW() - INTERVAL '7 days'
      GROUP BY sub.name
      ORDER BY avg_score ASC
      LIMIT 10
    `, [accountId]).catch(() => ({ rows: [] }));

    const { rows: hwRows } = await pool.query(`
      SELECT
        ROUND(100.0 * SUM(CASE WHEN hs.status='submitted' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0)) AS completion_rate
      FROM homework h
      JOIN aperti_courses c ON c.id = h.course_id
      LEFT JOIN homework_submissions hs ON hs.homework_id = h.id
      WHERE c.teacher_id = $1
        AND h.due_date BETWEEN NOW() - INTERVAL '7 days' AND NOW()
    `, [accountId]).catch(() => ({ rows: [{ completion_rate: null }] }));

    const weakestSubjects = perfRows.slice(0, 3).map((r: any) => r.subject_name);
    const strongestSubjects = [...perfRows].sort((a: any, b: any) => b.avg_score - a.avg_score).slice(0, 2).map((r: any) => r.subject_name);

    res.json({
      subjectPerformance: perfRows,
      weakestSubjects,
      strongestSubjects,
      homeworkCompletionRate: hwRows[0]?.completion_rate || null,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("weekly-summary error:", err);
    res.status(500).json({ error: "Failed to load weekly summary" });
  }
});
