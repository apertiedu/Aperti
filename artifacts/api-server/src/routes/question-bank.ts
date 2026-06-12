import { Router, Response } from "express";
import { db, pool } from "@workspace/db";
import { authenticate, AuthRequest, requireRole } from "../middleware/auth";
import { questionBankTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { enforceLimit, incrementUsage } from "../middleware/enforce-limit";
import { validateBody } from "../middleware/validate-body";
import { z } from "zod";

export const questionBankRouter = Router();

const createQuestionSchema = z.object({
  subjectId: z.number({ required_error: "subjectId is required" }),
  questionText: z.string().min(5, "Question text must be at least 5 characters"),
  topic: z.string().optional(),
  subtopic: z.string().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  maxMarks: z.number().optional(),
  modelAnswer: z.string().optional(),
  commonMistakes: z.string().optional(),
  tags: z.string().optional(),
  imageUrl: z.string().url().optional().nullable(),
  commandWord: z.string().optional(),
  paper: z.string().optional(),
  sessionName: z.string().optional(),
  variant: z.string().optional(),
  board: z.string().optional(),
  qualification: z.string().optional(),
  sourceYear: z.number().int().min(1990).max(2030).optional().nullable(),
  questionType: z.enum(["structured", "mcq", "essay", "short_answer", "calculation"]).optional(),
});

// GET /question-bank — list all questions for the teacher
questionBankRouter.get("/", authenticate, requireRole("teacher", "admin", "assistant"), async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const { subject, topic, difficulty, search, board, commandWord, paper } = req.query;

  let questions = await db.query.questionBank.findMany({
    where: (q, { eq }) => eq(q.teacherAccountId, teacherId),
    orderBy: (q, { desc }) => [desc(q.createdAt)],
  });

  if (subject) questions = questions.filter(q => q.subjectId === parseInt(subject as string));
  if (topic) questions = questions.filter(q => q.topic?.toLowerCase().includes((topic as string).toLowerCase()));
  if (difficulty) questions = questions.filter(q => q.difficulty === difficulty);
  if (board) questions = questions.filter(q => (q as any).board === board);
  if (commandWord) questions = questions.filter(q => (q as any).command_word?.toLowerCase() === (commandWord as string).toLowerCase());
  if (paper) questions = questions.filter(q => (q as any).paper === paper);
  if (search) {
    const term = (search as string).toLowerCase();
    questions = questions.filter(q =>
      q.questionText.toLowerCase().includes(term) ||
      q.tags?.toLowerCase().includes(term) ||
      q.topic?.toLowerCase().includes(term)
    );
  }

  res.json(questions);
});

// GET /question-bank/duplicate-check — check for near-duplicate question text
questionBankRouter.get("/duplicate-check", authenticate, requireRole("teacher", "admin", "assistant"), async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const { text } = req.query as Record<string, string>;
  if (!text || text.length < 10) return res.json({ duplicates: [] });

  const { rows } = await pool.query(`
    SELECT id, question_text, topic, difficulty,
      SIMILARITY(question_text, $1) AS sim
    FROM question_bank
    WHERE teacher_account_id = $2
      AND SIMILARITY(question_text, $1) > 0.5
    ORDER BY sim DESC
    LIMIT 5
  `, [text, teacherId]).catch(() => ({ rows: [] }));

  res.json({ duplicates: rows });
});

// POST /question-bank — create new question
questionBankRouter.post(
  "/",
  authenticate,
  requireRole("teacher", "admin", "assistant"),
  enforceLimit("questions"),
  validateBody(createQuestionSchema),
  async (req: AuthRequest, res: Response) => {
    const teacherId = req.userId!;
    const {
      subjectId, questionText, topic, subtopic, difficulty, maxMarks,
      modelAnswer, commonMistakes, tags, imageUrl,
      commandWord, paper, sessionName, variant, board, qualification, sourceYear, questionType,
    } = req.body;

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
      ...(commandWord !== undefined && { command_word: commandWord } as any),
      ...(paper !== undefined && { paper } as any),
      ...(sessionName !== undefined && { session_name: sessionName } as any),
      ...(variant !== undefined && { variant } as any),
      ...(board !== undefined && { board } as any),
      ...(qualification !== undefined && { qualification } as any),
      ...(sourceYear !== undefined && { year: sourceYear } as any),
      ...(questionType !== undefined && { question_type: questionType } as any),
    }).returning();
    await incrementUsage(teacherId, "questions");
    res.status(201).json(q);
  }
);

// PUT /question-bank/:id
questionBankRouter.put("/:id", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const id = parseInt(req.params.id);
  const existing = await db.query.questionBank.findFirst({ where: (q, { eq, and }) => and(eq(q.id, id), eq(q.teacherAccountId, teacherId)) });
  if (!existing) return res.status(404).json({ error: "Not found" });

  const {
    questionText, topic, subtopic, difficulty, maxMarks, modelAnswer,
    commonMistakes, tags, imageUrl, commandWord, paper, sessionName, variant,
    board, qualification, sourceYear, questionType,
  } = req.body;

  const updatePayload: Record<string, unknown> = {};
  if (questionText !== undefined) updatePayload.questionText = questionText;
  if (topic !== undefined) updatePayload.topic = topic;
  if (subtopic !== undefined) updatePayload.subtopic = subtopic;
  if (difficulty !== undefined) updatePayload.difficulty = difficulty;
  if (maxMarks !== undefined) updatePayload.maxMarks = maxMarks?.toString();
  if (modelAnswer !== undefined) updatePayload.modelAnswer = modelAnswer;
  if (commonMistakes !== undefined) updatePayload.commonMistakes = commonMistakes;
  if (tags !== undefined) updatePayload.tags = tags;
  if (imageUrl !== undefined) updatePayload.imageUrl = imageUrl;
  if (commandWord !== undefined) (updatePayload as any).command_word = commandWord;
  if (paper !== undefined) (updatePayload as any).paper = paper;
  if (sessionName !== undefined) (updatePayload as any).session_name = sessionName;
  if (variant !== undefined) (updatePayload as any).variant = variant;
  if (board !== undefined) (updatePayload as any).board = board;
  if (qualification !== undefined) (updatePayload as any).qualification = qualification;
  if (sourceYear !== undefined) (updatePayload as any).year = sourceYear;
  if (questionType !== undefined) (updatePayload as any).question_type = questionType;

  await db.update(questionBankTable).set(updatePayload).where(eq(questionBankTable.id, id));
  res.json({ success: true });
});

// DELETE /question-bank/:id
questionBankRouter.delete("/:id", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const id = parseInt(req.params.id);
  await db.delete(questionBankTable).where(and(eq(questionBankTable.id, id), eq(questionBankTable.teacherAccountId, teacherId)));
  await pool.query(`SELECT decrement_usage($1, 'questions')`, [teacherId]).catch(() => {});
  res.json({ success: true });
});
