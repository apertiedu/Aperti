import { Router } from "express";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import {
  db, studentsTable, studentMarksTable, examsTable, examQuestionsTable,
  attendanceTable, homeworkTable, homeworkSubmissionsTable,
  echoMemoryTable, focusSessionsTable,
} from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";

const studentGuard = [authenticate, requireRole("student")];
import type { Response } from "express";

const router = Router();

router.get("/student/analytics", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const [student] = await db.select().from(studentsTable)
    .where(eq(studentsTable.accountId, req.userId!)).limit(1);
  if (!student) { res.status(403).json({ message: "No student record" }); return; }

  const studentId = student.id;
  const teacherId = student.teacherAccountId!;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const nintyDaysAgo = new Date(Date.now() - 90 * 86400000);
  const nintyDaysAgoStr = nintyDaysAgo.toISOString().split("T")[0];

  const [marksRows, attRows, hwData, echoMem, focusSessions] = await Promise.all([
    db.select({
      examId: studentMarksTable.examId,
      examDate: examsTable.examDate,
      scored: sql<number>`sum(${studentMarksTable.marksScored})::numeric`,
      max: sql<number>`sum(${examQuestionsTable.maxMarks})::numeric`,
    }).from(studentMarksTable)
      .innerJoin(examQuestionsTable, eq(studentMarksTable.questionId, examQuestionsTable.id))
      .innerJoin(examsTable, eq(studentMarksTable.examId, examsTable.id))
      .where(eq(studentMarksTable.studentId, studentId))
      .groupBy(examsTable.id, examsTable.examDate, studentMarksTable.examId)
      .orderBy(examsTable.examDate),

    db.select({ status: attendanceTable.status, count: sql<number>`count(*)::int` })
      .from(attendanceTable)
      .where(and(eq(attendanceTable.studentId, studentId), sql`${attendanceTable.date} >= ${nintyDaysAgoStr}`))
      .groupBy(attendanceTable.status),

    db.select({
      total: sql<number>`count(*)::int`,
      submitted: sql<number>`count(*) filter (where ${homeworkSubmissionsTable.status} in ('submitted','graded'))::int`,
    }).from(homeworkTable)
      .leftJoin(homeworkSubmissionsTable, and(
        eq(homeworkSubmissionsTable.homeworkId, homeworkTable.id),
        eq(homeworkSubmissionsTable.studentId, studentId)
      ))
      .where(and(eq(homeworkTable.teacherAccountId, teacherId), eq(homeworkTable.isPublished, true))),

    db.select().from(echoMemoryTable).where(eq(echoMemoryTable.studentId, studentId)).limit(1),

    db.select({
      durationMinutes: focusSessionsTable.durationMinutes,
      completedAt: focusSessionsTable.completedAt,
    }).from(focusSessionsTable)
      .where(and(eq(focusSessionsTable.studentId, studentId), gte(focusSessionsTable.completedAt, thirtyDaysAgo))),
  ]);

  const gradedExams = marksRows.filter(m => m.max > 0).map(m => ({
    examId: m.examId,
    examDate: m.examDate,
    percentage: Math.round((m.scored / m.max) * 100),
  }));

  const last3 = gradedExams.slice(-3);
  const currentGrade = last3.length > 0
    ? Math.round(last3.reduce((s, e) => s + e.percentage, 0) / last3.length)
    : null;

  let predictedGrade: number | null = null;
  if (gradedExams.length >= 2) {
    const n = gradedExams.length;
    const xMean = (n - 1) / 2;
    const yMean = gradedExams.reduce((s, e) => s + e.percentage, 0) / n;
    let num = 0, den = 0;
    gradedExams.forEach((e, i) => {
      num += (i - xMean) * (e.percentage - yMean);
      den += (i - xMean) ** 2;
    });
    const slope = den !== 0 ? num / den : 0;
    predictedGrade = Math.min(100, Math.max(0, Math.round(yMean + slope * 1)));
  }

  const present = attRows.find(r => r.status === "Present")?.count ?? 0;
  const absent = attRows.find(r => r.status === "Absent")?.count ?? 0;
  const attendancePct = present + absent > 0 ? Math.round((present / (present + absent)) * 100) : 0;

  const hwTotal = hwData[0]?.total ?? 0;
  const hwSubmitted = hwData[0]?.submitted ?? 0;
  const hwCompletionRate = hwTotal > 0 ? Math.round((hwSubmitted / hwTotal) * 100) : 0;

  const recentQuizAvg = last3.length > 0
    ? Math.round(last3.reduce((s, e) => s + e.percentage, 0) / last3.length)
    : 0;

  const readinessScore = Math.round(
    (attendancePct * 0.3) + (hwCompletionRate * 0.3) + (recentQuizAvg * 0.4)
  );

  const weakTopics = (echoMem[0]?.weakTopics as string[]) ?? [];
  const strongTopics = (echoMem[0]?.strongTopics as string[]) ?? [];
  const retentionScores = (echoMem[0]?.retentionScores as Record<string, number>) ?? {};

  const topicMap = {
    mastered: strongTopics.filter(t => (retentionScores[t] ?? 0) >= 80),
    developing: strongTopics.filter(t => (retentionScores[t] ?? 0) >= 60 && (retentionScores[t] ?? 0) < 80),
    weak: weakTopics.filter(t => (retentionScores[t] ?? 100) >= 40 && (retentionScores[t] ?? 100) < 60),
    critical: weakTopics.filter(t => (retentionScores[t] ?? 100) < 40),
  };

  const totalStudyMinutes = focusSessions.reduce((s, fs) => s + (fs.durationMinutes ?? 0), 0);
  const studyHours = Math.round((totalStudyMinutes / 60) * 10) / 10;

  const studyByDay: Record<string, number> = {};
  for (const fs of focusSessions) {
    const day = (fs.completedAt as Date).toISOString().split("T")[0];
    studyByDay[day] = (studyByDay[day] ?? 0) + (fs.durationMinutes ?? 0);
  }

  // Target grade: derive from echo confidence score or predicted performance,
  // anchored at a student-adjusted level (default 80 if no data)
  const confidenceScore = echoMem[0] ? parseFloat(String(echoMem[0].confidenceScore ?? 0)) : 0;
  const targetGrade = currentGrade !== null
    ? Math.min(100, Math.max(
        currentGrade + 5,
        predictedGrade !== null ? Math.round(predictedGrade + (confidenceScore / 10)) : 80
      ))
    : 80;

  res.json({
    currentGrade,
    predictedGrade,
    targetGrade,
    readinessScore,
    attendancePct,
    hwCompletionRate,
    recentQuizAvg,
    gradeHistory: gradedExams,
    topicMap,
    timeAnalytics: {
      studyHours,
      studyByDay,
      focusSessions: focusSessions.length,
      avgSessionMinutes: focusSessions.length > 0
        ? Math.round(totalStudyMinutes / focusSessions.length) : 0,
    },
  });
});

export default router;
