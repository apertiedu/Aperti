import { Router, Response } from "express";
import { db } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import { attendanceTable, studentsTable, lessonsTable, attendanceAuditTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

export const attendanceRouter = Router();

async function logAudit(params: {
  attendanceId?: number;
  studentId: number;
  lessonId?: number;
  action: string;
  oldStatus?: string;
  newStatus: string;
  performedBy: number;
  scanMethod?: string;
  deviceInfo?: string;
  ipAddress?: string;
}) {
  try {
    await db.insert(attendanceAuditTable).values({
      attendanceId: params.attendanceId ?? null,
      studentId: params.studentId,
      lessonId: params.lessonId ?? null,
      action: params.action,
      oldStatus: params.oldStatus ?? null,
      newStatus: params.newStatus,
      performedBy: params.performedBy,
      performedByRole: "teacher",
      scanMethod: params.scanMethod ?? "manual",
      deviceInfo: params.deviceInfo ?? null,
      ipAddress: params.ipAddress ?? null,
    });
  } catch {
  }
}

attendanceRouter.post("/mark", authenticate, async (req: AuthRequest, res: Response) => {
  const { studentId, sessionId, date, status } = req.body;
  if (!studentId || !sessionId || !date) {
    return res.status(400).json({ error: "studentId, sessionId, and date are required" });
  }
  try {
    const [existing] = await db.select({ id: attendanceTable.id, status: attendanceTable.status })
      .from(attendanceTable)
      .where(and(eq(attendanceTable.studentId, studentId), eq(attendanceTable.sessionId, sessionId), eq(attendanceTable.date, date)))
      .limit(1);
    const newStatus = status || "Present";
    if (existing) {
      await db.update(attendanceTable).set({ status: newStatus, markedAt: sql`now()` }).where(eq(attendanceTable.id, existing.id));
      await logAudit({ attendanceId: existing.id, studentId, lessonId: sessionId, action: "update", oldStatus: existing.status, newStatus, performedBy: req.userId!, scanMethod: "manual", ipAddress: req.ip });
    } else {
      const [inserted] = await db.insert(attendanceTable).values({ studentId, sessionId, date, status: newStatus }).returning();
      await logAudit({ attendanceId: inserted?.id, studentId, lessonId: sessionId, action: "mark", newStatus, performedBy: req.userId!, scanMethod: "manual", ipAddress: req.ip });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

attendanceRouter.post("/mark-by-code", authenticate, async (req: AuthRequest, res: Response) => {
  const { studentCode, lessonId, date, status, deviceInfo } = req.body;
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
  const [existing] = await db.select({ id: attendanceTable.id, status: attendanceTable.status })
    .from(attendanceTable)
    .where(and(eq(attendanceTable.studentId, student.id), eq(attendanceTable.sessionId, Number(lessonId)), eq(attendanceTable.date, date)))
    .limit(1);
  const newStatus = status || "Present";
  if (existing) {
    await db.update(attendanceTable).set({ status: newStatus, markedAt: sql`now()` }).where(eq(attendanceTable.id, existing.id));
    await logAudit({ attendanceId: existing.id, studentId: student.id, lessonId: Number(lessonId), action: "update_qr", oldStatus: existing.status, newStatus, performedBy: req.userId!, scanMethod: "qr", deviceInfo, ipAddress: req.ip });
  } else {
    const [inserted] = await db.insert(attendanceTable).values({ studentId: student.id, sessionId: Number(lessonId), date, status: newStatus }).returning();
    await logAudit({ attendanceId: inserted?.id, studentId: student.id, lessonId: Number(lessonId), action: "scan_qr", newStatus, performedBy: req.userId!, scanMethod: "qr", deviceInfo, ipAddress: req.ip });
  }
  res.json({
    success: true,
    student: { id: student.id, name: student.studentName, code: student.studentCode },
  });
});

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

attendanceRouter.delete("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  await db.delete(attendanceTable).where(eq(attendanceTable.id, Number(req.params.id)));
  res.json({ success: true });
});
