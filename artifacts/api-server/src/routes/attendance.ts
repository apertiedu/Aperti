import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { db, studentsTable, sessionsTable, attendanceTable } from "@workspace/db";
import {
  MarkAttendanceBody,
  ListAttendanceQueryParams,
  AutoMarkAbsenceBody,
  ExportAttendanceQueryParams,
} from "@workspace/api-zod";

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
    res.status(404).json({ message: "Student not found" });
    return;
  }

  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, sessionId));
  if (!session) {
    res.status(404).json({ message: "Session not found" });
    return;
  }

  const existing = await db.select().from(attendanceTable)
    .where(and(
      eq(attendanceTable.studentId, student.id),
      eq(attendanceTable.sessionId, sessionId)
    ));

  if (existing.length > 0) {
    if (existing[0].status === "Absent") {
      const [updated] = await db.update(attendanceTable)
        .set({ status: "Present", markedAt: new Date() })
        .where(eq(attendanceTable.id, existing[0].id))
        .returning();

      res.json({
        id: updated.id,
        studentId: student.id,
        sessionId,
        studentCode: student.studentCode,
        studentName: student.studentName,
        lessonNumber: session.lessonNumber,
        date: session.date,
        status: updated.status,
        markedAt: updated.markedAt,
      });
      return;
    }

    res.json({
      id: existing[0].id,
      studentId: student.id,
      sessionId,
      studentCode: student.studentCode,
      studentName: student.studentName,
      lessonNumber: session.lessonNumber,
      date: session.date,
      status: existing[0].status,
      markedAt: existing[0].markedAt,
    });
    return;
  }

  const [record] = await db.insert(attendanceTable).values({
    studentId: student.id,
    sessionId,
    status: "Present",
  }).returning();

  res.json({
    id: record.id,
    studentId: student.id,
    sessionId,
    studentCode: student.studentCode,
    studentName: student.studentName,
    lessonNumber: session.lessonNumber,
    date: session.date,
    status: record.status,
    markedAt: record.markedAt,
  });
});

router.get("/attendance", async (req, res): Promise<void> => {
  const params = ListAttendanceQueryParams.safeParse(req.query);

  let query = db.select({
    id: attendanceTable.id,
    studentId: attendanceTable.studentId,
    sessionId: attendanceTable.sessionId,
    studentCode: studentsTable.studentCode,
    studentName: studentsTable.studentName,
    lessonNumber: sessionsTable.lessonNumber,
    date: sessionsTable.date,
    status: attendanceTable.status,
    markedAt: attendanceTable.markedAt,
  })
  .from(attendanceTable)
  .innerJoin(studentsTable, eq(attendanceTable.studentId, studentsTable.id))
  .innerJoin(sessionsTable, eq(attendanceTable.sessionId, sessionsTable.id))
  .$dynamic();

  const conditions = [];
  if (params.success && params.data.sessionId) {
    conditions.push(eq(attendanceTable.sessionId, params.data.sessionId));
  }
  if (params.success && params.data.studentCode) {
    conditions.push(eq(studentsTable.studentCode, params.data.studentCode));
  }
  if (params.success && params.data.weekStart) {
    const weekEnd = new Date(params.data.weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    conditions.push(gte(sessionsTable.date, params.data.weekStart));
    conditions.push(lte(sessionsTable.date, weekEnd.toISOString().split("T")[0]));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const records = await query;
  res.json(records);
});

router.post("/attendance/auto-absence", async (req, res): Promise<void> => {
  const parsed = AutoMarkAbsenceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.message });
    return;
  }

  const weekStart = parsed.data.weekStart;
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().split("T")[0];

  const weekSessions = await db.select().from(sessionsTable)
    .where(and(
      gte(sessionsTable.date, weekStart),
      lte(sessionsTable.date, weekEndStr)
    ));

  const students = await db.select().from(studentsTable);

  let marked = 0;

  for (const student of students) {
    for (const session of weekSessions) {
      const existing = await db.select().from(attendanceTable)
        .where(and(
          eq(attendanceTable.studentId, student.id),
          eq(attendanceTable.sessionId, session.id)
        ));

      if (existing.length === 0) {
        await db.insert(attendanceTable).values({
          studentId: student.id,
          sessionId: session.id,
          status: "Absent",
        });
        marked++;
      }
    }
  }

  res.json({ marked, message: `Marked ${marked} absence records for the week` });
});

router.get("/attendance/export", async (req, res): Promise<void> => {
  const params = ExportAttendanceQueryParams.safeParse(req.query);

  let query = db.select({
    studentCode: studentsTable.studentCode,
    studentName: studentsTable.studentName,
    date: sessionsTable.date,
    lessonNumber: sessionsTable.lessonNumber,
    status: attendanceTable.status,
  })
  .from(attendanceTable)
  .innerJoin(studentsTable, eq(attendanceTable.studentId, studentsTable.id))
  .innerJoin(sessionsTable, eq(attendanceTable.sessionId, sessionsTable.id))
  .$dynamic();

  if (params.success && params.data.weekStart) {
    const weekEnd = new Date(params.data.weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    query = query.where(and(
      gte(sessionsTable.date, params.data.weekStart),
      lte(sessionsTable.date, weekEnd.toISOString().split("T")[0])
    ));
  }

  const records = await query;

  let csv = "Student Code,Student Name,Date,Lesson Number,Status\n";
  for (const r of records) {
    csv += `${r.studentCode},${r.studentName},${r.date},${r.lessonNumber},${r.status}\n`;
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=attendance.csv");
  res.send(csv);
});

export default router;
