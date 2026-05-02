import { Router, type IRouter } from "express";
import { eq, and, desc, ilike, sql } from "drizzle-orm";
import { db, questionBankTable, subjectsTable } from "@workspace/db";
import { requireTenantAccess } from "../middleware/tenant";

const router: IRouter = Router();

router.get("/question-bank", requireTenantAccess, async (req, res): Promise<void> => {
  const { teacherId, isAdmin } = req.tenant;
  const { subjectId, topic, difficulty, search } = req.query as Record<string, string>;

  let query = db.select({
    id: questionBankTable.id,
    questionText: questionBankTable.questionText,
    topic: questionBankTable.topic,
    subtopic: questionBankTable.subtopic,
    difficulty: questionBankTable.difficulty,
    maxMarks: questionBankTable.maxMarks,
    modelAnswer: questionBankTable.modelAnswer,
    commonMistakes: questionBankTable.commonMistakes,
    tags: questionBankTable.tags,
    timesUsed: questionBankTable.timesUsed,
    subjectId: questionBankTable.subjectId,
    subjectName: subjectsTable.name,
    createdAt: questionBankTable.createdAt,
  }).from(questionBankTable)
    .leftJoin(subjectsTable, eq(questionBankTable.subjectId, subjectsTable.id))
    .$dynamic();

  const conditions = [];
  if (!isAdmin && teacherId) conditions.push(eq(questionBankTable.teacherAccountId, teacherId));
  if (subjectId) conditions.push(eq(questionBankTable.subjectId, parseInt(subjectId, 10)));
  if (topic) conditions.push(ilike(questionBankTable.topic, `%${topic}%`));
  if (difficulty) conditions.push(eq(questionBankTable.difficulty, difficulty));
  if (search) conditions.push(ilike(questionBankTable.questionText, `%${search}%`));

  if (conditions.length > 0) query = query.where(and(...conditions));

  const rows = await query.orderBy(desc(questionBankTable.createdAt));
  res.json(rows);
});

router.post("/question-bank", requireTenantAccess, async (req, res): Promise<void> => {
  const { teacherId, accountId, isAdmin } = req.tenant;
  const { questionText, topic, subtopic, difficulty, maxMarks, modelAnswer, commonMistakes, tags, subjectId } = req.body;

  if (!questionText?.trim()) { res.status(400).json({ message: "Question text is required" }); return; }

  const effectiveTeacherId = isAdmin ? accountId : (teacherId ?? accountId);

  const [created] = await db.insert(questionBankTable).values({
    teacherAccountId: effectiveTeacherId,
    questionText: questionText.trim(),
    topic: topic?.trim() || null,
    subtopic: subtopic?.trim() || null,
    difficulty: difficulty || "medium",
    maxMarks: String(maxMarks || 1),
    modelAnswer: modelAnswer?.trim() || null,
    commonMistakes: commonMistakes?.trim() || null,
    tags: tags?.trim() || null,
    subjectId: subjectId ? parseInt(subjectId, 10) : null,
  }).returning();

  res.status(201).json(created);
});

router.patch("/question-bank/:id", requireTenantAccess, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const { teacherId, isAdmin } = req.tenant;
  const { questionText, topic, subtopic, difficulty, maxMarks, modelAnswer, commonMistakes, tags, subjectId } = req.body;

  const updates: Record<string, unknown> = {};
  if (questionText) updates.questionText = questionText.trim();
  if ("topic" in req.body) updates.topic = topic?.trim() || null;
  if ("subtopic" in req.body) updates.subtopic = subtopic?.trim() || null;
  if (difficulty) updates.difficulty = difficulty;
  if ("maxMarks" in req.body) updates.maxMarks = String(maxMarks);
  if ("modelAnswer" in req.body) updates.modelAnswer = modelAnswer?.trim() || null;
  if ("commonMistakes" in req.body) updates.commonMistakes = commonMistakes?.trim() || null;
  if ("tags" in req.body) updates.tags = tags?.trim() || null;
  if ("subjectId" in req.body) updates.subjectId = subjectId ? parseInt(subjectId, 10) : null;

  const condition = isAdmin
    ? eq(questionBankTable.id, id)
    : and(eq(questionBankTable.id, id), eq(questionBankTable.teacherAccountId, teacherId!));

  const [updated] = await db.update(questionBankTable).set(updates).where(condition!).returning();
  if (!updated) { res.status(404).json({ message: "Question not found" }); return; }
  res.json(updated);
});

router.delete("/question-bank/:id", requireTenantAccess, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const { teacherId, isAdmin } = req.tenant;

  const condition = isAdmin
    ? eq(questionBankTable.id, id)
    : and(eq(questionBankTable.id, id), eq(questionBankTable.teacherAccountId, teacherId!));

  await db.delete(questionBankTable).where(condition!);
  res.json({ message: "Question deleted" });
});

// Import questions from bank to an exam
router.post("/question-bank/:id/use-in-exam/:examId", requireTenantAccess, async (req, res): Promise<void> => {
  const qId = parseInt(req.params.id as string, 10);
  const examId = parseInt(req.params.examId as string, 10);

  const [q] = await db.select().from(questionBankTable).where(eq(questionBankTable.id, qId));
  if (!q) { res.status(404).json({ message: "Question not found" }); return; }

  const { examQuestionsTable } = await import("@workspace/db");
  const [existing] = await db.select({ count: sql<number>`count(*)::int` }).from(examQuestionsTable)
    .where(eq(examQuestionsTable.examId, examId));

  const [created] = await db.insert(examQuestionsTable).values({
    examId,
    questionText: q.questionText,
    topic: q.topic,
    maxMarks: q.maxMarks,
    questionOrder: (existing?.count ?? 0) + 1,
  }).returning();

  // Increment usage count
  await db.update(questionBankTable).set({ timesUsed: sql`${questionBankTable.timesUsed} + 1` }).where(eq(questionBankTable.id, qId));

  res.status(201).json(created);
});

export default router;
