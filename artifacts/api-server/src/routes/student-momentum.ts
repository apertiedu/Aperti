import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { pool } from "@workspace/db";

export const studentMomentumRouter = Router();

studentMomentumRouter.use(authenticate);

// GET /api/student/momentum — Learning Momentum Score 0-100
studentMomentumRouter.get("/momentum", async (req: AuthRequest, res: Response) => {
  try {
    const accountId = req.user!.id;

    // Find student record
    const { rows: studentRows } = await pool.query(
      `SELECT id FROM students WHERE account_id = $1 LIMIT 1`,
      [accountId]
    ).catch(() => ({ rows: [] }));

    if (!studentRows.length) {
      return res.json({ score: 0, label: "No Data", breakdown: {} });
    }
    const studentId = studentRows[0].id;

    // Component 1: Attendance (0-25 pts) — last 30 days
    const { rows: attRows } = await pool.query(`
      SELECT
        ROUND(100.0 * SUM(CASE WHEN att.status='present' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)) AS pct
      FROM attendance att
      JOIN sessions s ON s.id = att.session_id
      WHERE att.student_id = $1
        AND s.date >= NOW() - INTERVAL '30 days'
    `, [studentId]).catch(() => ({ rows: [{ pct: null }] }));
    const attendancePct = Number(attRows[0]?.pct || 0);
    const attendanceScore = Math.round((attendancePct / 100) * 25);

    // Component 2: Homework completion (0-20 pts) — last 30 days
    const { rows: hwRows } = await pool.query(`
      SELECT
        COUNT(h.id)::int AS total,
        COUNT(hs.id)::int AS submitted
      FROM homework h
      JOIN students s ON s.course_id = h.course_id
      LEFT JOIN homework_submissions hs ON hs.homework_id = h.id AND hs.student_id = $1
      WHERE s.id = $1
        AND h.due_date >= NOW() - INTERVAL '30 days'
    `, [studentId]).catch(() => ({ rows: [{ total: 0, submitted: 0 }] }));
    const hwTotal = Number(hwRows[0]?.total || 0);
    const hwSubmitted = Number(hwRows[0]?.submitted || 0);
    const hwPct = hwTotal > 0 ? (hwSubmitted / hwTotal) * 100 : 0;
    const hwScore = Math.round((hwPct / 100) * 20);

    // Component 3: Assessment performance (0-30 pts) — average score
    const { rows: examRows } = await pool.query(`
      SELECT ROUND(AVG(sm.score / NULLIF(sm.max_score, 0) * 100)) AS avg_pct
      FROM student_marks sm
      WHERE sm.student_id = $1
        AND sm.created_at >= NOW() - INTERVAL '60 days'
    `, [studentId]).catch(() => ({ rows: [{ avg_pct: null }] }));
    const examPct = Number(examRows[0]?.avg_pct || 0);
    const examScore = Math.round((examPct / 100) * 30);

    // Component 4: Revision activity (0-15 pts) — flashcard + revision sessions
    const { rows: revRows } = await pool.query(`
      SELECT COUNT(*)::int AS sessions
      FROM flashcard_sessions
      WHERE student_id = $1
        AND created_at >= NOW() - INTERVAL '30 days'
    `, [studentId]).catch(() => ({ rows: [{ sessions: 0 }] }));
    const revSessions = Number(revRows[0]?.sessions || 0);
    const revScore = Math.min(15, Math.round((revSessions / 20) * 15));

    // Component 5: Consistency (0-10 pts) — active days last 14 days
    const { rows: activeRows } = await pool.query(`
      SELECT COUNT(DISTINCT DATE(att.created_at))::int AS active_days
      FROM attendance att
      WHERE att.student_id = $1
        AND att.status = 'present'
        AND att.created_at >= NOW() - INTERVAL '14 days'
    `, [studentId]).catch(() => ({ rows: [{ active_days: 0 }] }));
    const activeDays = Number(activeRows[0]?.active_days || 0);
    const consistencyScore = Math.round((activeDays / 10) * 10);

    const totalScore = Math.min(100, attendanceScore + hwScore + examScore + revScore + consistencyScore);

    let label: string;
    let color: string;
    if (totalScore >= 80) { label = "Excellent"; color = "#16a34a"; }
    else if (totalScore >= 60) { label = "Good"; color = "#0D9488"; }
    else if (totalScore >= 40) { label = "Needs Attention"; color = "#d97706"; }
    else { label = "At Risk"; color = "#dc2626"; }

    // Recommendations based on weakest components
    const recommendations: string[] = [];
    if (attendancePct < 70) recommendations.push("Improve attendance — aim for 80%+ to stay on track");
    if (hwPct < 60) recommendations.push("Complete pending homework before the deadline");
    if (examPct < 50) recommendations.push("Review recent exam mistakes with your teacher");
    if (revSessions < 5) recommendations.push("Try 15 minutes of flashcard revision daily");
    if (activeDays < 5) recommendations.push("Log in consistently — even 10 minutes a day counts");

    res.json({
      score: totalScore,
      label,
      color,
      breakdown: {
        attendance: { score: attendanceScore, max: 25, pct: attendancePct },
        homework: { score: hwScore, max: 20, pct: Math.round(hwPct) },
        assessments: { score: examScore, max: 30, pct: examPct },
        revision: { score: revScore, max: 15, sessions: revSessions },
        consistency: { score: consistencyScore, max: 10, activeDays },
      },
      recommendations,
    });
  } catch (err) {
    console.error("momentum error:", err);
    res.status(500).json({ error: "Failed to calculate momentum score" });
  }
});

// GET /api/student/what-next — "What to do next" recommendations
studentMomentumRouter.get("/what-next", async (req: AuthRequest, res: Response) => {
  try {
    const accountId = req.user!.id;

    const { rows: studentRows } = await pool.query(
      `SELECT id, course_id FROM students WHERE account_id = $1 LIMIT 1`,
      [accountId]
    ).catch(() => ({ rows: [] }));

    if (!studentRows.length) return res.json({ items: [] });
    const studentId = studentRows[0].id;
    const courseId = studentRows[0].course_id;

    const items: any[] = [];

    // Pending homework
    const { rows: hwDue } = await pool.query(`
      SELECT h.id, h.title, h.due_date
      FROM homework h
      LEFT JOIN homework_submissions hs ON hs.homework_id = h.id AND hs.student_id = $1
      WHERE h.course_id = $2
        AND h.due_date >= NOW()
        AND hs.id IS NULL
      ORDER BY h.due_date ASC
      LIMIT 3
    `, [studentId, courseId]).catch(() => ({ rows: [] }));
    hwDue.forEach((hw: any) => items.push({ type: "homework", icon: "📝", title: hw.title, subtitle: `Due ${new Date(hw.due_date).toLocaleDateString()}`, href: "/my-homework", priority: 1 }));

    // Upcoming exams
    const { rows: exDue } = await pool.query(`
      SELECT e.id, e.name, e.exam_date
      FROM exams e
      WHERE e.course_id = $1
        AND e.status = 'published'
        AND e.exam_date BETWEEN NOW() AND NOW() + INTERVAL '14 days'
      ORDER BY e.exam_date ASC
      LIMIT 2
    `, [courseId]).catch(() => ({ rows: [] }));
    exDue.forEach((ex: any) => items.push({ type: "exam", icon: "📋", title: `Prepare: ${ex.name}`, subtitle: `Exam on ${new Date(ex.exam_date).toLocaleDateString()}`, href: "/exams", priority: 2 }));

    // Flashcards due for review
    const { rows: fcRows } = await pool.query(`
      SELECT COUNT(*)::int AS count FROM flashcards
      WHERE student_id = $1 AND (next_review IS NULL OR next_review <= NOW())
      LIMIT 1
    `, [studentId]).catch(() => ({ rows: [{ count: 0 }] }));
    if (Number(fcRows[0]?.count || 0) > 0) {
      items.push({ type: "flashcard", icon: "🃏", title: `${fcRows[0].count} flashcards due for review`, subtitle: "Keep your memory fresh", href: "/flashcards", priority: 3 });
    }

    // Unread messages
    const { rows: msgRows } = await pool.query(`
      SELECT COUNT(*)::int AS count FROM messages
      WHERE recipient_id = $1 AND read_at IS NULL
    `, [accountId]).catch(() => ({ rows: [{ count: 0 }] }));
    if (Number(msgRows[0]?.count || 0) > 0) {
      items.push({ type: "message", icon: "💬", title: `${msgRows[0].count} unread messages`, subtitle: "Check your inbox", href: "/inbox", priority: 4 });
    }

    items.sort((a, b) => a.priority - b.priority);
    res.json({ items: items.slice(0, 5) });
  } catch (err) {
    console.error("what-next error:", err);
    res.status(500).json({ error: "Failed to load recommendations" });
  }
});
