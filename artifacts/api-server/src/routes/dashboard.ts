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

export default router;
