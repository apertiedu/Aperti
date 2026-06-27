import { Router, Response } from "express";
import { db, pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { attendanceTable, studentsTable, attendanceAuditTable } from "@workspace/db";
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
  } catch { }
}

async function notifyParentOfAbsence(studentId: number, date: string) {
  try {
    const { rows: links } = await pool.query(
      `SELECT gl.parent_account_id, s.student_name
       FROM guardian_links gl
       JOIN students s ON s.id = $1
       WHERE gl.student_id = $1 AND gl.status = 'active'`,
      [studentId]
    );
    if (!links.length) return;
    const studentName = links[0].student_name;
    const inserts = links.map((l: any) =>
      pool.query(
        `INSERT INTO parent_notifications (parent_id, type, title, message, is_read, created_at)
         VALUES ($1, 'attendance', $2, $3, false, NOW())`,
        [
          l.parent_account_id,
          `Absence recorded — ${studentName}`,
          `${studentName} was marked absent on ${date}. Please contact the teacher if this is incorrect.`,
        ]
      )
    );
    await Promise.all(inserts);
  } catch { }
}

attendanceRouter.post("/mark", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  const { studentId, sessionId, date, status } = req.body;
  if (!studentId || !sessionId || !date) {
    return res.status(400).json({ error: "studentId, sessionId, and date are required" });
  }
  try {
    if (req.role !== "admin") {
      const [student] = await db.select({ id: studentsTable.id })
        .from(studentsTable)
        .where(and(eq(studentsTable.id, Number(studentId)), eq(studentsTable.teacherAccountId, req.userId!)))
        .limit(1);
      if (!student) return res.status(403).json({ error: "Student does not belong to your account" });
    }

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

    if (newStatus === "Absent" || newStatus === "absent") {
      notifyParentOfAbsence(Number(studentId), date);
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: "Failed to mark attendance" });
  }
});

attendanceRouter.post("/mark-by-code", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  const { studentCode, lessonId, date, status, deviceInfo } = req.body;
  if (!studentCode || !date) {
    return res.status(400).json({ error: "studentCode and date are required" });
  }
  try {
    const studentFilter = req.role === "admin"
      ? eq(studentsTable.studentCode, studentCode.trim().toUpperCase())
      : and(eq(studentsTable.studentCode, studentCode.trim().toUpperCase()), eq(studentsTable.teacherAccountId, req.userId!));

    const [student] = await db.select().from(studentsTable).where(studentFilter).limit(1);
    if (!student) {
      return res.status(404).json({ error: `No student found with code "${studentCode}"` });
    }

    const [existing] = await db.select({ id: attendanceTable.id, status: attendanceTable.status })
      .from(attendanceTable)
      .where(and(eq(attendanceTable.studentId, student.id), ...(lessonId ? [eq(attendanceTable.sessionId, Number(lessonId))] : []), eq(attendanceTable.date, date)))
      .limit(1);
    const newStatus = status || "Present";
    if (existing) {
      await db.update(attendanceTable).set({ status: newStatus, markedAt: sql`now()` }).where(eq(attendanceTable.id, existing.id));
      await logAudit({ attendanceId: existing.id, studentId: student.id, lessonId: lessonId ? Number(lessonId) : undefined, action: "update_qr", oldStatus: existing.status, newStatus, performedBy: req.userId!, scanMethod: "qr", deviceInfo, ipAddress: req.ip });
    } else {
      const [inserted] = await db.insert(attendanceTable).values({ studentId: student.id, sessionId: lessonId ? Number(lessonId) : null, date, status: newStatus }).returning();
      await logAudit({ attendanceId: inserted?.id, studentId: student.id, lessonId: lessonId ? Number(lessonId) : undefined, action: "scan_qr", newStatus, performedBy: req.userId!, scanMethod: "qr", deviceInfo, ipAddress: req.ip });
    }

    if (newStatus === "Absent" || newStatus === "absent") {
      notifyParentOfAbsence(student.id, date);
    }

    res.json({
      success: true,
      student: { id: student.id, name: student.studentName, code: student.studentCode },
    });
  } catch {
    res.status(500).json({ error: "Failed to mark attendance by code" });
  }
});

attendanceRouter.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { date, lessonId } = req.query as { date?: string; lessonId?: string };
    const dateStr = date || new Date().toISOString().split("T")[0];

    const baseConditions: any[] = [eq(attendanceTable.date, dateStr)];
    if (lessonId) baseConditions.push(eq(attendanceTable.sessionId, Number(lessonId)));

    if (req.role !== "admin") {
      baseConditions.push(eq(studentsTable.teacherAccountId, req.userId!));
    }

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
      .where(and(...baseConditions));

    res.json(records);
  } catch {
    res.status(500).json({ error: "Failed to load attendance" });
  }
});

attendanceRouter.get("/today", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const conditions: any[] = [eq(attendanceTable.date, today)];
    if (req.role !== "admin") {
      conditions.push(eq(studentsTable.teacherAccountId, req.userId!));
    }

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
      .where(and(...conditions));

    res.json(records);
  } catch {
    res.status(500).json({ error: "Failed to load today's attendance" });
  }
});

attendanceRouter.delete("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid attendance ID" });

    if (req.role !== "admin") {
      const [record] = await db
        .select({ studentId: attendanceTable.studentId })
        .from(attendanceTable)
        .where(eq(attendanceTable.id, id))
        .limit(1);
      if (!record) return res.status(404).json({ error: "Attendance record not found" });

      const [student] = await db
        .select({ id: studentsTable.id })
        .from(studentsTable)
        .where(and(eq(studentsTable.id, record.studentId), eq(studentsTable.teacherAccountId, req.userId!)))
        .limit(1);
      if (!student) return res.status(403).json({ error: "Access denied" });
    }

    await db.delete(attendanceTable).where(eq(attendanceTable.id, id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete attendance record" });
  }
});
