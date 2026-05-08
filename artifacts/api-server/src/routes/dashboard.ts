import { Router, type IRouter } from "express";
import { eq, sql, desc, and, gte, lte } from "drizzle-orm";
import { db, studentsTable, sessionsTable, attendanceTable } from "@workspace/db";
import { requireTenantAccess } from "../middleware/tenant";
import {
  GetRecentActivityQueryParams,
  GetWeeklyStatsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", requireTenantAccess, async (req, res): Promise<void> => {
  const { teacherId, isAdmin } = req.tenant;
  const stuFilter = !isAdmin && teacherId ? eq(studentsTable.teacherAccountId, teacherId) : sql`1=1`;
  const sesFilter = !isAdmin && teacherId ? eq(sessionsTable.teacherAccountId, teacherId) : sql`1=1`;
  const attStuJoin = !isAdmin && teacherId ? eq(studentsTable.teacherAccountId, teacherId) : sql`1=1`;

  const [studentCount] = await db.select({ count: sql<number>`count(*)::int` }).from(studentsTable).where(stuFilter);
  const [sessionCount] = await db.select({ count: sql<number>`count(*)::int` }).from(sessionsTable).where(sesFilter);

  const [totalRecords] = await db.select({ count: sql<number>`count(*)::int` })
    .from(attendanceTable)
    .innerJoin(studentsTable, eq(attendanceTable.studentId, studentsTable.id))
    .where(attStuJoin);

  const [presentRecords] = await db.select({ count: sql<number>`count(*)::int` })
    .from(attendanceTable)
    .innerJoin(studentsTable, eq(attendanceTable.studentId, studentsTable.id))
    .where(and(eq(attendanceTable.status, "Present"), attStuJoin));

  const today = new Date().toISOString().split("T")[0];
  const [presentToday] = await db.select({ count: sql<number>`count(*)::int` })
    .from(attendanceTable)
    .innerJoin(studentsTable, eq(attendanceTable.studentId, studentsTable.id))
    .where(and(eq(attendanceTable.date, today), eq(attendanceTable.status, "Present"), attStuJoin));

  const [absentStudentsResult] = await db.select({ count: sql<number>`count(distinct ${attendanceTable.studentId})::int` })
    .from(attendanceTable)
    .innerJoin(studentsTable, eq(attendanceTable.studentId, studentsTable.id))
    .where(and(eq(attendanceTable.status, "Absent"), attStuJoin));

  const total = totalRecords.count || 0;
  const present = presentRecords.count || 0;
  const rate = total > 0 ? Math.round((present / total) * 100 * 100) / 100 : 0;

  res.json({
    totalStudents: studentCount.count,
    totalSessions: sessionCount.count,
    attendanceRate: rate,
    absentStudents: absentStudentsResult.count,
    presentToday: presentToday.count,
  });
});

router.get("/dashboard/recent-activity", requireTenantAccess, async (req, res): Promise<void> => {
  const { teacherId, isAdmin } = req.tenant;
  const params = GetRecentActivityQueryParams.safeParse(req.query);
  const limit = (params.success && params.data.limit) || 10;
  const teacherFilter = !isAdmin && teacherId ? eq(studentsTable.teacherAccountId, teacherId) : sql`1=1`;

  const records = await db.select({
    id: attendanceTable.id,
    studentCode: studentsTable.studentCode,
    studentName: studentsTable.studentName,
    lessonNumber: sessionsTable.lessonNumber,
    status: attendanceTable.status,
    markedAt: attendanceTable.markedAt,
  })
  .from(attendanceTable)
  .innerJoin(studentsTable, eq(attendanceTable.studentId, studentsTable.id))
  .innerJoin(sessionsTable, eq(attendanceTable.sessionId, sessionsTable.id))
  .where(teacherFilter)
  .orderBy(desc(attendanceTable.markedAt))
  .limit(limit);

  res.json(records);
});

router.get("/dashboard/weekly-stats", requireTenantAccess, async (req, res): Promise<void> => {
  const { teacherId, isAdmin } = req.tenant;
  const params = GetWeeklyStatsQueryParams.safeParse(req.query);

  let weekStart: string;
  if (params.success && params.data.weekStart) {
    weekStart = (params.data.weekStart as unknown as Date).toISOString().split("T")[0];
  } else {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    weekStart = monday.toISOString().split("T")[0];
  }

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().split("T")[0];
  const sesFilter = !isAdmin && teacherId ? eq(sessionsTable.teacherAccountId, teacherId) : sql`1=1`;

  const records = await db.select({
    lessonNumber: sessionsTable.lessonNumber,
    status: attendanceTable.status,
    count: sql<number>`count(*)::int`,
  })
  .from(attendanceTable)
  .innerJoin(sessionsTable, eq(attendanceTable.sessionId, sessionsTable.id))
  .where(and(
    gte(attendanceTable.date, weekStart),
    lte(attendanceTable.date, weekEndStr),
    sesFilter,
  ))
  .groupBy(sessionsTable.lessonNumber, attendanceTable.status);

  const byLessonMap: Record<number, { present: number; absent: number }> = {};
  let totalPresent = 0;
  let totalAbsent = 0;

  for (const r of records) {
    if (!byLessonMap[r.lessonNumber]) {
      byLessonMap[r.lessonNumber] = { present: 0, absent: 0 };
    }
    if (r.status === "Present") {
      byLessonMap[r.lessonNumber].present += r.count;
      totalPresent += r.count;
    } else {
      byLessonMap[r.lessonNumber].absent += r.count;
      totalAbsent += r.count;
    }
  }

  const byLesson = Object.entries(byLessonMap).map(([ln, data]) => ({
    lessonNumber: parseInt(ln, 10),
    present: data.present,
    absent: data.absent,
  }));

  res.json({ totalPresent, totalAbsent, byLesson });
});

// Today's sessions (sessions whose day_of_week matches today)
router.get("/dashboard/today-sessions", requireTenantAccess, async (req, res): Promise<void> => {
  const { teacherId, isAdmin } = req.tenant;
  const teacherCond = !isAdmin && teacherId ? `AND s.teacher_account_id = ${teacherId}` : "";
  const { pool } = await import("@workspace/db");
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const todayName = dayNames[new Date().getDay()];
  const today = new Date().toISOString().split("T")[0];

  const { rows } = await pool.query(`
    SELECT
      s.id, s.lesson_number AS "lessonNumber", s.day_of_week AS "dayOfWeek",
      s.start_time AS "startTime", s.type, s.capacity, s.online_link AS "onlineLink",
      COALESCE(sub.name, 'No Subject') AS "subjectName",
      COUNT(DISTINCT st.id)::int AS "studentCount",
      COALESCE(SUM(CASE WHEN a.status='Present' AND a.date=$2 THEN 1 ELSE 0 END)::int, 0) AS "presentToday"
    FROM sessions s
    LEFT JOIN subjects sub ON sub.id = s.subject_id
    LEFT JOIN students st ON (st.lesson1_session_id=s.id OR st.lesson2_session_id=s.id OR st.lesson3_session_id=s.id)
    LEFT JOIN attendance a ON a.session_id=s.id AND a.date=$2
    WHERE s.day_of_week=$1 ${teacherCond}
    GROUP BY s.id, s.lesson_number, s.day_of_week, s.start_time, s.type, s.capacity, s.online_link, sub.name
    ORDER BY s.start_time
  `, [todayName, today]);
  res.json(rows);
});

// Upcoming exams in next 14 days
router.get("/dashboard/upcoming-exams", requireTenantAccess, async (req, res): Promise<void> => {
  const { teacherId, isAdmin } = req.tenant;
  const teacherCond = !isAdmin && teacherId ? `AND e.teacher_account_id = ${teacherId}` : "";
  const { pool } = await import("@workspace/db");
  const today = new Date().toISOString().split("T")[0];
  const futureDate = new Date(); futureDate.setDate(futureDate.getDate() + 14);
  const future = futureDate.toISOString().split("T")[0];

  const { rows } = await pool.query(`
    SELECT
      e.id, e.name, e.exam_date AS "examDate", e.total_marks AS "totalMarks",
      e.time_limit_minutes AS "timeLimitMinutes",
      COALESCE(sub.name, 'No Subject') AS "subjectName",
      COUNT(DISTINCT eq.id)::int AS "questionCount"
    FROM exams e
    LEFT JOIN subjects sub ON sub.id = e.subject_id
    LEFT JOIN exam_questions eq ON eq.exam_id = e.id
    WHERE e.exam_date >= $1 AND e.exam_date <= $2 ${teacherCond}
    GROUP BY e.id, e.name, e.exam_date, e.total_marks, e.time_limit_minutes, sub.name
    ORDER BY e.exam_date ASC
    LIMIT 8
  `, [today, future]);
  res.json(rows);
});

// At-risk students (attendance < 75% or no recent activity)
router.get("/dashboard/at-risk", requireTenantAccess, async (req, res): Promise<void> => {
  const { teacherId, isAdmin } = req.tenant;
  const teacherCond = !isAdmin && teacherId ? `AND st.teacher_account_id = ${teacherId}` : "";
  const { pool } = await import("@workspace/db");

  const { rows } = await pool.query(`
    SELECT
      st.id, st.student_name AS "studentName", st.student_code AS "studentCode",
      COUNT(a.id)::int AS "totalSessions",
      COALESCE(SUM(CASE WHEN a.status='Present' THEN 1 ELSE 0 END)::int, 0) AS "presentCount",
      CASE WHEN COUNT(a.id) > 0 THEN
        ROUND((SUM(CASE WHEN a.status='Present' THEN 1 ELSE 0 END)::numeric / COUNT(a.id)::numeric) * 100, 1)
      ELSE 0 END AS "attendanceRate"
    FROM students st
    LEFT JOIN attendance a ON a.student_id = st.id
    WHERE st.status = 'active' ${teacherCond}
    GROUP BY st.id, st.student_name, st.student_code
    HAVING COUNT(a.id) > 0 AND
      (SUM(CASE WHEN a.status='Present' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(a.id), 0)) < 0.75
    ORDER BY "attendanceRate" ASC
    LIMIT 5
  `);
  res.json(rows);
});

export default router;
