import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { db } from "../lib/db";

export const revisitRouter = Router();

// GET /revisit/plan — generate a revision plan for the next 7 days
revisitRouter.get("/plan", authenticate, async (req: AuthRequest, res: Response) => {
  const studentId = req.userId!;

  // 1. Fetch Echo memory
  const memory = await db.query.echoMemory.findFirst({
    where: (m, { eq }) => eq(m.studentId, studentId),
  });
  const weakTopics = (memory?.weakTopics as string[]) ?? [];
  const retentionScores = (memory?.retentionScores as Record<string, number>) ?? {};
  const learningPace = memory?.learningPace ?? "medium";

  // 2. Fetch upcoming exam dates (mock for now; later from ExamScope or subject table)
  const exams = []; // Placeholder

  // 3. Get questions for weak topics
  const questions = weakTopics.length > 0
    ? await db.query.questionBank.findMany({
        where: (q, { inArray }) => inArray(q.topic, weakTopics),
        limit: 20,
      })
    : [];

  // 4. Build a daily plan: spread weak topics across 7 days, prioritize lowest retention
  const plan: { date: string; topic: string; durationMinutes: number; resources: { questionCount: number; flashcardDeck?: string } }[] = [];
  const today = new Date();
  const paceMultiplier = learningPace === "slow" ? 1.5 : learningPace === "fast" ? 0.5 : 1;

  const sortedTopics = [...weakTopics].sort(
    (a, b) => (retentionScores[a] ?? 50) - (retentionScores[b] ?? 50)
  );

  for (let i = 0; i < 7; i++) {
    const topic = sortedTopics[i % sortedTopics.length] || "General Review";
    const duration = Math.round(20 * paceMultiplier); // minutes per day
    plan.push({
      date: new Date(today.getTime() + i * 86400000).toISOString().split("T")[0],
      topic,
      durationMinutes: duration,
      resources: {
        questionCount: Math.min(5, questions.filter(q => q.topic === topic).length),
        flashcardDeck: topic,
      },
    });
  }

  res.json({ plan, weakTopics, learningPace });
});
