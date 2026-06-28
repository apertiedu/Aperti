import { Router, Response } from "express";
import { db, pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { markSchemesTable, studentMarksTable, examsTable, examQuestionsTable, questionBankTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { enhanceGrading } from "../lib/coremind";
import { logInteraction, emitAIOutage } from "../lib/ai-safety";
import { auditFromReq } from "../lib/audit";
import { notifyAndPush } from "../lib/notify";
import { gradingLimiter } from "../middleware/rate-limit";

export const gradingRouter = Router();

gradingRouter.get("/schemes", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { questionId, type } = req.query as Record<string, string>;
    const qId = parseInt(questionId);
    if (isNaN(qId)) { res.status(400).json({ error: "Invalid questionId" }); return; }

    const scheme = await db.query.markSchemes.findFirst({
      where: (s, { eq }) => type === "exam" ? eq(s.examQuestionId, qId) : eq(s.questionBankId, qId),
    });

    if (!scheme) { res.json(null); return; }

    if (req.role !== "admin") {
      if (scheme.examQuestionId) {
        const [question] = await db
          .select({ teacherAccountId: examsTable.teacherAccountId })
          .from(examQuestionsTable)
          .innerJoin(examsTable, eq(examsTable.id, examQuestionsTable.examId))
          .where(eq(examQuestionsTable.id, scheme.examQuestionId))
          .limit(1);
        if (!question || question.teacherAccountId !== req.userId) {
          res.status(403).json({ error: "Access denied" }); return;
        }
      } else if (scheme.questionBankId) {
        const [question] = await db
          .select({ teacherAccountId: questionBankTable.teacherAccountId })
          .from(questionBankTable)
          .where(eq(questionBankTable.id, scheme.questionBankId))
          .limit(1);
        if (!question || question.teacherAccountId !== req.userId) {
          res.status(403).json({ error: "Access denied" }); return;
        }
      }
    }

    res.json(scheme);
  } catch (err) {
    res.status(500).json({ error: "Failed to load mark scheme" });
  }
});

gradingRouter.post("/schemes", authenticate, requireRole("teacher", "admin"), gradingLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { questionBankId, examQuestionId, criteria, totalMarks } = req.body;

    if (req.role !== "admin") {
      if (examQuestionId) {
        const [question] = await db
          .select({ teacherAccountId: examsTable.teacherAccountId })
          .from(examQuestionsTable)
          .innerJoin(examsTable, eq(examsTable.id, examQuestionsTable.examId))
          .where(eq(examQuestionsTable.id, examQuestionId))
          .limit(1);
        if (!question || question.teacherAccountId !== req.userId) {
          res.status(403).json({ error: "Access denied" }); return;
        }
      } else if (questionBankId) {
        const [question] = await db
          .select({ teacherAccountId: questionBankTable.teacherAccountId })
          .from(questionBankTable)
          .where(eq(questionBankTable.id, questionBankId))
          .limit(1);
        if (!question || question.teacherAccountId !== req.userId) {
          res.status(403).json({ error: "Access denied" }); return;
        }
      }
    }

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

gradingRouter.post("/grade", authenticate, requireRole("teacher", "admin"), gradingLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { answer, questionId, type, topic, studentId } = req.body;
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
    } catch (enhErr: any) {
      emitAIOutage("grading-enhancement", enhErr?.message ?? "Enhancement failed", req.userId).catch(() => {});
    }

    const interactionId = await logInteraction({
      userId: req.userId,
      module: "grading",
      action: "grade",
      inputSummary: `questionId=${questionId}, answer length=${answer?.length ?? 0}`,
      outputSummary: `totalAwarded=${totalAwarded}/${scheme.totalMarks}`,
      confidence: baseResponse.confidence,
      sources: baseResponse.sources,
    });

    pool.query(
      `INSERT INTO ai_grading_accuracy (interaction_id, question_id, student_id, suggested_mark, confidence, teacher_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        interactionId > 0 ? interactionId : null,
        questionId ?? null,
        studentId ?? null,
        totalAwarded,
        baseResponse.confidence,
        req.userId,
      ]
    ).catch(() => {});

    auditFromReq(req, "GRADE_CREATE", "grading", { resourceId: questionId, metadata: { totalAwarded, totalMarks: scheme.totalMarks, type } });
    res.json({ ...baseResponse, gradingAccuracyId: interactionId > 0 ? interactionId : null });
  } catch (err) {
    res.status(500).json({ error: "Failed to grade answer" });
  }
});

gradingRouter.post("/submission/:submissionId/approve", authenticate, requireRole("teacher", "admin"), gradingLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const submissionId = parseInt(req.params.submissionId);
    if (isNaN(submissionId)) { res.status(400).json({ error: "Invalid submission ID" }); return; }

    const { marksScored, action } = req.body as {
      marksScored?: number;
      action?: "grade" | "approve";
    };
    const act = action === "grade" ? "grade" : "approve";

    const mark = await db.query.studentMarks.findFirst({ where: (m, { eq }) => eq(m.id, submissionId) });
    if (!mark) { res.status(404).json({ error: "Submission not found" }); return; }

    if (req.role !== "admin") {
      const [exam] = await db
        .select({ teacherAccountId: examsTable.teacherAccountId })
        .from(examsTable)
        .where(eq(examsTable.id, mark.examId!))
        .limit(1);
      if (!exam || exam.teacherAccountId !== req.userId) {
        res.status(403).json({ error: "Access denied" }); return;
      }
    }

    const officialMarks = marksScored !== undefined ? String(marksScored) : mark.aiSuggestedMarks;
    if (!officialMarks) { res.status(400).json({ error: "No marks provided — include marksScored in the request body" }); return; }

    const newStatus = act === "approve" ? "approved" : "graded";
    const nowVal = new Date();

    await db.update(studentMarksTable).set({
      marksScored: officialMarks,
      gradingStatus: newStatus,
      gradedAt: nowVal,
      approvedAt: act === "approve" ? nowVal : null,
      approvedBy: act === "approve" ? req.userId : null,
    }).where(eq(studentMarksTable.id, submissionId));

    if (act === "approve" && mark.questionId) {
      const approvedVal = parseFloat(officialMarks);
      pool.query(
        `UPDATE ai_grading_accuracy
         SET approved_mark = $1,
             delta = $1 - suggested_mark,
             approved_at = NOW()
         WHERE question_id = $2
           AND student_id = $3
           AND approved_at IS NULL
         ORDER BY created_at DESC
         LIMIT 1`,
        [approvedVal, mark.questionId, mark.studentId]
      ).catch(() => {});
    }

    auditFromReq(req, act === "approve" ? "GRADE_APPROVE" : "GRADE_CREATE", "student_marks", { resourceId: submissionId, metadata: { marksScored: officialMarks, gradingStatus: newStatus } });

    if (act === "approve") {
      pool.query(
        `SELECT s.account_id FROM student_marks sm
         JOIN students s ON s.id = sm.student_id
         WHERE sm.id = $1 AND s.account_id IS NOT NULL`,
        [submissionId]
      ).then(({ rows }) => {
        const accountId = rows[0]?.account_id;
        if (accountId) {
          notifyAndPush(accountId, {
            title: "Grade released",
            message: `Your exam result is now available. You scored ${officialMarks} marks.`,
            type: "grade_approved",
            link: "/my-results",
            pushBody: `Result available: ${officialMarks} marks.`,
            relatedEntityType: "student_mark",
            relatedEntityId: submissionId,
          }).catch(() => {});
        }
      }).catch(() => {});
    }

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
