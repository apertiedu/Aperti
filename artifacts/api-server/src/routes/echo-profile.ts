import { Router } from "express";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
  db, studentsTable, echoMemoryTable, studentMarksTable, examsTable,
  examQuestionsTable, attendanceTable, homeworkTable, homeworkSubmissionsTable,
  behaviorPatternsTable, ascendProfilesTable, subjectsTable,
  flashcardProgressTable, flashcardItemsTable, flashcardDecksTable,
} from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";

const studentGuard = [authenticate, requireRole("student")];
import type { Response } from "express";

const router = Router();

router.get("/echo/profile", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const [student] = await db.select().from(studentsTable)
    .where(eq(studentsTable.accountId, req.userId!));
  if (!student) { res.status(403).json({ message: "No student record" }); return; }

  const studentId = student.id;
  const teacherId = student.teacherAccountId!;
  const since90 = new Date(); since90.setDate(since90.getDate() - 90);
  const since90Str = since90.toISOString().split("T")[0];

  const [echoMem, marks, attData, hwData, behaviorData, ascendData, flashcardStats] = await Promise.all([
    db.select().from(echoMemoryTable).where(eq(echoMemoryTable.studentId, studentId)).limit(1),

    db.select({
      examId: studentMarksTable.examId,
      examName: examsTable.name,
      examDate: examsTable.examDate,
      subjectId: examsTable.subjectId,
      subjectName: subjectsTable.name,
      scored: sql<number>`sum(${studentMarksTable.marksScored})::numeric`,
      max: sql<number>`sum(${examQuestionsTable.maxMarks})::numeric`,
    }).from(studentMarksTable)
      .innerJoin(examQuestionsTable, eq(studentMarksTable.questionId, examQuestionsTable.id))
      .innerJoin(examsTable, eq(studentMarksTable.examId, examsTable.id))
      .leftJoin(subjectsTable, eq(examsTable.subjectId, subjectsTable.id))
      .where(eq(studentMarksTable.studentId, studentId))
      .groupBy(examsTable.id, examsTable.name, examsTable.examDate, examsTable.subjectId, subjectsTable.name)
      .orderBy(desc(examsTable.examDate))
      .limit(20),

    db.select({ status: attendanceTable.status, count: sql<number>`count(*)::int` })
      .from(attendanceTable)
      .where(and(eq(attendanceTable.studentId, studentId), sql`${attendanceTable.date} >= ${since90Str}`))
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

    db.select().from(behaviorPatternsTable).where(eq(behaviorPatternsTable.studentId, studentId)).limit(1),

    db.select().from(ascendProfilesTable).where(eq(ascendProfilesTable.studentAccountId, req.userId!)).limit(1),

    // Flashcard retention: aggregate over all this student's flashcard progress
    db.select({
      cardId: flashcardProgressTable.cardId,
      repetitions: flashcardProgressTable.repetitions,
      easeFactor: flashcardProgressTable.easeFactor,
      interval: flashcardProgressTable.interval,
      subjectId: flashcardDecksTable.subjectId,
    }).from(flashcardProgressTable)
      .innerJoin(flashcardItemsTable, eq(flashcardProgressTable.cardId, flashcardItemsTable.id))
      .innerJoin(flashcardDecksTable, eq(flashcardItemsTable.deckId, flashcardDecksTable.id))
      .where(eq(flashcardProgressTable.studentId, studentId))
      .limit(200),
  ]);

  const echo = echoMem[0];
  const weakTopics = (echo?.weakTopics as string[]) ?? [];
  const strongTopics = (echo?.strongTopics as string[]) ?? [];
  const retentionScores = (echo?.retentionScores as Record<string, number>) ?? {};

  const present = attData.find(r => r.status === "Present")?.count ?? 0;
  const absent = attData.find(r => r.status === "Absent")?.count ?? 0;
  const attendancePct = present + absent > 0 ? Math.round((present / (present + absent)) * 100) : 0;

  const hwTotal = hwData[0]?.total ?? 0;
  const hwSubmitted = hwData[0]?.submitted ?? 0;
  const hwCompletionRate = hwTotal > 0 ? Math.round((hwSubmitted / hwTotal) * 100) : 0;

  const gradeHistory = marks.map(m => ({
    examId: m.examId,
    examName: m.examName,
    examDate: m.examDate,
    subjectId: m.subjectId,
    subjectName: m.subjectName,
    percentage: m.max > 0 ? Math.round((m.scored / m.max) * 100) : 0,
    scored: m.scored,
    max: m.max,
  }));

  const avgGrade = gradeHistory.length > 0
    ? Math.round(gradeHistory.reduce((s, g) => s + g.percentage, 0) / gradeHistory.length)
    : null;

  // ── Subject-level XP aggregation ─────────────────────────────────────
  // Derive subject XP from exam performance: each percent above 50 = 2 XP per exam
  const subjectXpMap: Record<string, number> = {};
  const subjectGradeMap: Record<string, number[]> = {};
  for (const g of gradeHistory) {
    const subj = g.subjectName ?? `subject_${g.subjectId}`;
    if (!subjectGradeMap[subj]) subjectGradeMap[subj] = [];
    subjectGradeMap[subj].push(g.percentage);
    subjectXpMap[subj] = (subjectXpMap[subj] ?? 0) + Math.max(0, Math.round((g.percentage - 50) * 2));
  }
  const subjectXp = Object.entries(subjectXpMap).map(([subject, xp]) => ({
    subject,
    xp,
    avgGrade: subjectGradeMap[subject].length > 0
      ? Math.round(subjectGradeMap[subject].reduce((a, v) => a + v, 0) / subjectGradeMap[subject].length)
      : 0,
  })).sort((a, b) => b.xp - a.xp);

  // ── Flashcard retention stats ─────────────────────────────────────────
  // Retention formula based on SM-2 algorithm: easeFactor (out of 250) × interval
  const totalCards = flashcardStats.length;
  const masteredCards = flashcardStats.filter(c => c.interval >= 21).length;
  const learningCards = flashcardStats.filter(c => c.interval >= 7 && c.interval < 21).length;
  const newCards = flashcardStats.filter(c => c.repetitions === 0).length;
  const avgEaseFactor = totalCards > 0
    ? Math.round(flashcardStats.reduce((s, c) => s + (c.easeFactor ?? 250), 0) / totalCards)
    : 250;
  // Retention %: (mastered * 1 + learning * 0.5) / total * 100
  const flashcardRetentionPct = totalCards > 0
    ? Math.round(((masteredCards + learningCards * 0.5) / totalCards) * 100)
    : 0;

  // Subject-level flashcard breakdown
  const flashcardBySubject: Record<string, { total: number; mastered: number; retention: number }> = {};
  for (const fc of flashcardStats) {
    const subjectKey = fc.subjectId !== null ? `subject_${fc.subjectId}` : "general";
    if (!flashcardBySubject[subjectKey]) flashcardBySubject[subjectKey] = { total: 0, mastered: 0, retention: 0 };
    flashcardBySubject[subjectKey].total++;
    if (fc.interval >= 21) flashcardBySubject[subjectKey].mastered++;
  }
  for (const k of Object.keys(flashcardBySubject)) {
    const s = flashcardBySubject[k];
    s.retention = s.total > 0 ? Math.round((s.mastered / s.total) * 100) : 0;
  }

  res.json({
    weakTopics,
    strongTopics,
    retentionScores,
    learningPace: echo?.learningPace ?? "medium",
    preferredStyle: echo?.preferredStyle ?? "visual",
    burnoutRisk: echo?.burnoutRisk ?? 0,
    confidenceScore: echo?.confidenceScore ?? 0,
    gradeHistory,
    avgGrade,
    attendancePct,
    hwCompletionRate,
    behavior: behaviorData[0] ?? null,
    ascend: ascendData[0] ?? null,
    subjectXp,
    flashcardRetention: {
      totalCards,
      masteredCards,
      learningCards,
      newCards,
      retentionPct: flashcardRetentionPct,
      avgEaseFactor,
      bySubject: flashcardBySubject,
    },
  });
});

export default router;
