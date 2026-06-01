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
