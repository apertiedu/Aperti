import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, pool, examsTable, examQuestionsTable, studentMarksTable, studentsTable } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";

const router: IRouter = Router();

function getTeacherId(req: AuthRequest): number {
  return req.userId!;
}

async function assertExamOwner(req: AuthRequest, examId: number): Promise<{ exam: typeof examsTable.$inferSelect } | null> {
  const [exam] = await db.select().from(examsTable).where(eq(examsTable.id, examId));
  if (!exam) return null;
  if (req.role === "admin") return { exam };
  if (exam.teacherAccountId !== req.userId) return null;
  return { exam };
}

router.get("/exams", authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    const teacherId = getTeacherId(req);
    const filter = req.role === "admin" ? undefined : eq(examsTable.teacherAccountId, teacherId);
    const rows = filter
      ? await db.select().from(examsTable).where(filter).orderBy(examsTable.createdAt)
      : await db.select().from(examsTable).orderBy(examsTable.createdAt);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to load exams" });
  }
});

router.post("/exams", authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { name, subjectId, examDate, totalMarks, timeLimitMinutes } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: "Exam name is required" }); return; }
    const teacherId = getTeacherId(req);
    const [created] = await db.insert(examsTable).values({
      name: name.trim(),
      subjectId: subjectId ? parseInt(subjectId, 10) : null,
      teacherAccountId: teacherId,
      examDate: examDate || null,
      totalMarks: totalMarks ? String(totalMarks) : null,
      timeLimitMinutes: timeLimitMinutes ? parseInt(timeLimitMinutes, 10) : null,
    }).returning();
    res.status(201).json(created);
  } catch {
    res.status(500).json({ error: "Failed to create exam" });
  }
});

router.get("/exams/:id", authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid exam ID" }); return; }

    const [exam] = await db.select().from(examsTable).where(eq(examsTable.id, id));
    if (!exam) { res.status(404).json({ error: "Exam not found" }); return; }

    const isStudent = req.role === "student";
    const isOwner = req.role === "admin" || exam.teacherAccountId === req.userId;

    if (!isOwner && !isStudent) {
      res.status(403).json({ error: "You do not have permission to view this exam" });
      return;
    }

    const questions = await db.select().from(examQuestionsTable)
      .where(eq(examQuestionsTable.examId, id))
      .orderBy(examQuestionsTable.questionOrder);

    const teacherId = getTeacherId(req);
    const students = req.role === "admin"
      ? await db.select().from(studentsTable)
      : isStudent
        ? []
        : await db.select().from(studentsTable).where(eq(studentsTable.teacherAccountId, teacherId));

    // HUMAN GRADING AUTHORITY: students only see approved grades.
    // Teachers see all marks (so they can review/approve pending ones).
    const marksFilter = isStudent
      ? and(eq(studentMarksTable.examId, id), eq(studentMarksTable.gradingStatus, "approved"))
      : eq(studentMarksTable.examId, id);
    const marks = await db.select().from(studentMarksTable).where(marksFilter);
    res.json({ exam, questions, students, marks });
  } catch {
    res.status(500).json({ error: "Failed to load exam" });
  }
});

router.patch("/exams/:id", authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid exam ID" }); return; }

    const owned = await assertExamOwner(req, id);
    if (!owned) { res.status(owned === null ? 404 : 403).json({ error: "Exam not found or access denied" }); return; }

    const { name, subjectId, examDate, totalMarks, timeLimitMinutes } = req.body;
    const updates: Record<string, unknown> = {};
    if (name) updates.name = name.trim();
    if ("subjectId" in req.body) updates.subjectId = subjectId ? parseInt(subjectId, 10) : null;
    if ("examDate" in req.body) updates.examDate = examDate || null;
    if ("totalMarks" in req.body) updates.totalMarks = totalMarks ? String(totalMarks) : null;
    if ("timeLimitMinutes" in req.body) updates.timeLimitMinutes = timeLimitMinutes ? parseInt(timeLimitMinutes, 10) : null;
    const [updated] = await db.update(examsTable).set(updates).where(eq(examsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Exam not found" }); return; }
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Failed to update exam" });
  }
});

router.delete("/exams/:id", authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid exam ID" }); return; }

    const owned = await assertExamOwner(req, id);
    if (!owned) { res.status(404).json({ error: "Exam not found or access denied" }); return; }

    await db.delete(examQuestionsTable).where(eq(examQuestionsTable.examId, id));
    await db.delete(studentMarksTable).where(eq(studentMarksTable.examId, id));
    await db.delete(examsTable).where(eq(examsTable.id, id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete exam" });
  }
});

router.post("/exams/:id/questions", authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    const examId = parseInt(req.params.id, 10);
    if (isNaN(examId)) { res.status(400).json({ error: "Invalid exam ID" }); return; }

    const owned = await assertExamOwner(req, examId);
    if (!owned) { res.status(404).json({ error: "Exam not found or access denied" }); return; }

    const { questionText, topic, maxMarks, questionOrder, parentId, questionType, options, correctOption } = req.body;
    if (!maxMarks && maxMarks !== 0) { res.status(400).json({ error: "maxMarks is required" }); return; }
    const type = questionType || "written";
    const [created] = await db.insert(examQuestionsTable).values({
      examId,
      questionText: questionText || null,
      topic: topic || null,
      maxMarks: String(maxMarks),
      questionOrder: questionOrder ?? 0,
      parentId: parentId ? parseInt(parentId, 10) : null,
      questionType: type,
      options: type === "mcq" && Array.isArray(options) ? options : null,
      correctOption: type === "mcq" && correctOption !== undefined ? parseInt(correctOption, 10) : null,
    }).returning();
    res.status(201).json(created);
  } catch {
    res.status(500).json({ error: "Failed to add question" });
  }
});

router.patch("/exam-questions/:id", authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid question ID" }); return; }

    const [question] = await db.select().from(examQuestionsTable).where(eq(examQuestionsTable.id, id));
    if (!question) { res.status(404).json({ error: "Question not found" }); return; }

    const owned = await assertExamOwner(req, question.examId);
    if (!owned) { res.status(403).json({ error: "Access denied" }); return; }

    const { questionText, topic, maxMarks, questionOrder, questionType, options, correctOption } = req.body;
    const updates: Record<string, unknown> = {};
    if ("questionText" in req.body) updates.questionText = questionText;
    if ("topic" in req.body) updates.topic = topic;
    if ("maxMarks" in req.body) updates.maxMarks = String(maxMarks);
    if ("questionOrder" in req.body) updates.questionOrder = questionOrder;
    if ("questionType" in req.body) {
      updates.questionType = questionType;
      updates.options = questionType === "mcq" && Array.isArray(options) ? options : null;
      updates.correctOption = questionType === "mcq" && correctOption !== undefined ? parseInt(correctOption, 10) : null;
    }
    const [updated] = await db.update(examQuestionsTable).set(updates).where(eq(examQuestionsTable.id, id)).returning();
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Failed to update question" });
  }
});

router.delete("/exam-questions/:id", authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid question ID" }); return; }

    const [question] = await db.select().from(examQuestionsTable).where(eq(examQuestionsTable.id, id));
    if (!question) { res.status(404).json({ error: "Question not found" }); return; }

    const owned = await assertExamOwner(req, question.examId);
    if (!owned) { res.status(403).json({ error: "Access denied" }); return; }

    await db.delete(examQuestionsTable).where(eq(examQuestionsTable.id, id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete question" });
  }
});

router.post("/exams/:id/marks", authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    const examId = parseInt(req.params.id, 10);
    if (isNaN(examId)) { res.status(400).json({ error: "Invalid exam ID" }); return; }

    const owned = await assertExamOwner(req, examId);
    if (!owned) { res.status(404).json({ error: "Exam not found or access denied" }); return; }

    const { marks } = req.body;
    if (!Array.isArray(marks)) { res.status(400).json({ error: "marks array required" }); return; }

    const allowedStudentIds: Set<number> | null = req.role === "admin" ? null : await (async () => {
      const rows = await db.select({ id: studentsTable.id }).from(studentsTable).where(eq(studentsTable.teacherAccountId, req.userId!));
      return new Set(rows.map(r => r.id));
    })();

    for (const m of marks) {
      const { studentId, questionId, marksScored, mistakes } = m;
      const sid = parseInt(studentId, 10);
      if (isNaN(sid)) { res.status(400).json({ error: "Invalid studentId" }); return; }
      if (allowedStudentIds && !allowedStudentIds.has(sid)) {
        res.status(403).json({ error: `Student ${sid} does not belong to your account` });
        return;
      }
      const scored = marksScored !== undefined && marksScored !== null ? parseFloat(String(marksScored)) : null;
      if (scored !== null && (isNaN(scored) || scored < 0 || scored > 10000)) {
        res.status(400).json({ error: "marksScored must be a number between 0 and 10000" });
        return;
      }
      const scoredStr = scored !== null ? String(scored) : null;
      // Teacher-entered marks start as 'graded' (teacher has already reviewed them).
      // They still need an explicit 'approved' action to be released to students.
      await db.insert(studentMarksTable).values({
        studentId: sid,
        examId,
        questionId: parseInt(questionId, 10),
        marksScored: scoredStr,
        mistakes: mistakes || null,
        gradingStatus: "graded",
        gradedAt: new Date(),
      }).onConflictDoUpdate({
        target: [studentMarksTable.studentId, studentMarksTable.questionId],
        set: { marksScored: scoredStr, mistakes: mistakes || null, markedAt: new Date(), gradingStatus: "graded", gradedAt: new Date() },
      });
    }
    res.json({ success: true, saved: marks.length });
  } catch {
    res.status(500).json({ error: "Failed to save marks" });
  }
});

router.get("/exams/:id/results", authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    const examId = parseInt(req.params.id, 10);
    if (isNaN(examId)) { res.status(400).json({ error: "Invalid exam ID" }); return; }

    const [exam] = await db.select().from(examsTable).where(eq(examsTable.id, examId));
    if (!exam) { res.status(404).json({ error: "Exam not found" }); return; }

    if (req.role === "student") {
      res.status(403).json({ error: "Use the student portal to view your results" });
      return;
    }
    if (req.role !== "admin" && exam.teacherAccountId !== req.userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const questions = await db.select().from(examQuestionsTable).where(eq(examQuestionsTable.examId, examId));
    const marks = await db.select({
      studentId: studentMarksTable.studentId,
      studentName: studentsTable.studentName,
      studentCode: studentsTable.studentCode,
      questionId: studentMarksTable.questionId,
      marksScored: studentMarksTable.marksScored,
      mistakes: studentMarksTable.mistakes,
    }).from(studentMarksTable)
      .innerJoin(studentsTable, eq(studentMarksTable.studentId, studentsTable.id))
      .where(eq(studentMarksTable.examId, examId));

    const studentMap: Record<number, any> = {};
    for (const mark of marks) {
      if (!studentMap[mark.studentId]) {
        studentMap[mark.studentId] = { studentId: mark.studentId, studentName: mark.studentName, studentCode: mark.studentCode, totalScored: 0, questionMarks: {} };
      }
      const scored = mark.marksScored !== null ? parseFloat(String(mark.marksScored)) : null;
      studentMap[mark.studentId].questionMarks[mark.questionId] = { marksScored: scored, mistakes: mark.mistakes };
      if (scored !== null) studentMap[mark.studentId].totalScored += scored;
    }

    const totalMax = questions.reduce((sum, q) => sum + parseFloat(String(q.maxMarks)), 0);
    const results = Object.values(studentMap).map((s: any) => ({
      ...s, totalMax,
      percentage: totalMax > 0 ? Math.round((s.totalScored / totalMax) * 100 * 10) / 10 : 0,
    })).sort((a: any, b: any) => b.totalScored - a.totalScored);

    res.json({ exam, questions, results, totalMax });
  } catch {
    res.status(500).json({ error: "Failed to load exam results" });
  }
});

export default router;
