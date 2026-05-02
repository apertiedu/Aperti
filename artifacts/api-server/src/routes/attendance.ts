import { Router, type IRouter } from "express";
import { eq, and, gte, lte, or, inArray } from "drizzle-orm";
import { db, studentsTable, sessionsTable, attendanceTable } from "@workspace/db";
import { requireTenantAccess } from "../middleware/tenant";
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

// POST /api/attendance/mark
router.post("/attendance/mark", requireTenantAccess, async (req, res): Promise<void> => {
  const parsed = MarkAttendanceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.message });
    return;
  }

  const { studentCode, sessionId } = parsed.data;
  const { teacherId, isAdmin } = req.tenant;

  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.studentCode, studentCode));
  if (!student) {
    res.status(404).json({ message: `Student code "${studentCode}" not found` });
    return;
  }

  // Verify teacher owns this student (skip for admin)
  if (!isAdmin && teacherId && student.teacherAccountId !== teacherId) {
    res.status(403).json({ message: "Student not in your roster" });
    return;
  }

  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, sessionId));
  if (!session) {
    res.status(404).json({ message: "Session not found" });
    return;
  }

  // Verify teacher owns this session (skip for admin)
  if (!isAdmin && teacherId && session.teacherAccountId !== teacherId) {
    res.status(403).json({ message: "Session not in your account" });
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

// GET /api/attendance
router.get("/attendance", requireTenantAccess, async (req, res): Promise<void> => {
  const params = ListAttendanceQueryParams.safeParse(req.query);
  const { teacherId, isAdmin } = req.tenant;

  const conditions: ReturnType<typeof eq>[] = [];

  // Teacher scoping: filter by sessions or students owned by this teacher
  if (!isAdmin && teacherId) {
    conditions.push(eq(sessionsTable.teacherAccountId, teacherId));
  }

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

  const records = await db
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
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  res.json(records);
});

// POST /api/attendance/auto-absence — mark ONE absence per lesson per student per week
router.post("/attendance/auto-absence", requireTenantAccess, async (req, res): Promise<void> => {
  const parsed = AutoMarkAbsenceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.message });
    return;
  }

  const { teacherId, isAdmin } = req.tenant;
  const weekStart = (parsed.data.weekStart as unknown as Date).toISOString().split("T")[0];

  // Scope students and sessions to this teacher only (admin processes all)
  const allStudents = teacherId && !isAdmin
    ? await db.select().from(studentsTable).where(eq(studentsTable.teacherAccountId, teacherId))
    : await db.select().from(studentsTable);

  const allSessions = teacherId && !isAdmin
    ? await db.select().from(sessionsTable).where(eq(sessionsTable.teacherAccountId, teacherId))
    : await db.select().from(sessionsTable);

  const sessionMap = Object.fromEntries(allSessions.map((s) => [s.id, s]));

  let marked = 0;

  for (const student of allStudents) {
    const lessonAssignments = [
      student.lesson1SessionId,
      student.lesson2SessionId,
      student.lesson3SessionId,
    ].filter(Boolean) as number[];

    for (const sessionId of lessonAssignments) {
      const session = sessionMap[sessionId];
      if (!session) continue;

      const sessionDate = getDateForDayInWeek(weekStart, session.dayOfWeek);

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

// GET /api/attendance/export
router.get("/attendance/export", requireTenantAccess, async (req, res): Promise<void> => {
  const params = ExportAttendanceQueryParams.safeParse(req.query);
  const { teacherId, isAdmin } = req.tenant;

  const conditions: ReturnType<typeof eq>[] = [];

  // Teacher scoping
  if (!isAdmin && teacherId) {
    conditions.push(eq(sessionsTable.teacherAccountId, teacherId));
  }

  if (params.success && params.data.weekStart) {
    const wsDate = params.data.weekStart as unknown as Date;
    const wsStr = wsDate.toISOString().split("T")[0];
    const weekEnd = new Date(wsDate);
    weekEnd.setDate(weekEnd.getDate() + 6);
    conditions.push(gte(attendanceTable.date, wsStr));
    conditions.push(lte(attendanceTable.date, weekEnd.toISOString().split("T")[0]));
  }

  const records = await db
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
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(attendanceTable.date, studentsTable.studentCode);

  let csv = "Student Code,Student Name,Date,Lesson,Day,Start Time,Status\n";
  for (const r of records) {
    csv += `${r.studentCode},"${r.studentName}",${r.date},Lesson ${r.lessonNumber},${r.dayOfWeek},${r.startTime},${r.status}\n`;
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="attendance-${params.success && params.data.weekStart ? params.data.weekStart : "all"}.csv"`);
  res.send(csv);
});

export default router;
