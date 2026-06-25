import { Router, Response } from "express";
import { db, pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { markSchemesTable, studentMarksTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { enhanceGrading } from "../lib/coremind";
import { logInteraction } from "../lib/ai-safety";

export const gradingRouter = Router();

gradingRouter.get("/schemes", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { questionId } = req.query as Record<string, string>;
    const scheme = await db.query.markSchemes.findFirst({
      where: (s, { eq }) => eq(s.questionBankId || s.examQuestionId, parseInt(questionId)),
    });
    res.json(scheme || null);
  } catch (err) {
    res.status(500).json({ error: "Failed to load mark scheme" });
  }
});

gradingRouter.post("/schemes", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
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
  } catch (err) {
    res.status(500).json({ error: "Failed to save mark scheme" });
  }
});

gradingRouter.post("/grade", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { answer, questionId, type, topic } = req.body;
    const scheme = await db.query.markSchemes.findFirst({
      where: (s, { eq }) => eq(type === "exam" ? s.examQuestionId : s.questionBankId, questionId),
    });
    if (!scheme) { res.status(404).json({ error: "No mark scheme found for this question" }); return; }

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
  } catch (err) {
    res.status(500).json({ error: "Failed to grade answer" });
  }
});

gradingRouter.post("/submission/:submissionId/grade", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const submissionId = parseInt(req.params.submissionId);
    if (isNaN(submissionId)) { res.status(400).json({ error: "Invalid submission ID" }); return; }
    const mark = await db.query.studentMarks.findFirst({ where: (m, { eq }) => eq(m.id, submissionId) });
    if (!mark) { res.status(404).json({ error: "Submission not found" }); return; }

    if (req.role !== "admin" && req.role !== "super_admin" && mark.examId) {
      const { rows: examRows } = await pool.query(
        "SELECT id FROM exams WHERE id=$1 AND teacher_account_id=$2 LIMIT 1",
        [mark.examId, req.userId],
      );
      if (!examRows.length) { res.status(403).json({ error: "Access denied" }); return; }
    }

    const scheme = await db.query.markSchemes.findFirst({ where: (s, { eq }) => eq(s.examQuestionId, mark.questionId) });
    if (!scheme) { res.status(404).json({ error: "No scheme for this question" }); return; }

    const answer = mark.mistakes || "";
    const criteria = scheme.criteria as Array<{ keyword: string; marks: number }>;
    let total = 0;
    for (const c of criteria) {
      if (answer.toLowerCase().includes(c.keyword.toLowerCase())) total += c.marks;
    }

    // HUMAN GRADING AUTHORITY: AI result goes into aiSuggestedMarks only.
    // marksScored stays null until a teacher explicitly approves via /approve.
    await db.update(studentMarksTable)
      .set({
        aiSuggestedMarks: total.toString(),
        aiConfidence: "0.8",
        gradingStatus: "pending",
        mistakes: `[AI-suggested] ${answer}`,
      })
      .where(eq(studentMarksTable.id, submissionId));

    res.json({
      totalAwarded: total,
      totalMarks: scheme.totalMarks,
      status: "pending",
      message: "AI suggestion stored. A teacher must review and approve before the grade is official.",
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to auto-grade submission" });
  }
});

// ── Grade approval for student_marks ─────────────────────────────────────────
// Teacher reviews an AI suggestion, optionally overrides the mark, and sets
// gradingStatus → 'graded' (saved) or 'approved' (released to student).
gradingRouter.post("/submission/:submissionId/approve", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const submissionId = parseInt(req.params.submissionId);
    if (isNaN(submissionId)) { res.status(400).json({ error: "Invalid submission ID" }); return; }

    const { marksScored, action } = req.body as {
      marksScored?: number;
      action?: "grade" | "approve";  // grade=save without releasing, approve=release to student
    };
    const act = action === "grade" ? "grade" : "approve";

    const mark = await db.query.studentMarks.findFirst({ where: (m, { eq }) => eq(m.id, submissionId) });
    if (!mark) { res.status(404).json({ error: "Submission not found" }); return; }

    const officialMarks = marksScored !== undefined ? String(marksScored) : mark.aiSuggestedMarks;
    if (!officialMarks) { res.status(400).json({ error: "No marks to approve — provide marksScored or run AI grading first" }); return; }

    const newStatus = act === "approve" ? "approved" : "graded";
    const nowVal = new Date();

    await db.update(studentMarksTable).set({
      marksScored: officialMarks,
      gradingStatus: newStatus,
      gradedAt: nowVal,
      approvedAt: act === "approve" ? nowVal : null,
      approvedBy: act === "approve" ? req.userId : null,
    }).where(eq(studentMarksTable.id, submissionId));

    res.json({
      id: submissionId,
      marksScored: officialMarks,
      gradingStatus: newStatus,
      message: act === "approve"
        ? "Grade approved and released to student."
        : "Grade saved. Run approve to release to student.",
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to approve grade" });
  }
});

gradingRouter.post("/accept-suggestion", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { interactionId, accepted } = req.body;
    if (!interactionId) { res.status(400).json({ error: "interactionId required" }); return; }
    const { markInteractionOutcome } = await import("../lib/ai-safety");
    await markInteractionOutcome(interactionId, accepted === true);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to record suggestion outcome" });
  }
});
