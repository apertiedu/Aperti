import { Router, Response } from "express";
import { db } from "@workspace/db";
import { authenticate, AuthRequest, requireRole } from "../middleware/auth";
import { questionBankTable } from "@workspace/db";
import { eq, and, like } from "drizzle-orm";
import { enforceLimit, incrementUsage, decrementUsage } from "../middleware/enforce-limit";

export const questionBankRouter = Router();

// GET /question-bank — list all questions for the teacher
questionBankRouter.get("/", authenticate, requireRole("teacher", "admin", "assistant"), async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const { subject, topic, difficulty, search } = req.query;

  let query = db.query.questionBank.findMany({
    where: (q, { eq, and }) => and(eq(q.teacherAccountId, teacherId)),
    orderBy: (q, { desc }) => [desc(q.createdAt)],
  });

  // For simplicity, we'll filter in memory — in production, use proper DB filters
  let questions = await db.query.questionBank.findMany({
    where: (q, { eq }) => eq(q.teacherAccountId, teacherId),
  });

  if (subject) questions = questions.filter(q => q.subjectId === parseInt(subject as string));
  if (topic) questions = questions.filter(q => q.topic?.toLowerCase().includes((topic as string).toLowerCase()));
  if (difficulty) questions = questions.filter(q => q.difficulty === difficulty);
  if (search) {
    const term = (search as string).toLowerCase();
    questions = questions.filter(q => q.questionText.toLowerCase().includes(term) || q.tags?.toLowerCase().includes(term));
  }

  res.json(questions);
});

// POST /question-bank — create new question
questionBankRouter.post("/", authenticate, requireRole("teacher", "admin", "assistant"), enforceLimit("questions"), async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const { subjectId, questionText, topic, subtopic, difficulty, maxMarks, modelAnswer, commonMistakes, tags, imageUrl } = req.body;
  const [q] = await db.insert(questionBankTable).values({
    teacherAccountId: teacherId,
    subjectId,
    questionText,
    topic,
    subtopic,
    difficulty,
    maxMarks: maxMarks?.toString(),
    modelAnswer,
    commonMistakes,
    tags,
    imageUrl: imageUrl || null,
  }).returning();
  await incrementUsage(teacherId, "questions");
  res.status(201).json(q);
});

// PUT /question-bank/:id
questionBankRouter.put("/:id", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const id = parseInt(req.params.id);
  const existing = await db.query.questionBank.findFirst({ where: (q, { eq, and }) => and(eq(q.id, id), eq(q.teacherAccountId, teacherId)) });
  if (!existing) return res.status(404).json({ error: "Not found" });
  await db.update(questionBankTable).set(req.body).where(eq(questionBankTable.id, id));
  res.json({ success: true });
});

// DELETE /question-bank/:id
questionBankRouter.delete("/:id", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const id = parseInt(req.params.id);
  await db.delete(questionBankTable).where(and(eq(questionBankTable.id, id), eq(questionBankTable.teacherAccountId, teacherId)));
  res.json({ success: true });
});
