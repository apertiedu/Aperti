import { Router, type IRouter } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { db, studentsTable, sessionsTable, attendanceTable } from "@workspace/db";
import {
  MarkAttendanceBody,
  ListAttendanceQueryParams,
  AutoMarkAbsenceBody,
  ExportAttendanceQueryParams,
} from "@workspace/api-zod";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function getDateForDayInWeek(weekStart: string, dayOfWeek: string): string {
  const start = new Date(weekStart + "T00:00:00");
  const targetIdx = DAY_NAMES.indexOf(dayOfWeek);
  const mondayIdx = 1;
  const diff = targetIdx - mondayIdx;
  const d = new Date(start);
  d.setDate(start.getDate() + diff);
  return d.toISOString().split("T")[0];
}

function getCurrentWeekMonday(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().split("T")[0];
}

const router: IRouter = Router();

router.post("/attendance/mark", async (req, res): Promise<void> => {
  const parsed = MarkAttendanceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.message });
    return;
  }

  const { studentCode, sessionId } = parsed.data;

  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.studentCode, studentCode));
  if (!student) {
    res.status(404).json({ message: `Student code "${studentCode}" not found` });
    return;
  }

  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, sessionId));
  if (!session) {
    res.status(404).json({ message: "Session not found" });
    return;
  }

  const today = new Date().toISOString().split("T")[0];

  const existing = await db
    .select()
    .from(attendanceTable)
    .where(
      and(
        eq(attendanceTable.studentId, student.id),
        eq(attendanceTable.sessionId, sessionId),
        eq(attendanceTable.date, today)
      )
    );

  if (existing.length > 0) {
    if (existing[0].status === "Absent") {
      const [updated] = await db
        .update(attendanceTable)
        .set({ status: "Present", markedAt: new Date() })
        .where(eq(attendanceTable.id, existing[0].id))
        .returning();
      res.json({ ...updated, studentCode: student.studentCode, studentName: student.studentName, lessonNumber: session.lessonNumber, dayOfWeek: session.dayOfWeek, startTime: session.startTime });
      return;
    }
    res.json({ ...existing[0], studentCode: student.studentCode, studentName: student.studentName, lessonNumber: session.lessonNumber, dayOfWeek: session.dayOfWeek, startTime: session.startTime });
    return;
  }

  const [record] = await db
    .insert(attendanceTable)
    .values({ studentId: student.id, sessionId, date: today, status: "Present" })
    .returning();

  res.json({ ...record, studentCode: student.studentCode, studentName: student.studentName, lessonNumber: session.lessonNumber, dayOfWeek: session.dayOfWeek, startTime: session.startTime });
});

router.get("/attendance", async (req, res): Promise<void> => {
  const params = ListAttendanceQueryParams.safeParse(req.query);

  let query = db
    .select({
      id: attendanceTable.id,
      studentId: attendanceTable.studentId,
      sessionId: attendanceTable.sessionId,
      studentCode: studentsTable.studentCode,
      studentName: studentsTable.studentName,
      lessonNumber: sessionsTable.lessonNumber,
      dayOfWeek: sessionsTable.dayOfWeek,
      startTime: sessionsTable.startTime,
      date: attendanceTable.date,
      status: attendanceTable.status,
      markedAt: attendanceTable.markedAt,
    })
    .from(attendanceTable)
    .innerJoin(studentsTable, eq(attendanceTable.studentId, studentsTable.id))
    .innerJoin(sessionsTable, eq(attendanceTable.sessionId, sessionsTable.id))
    .$dynamic();

  const conditions = [];
  if (params.success && params.data.sessionId) conditions.push(eq(attendanceTable.sessionId, params.data.sessionId));
  if (params.success && params.data.studentCode) conditions.push(eq(studentsTable.studentCode, params.data.studentCode));
  if (params.success && params.data.date) conditions.push(eq(attendanceTable.date, (params.data.date as unknown as Date).toISOString().split("T")[0]));
  if (params.success && params.data.weekStart) {
    const wsDate = params.data.weekStart as unknown as Date;
    const wsStr = wsDate.toISOString().split("T")[0];
    const weekEnd = new Date(wsDate);
    weekEnd.setDate(weekEnd.getDate() + 6);
    conditions.push(gte(attendanceTable.date, wsStr));
    conditions.push(lte(attendanceTable.date, weekEnd.toISOString().split("T")[0]));
  }

  if (conditions.length > 0) query = query.where(and(...conditions));

  const records = await query;
  res.json(records);
});

// Auto-absence: mark ONE absence per lesson per student per week
// Only uses their assigned sessions (lesson1SessionId, lesson2SessionId, lesson3SessionId)
router.post("/attendance/auto-absence", async (req, res): Promise<void> => {
  const parsed = AutoMarkAbsenceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.message });
    return;
  }

  const weekStart = (parsed.data.weekStart as unknown as Date).toISOString().split("T")[0];
  const allStudents = await db.select().from(studentsTable);
  const allSessions = await db.select().from(sessionsTable);
  const sessionMap = Object.fromEntries(allSessions.map((s) => [s.id, s]));

  let marked = 0;

  for (const student of allStudents) {
    // Each student has up to 3 lesson assignments; check each lesson independently
    const lessonAssignments = [
      student.lesson1SessionId,
      student.lesson2SessionId,
      student.lesson3SessionId,
    ].filter(Boolean) as number[];

    for (const sessionId of lessonAssignments) {
      const session = sessionMap[sessionId];
      if (!session) continue;

      // Calculate the exact date of this session in the given week
      const sessionDate = getDateForDayInWeek(weekStart, session.dayOfWeek);

      // Check if this student already has ANY attendance record for this lesson this week
      // (same lessonNumber means same lesson, regardless of session)
      const sameLessonSessions = allSessions.filter((s) => s.lessonNumber === session.lessonNumber);
      const sameLessonSessionIds = sameLessonSessions.map((s) => s.id);

      // Check if student attended ANY session of this lesson number this week
      const weekEnd = new Date(weekStart + "T00:00:00");
      weekEnd.setDate(weekEnd.getDate() + 6);
      const weekEndStr = weekEnd.toISOString().split("T")[0];

      const existingRecords = await db
        .select()
        .from(attendanceTable)
        .where(
          and(
            eq(attendanceTable.studentId, student.id),
            eq(attendanceTable.sessionId, sessionId),
            eq(attendanceTable.date, sessionDate)
          )
        );

      if (existingRecords.length === 0) {
        await db.insert(attendanceTable).values({
          studentId: student.id,
          sessionId,
          date: sessionDate,
          status: "Absent",
        });
        marked++;
      }
    }
  }

  res.json({ marked, message: `Marked ${marked} absence record(s) for the week of ${weekStart}` });
});

router.get("/attendance/export", async (req, res): Promise<void> => {
  const params = ExportAttendanceQueryParams.safeParse(req.query);

  let query = db
    .select({
      studentCode: studentsTable.studentCode,
      studentName: studentsTable.studentName,
      date: attendanceTable.date,
      lessonNumber: sessionsTable.lessonNumber,
      dayOfWeek: sessionsTable.dayOfWeek,
      startTime: sessionsTable.startTime,
      status: attendanceTable.status,
    })
    .from(attendanceTable)
    .innerJoin(studentsTable, eq(attendanceTable.studentId, studentsTable.id))
    .innerJoin(sessionsTable, eq(attendanceTable.sessionId, sessionsTable.id))
    .$dynamic();

  if (params.success && params.data.weekStart) {
    const wsDate = params.data.weekStart as unknown as Date;
    const wsStr = wsDate.toISOString().split("T")[0];
    const weekEnd = new Date(wsDate);
    weekEnd.setDate(weekEnd.getDate() + 6);
    query = query.where(
      and(
        gte(attendanceTable.date, wsStr),
        lte(attendanceTable.date, weekEnd.toISOString().split("T")[0])
      )
    );
  }

  const records = await query.orderBy(attendanceTable.date, studentsTable.studentCode);

  let csv = "Student Code,Student Name,Date,Lesson,Day,Start Time,Status\n";
  for (const r of records) {
    csv += `${r.studentCode},"${r.studentName}",${r.date},Lesson ${r.lessonNumber},${r.dayOfWeek},${r.startTime},${r.status}\n`;
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="attendance-${params.success && params.data.weekStart ? params.data.weekStart : "all"}.csv"`);
  res.send(csv);
});

export default router;
