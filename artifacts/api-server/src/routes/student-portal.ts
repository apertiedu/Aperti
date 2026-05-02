import { Router, type IRouter } from "express";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import {
  db, studentsTable, attendanceTable, sessionsTable,
  studentMarksTable, examQuestionsTable, examsTable,
  homeworkTable, homeworkSubmissionsTable, resourcesTable, subjectsTable
} from "@workspace/db";
import type { Request, Response, NextFunction } from "express";

const router: IRouter = Router();

function requireStudentAccess(req: Request, res: Response, next: NextFunction): void {
  const session = req.session as any;
  if (!session.accountId) { res.status(401).json({ message: "Not authenticated" }); return; }
  if (session.role !== "student") { res.status(403).json({ message: "Student access required" }); return; }
  if (!session.studentId) { res.status(403).json({ message: "No student record linked" }); return; }
  next();
}

// Get student profile + stats
router.get("/portal/me", requireStudentAccess, async (req, res): Promise<void> => {
  const session = req.session as any;
  const studentId: number = session.studentId;
  const teacherId: number = session.teacherAccountId;

  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, studentId));
  if (!student) { res.status(404).json({ message: "Student record not found" }); return; }

  // Attendance stats (last 90 days)
  const since = new Date(); since.setDate(since.getDate() - 90);
  const sinceStr = since.toISOString().split("T")[0];

  const attData = await db.select({ status: attendanceTable.status, count: sql<number>`count(*)::int` })
    .from(attendanceTable)
    .where(and(eq(attendanceTable.studentId, studentId), gte(attendanceTable.date, sinceStr)))
    .groupBy(attendanceTable.status);

  const present = attData.find(r => r.status === "Present")?.count ?? 0;
  const absent = attData.find(r => r.status === "Absent")?.count ?? 0;
  const total = present + absent;
  const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;

  // Latest exam
  const latestExam = await db.select({
    examName: examsTable.name,
    scored: sql<number>`sum(${studentMarksTable.marksScored})::numeric`,
    maxMarks: sql<number>`sum(${examQuestionsTable.maxMarks})::numeric`,
  }).from(studentMarksTable)
    .innerJoin(examQuestionsTable, eq(studentMarksTable.questionId, examQuestionsTable.id))
    .innerJoin(examsTable, eq(studentMarksTable.examId, examsTable.id))
    .where(eq(studentMarksTable.studentId, studentId))
    .groupBy(examsTable.id, examsTable.name, examsTable.examDate)
    .orderBy(desc(examsTable.examDate))
    .limit(1);

  // Streak: consecutive sessions with Present
  const recentAtt = await db.select({ date: attendanceTable.date, status: attendanceTable.status })
    .from(attendanceTable)
    .where(eq(attendanceTable.studentId, studentId))
    .orderBy(desc(attendanceTable.date))
    .limit(30);

  let streak = 0;
  for (const r of recentAtt) {
    if (r.status === "Present") streak++;
    else break;
  }

  // Upcoming homework (due in next 14 days)
  const twoWeeks = new Date(); twoWeeks.setDate(twoWeeks.getDate() + 14);
  const today = new Date().toISOString().split("T")[0];
  const upcoming = await db.select({
    id: homeworkTable.id,
    title: homeworkTable.title,
    dueDate: homeworkTable.dueDate,
    totalMarks: homeworkTable.totalMarks,
    subjectName: subjectsTable.name,
    submissionStatus: homeworkSubmissionsTable.status,
  }).from(homeworkTable)
    .leftJoin(subjectsTable, eq(homeworkTable.subjectId, subjectsTable.id))
    .leftJoin(homeworkSubmissionsTable, and(eq(homeworkSubmissionsTable.homeworkId, homeworkTable.id), eq(homeworkSubmissionsTable.studentId, studentId)))
    .where(and(eq(homeworkTable.teacherAccountId, teacherId), eq(homeworkTable.isPublished, true)))
    .orderBy(homeworkTable.dueDate)
    .limit(5);

  const examPct = latestExam[0] && latestExam[0].maxMarks > 0
    ? Math.round((latestExam[0].scored / latestExam[0].maxMarks) * 100)
    : null;

  res.json({
    student,
    stats: { attendanceRate, present, absent, total, streak },
    latestExam: latestExam[0] ? { ...latestExam[0], percentage: examPct } : null,
    upcomingHomework: upcoming,
  });
});

// Student's own attendance history
router.get("/portal/attendance", requireStudentAccess, async (req, res): Promise<void> => {
  const session = req.session as any;
  const studentId: number = session.studentId;

  const since = new Date(); since.setDate(since.getDate() - 365);
  const sinceStr = since.toISOString().split("T")[0];

  const rows = await db.select({
    date: attendanceTable.date,
    status: attendanceTable.status,
    lessonNumber: sessionsTable.lessonNumber,
    dayOfWeek: sessionsTable.dayOfWeek,
    startTime: sessionsTable.startTime,
  }).from(attendanceTable)
    .innerJoin(sessionsTable, eq(attendanceTable.sessionId, sessionsTable.id))
    .where(and(eq(attendanceTable.studentId, studentId), gte(attendanceTable.date, sinceStr)))
    .orderBy(desc(attendanceTable.date));

  // Heatmap data
  const heatmapMap: Record<string, { present: number; absent: number }> = {};
  for (const row of rows) {
    if (!heatmapMap[row.date]) heatmapMap[row.date] = { present: 0, absent: 0 };
    if (row.status === "Present") heatmapMap[row.date].present++;
    else heatmapMap[row.date].absent++;
  }
  const heatmap = Object.entries(heatmapMap).map(([date, d]) => ({
    date, value: d.present > 0 ? (d.absent > 0 ? 2 : 3) : 1, ...d,
  }));

  res.json({ records: rows, heatmap });
});

// Homework list for student
router.get("/portal/homework", requireStudentAccess, async (req, res): Promise<void> => {
  const session = req.session as any;
  const studentId: number = session.studentId;
  const teacherId: number = session.teacherAccountId;

  const rows = await db.select({
    id: homeworkTable.id,
    title: homeworkTable.title,
    description: homeworkTable.description,
    instructions: homeworkTable.instructions,
    dueDate: homeworkTable.dueDate,
    totalMarks: homeworkTable.totalMarks,
    allowLate: homeworkTable.allowLate,
    subjectName: subjectsTable.name,
    submissionId: homeworkSubmissionsTable.id,
    submissionStatus: homeworkSubmissionsTable.status,
    submissionContent: homeworkSubmissionsTable.content,
    marksAwarded: homeworkSubmissionsTable.marksAwarded,
    teacherFeedback: homeworkSubmissionsTable.teacherFeedback,
    submittedAt: homeworkSubmissionsTable.submittedAt,
    gradedAt: homeworkSubmissionsTable.gradedAt,
    createdAt: homeworkTable.createdAt,
  }).from(homeworkTable)
    .leftJoin(subjectsTable, eq(homeworkTable.subjectId, subjectsTable.id))
    .leftJoin(homeworkSubmissionsTable, and(eq(homeworkSubmissionsTable.homeworkId, homeworkTable.id), eq(homeworkSubmissionsTable.studentId, studentId)))
    .where(and(eq(homeworkTable.teacherAccountId, teacherId), eq(homeworkTable.isPublished, true)))
    .orderBy(desc(homeworkTable.createdAt));

  res.json(rows);
});

// Submit homework
router.post("/portal/homework/:id/submit", requireStudentAccess, async (req, res): Promise<void> => {
  const session = req.session as any;
  const studentId: number = session.studentId;
  const hwId = parseInt(req.params.id, 10);
  const { content, isDraft } = req.body;

  const status = isDraft ? "draft" : "submitted";
  const submittedAt = isDraft ? null : new Date();

  const existing = await db.select().from(homeworkSubmissionsTable)
    .where(and(eq(homeworkSubmissionsTable.homeworkId, hwId), eq(homeworkSubmissionsTable.studentId, studentId)));

  if (existing.length > 0) {
    if (existing[0].status === "graded") { res.status(400).json({ message: "Graded submissions cannot be edited" }); return; }
    const [updated] = await db.update(homeworkSubmissionsTable)
      .set({ content: content?.trim() || null, status, submittedAt })
      .where(and(eq(homeworkSubmissionsTable.homeworkId, hwId), eq(homeworkSubmissionsTable.studentId, studentId)))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(homeworkSubmissionsTable).values({
      homeworkId: hwId, studentId, content: content?.trim() || null, status, submittedAt,
    }).returning();
    res.status(201).json(created);
  }
});

// Student resources
router.get("/portal/resources", requireStudentAccess, async (req, res): Promise<void> => {
  const session = req.session as any;
  const teacherId: number = session.teacherAccountId;

  const rows = await db.select({
    id: resourcesTable.id,
    title: resourcesTable.title,
    description: resourcesTable.description,
    type: resourcesTable.type,
    url: resourcesTable.url,
    content: resourcesTable.content,
    topic: resourcesTable.topic,
    tags: resourcesTable.tags,
    subjectName: subjectsTable.name,
    viewCount: resourcesTable.viewCount,
    createdAt: resourcesTable.createdAt,
  }).from(resourcesTable)
    .leftJoin(subjectsTable, eq(resourcesTable.subjectId, subjectsTable.id))
    .where(and(eq(resourcesTable.teacherAccountId, teacherId), eq(resourcesTable.isStudentVisible, true)))
    .orderBy(desc(resourcesTable.createdAt));

  res.json(rows);
});

// Student exam results
router.get("/portal/exams", requireStudentAccess, async (req, res): Promise<void> => {
  const session = req.session as any;
  const studentId: number = session.studentId;

  const marks = await db.select({
    examId: studentMarksTable.examId,
    examName: examsTable.name,
    examDate: examsTable.examDate,
    marksScored: studentMarksTable.marksScored,
    maxMarks: examQuestionsTable.maxMarks,
    topic: examQuestionsTable.topic,
  }).from(studentMarksTable)
    .innerJoin(examQuestionsTable, eq(studentMarksTable.questionId, examQuestionsTable.id))
    .innerJoin(examsTable, eq(studentMarksTable.examId, examsTable.id))
    .where(eq(studentMarksTable.studentId, studentId))
    .orderBy(examsTable.examDate);

  const examMap: Record<number, { examId: number; examName: string; examDate: string | null; scored: number; max: number }> = {};
  for (const m of marks) {
    if (!examMap[m.examId]) examMap[m.examId] = { examId: m.examId, examName: m.examName, examDate: m.examDate, scored: 0, max: 0 };
    examMap[m.examId].scored += parseFloat(String(m.marksScored ?? 0));
    examMap[m.examId].max += parseFloat(String(m.maxMarks));
  }

  const results = Object.values(examMap).map(e => ({
    ...e, percentage: e.max > 0 ? Math.round((e.scored / e.max) * 1000) / 10 : 0,
  }));

  res.json(results);
});

export default router;
