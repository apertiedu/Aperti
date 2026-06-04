import { Router } from "express";
import { eq, and } from "drizzle-orm";
import {
  db, studentsTable, questionBankTable, trialVaultAttemptsTable, echoMemoryTable,
  ascendProfilesTable,
} from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";

const studentGuard = [authenticate, requireRole("student")];
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

// POST /trial-vault/generate — weak-topic-aware question selection
router.post("/trial-vault/generate", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const ctx = await requireStudent(req, res);
  if (!ctx) return;
  const { studentId, teacherId } = ctx;

  const { subjectId, type, difficulty, timeMode, topicFilter, topicIds, count } = req.body;

  // Fetch echo memory to bias question selection toward weak topics
  const memory = await db.query.echoMemory.findFirst({
    where: (m, { eq }) => eq(m.studentId, studentId),
  });
  const weakTopics: string[] = (memory?.weakTopics as string[]) ?? [];

  // Weave enhancement: also include prerequisite topics of weak topics
  let weavePrereqTopics: string[] = [];
  try {
    const { getRecommendations } = await import("../lib/weave-graph");
    const recs = await getRecommendations(studentId, "topic");
    weavePrereqTopics = recs.map(n => n.name);
  } catch { /* weave best-effort */ }
  const allWeakTopics = [...new Set([...weakTopics, ...weavePrereqTopics])];

  const conditions: any[] = [eq(questionBankTable.teacherAccountId, teacherId)];
  if (subjectId) conditions.push(eq(questionBankTable.subjectId, parseInt(subjectId, 10)));
  if (difficulty) conditions.push(eq(questionBankTable.difficulty, difficulty));
  // topicIds: filter to specific question bank topic strings
  if (Array.isArray(topicIds) && topicIds.length > 0) {
    const { inArray } = await import("drizzle-orm");
    conditions.push(inArray(questionBankTable.topic, topicIds as string[]));
  }

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

  // Bias selection: weak-topic questions first (up to 60% of quota), rest shuffled
  // allWeakTopics includes prerequisite topics from the Weave
  const sessionCount = Math.min(count ?? 20, questions.length);
  const weakQuestions = allWeakTopics.length > 0
    ? questions.filter(q => allWeakTopics.some(wt =>
        (q.topic ?? "").toLowerCase().includes(wt.toLowerCase()) ||
        (q.subtopic ?? "").toLowerCase().includes(wt.toLowerCase())
      ))
    : [];
  const otherQuestions = questions.filter(q => !weakQuestions.includes(q));

  const weakQuota = Math.min(Math.ceil(sessionCount * 0.6), weakQuestions.length);
  const otherQuota = sessionCount - weakQuota;
  const selected = [
    ...shuffleArray(weakQuestions).slice(0, weakQuota),
    ...shuffleArray(otherQuestions).slice(0, otherQuota),
  ];

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
    weakTopicsTargeted: weakTopics,
    prerequisiteTopicsIncluded: weavePrereqTopics,
    weakTopicCoverage: weakQuota,
    weaveEnhanced: weavePrereqTopics.length > 0,
  };

  // OpenAI augmentation: generate AI questions + study hints for weak topics
  let studyHints: { topic: string; hint: string }[] = [];
  let aiGeneratedQuestions: Array<{
    id: number; questionText: string; topic: string; subtopic: string | null;
    difficulty: string; maxMarks: string; modelAnswer: string; aiGenerated: boolean;
  }> = [];
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey && weakTopics.length > 0) {
    try {
      const topicsToAugment = weakTopics.slice(0, 3).join(", ");
      const augmentPrompt = `You are an exam question writer. Generate ${Math.min(weakQuota, 3)} exam questions for these weak topics: ${topicsToAugment}. Respond as JSON array: [{"questionText":"...","topic":"<one of the topics>","subtopic":"...","difficulty":"medium","maxMarks":"2","modelAnswer":"..."}]`;
      const hintsPrompt = `You are a study coach. Give 1 concise study tip (≤30 words) for each of these topics: ${topicsToAugment}. Respond as JSON array: [{"topic":"...","hint":"..."}]`;

      const [augRes, hintsRes] = await Promise.all([
        fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: augmentPrompt }],
            max_tokens: 800, temperature: 0.7,
          }),
        }),
        fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: hintsPrompt }],
            max_tokens: 300, temperature: 0.5,
          }),
        }),
      ]);

      const [augData, hintsData] = await Promise.all([
        augRes.json() as Promise<{ choices?: { message?: { content?: string } }[] }>,
        hintsRes.json() as Promise<{ choices?: { message?: { content?: string } }[] }>,
      ]);

      const augContent = augData.choices?.[0]?.message?.content ?? "[]";
      const parsedAug = JSON.parse(augContent.replace(/```json|```/g, "").trim()) as Array<{
        questionText: string; topic: string; subtopic?: string; difficulty?: string; maxMarks?: string; modelAnswer?: string;
      }>;
      // Assign synthetic negative IDs so client can distinguish AI questions
      aiGeneratedQuestions = parsedAug.map((q, i) => ({
        id: -(i + 1),
        questionText: q.questionText,
        topic: q.topic ?? weakTopics[0],
        subtopic: q.subtopic ?? null,
        difficulty: q.difficulty ?? "medium",
        maxMarks: q.maxMarks ?? "2",
        modelAnswer: q.modelAnswer ?? "",
        aiGenerated: true,
      }));

      const hintsContent = hintsData.choices?.[0]?.message?.content ?? "[]";
      studyHints = JSON.parse(hintsContent.replace(/```json|```/g, "").trim());
    } catch { /* augmentation is best-effort — silently skip on error */ }
  }

  // Merge AI-generated questions into selected (they sit alongside bank questions)
  const allQuestions = [...selected, ...aiGeneratedQuestions];
  config.questionCount = allQuestions.length;
  config.aiGeneratedCount = aiGeneratedQuestions.length;

  const [attempt] = await db.insert(trialVaultAttemptsTable).values({
    studentId,
    subjectId: subjectId ? parseInt(subjectId, 10) : null,
    config,
    questions: allQuestions,
    answers: {},
  }).returning();

  res.status(201).json({
    attemptId: attempt.id,
    config,
    studyHints,
    questions: allQuestions.map(q => ({
      id: q.id,
      questionText: q.questionText,
      topic: q.topic,
      subtopic: q.subtopic,
      difficulty: q.difficulty,
      maxMarks: q.maxMarks,
      aiGenerated: (q as any).aiGenerated ?? false,
    })),
  });
});

// POST /trial-vault/submit
router.post("/trial-vault/submit", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
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

  await db.update(trialVaultAttemptsTable)
    .set({
      answers: answers ?? {},
      score: String(scorePercent),
      topicBreakdown,
      timingData: timingData ?? {},
      completedAt: new Date(),
    })
    .where(eq(trialVaultAttemptsTable.id, attempt.id));

  // Update echo_memory mistake history: topics where scored < 50% of max are weak
  const weakTopicUpdates = Object.entries(topicBreakdown)
    .filter(([, v]) => v.max > 0 && (v.scored / v.max) < 0.5)
    .map(([topic]) => topic);

  if (weakTopicUpdates.length > 0) {
    const existingMemory = await db.query.echoMemory.findFirst({
      where: (m, { eq }) => eq(m.studentId, studentId),
    });
    if (existingMemory) {
      const currentMistakes = (existingMemory.mistakeHistory as Record<string, number>) ?? {};
      for (const topic of weakTopicUpdates) {
        currentMistakes[topic] = (currentMistakes[topic] ?? 0) + 1;
      }
      const currentWeak = (existingMemory.weakTopics as string[]) ?? [];
      const mergedWeak = Array.from(new Set([...currentWeak, ...weakTopicUpdates])).slice(0, 20);
      await db.update(echoMemoryTable)
        .set({ mistakeHistory: currentMistakes, weakTopics: mergedWeak })
        .where(eq(echoMemoryTable.id, existingMemory.id));
    }
  }

  // Award XP for completing a trial vault session
  const xpToAward = Math.max(10, Math.round(scorePercent * 1.0)); // 1 XP per % point, min 10
  const [profile] = await db.select().from(ascendProfilesTable)
    .where(eq(ascendProfilesTable.studentAccountId, req.userId!)).limit(1);
  if (profile) {
    const newXp = (profile.xp ?? 0) + xpToAward;
    const newLevel = Math.max(1, Math.floor(Math.sqrt(newXp / 100)));
    await db.update(ascendProfilesTable)
      .set({ xp: newXp, level: newLevel })
      .where(eq(ascendProfilesTable.id, profile.id));
  }

  res.json({
    attemptId: attempt.id,
    score: scorePercent,
    totalScored,
    totalMax,
    topicBreakdown,
    weakTopicsUpdated: weakTopicUpdates,
    xpAwarded: xpToAward,
  });
});

// GET /trial-vault/results/:id
router.get("/trial-vault/results/:id", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
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

  // Grade prediction: map score % to grade bands
  const scoreNum = parseFloat(String(attempt.score ?? 0));
  let gradePrediction = "U";
  if (scoreNum >= 90) gradePrediction = "A*";
  else if (scoreNum >= 80) gradePrediction = "A";
  else if (scoreNum >= 70) gradePrediction = "B";
  else if (scoreNum >= 60) gradePrediction = "C";
  else if (scoreNum >= 50) gradePrediction = "D";
  else if (scoreNum >= 40) gradePrediction = "E";

  // Time analysis: derive per-question and per-topic timing from timingData
  const questionTimings = timingData as Record<string, number>; // questionId → seconds spent
  const timingValues = Object.values(questionTimings).filter(v => typeof v === "number" && v > 0);
  const avgTimePerQuestion = timingValues.length > 0
    ? Math.round(timingValues.reduce((s, v) => s + v, 0) / timingValues.length)
    : null;
  const totalTimeSeconds = timingValues.reduce((s, v) => s + v, 0);

  // Topic-level time aggregation
  const topicTimings: Record<string, { totalSeconds: number; questionCount: number }> = {};
  for (const q of questions) {
    const secs = questionTimings[String(q.id)];
    if (secs && typeof secs === "number") {
      const topic = q.topic ?? "General";
      if (!topicTimings[topic]) topicTimings[topic] = { totalSeconds: 0, questionCount: 0 };
      topicTimings[topic].totalSeconds += secs;
      topicTimings[topic].questionCount += 1;
    }
  }
  const topicTimeAnalysis = Object.fromEntries(
    Object.entries(topicTimings).map(([topic, t]) => [
      topic, { avgSecondsPerQuestion: Math.round(t.totalSeconds / t.questionCount), totalSeconds: t.totalSeconds }
    ])
  );
  const slowestTopic = Object.entries(topicTimeAnalysis).sort((a, b) => b[1].avgSecondsPerQuestion - a[1].avgSecondsPerQuestion)[0]?.[0] ?? null;
  const fastestTopic = Object.entries(topicTimeAnalysis).sort((a, b) => a[1].avgSecondsPerQuestion - b[1].avgSecondsPerQuestion)[0]?.[0] ?? null;

  res.json({
    attemptId: attempt.id,
    config: attempt.config,
    score: attempt.score,
    gradePrediction,
    topicBreakdown,
    timeAnalysis: {
      totalTimeSeconds,
      avgTimePerQuestion,
      topicTimings: topicTimeAnalysis,
      slowestTopic,
      fastestTopic,
    },
    completedAt: attempt.completedAt,
    questions: detailed,
  });
});

// GET /trial-vault/history
router.get("/trial-vault/history", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
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
