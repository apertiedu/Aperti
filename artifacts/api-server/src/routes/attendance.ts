import { Router, Response } from "express";
import { db } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import { attendanceTable, studentsTable, lessonsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

export const attendanceRouter = Router();

// POST /attendance/mark — mark by studentId + sessionId + date + status (upsert)
attendanceRouter.post("/mark", authenticate, async (req: AuthRequest, res: Response) => {
  const { studentId, sessionId, date, status } = req.body;
  if (!studentId || !sessionId || !date) {
    return res.status(400).json({ error: "studentId, sessionId, and date are required" });
  }
  try {
    const [existing] = await db.select({ id: attendanceTable.id })
      .from(attendanceTable)
      .where(and(eq(attendanceTable.studentId, studentId), eq(attendanceTable.sessionId, sessionId), eq(attendanceTable.date, date)))
      .limit(1);
    if (existing) {
      await db.update(attendanceTable).set({ status: status || "Present", markedAt: sql`now()` }).where(eq(attendanceTable.id, existing.id));
    } else {
      await db.insert(attendanceTable).values({ studentId, sessionId, date, status: status || "Present" });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /attendance/mark-by-code — scan QR: look up student by code, mark present
attendanceRouter.post("/mark-by-code", authenticate, async (req: AuthRequest, res: Response) => {
  const { studentCode, lessonId, date, status } = req.body;
  if (!studentCode || !lessonId || !date) {
    return res.status(400).json({ error: "studentCode, lessonId, and date are required" });
  }
  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.studentCode, studentCode.trim().toUpperCase()))
    .limit(1);
  if (!student) {
    return res.status(404).json({ error: `No student found with code "${studentCode}"` });
  }
  const [existing] = await db.select({ id: attendanceTable.id })
    .from(attendanceTable)
    .where(and(eq(attendanceTable.studentId, student.id), eq(attendanceTable.sessionId, Number(lessonId)), eq(attendanceTable.date, date)))
    .limit(1);
  if (existing) {
    await db.update(attendanceTable).set({ status: status || "Present", markedAt: sql`now()` }).where(eq(attendanceTable.id, existing.id));
  } else {
    await db.insert(attendanceTable).values({ studentId: student.id, sessionId: Number(lessonId), date, status: status || "Present" });
  }
  res.json({
    success: true,
    student: { id: student.id, name: student.studentName, code: student.studentCode },
  });
});

// GET /attendance — list for a lesson+date (or all today)
attendanceRouter.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  const { date, lessonId } = req.query as { date?: string; lessonId?: string };
  const dateStr = date || new Date().toISOString().split("T")[0];
  const conditions = lessonId
    ? and(eq(attendanceTable.sessionId, Number(lessonId)), eq(attendanceTable.date, dateStr))
    : eq(attendanceTable.date, dateStr);
  const records = await db
    .select({
      id: attendanceTable.id,
      studentId: attendanceTable.studentId,
      studentName: studentsTable.studentName,
      studentCode: studentsTable.studentCode,
      sessionId: attendanceTable.sessionId,
      status: attendanceTable.status,
      markedAt: attendanceTable.markedAt,
    })
    .from(attendanceTable)
    .innerJoin(studentsTable, eq(attendanceTable.studentId, studentsTable.id))
    .where(conditions);
  res.json(records);
});

// GET /attendance/today — shorthand for today
attendanceRouter.get("/today", authenticate, async (req: AuthRequest, res: Response) => {
  const today = new Date().toISOString().split("T")[0];
  const records = await db
    .select({
      id: attendanceTable.id,
      studentId: attendanceTable.studentId,
      studentName: studentsTable.studentName,
      studentCode: studentsTable.studentCode,
      sessionId: attendanceTable.sessionId,
      status: attendanceTable.status,
      markedAt: attendanceTable.markedAt,
    })
    .from(attendanceTable)
    .innerJoin(studentsTable, eq(attendanceTable.studentId, studentsTable.id))
    .where(eq(attendanceTable.date, today));
  res.json(records);
});

// DELETE /attendance/:id — remove a mark
attendanceRouter.delete("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  await db.delete(attendanceTable).where(eq(attendanceTable.id, Number(req.params.id)));
  res.json({ success: true });
});
