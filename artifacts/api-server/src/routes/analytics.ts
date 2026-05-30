import { Router, Response } from "express";
import { db } from "../lib/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import { eq, and, sql } from "drizzle-orm";

export const analyticsRouter = Router();

// GET /analytics/class-overview — teacher's whole-class summary
analyticsRouter.get("/class-overview", authenticate, async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;

  // 1. Students count
  const students = await db.query.students.findMany({
    where: (s, { eq }) => eq(s.teacherAccountId, teacherId),
  });

  // 2. Attendance rate (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const attendanceRecords = await db.query.attendance.findMany({
    where: (a, { gte }) => gte(a.date, thirtyDaysAgo),
  });
  const present = attendanceRecords.filter(a => a.status === "Present").length;
  const totalRecs = attendanceRecords.length;
  const attendanceRate = totalRecs > 0 ? Math.round((present / totalRecs) * 100) : 0;

  // 3. Weak topics (aggregated from Echo)
  const memoryRecords = await db.query.echoMemory.findMany({
    where: (m, { inArray }) => inArray(m.studentId, students.map(s => s.id)),
  });
  const weakTopicCounts: Record<string, number> = {};
  memoryRecords.forEach(m => {
    const topics = (m.weakTopics as string[]) ?? [];
    topics.forEach(t => { weakTopicCounts[t] = (weakTopicCounts[t] || 0) + 1; });
  });
  const weakTopics = Object.entries(weakTopicCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([topic, count]) => ({ topic, count }));

  // 4. Recent exam average
  const exams = await db.query.exams.findMany({
    where: (e, { eq }) => eq(e.teacherAccountId, teacherId),
    orderBy: (e, { desc }) => [desc(e.createdAt)],
    limit: 5,
  });
  const recentExamAverages = await Promise.all(exams.map(async exam => {
    const marks = await db.query.studentMarks.findMany({ where: (m, { eq }) => eq(m.examId, exam.id) });
    const avg = marks.length > 0 ? marks.reduce((sum, m) => sum + parseFloat(m.marksScored || "0"), 0) / marks.length : 0;
    return { examId: exam.id, examName: exam.name, average: Math.round(avg) };
  }));

  res.json({
    studentCount: students.length,
    attendanceRate,
    weakTopics,
    recentExamAverages,
  });
});

// GET /analytics/student/:studentId — individual student report
analyticsRouter.get("/student/:studentId", authenticate, async (req: AuthRequest, res: Response) => {
  const studentId = parseInt(req.params.studentId);

  const memory = await db.query.echoMemory.findFirst({ where: (m, { eq }) => eq(m.studentId, studentId) });
  const attendance = await db.query.attendance.findMany({ where: (a, { eq }) => eq(a.studentId, studentId), limit: 30 });
  const presentCount = attendance.filter(a => a.status === "Present").length;

  res.json({
    weakTopics: memory?.weakTopics ?? [],
    strongTopics: memory?.strongTopics ?? [],
    learningPace: memory?.learningPace ?? "medium",
    attendanceRate: attendance.length > 0 ? Math.round((presentCount / attendance.length) * 100) : 0,
    burnoutRisk: memory?.burnoutRisk ?? 0,
  });
});
