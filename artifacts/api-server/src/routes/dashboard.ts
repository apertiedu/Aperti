import { Router, type IRouter } from "express";
import { eq, sql, desc, and, gte, lte } from "drizzle-orm";
import { db, studentsTable, sessionsTable, attendanceTable } from "@workspace/db";
import {
  GetRecentActivityQueryParams,
  GetWeeklyStatsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const [studentCount] = await db.select({ count: sql<number>`count(*)::int` }).from(studentsTable);
  const [sessionCount] = await db.select({ count: sql<number>`count(*)::int` }).from(sessionsTable);
  const [totalRecords] = await db.select({ count: sql<number>`count(*)::int` }).from(attendanceTable);
  const [presentRecords] = await db.select({ count: sql<number>`count(*)::int` }).from(attendanceTable).where(eq(attendanceTable.status, "Present"));

  const today = new Date().toISOString().split("T")[0];
  const [presentToday] = await db.select({ count: sql<number>`count(*)::int` })
    .from(attendanceTable)
    .where(and(eq(attendanceTable.date, today), eq(attendanceTable.status, "Present")));

  const [absentStudentsResult] = await db.select({ count: sql<number>`count(distinct ${attendanceTable.studentId})::int` })
    .from(attendanceTable)
    .where(eq(attendanceTable.status, "Absent"));

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

router.get("/dashboard/recent-activity", async (req, res): Promise<void> => {
  const params = GetRecentActivityQueryParams.safeParse(req.query);
  const limit = (params.success && params.data.limit) || 10;

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
  .orderBy(desc(attendanceTable.markedAt))
  .limit(limit);

  res.json(records);
});

router.get("/dashboard/weekly-stats", async (req, res): Promise<void> => {
  const params = GetWeeklyStatsQueryParams.safeParse(req.query);

  let weekStart: string;
  if (params.success && params.data.weekStart) {
    weekStart = params.data.weekStart;
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

  const records = await db.select({
    lessonNumber: sessionsTable.lessonNumber,
    status: attendanceTable.status,
    count: sql<number>`count(*)::int`,
  })
  .from(attendanceTable)
  .innerJoin(sessionsTable, eq(attendanceTable.sessionId, sessionsTable.id))
  .where(and(
    gte(attendanceTable.date, weekStart),
    lte(attendanceTable.date, weekEndStr)
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
