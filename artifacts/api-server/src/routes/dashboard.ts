import { Router, Response } from "express";
import { db } from "@workspace/db";
import { authenticate, AuthRequest, requireRole } from "../middleware/auth";
import { lessonsTable, attendanceTable, homeworkSubmissionsTable, studentsTable, liveClassRoomsTable, subscriptionsTable } from "@workspace/db";
import { eq, and, isNull, isNotNull, sql } from "drizzle-orm";

export const dashboardRouter = Router();

dashboardRouter.get("/summary", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.userId!;
    const today = new Date().toISOString().split("T")[0];
    const lessons = await db.query.lessons.findMany({
      where: (l, { eq, and }) => and(eq(l.teacherAccountId, teacherId), eq(l.dayOfWeek, today)),
    });
    const attendanceRecords = await db.query.attendance.findMany({
      where: (a, { eq }) => eq(a.date, today),
    });
    const pending = await db.query.homeworkSubmissions.findMany({
      where: (s, { eq }) => eq(s.status, "submitted"),
    });
    res.json({
      lessonsToday: lessons.length,
      studentsPresent: attendanceRecords.filter(r => r.status === "Present").length,
      attendanceRate: lessons.length > 0
        ? Math.round((attendanceRecords.length / lessons.length) * 100)
        : 0,
      pendingHomework: pending.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Today's full class schedule ──────────────────────────────────────── */
dashboardRouter.get("/today-classes", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.userId!;
    const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
    const { rows } = await (await import("@workspace/db")).pool.query(
      `SELECT l.*, s.name AS subject_name, s.board, s.level
         FROM lessons l
         LEFT JOIN subjects s ON l.subject_id = s.id
        WHERE l.teacher_account_id=$1 AND lower(l.day_of_week)=lower($2) AND l.is_active=true
        ORDER BY l.start_time`,
      [teacherId, todayName],
    );
    res.json(rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* ── Pending assignment queue ─────────────────────────────────────────── */
dashboardRouter.get("/assignment-queue", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.userId!;
    const { rows } = await (await import("@workspace/db")).pool.query(
      `SELECT hs.id, hs.status, hs.submitted_at, hs.marks_awarded,
              h.title AS homework_title, h.total_marks, h.due_date,
              st.student_name, st.student_code
         FROM homework_submissions hs
         JOIN homework h ON hs.homework_id = h.id
         JOIN students st ON hs.student_id = st.id
        WHERE h.teacher_account_id=$1 AND hs.status='submitted'
        ORDER BY hs.submitted_at DESC
        LIMIT 20`,
      [teacherId],
    );
    res.json(rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* ── 7-day attendance trend ───────────────────────────────────────────── */
dashboardRouter.get("/attendance-trend", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.userId!;
    const { rows } = await (await import("@workspace/db")).pool.query(
      `SELECT a.date::text,
              COUNT(*) FILTER (WHERE a.status='Present') AS present,
              COUNT(*) AS total
         FROM attendance a
         JOIN students s ON a.student_id = s.id
        WHERE s.teacher_account_id=$1
          AND a.date >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY a.date
        ORDER BY a.date`,
      [teacherId],
    );
    res.json(rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* ── Extended summary (richer than /summary) ─────────────────────────── */
dashboardRouter.get("/extended-summary", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.userId!;
    const { pool } = await import("@workspace/db");

    const [students, pending, questions, decks, resources, msgs] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM students WHERE teacher_account_id=$1 AND status='active'`, [teacherId]),
      pool.query(
        `SELECT COUNT(*) FROM homework_submissions hs JOIN homework h ON hs.homework_id=h.id WHERE h.teacher_account_id=$1 AND hs.status='submitted'`,
        [teacherId],
      ),
      pool.query(`SELECT COUNT(*) FROM question_bank WHERE teacher_account_id=$1`, [teacherId]),
      pool.query(`SELECT COUNT(*) FROM flashcard_decks WHERE teacher_account_id=$1`, [teacherId]),
      pool.query(`SELECT COUNT(*) FROM resources WHERE teacher_account_id=$1`, [teacherId]),
      pool.query(`SELECT COUNT(*) FROM messages WHERE to_account_id=$1 AND read=false`, [teacherId]).catch(() => ({ rows: [{ count: 0 }] })),
    ]);

    res.json({
      totalStudents: Number(students.rows[0].count),
      pendingGrading: Number(pending.rows[0].count),
      questionBankCount: Number(questions.rows[0].count),
      flashcardDecks: Number(decks.rows[0].count),
      resourceCount: Number(resources.rows[0].count),
      unreadMessages: Number(msgs.rows[0].count),
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

dashboardRouter.get("/admin/live-stats", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const [totalStudentsResult] = await db.select({ count: sql<number>`count(*)` }).from(studentsTable);
    const totalStudents = Number(totalStudentsResult?.count ?? 0);

    const attendanceToday = await db.select({ count: sql<number>`count(*)` })
      .from(attendanceTable)
      .where(and(eq(attendanceTable.date, today), eq(attendanceTable.status, "Present")));
    const presentToday = Number(attendanceToday[0]?.count ?? 0);

    const attendanceRate = totalStudents > 0
      ? Math.round((presentToday / totalStudents) * 100)
      : 0;

    const activeSessions = await db.select({ count: sql<number>`count(*)` })
      .from(liveClassRoomsTable)
      .where(and(isNotNull(liveClassRoomsTable.startedAt), isNull(liveClassRoomsTable.endedAt)));
    const activeSessionCount = Number(activeSessions[0]?.count ?? 0);

    const pendingInstaPay = await db.select({ count: sql<number>`count(*)` })
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.paymentStatus, "pending"));
    const pendingInstapayCount = Number(pendingInstaPay[0]?.count ?? 0);

    res.json({
      attendanceRate,
      presentToday,
      totalStudents,
      activeLiveSessions: activeSessionCount,
      pendingInstapay: pendingInstapayCount,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
