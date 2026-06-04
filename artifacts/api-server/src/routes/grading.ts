import { Router, Response } from "express";
import { db } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { markSchemesTable, examQuestionsTable, studentMarksTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { enhanceGrading } from "../lib/coremind";
import { logInteraction } from "../lib/ai-safety";

export const gradingRouter = Router();

// ─── SCHEME CRAFT (Mark Scheme Builder) ───

gradingRouter.get("/schemes", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  const { questionId, type } = req.query as Record<string, string>;
  const scheme = await db.query.markSchemes.findFirst({ where: (s, { eq }) => eq(s.questionBankId || s.examQuestionId, parseInt(questionId)) });
  res.json(scheme || null);
});

gradingRouter.post("/schemes", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  const { questionBankId, examQuestionId, criteria, totalMarks } = req.body;
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

gradingRouter.post("/grade", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  const { answer, questionId, type, topic } = req.body;
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

  const baseResponse = {
    totalMarks: scheme.totalMarks,
    totalAwarded,
    breakdown,
    feedback: totalAwarded < parseFloat(scheme.totalMarks)
      ? "Some key points missing. Check the highlighted criteria."
      : "Excellent — all key points covered!",
    confidence: 0.8,
    sources: ["mark_scheme_keywords"],
    misconceptions: [] as Array<{ pattern: string; description: string; severity: string }>,
    misconceptionFeedback: null as string | null,
  };

  // CoreMind enhancement: check for misconceptions
  try {
    const enhancement = await enhanceGrading(questionId, answer, topic);
    if (enhancement.misconceptions.length > 0) {
      baseResponse.misconceptions = enhancement.misconceptions;
      baseResponse.misconceptionFeedback = enhancement.feedbackTemplate;
      baseResponse.confidence = enhancement.confidence;
      baseResponse.sources = [...baseResponse.sources, ...enhancement.sources];
    }
  } catch { /* enhancement best-effort */ }

  await logInteraction({
    userId: req.userId,
    module: "grading",
    action: "grade",
    inputSummary: `questionId=${questionId}, answer length=${answer?.length ?? 0}`,
    outputSummary: `totalAwarded=${totalAwarded}/${scheme.totalMarks}`,
    confidence: baseResponse.confidence,
    sources: baseResponse.sources,
  });

  res.json(baseResponse);
});

gradingRouter.post("/submission/:submissionId/grade", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  const submissionId = parseInt(req.params.submissionId);
  const mark = await db.query.studentMarks.findFirst({ where: (m, { eq }) => eq(m.id, submissionId) });
  if (!mark) return res.status(404).json({ error: "Submission not found" });

  const scheme = await db.query.markSchemes.findFirst({ where: (s, { eq }) => eq(s.examQuestionId, mark.questionId) });
  if (!scheme) return res.status(404).json({ error: "No scheme for this question" });

  const answer = mark.mistakes || "";
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

// POST /grading/accept-suggestion — teacher marks an AI suggestion as accepted or rejected
gradingRouter.post("/accept-suggestion", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  const { interactionId, accepted } = req.body;
  if (!interactionId) return res.status(400).json({ error: "interactionId required" });
  const { markInteractionOutcome } = await import("../lib/ai-safety");
  await markInteractionOutcome(interactionId, accepted === true);
  res.json({ success: true });
});
