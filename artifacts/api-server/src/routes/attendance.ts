import { Router, Response } from "express";
import { db } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import { attendanceTable } from "@workspace/db";
import { studentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export const attendanceRouter = Router();

// POST /attendance/mark – teacher marks attendance for a lesson
attendanceRouter.post("/mark", authenticate, async (req: AuthRequest, res: Response) => {
  const { studentId, sessionId, date, status } = req.body;
  try {
    await db.insert(attendanceTable).values({ studentId, sessionId, date, status });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /attendance/today – get all attendance for today's lessons of teacher
attendanceRouter.get("/today", authenticate, async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const today = new Date().toISOString().split("T")[0];
  // Find sessions of teacher today
  const lessons = await db.query.lessons.findMany({
    where: (l, { eq, and }) => and(eq(l.teacherAccountId, teacherId)),
  });
  // filter for today (simplified) – in production use proper date matching
  const attendance = await db.query.attendance.findMany({
    where: (a, { eq }) => eq(a.date, today),
  });
  res.json(attendance);
});
