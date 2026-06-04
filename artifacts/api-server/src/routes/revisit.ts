import { Router, Response } from "express";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { db, studentsTable, examsTable, subjectsTable } from "@workspace/db";
import { eq, and, gte } from "drizzle-orm";

export const revisitRouter = Router();

const studentGuard = [authenticate, requireRole("student")];

// GET /revisit/plan?type=daily|weekly|sprint — generate a revision plan
revisitRouter.get("/plan", ...studentGuard, async (req: AuthRequest, res: Response) => {
  const studentId = req.userId!;
  const type = (req.query.type as string) || "daily";

  const [student] = await db.select({ id: studentsTable.id, teacherAccountId: studentsTable.teacherAccountId })
    .from(studentsTable).where(eq(studentsTable.accountId, req.userId!)).limit(1);

  if (!student) { res.status(403).json({ message: "No student record" }); return; }

  const todayStr = new Date().toISOString().split("T")[0];
  const fourteenDaysOut = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];

  const [memory, upcomingExams, questions] = await Promise.all([
    db.query.echoMemory.findFirst({
      where: (m, { eq }) => eq(m.studentId, student.id),
    }),
    db.select({
      id: examsTable.id,
      name: examsTable.name,
      examDate: examsTable.examDate,
      subjectName: subjectsTable.name,
      totalMarks: examsTable.totalMarks,
    }).from(examsTable)
      .leftJoin(subjectsTable, eq(examsTable.subjectId, subjectsTable.id))
      .where(and(
        eq(examsTable.teacherAccountId, student.teacherAccountId!),
        gte(examsTable.examDate, todayStr)
      ))
      .limit(10),
    db.query.questionBank.findMany({
      where: (q, { isNotNull }) => isNotNull(q.topic),
      limit: 50,
    }),
  ]);

  const weakTopics = (memory?.weakTopics as string[]) ?? [];
  const retentionScores = (memory?.retentionScores as Record<string, number>) ?? {};
  const learningPace = memory?.learningPace ?? "medium";
  const paceMultiplier = learningPace === "slow" ? 1.5 : learningPace === "fast" ? 0.5 : 1;

  const sortedTopics = [...weakTopics].sort(
    (a, b) => (retentionScores[a] ?? 50) - (retentionScores[b] ?? 50)
  );

  const today = new Date();
  const sprintExam = upcomingExams.find(e =>
    new Date(e.examDate as string).getTime() - today.getTime() <= 14 * 86400000
  ) ?? null;

  const dayCount = type === "weekly" ? 7 : type === "sprint" ? 14 : 5;
  const plan: {
    date: string;
    topic: string;
    durationMinutes: number;
    mode: string;
    resources: { questionCount: number; flashcardDeck: string };
    examContext?: string;
  }[] = [];

  for (let i = 0; i < dayCount; i++) {
    const topic = sortedTopics[i % (sortedTopics.length || 1)] || "General Review";
    const duration = Math.round(20 * paceMultiplier);
    const nearbyExam = upcomingExams.find(e =>
      Math.abs(new Date(e.examDate as string).getTime() - new Date(today.getTime() + i * 86400000).getTime()) <= 2 * 86400000
    );

    plan.push({
      date: new Date(today.getTime() + i * 86400000).toISOString().split("T")[0],
      topic,
      durationMinutes: type === "sprint" ? Math.min(Math.round(duration * 1.5), 60) : duration,
      mode: type === "sprint" ? "past-paper" : i % 3 === 0 ? "flashcards" : "questions",
      resources: {
        questionCount: Math.min(5, questions.filter(q => q.topic === topic).length),
        flashcardDeck: topic,
      },
      ...(nearbyExam ? { examContext: `${nearbyExam.name} on ${nearbyExam.examDate}` } : {}),
    });
  }

  res.json({
    type,
    plan,
    weakTopics,
    learningPace,
    upcomingExams: upcomingExams.map(e => ({
      id: e.id,
      name: e.name,
      examDate: e.examDate,
      subject: e.subjectName,
      daysUntil: Math.ceil((new Date(e.examDate as string).getTime() - today.getTime()) / 86400000),
    })),
    sprintMode: type === "sprint" && sprintExam ? {
      examName: sprintExam.name,
      examDate: sprintExam.examDate,
      daysRemaining: Math.ceil((new Date(sprintExam.examDate as string).getTime() - today.getTime()) / 86400000),
    } : null,
  });
});
