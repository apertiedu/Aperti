import { Router, Response } from "express";
import { db } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { examsTable, examQuestionsTable, studentMarksTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const examsRouter = Router();

examsRouter.get("/", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.userId!;
    const exams = await db.query.exams.findMany({
      where: (e, { eq }) => eq(e.teacherAccountId, teacherId),
      orderBy: (e, { desc }) => [desc(e.createdAt)],
    });
    res.json(exams);
  } catch (err) {
    res.status(500).json({ error: "Failed to load exams" });
  }
});

examsRouter.post("/", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.userId!;
    const { name, subjectId, examDate, totalMarks, timeLimitMinutes, questions } = req.body;

    const [exam] = await db.insert(examsTable).values({
      name,
      subjectId,
      teacherAccountId: teacherId,
      examDate,
      totalMarks: totalMarks?.toString(),
      timeLimitMinutes,
    }).returning();

    if (questions && Array.isArray(questions)) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await db.insert(examQuestionsTable).values({
          examId: exam.id,
          questionText: q.questionText,
          topic: q.topic,
          maxMarks: q.maxMarks?.toString() || "0",
          questionOrder: i + 1,
          questionType: q.questionType || "written",
          options: q.options || null,
          correctOption: q.correctOption || null,
        });
      }
    }

    res.status(201).json(exam);
  } catch (err) {
    res.status(500).json({ error: "Failed to create exam" });
  }
});

examsRouter.get("/:id", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const examId = parseInt(req.params.id);
    const exam = await db.query.exams.findFirst({ where: (e, { eq }) => eq(e.id, examId) });
    const questions = await db.query.examQuestions.findMany({
      where: (q, { eq }) => eq(q.examId, examId),
      orderBy: (q, { asc }) => [asc(q.questionOrder)],
    });
    res.json({ exam, questions });
  } catch (err) {
    res.status(500).json({ error: "Failed to load exam" });
  }
});

examsRouter.get("/:id/submissions", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const examId = parseInt(req.params.id);
    const marks = await db.query.studentMarks.findMany({
      where: (m, { eq }) => eq(m.examId, examId),
      orderBy: (m, { desc }) => [desc(m.marksScored)],
    });
    res.json(marks);
  } catch (err) {
    res.status(500).json({ error: "Failed to load submissions" });
  }
});

examsRouter.get("/student/assigned", authenticate, requireRole("student"), async (req: AuthRequest, res: Response) => {
  try {
    const exams = await db.query.exams.findMany({ orderBy: (e, { desc }) => [desc(e.createdAt)] });
    res.json(exams);
  } catch (err) {
    res.status(500).json({ error: "Failed to load assigned exams" });
  }
});

examsRouter.get("/student/:id/take", authenticate, requireRole("student"), async (req: AuthRequest, res: Response) => {
  try {
    const examId = parseInt(req.params.id);
    const exam = await db.query.exams.findFirst({ where: (e, { eq }) => eq(e.id, examId) });
    const questions = await db.query.examQuestions.findMany({
      where: (q, { eq }) => eq(q.examId, examId),
      orderBy: (q, { asc }) => [asc(q.questionOrder)],
    });
    res.json({ exam, questions });
  } catch (err) {
    res.status(500).json({ error: "Failed to load exam" });
  }
});

examsRouter.post("/student/:id/submit", authenticate, requireRole("student"), async (req: AuthRequest, res: Response) => {
  try {
    const examId = parseInt(req.params.id);
    const studentId = req.userId!;
    const { answers } = req.body;

    let totalScored = 0;
    for (const ans of answers) {
      const question = await db.query.examQuestions.findFirst({ where: (q, { eq }) => eq(q.id, ans.questionId) });
      let marksScored = "0";
      if (question?.questionType === "mcq" && question.correctOption === parseInt(ans.answerText)) {
        marksScored = question.maxMarks;
      }
      totalScored += parseFloat(marksScored);
      await db.insert(studentMarksTable).values({
        studentId,
        examId,
        questionId: ans.questionId,
        marksScored,
        mistakes: ans.answerText,
      });
    }
    res.json({ success: true, totalScored });
  } catch (err) {
    res.status(500).json({ error: "Failed to submit exam" });
  }
});
