import { Router, Response } from "express";
import { db } from "../lib/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import { lessonsTable } from "@lib/db/schema/sessions";
import { attendanceTable } from "@lib/db/schema/attendance";
import { homeworkSubmissionsTable } from "@lib/db/schema/homework";

export const dashboardRouter = Router();

dashboardRouter.get("/summary", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.userId!;

    // Today's lessons count
    const today = new Date().toISOString().split("T")[0];
    const lessons = await db.query.lessons.findMany({
      where: (l, { eq, and }) => and(eq(l.teacherAccountId, teacherId), eq(l.dayOfWeek, today)),
    });

    // Today's attendance
    const attendanceRecords = await db.query.attendance.findMany({
      where: (a, { eq }) => eq(a.date, today),
    });

    // Pending homework submissions (needs grading)
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
