import { Router } from "express";
import { eq, and, inArray } from "drizzle-orm";
import {
  db, studentsTable, questionBankTable, trialVaultAttemptsTable, subjectsTable,
} from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import type { Response } from "express";

const router = Router();

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function requireStudent(req: AuthRequest, res: Response): Promise<{ studentId: number; teacherId: number } | null> {
  const [student] = await db.select().from(studentsTable)
    .where(eq(studentsTable.accountId, req.userId!)).limit(1);
  if (!student) { res.status(403).json({ message: "No student record" }); return null; }
  return { studentId: student.id, teacherId: student.teacherAccountId! };
}

// POST /trial-vault/generate
router.post("/trial-vault/generate", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const ctx = await requireStudent(req, res);
  if (!ctx) return;
  const { studentId, teacherId } = ctx;

  const { subjectId, type, difficulty, timeMode, topicFilter, count } = req.body;

  const conditions: any[] = [eq(questionBankTable.teacherAccountId, teacherId)];
  if (subjectId) conditions.push(eq(questionBankTable.subjectId, parseInt(subjectId, 10)));
  if (difficulty) conditions.push(eq(questionBankTable.difficulty, difficulty));

  let questions = await db.select({
    id: questionBankTable.id,
    questionText: questionBankTable.questionText,
    topic: questionBankTable.topic,
    subtopic: questionBankTable.subtopic,
    difficulty: questionBankTable.difficulty,
    maxMarks: questionBankTable.maxMarks,
    modelAnswer: questionBankTable.modelAnswer,
  }).from(questionBankTable)
    .where(and(...conditions))
    .limit(200);

  if (topicFilter) {
    questions = questions.filter(q => q.topic?.toLowerCase().includes(topicFilter.toLowerCase()));
  }

  const sessionCount = Math.min(count ?? 20, questions.length);
  const selected = shuffleArray(questions).slice(0, sessionCount);

  const totalMarks = selected.reduce((s, q) => s + parseFloat(String(q.maxMarks ?? 1)), 0);
  const estimatedMinutes = type === "full" ? 90 : type === "section" ? 45 : 25;

  const config = {
    type: type ?? "topic",
    difficulty: difficulty ?? "mixed",
    timeMode: timeMode ?? "timed",
    estimatedMinutes,
    totalMarks,
    questionCount: selected.length,
    subjectId,
  };

  const [attempt] = await db.insert(trialVaultAttemptsTable).values({
    studentId,
    subjectId: subjectId ? parseInt(subjectId, 10) : null,
    config,
    questions: selected,
    answers: {},
  }).returning();

  res.status(201).json({
    attemptId: attempt.id,
    config,
    questions: selected.map(q => ({
      id: q.id,
      questionText: q.questionText,
      topic: q.topic,
      subtopic: q.subtopic,
      difficulty: q.difficulty,
      maxMarks: q.maxMarks,
    })),
  });
});

// POST /trial-vault/submit
router.post("/trial-vault/submit", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const ctx = await requireStudent(req, res);
  if (!ctx) return;
  const { studentId } = ctx;

  const { attemptId, answers, timingData } = req.body;
  if (!attemptId) { res.status(400).json({ message: "attemptId required" }); return; }

  const [attempt] = await db.select().from(trialVaultAttemptsTable)
    .where(and(
      eq(trialVaultAttemptsTable.id, parseInt(attemptId, 10)),
      eq(trialVaultAttemptsTable.studentId, studentId)
    ));

  if (!attempt) { res.status(404).json({ message: "Attempt not found" }); return; }
  if (attempt.completedAt) { res.status(400).json({ message: "Already submitted" }); return; }

  const questions = (attempt.questions as Array<{
    id: number; questionText: string; topic?: string; maxMarks: string; modelAnswer?: string;
  }>) ?? [];

  const topicBreakdown: Record<string, { scored: number; max: number }> = {};
  let totalScored = 0;
  let totalMax = 0;

  for (const q of questions) {
    const studentAnswer = (answers as Record<string, string>)?.[String(q.id)] ?? "";
    const qMax = parseFloat(String(q.maxMarks ?? 1));
    const topic = q.topic ?? "General";

    if (!topicBreakdown[topic]) topicBreakdown[topic] = { scored: 0, max: 0 };
    topicBreakdown[topic].max += qMax;
    totalMax += qMax;

    let scored = 0;
    if (q.modelAnswer && studentAnswer) {
      const modelLower = q.modelAnswer.toLowerCase();
      const answerLower = studentAnswer.toLowerCase();
      const words = modelLower.split(/\s+/).filter(w => w.length > 3);
      const matches = words.filter(w => answerLower.includes(w)).length;
      scored = words.length > 0 ? Math.round((matches / words.length) * qMax * 10) / 10 : 0;
    }

    topicBreakdown[topic].scored += scored;
    totalScored += scored;
  }

  const scorePercent = totalMax > 0 ? Math.round((totalScored / totalMax) * 100) : 0;

  const [updated] = await db.update(trialVaultAttemptsTable)
    .set({
      answers: answers ?? {},
      score: String(scorePercent),
      topicBreakdown,
      timingData: timingData ?? {},
      completedAt: new Date(),
    })
    .where(eq(trialVaultAttemptsTable.id, attempt.id))
    .returning();

  res.json({
    attemptId: attempt.id,
    score: scorePercent,
    totalScored,
    totalMax,
    topicBreakdown,
  });
});

// GET /trial-vault/results/:id
router.get("/trial-vault/results/:id", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const ctx = await requireStudent(req, res);
  if (!ctx) return;
  const { studentId } = ctx;

  const attemptId = parseInt(req.params.id, 10);
  const [attempt] = await db.select().from(trialVaultAttemptsTable)
    .where(and(
      eq(trialVaultAttemptsTable.id, attemptId),
      eq(trialVaultAttemptsTable.studentId, studentId)
    ));

  if (!attempt) { res.status(404).json({ message: "Attempt not found" }); return; }

  const questions = (attempt.questions as any[]) ?? [];
  const answers = (attempt.answers as Record<string, string>) ?? {};
  const topicBreakdown = (attempt.topicBreakdown as Record<string, { scored: number; max: number }>) ?? {};
  const timingData = (attempt.timingData as Record<string, unknown>) ?? {};

  const detailed = questions.map(q => ({
    id: q.id,
    questionText: q.questionText,
    topic: q.topic,
    maxMarks: q.maxMarks,
    modelAnswer: q.modelAnswer,
    studentAnswer: answers[String(q.id)] ?? "",
  }));

  res.json({
    attemptId: attempt.id,
    config: attempt.config,
    score: attempt.score,
    topicBreakdown,
    timingData,
    completedAt: attempt.completedAt,
    questions: detailed,
  });
});

// GET /trial-vault/history
router.get("/trial-vault/history", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const ctx = await requireStudent(req, res);
  if (!ctx) return;
  const { studentId } = ctx;

  const attempts = await db.select({
    id: trialVaultAttemptsTable.id,
    config: trialVaultAttemptsTable.config,
    score: trialVaultAttemptsTable.score,
    completedAt: trialVaultAttemptsTable.completedAt,
    createdAt: trialVaultAttemptsTable.createdAt,
  }).from(trialVaultAttemptsTable)
    .where(eq(trialVaultAttemptsTable.studentId, studentId))
    .orderBy(trialVaultAttemptsTable.createdAt)
    .limit(50);

  res.json(attempts);
});

export default router;
