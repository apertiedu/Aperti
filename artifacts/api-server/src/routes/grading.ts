import { Router, Response } from "express";
import { db } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { markSchemesTable } from "@workspace/db";
import { examQuestionsTable } from "@workspace/db";
import { studentMarksTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export const gradingRouter = Router();

// ─── SCHEME CRAFT (Mark Scheme Builder) ───

// GET /grading/schemes?questionId=123&type=bank|exam
gradingRouter.get("/schemes", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  const { questionId, type } = req.query as Record<string, string>;
  const filter = type === "exam"
    ? { examQuestionId: parseInt(questionId) }
    : { questionBankId: parseInt(questionId) };
  const scheme = await db.query.markSchemes.findFirst({ where: (s, { eq }) => eq(s.questionBankId || s.examQuestionId, parseInt(questionId)) });
  res.json(scheme || null);
});

// POST /grading/schemes — create or update a mark scheme
gradingRouter.post("/schemes", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  const { questionBankId, examQuestionId, criteria, totalMarks } = req.body;
  // Upsert: if scheme exists for this question, update; else insert
  const existing = await db.query.markSchemes.findFirst({
    where: (s, { eq }) => eq(questionBankId ? s.questionBankId : s.examQuestionId, questionBankId || examQuestionId),
  });
  if (existing) {
    await db.update(markSchemesTable)
      .set({ criteria, totalMarks: totalMarks.toString() })
      .where(eq(markSchemesTable.id, existing.id));
    res.json({ success: true, id: existing.id });
  } else {
    const [scheme] = await db.insert(markSchemesTable).values({
      questionBankId, examQuestionId, criteria, totalMarks: totalMarks.toString(), createdBy: req.userId,
    }).returning();
    res.status(201).json(scheme);
  }
});

// ─── GRADE FLOW (Apply scheme to answers) ───

// POST /grading/grade — auto-grade a single answer
gradingRouter.post("/grade", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  const { answer, questionId, type } = req.body; // type = 'bank' | 'exam'
  const scheme = await db.query.markSchemes.findFirst({
    where: (s, { eq }) => eq(type === "exam" ? s.examQuestionId : s.questionBankId, questionId),
  });
  if (!scheme) return res.status(404).json({ error: "No mark scheme found for this question" });

  const criteria = scheme.criteria as Array<{ keyword: string; marks: number; description?: string }>;
  const answerLower = answer.toLowerCase();
  let totalAwarded = 0;
  const breakdown = criteria.map((criterion: any) => {
    const found = answerLower.includes(criterion.keyword.toLowerCase());
    const awarded = found ? criterion.marks : 0;
    totalAwarded += awarded;
    return { criterion: criterion.keyword, maxMarks: criterion.marks, awarded, found };
  });

  res.json({
    totalMarks: scheme.totalMarks,
    totalAwarded,
    breakdown,
    feedback: totalAwarded < parseFloat(scheme.totalMarks) ? "Some key points missing. Check the highlighted criteria." : "Excellent — all key points covered!",
  });
});

// POST /grading/submission/:submissionId/grade — apply scheme and update submission
gradingRouter.post("/submission/:submissionId/grade", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  const submissionId = parseInt(req.params.submissionId);
  // Fetch the submission (from homework or exam — we'll use exam for now)
  const mark = await db.query.studentMarks.findFirst({ where: (m, { eq }) => eq(m.id, submissionId) });
  if (!mark) return res.status(404).json({ error: "Submission not found" });

  const question = await db.query.examQuestions.findFirst({ where: (q, { eq }) => eq(q.id, mark.questionId) });
  const scheme = await db.query.markSchemes.findFirst({ where: (s, { eq }) => eq(s.examQuestionId, mark.questionId) });
  if (!scheme) return res.status(404).json({ error: "No scheme for this question" });

  const answer = mark.mistakes || ""; // In studentMarks, 'mistakes' field stores the answer text
  const criteria = scheme.criteria as Array<{ keyword: string; marks: number }>;
  let total = 0;
  for (const c of criteria) {
    if (answer.toLowerCase().includes(c.keyword.toLowerCase())) total += c.marks;
  }

  await db.update(studentMarksTable)
    .set({ marksScored: total.toString(), mistakes: `[Auto-graded] ${answer}` })
    .where(eq(studentMarksTable.id, submissionId));

  res.json({ totalAwarded: total, totalMarks: scheme.totalMarks });
});
