import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, examsTable, examQuestionsTable, studentMarksTable, studentsTable, subjectsTable } from "@workspace/db";

const router: IRouter = Router();

function getTeacherId(req: any): number {
  if (req.session.role === "teacher") return req.session.accountId;
  if (req.session.role === "assistant") return req.session.teacherAccountId || req.session.accountId;
  return req.session.accountId;
}

router.get("/exams", async (req, res): Promise<void> => {
  const teacherId = getTeacherId(req);
  const filter = req.session.role === "admin" ? undefined : eq(examsTable.teacherAccountId, teacherId);
  const rows = filter
    ? await db.select().from(examsTable).where(filter).orderBy(examsTable.createdAt)
    : await db.select().from(examsTable).orderBy(examsTable.createdAt);
  res.json(rows);
});

router.post("/exams", async (req, res): Promise<void> => {
  const { name, subjectId, examDate, totalMarks } = req.body;
  if (!name?.trim()) { res.status(400).json({ message: "Exam name is required" }); return; }
  const teacherId = getTeacherId(req);
  const [created] = await db.insert(examsTable).values({
    name: name.trim(),
    subjectId: subjectId ? parseInt(subjectId, 10) : null,
    teacherAccountId: teacherId,
    examDate: examDate || null,
    totalMarks: totalMarks ? String(totalMarks) : null,
  }).returning();
  res.status(201).json(created);
});

router.get("/exams/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [exam] = await db.select().from(examsTable).where(eq(examsTable.id, id));
  if (!exam) { res.status(404).json({ message: "Exam not found" }); return; }

  const questions = await db.select().from(examQuestionsTable)
    .where(eq(examQuestionsTable.examId, id))
    .orderBy(examQuestionsTable.questionOrder);

  const teacherId = getTeacherId(req);
  const students = req.session.role === "admin"
    ? await db.select().from(studentsTable)
    : await db.select().from(studentsTable).where(eq(studentsTable.teacherAccountId, teacherId));

  const marks = await db.select().from(studentMarksTable).where(eq(studentMarksTable.examId, id));

  res.json({ exam, questions, students, marks });
});

router.patch("/exams/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { name, subjectId, examDate, totalMarks } = req.body;
  const updates: Record<string, unknown> = {};
  if (name) updates.name = name.trim();
  if ("subjectId" in req.body) updates.subjectId = subjectId ? parseInt(subjectId, 10) : null;
  if ("examDate" in req.body) updates.examDate = examDate || null;
  if ("totalMarks" in req.body) updates.totalMarks = totalMarks ? String(totalMarks) : null;
  const [updated] = await db.update(examsTable).set(updates).where(eq(examsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ message: "Exam not found" }); return; }
  res.json(updated);
});

router.delete("/exams/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  await db.delete(examsTable).where(eq(examsTable.id, id));
  res.json({ message: "Exam deleted" });
});

// Questions
router.post("/exams/:id/questions", async (req, res): Promise<void> => {
  const examId = parseInt(req.params.id, 10);
  const { questionText, topic, maxMarks, questionOrder, parentId } = req.body;
  if (!maxMarks && maxMarks !== 0) { res.status(400).json({ message: "maxMarks is required" }); return; }
  const [created] = await db.insert(examQuestionsTable).values({
    examId,
    questionText: questionText || null,
    topic: topic || null,
    maxMarks: String(maxMarks),
    questionOrder: questionOrder ?? 0,
    parentId: parentId ? parseInt(parentId, 10) : null,
  }).returning();
  res.status(201).json(created);
});

router.patch("/exam-questions/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { questionText, topic, maxMarks, questionOrder } = req.body;
  const updates: Record<string, unknown> = {};
  if ("questionText" in req.body) updates.questionText = questionText;
  if ("topic" in req.body) updates.topic = topic;
  if ("maxMarks" in req.body) updates.maxMarks = String(maxMarks);
  if ("questionOrder" in req.body) updates.questionOrder = questionOrder;
  const [updated] = await db.update(examQuestionsTable).set(updates).where(eq(examQuestionsTable.id, id)).returning();
  res.json(updated);
});

router.delete("/exam-questions/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  await db.delete(examQuestionsTable).where(eq(examQuestionsTable.id, id));
  res.json({ message: "Question deleted" });
});

// Marks
router.post("/exams/:id/marks", async (req, res): Promise<void> => {
  const examId = parseInt(req.params.id, 10);
  const { marks } = req.body;
  if (!Array.isArray(marks)) { res.status(400).json({ message: "marks array required" }); return; }

  for (const m of marks) {
    const { studentId, questionId, marksScored, mistakes } = m;
    await db.insert(studentMarksTable).values({
      studentId: parseInt(studentId, 10),
      examId,
      questionId: parseInt(questionId, 10),
      marksScored: marksScored !== undefined && marksScored !== null ? String(marksScored) : null,
      mistakes: mistakes || null,
    }).onConflictDoUpdate({
      target: [studentMarksTable.studentId, studentMarksTable.questionId],
      set: {
        marksScored: marksScored !== undefined && marksScored !== null ? String(marksScored) : null,
        mistakes: mistakes || null,
        markedAt: new Date(),
      },
    });
  }

  res.json({ message: `Saved ${marks.length} mark entries` });
});

router.get("/exams/:id/results", async (req, res): Promise<void> => {
  const examId = parseInt(req.params.id, 10);
  const [exam] = await db.select().from(examsTable).where(eq(examsTable.id, examId));
  if (!exam) { res.status(404).json({ message: "Exam not found" }); return; }

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

  const studentMap: Record<number, { studentId: number; studentName: string; studentCode: string; totalScored: number; questionMarks: Record<number, { marksScored: number | null; mistakes: string | null }> }> = {};

  for (const mark of marks) {
    if (!studentMap[mark.studentId]) {
      studentMap[mark.studentId] = { studentId: mark.studentId, studentName: mark.studentName, studentCode: mark.studentCode, totalScored: 0, questionMarks: {} };
    }
    const scored = mark.marksScored !== null ? parseFloat(String(mark.marksScored)) : null;
    studentMap[mark.studentId].questionMarks[mark.questionId] = { marksScored: scored, mistakes: mark.mistakes };
    if (scored !== null) studentMap[mark.studentId].totalScored += scored;
  }

  const totalMax = questions.reduce((sum, q) => sum + parseFloat(String(q.maxMarks)), 0);
  const results = Object.values(studentMap).map(s => ({
    ...s,
    totalMax,
    percentage: totalMax > 0 ? Math.round((s.totalScored / totalMax) * 100 * 10) / 10 : 0,
  })).sort((a, b) => b.totalScored - a.totalScored);

  res.json({ exam, questions, results, totalMax });
});

export default router;
