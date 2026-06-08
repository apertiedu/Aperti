import { Router, Response } from "express";
import { eq, and, desc, gte, sql, ne } from "drizzle-orm";
import {
  db,
  studentsTable,
  masteryRecordsTable,
  learningPathsTable,
  microAssessmentsTable,
  learningGoalsTable,
  challengesTable,
  challengeParticipationsTable,
  learningAnalyticsSnapshotsTable,
  offlineContentTable,
  recommendationFeedbackTable,
  focusSessionsTable,
  ascendProfilesTable,
  echoMemoryTable,
  examsTable,
  subjectsTable,
  homeworkTable,
  homeworkSubmissionsTable,
  questionBankTable,
  flashcardDecksTable,
  flashcardItemsTable,
  studentMarksTable,
  attendanceTable,
  accountsTable,
} from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";

export const learningExperienceRouter = Router();

const studentGuard = [authenticate, requireRole("student")];
const teacherGuard = [authenticate, requireRole("teacher")];
const anyAuth = [authenticate];

async function getStudent(req: AuthRequest, res: Response) {
  const [s] = await db.select().from(studentsTable).where(eq(studentsTable.accountId, req.userId!)).limit(1);
  if (!s) { res.status(403).json({ message: "No student record" }); return null; }
  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// MASTERY
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/mastery/:courseId
learningExperienceRouter.get("/mastery/:courseId", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const student = await getStudent(req, res);
  if (!student) return;
  const courseId = parseInt(req.params.courseId, 10) || 0;

  const records = await db.select().from(masteryRecordsTable)
    .where(and(eq(masteryRecordsTable.studentId, student.id),
      courseId ? eq(masteryRecordsTable.courseId, courseId) : sql`1=1`))
    .orderBy(desc(masteryRecordsTable.updatedAt));

  const echo = await db.query.echoMemory?.findFirst({ where: (m: any, { eq }: any) => eq(m.studentId, student.id) });
  const weakTopics = (echo?.weakTopics as string[]) ?? [];

  const states = ["not_started", "introduced", "practicing", "developing", "mastered", "expert"];
  const masteryPct = records.length > 0
    ? Math.round(records.reduce((acc: number, r) => acc + states.indexOf(r.masteryState) / 5 * 100, 0) / records.length)
    : 0;

  res.json({ records, masteryPct, weakTopics, total: records.length });
});

// POST /api/mastery/:topicId/update
learningExperienceRouter.post("/mastery/:topicId/update", ...anyAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { studentId, masteryState, confidenceScore, topicName, courseId } = req.body;
  const topicId = parseInt(req.params.topicId, 10);

  if (!studentId) { res.status(400).json({ message: "studentId required" }); return; }

  const existing = await db.select().from(masteryRecordsTable)
    .where(and(eq(masteryRecordsTable.studentId, studentId), topicId ? eq(masteryRecordsTable.topicId, topicId) : sql`1=1`))
    .limit(1);

  const states = ["not_started", "introduced", "practicing", "developing", "mastered", "expert"];
  const validState = states.includes(masteryState) ? masteryState : "practicing";

  let record;
  if (existing.length > 0) {
    [record] = await db.update(masteryRecordsTable)
      .set({ masteryState: validState, confidenceScore: confidenceScore ?? existing[0].confidenceScore, updatedAt: new Date(), lastInteractedAt: new Date() })
      .where(eq(masteryRecordsTable.id, existing[0].id)).returning();
  } else {
    [record] = await db.insert(masteryRecordsTable).values({
      studentId, topicId, topicName: topicName ?? "Topic", courseId, masteryState: validState, confidenceScore: confidenceScore ?? 50,
    }).returning();
  }

  res.json(record);
});

// ─────────────────────────────────────────────────────────────────────────────
// LEARNING PATH
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/learning-path
learningExperienceRouter.get("/learning-path", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const student = await getStudent(req, res);
  if (!student) return;

  const [paths, echo, mastery, exams] = await Promise.all([
    db.select().from(learningPathsTable).where(eq(learningPathsTable.studentId, student.id)).orderBy(desc(learningPathsTable.updatedAt)),
    db.query.echoMemory?.findFirst({ where: (m: any, { eq }: any) => eq(m.studentId, student.id) }),
    db.select().from(masteryRecordsTable).where(eq(masteryRecordsTable.studentId, student.id)),
    db.select({ id: examsTable.id, name: examsTable.name, examDate: examsTable.examDate })
      .from(examsTable)
      .where(and(
        student.teacherAccountId ? eq(examsTable.teacherAccountId, student.teacherAccountId) : sql`1=1`,
        gte(examsTable.examDate, new Date().toISOString().split("T")[0])
      )).limit(5),
  ]);

  const weakTopics = (echo?.weakTopics as string[]) ?? [];
  const strongTopics = (echo?.strongTopics as string[]) ?? [];

  res.json({ paths, weakTopics, strongTopics, masteryCount: mastery.length, upcomingExams: exams });
});

// POST /api/learning-path/generate
learningExperienceRouter.post("/learning-path/generate", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const student = await getStudent(req, res);
  if (!student) return;
  const { courseId, pathType = "adaptive" } = req.body;

  const [echo, mastery, qb] = await Promise.all([
    db.query.echoMemory?.findFirst({ where: (m: any, { eq }: any) => eq(m.studentId, student.id) }),
    db.select().from(masteryRecordsTable).where(eq(masteryRecordsTable.studentId, student.id)),
    db.select().from(questionBankTable).where(sql`topic IS NOT NULL`).limit(60),
  ]);

  const weakTopics = (echo?.weakTopics as string[]) ?? [];
  const retentionScores = (echo?.retentionScores as Record<string, number>) ?? {};

  const allTopics = [...new Set([
    ...weakTopics,
    ...qb.map((q: any) => q.topic).filter(Boolean),
  ])].slice(0, 20);

  const masteryMap = Object.fromEntries(mastery.map(m => [m.topicName, m.masteryState]));
  const states = ["not_started", "introduced", "practicing", "developing", "mastered", "expert"];

  const nodes = allTopics.map((topic, idx) => {
    const ms = masteryMap[topic] ?? "not_started";
    const stateIndex = states.indexOf(ms);
    const retention = retentionScores[topic] ?? 50;
    return {
      id: `topic_${idx}`,
      title: topic,
      type: "topic",
      status: stateIndex >= 4 ? "completed" : stateIndex >= 2 ? "in_progress" : "locked",
      order: idx,
      prerequisites: idx > 0 ? [`topic_${idx - 1}`] : [],
      estimatedMinutes: Math.round((1 - retention / 100) * 45 + 15),
      masteryState: ms,
      confidenceScore: retention,
    };
  });

  const [existing] = await db.select().from(learningPathsTable)
    .where(and(eq(learningPathsTable.studentId, student.id), courseId ? eq(learningPathsTable.courseId, courseId) : sql`course_id IS NULL`)).limit(1);

  let path;
  if (existing) {
    [path] = await db.update(learningPathsTable).set({ nodes, pathType, updatedAt: new Date() }).where(eq(learningPathsTable.id, existing.id)).returning();
  } else {
    [path] = await db.insert(learningPathsTable).values({ studentId: student.id, courseId, pathType, nodes }).returning();
  }

  res.json({ path, generated: true, nodeCount: nodes.length });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTIVE CONTENT DELIVERY
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/content/next
learningExperienceRouter.get("/content/next", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const student = await getStudent(req, res);
  if (!student) return;

  const [echo, mastery, exams, decks] = await Promise.all([
    db.query.echoMemory?.findFirst({ where: (m: any, { eq }: any) => eq(m.studentId, student.id) }),
    db.select().from(masteryRecordsTable).where(eq(masteryRecordsTable.studentId, student.id)).orderBy(masteryRecordsTable.confidenceScore).limit(5),
    db.select().from(examsTable)
      .where(and(
        student.teacherAccountId ? eq(examsTable.teacherAccountId, student.teacherAccountId) : sql`1=1`,
        gte(examsTable.examDate, new Date().toISOString().split("T")[0])
      )).limit(3),
    db.select().from(flashcardDecksTable).where(eq(flashcardDecksTable.createdByAccountId, student.accountId)).limit(5),
  ]);

  const weakTopics = (echo?.weakTopics as string[]) ?? [];
  const nearestExam = exams[0];
  const daysToExam = nearestExam
    ? Math.ceil((new Date(nearestExam.examDate as string).getTime() - Date.now()) / 86400000)
    : 999;

  const weakestTopic = mastery[0]?.topicName ?? weakTopics[0];
  const items = [];

  if (weakestTopic) {
    const type = daysToExam <= 7 ? "practice" : daysToExam <= 14 ? "flashcard" : "lesson";
    items.push({
      type, resourceId: `topic_${weakestTopic}`, title: weakestTopic,
      reason: daysToExam <= 7
        ? `Exam in ${daysToExam} days — urgent revision needed`
        : `Your weakest topic — practicing improves mastery`,
      priority: 1,
      estimatedMinutes: type === "practice" ? 20 : 10,
    });
  }

  for (const deck of decks.slice(0, 2)) {
    items.push({
      type: "flashcard", resourceId: String(deck.id), title: deck.name,
      reason: "Spaced repetition — cards are due for review",
      priority: 2, estimatedMinutes: 10,
    });
  }

  if (daysToExam <= 14 && nearestExam) {
    items.push({
      type: "simulation", resourceId: "simverse", title: `Practice for ${nearestExam.name}`,
      reason: `${nearestExam.name} is in ${daysToExam} days — hands-on practice helps`,
      priority: 3, estimatedMinutes: 30,
    });
  }

  res.json({ next: items[0] ?? null, queue: items });
});

// POST /api/content/deliver
learningExperienceRouter.post("/content/deliver", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const student = await getStudent(req, res);
  if (!student) return;
  const { contentType, resourceId, topicName, durationMinutes } = req.body;

  if (topicName) {
    const [existing] = await db.select().from(masteryRecordsTable)
      .where(and(eq(masteryRecordsTable.studentId, student.id), eq(masteryRecordsTable.topicName, topicName))).limit(1);
    if (existing) {
      const newState = existing.masteryState === "not_started" ? "introduced" :
        existing.masteryState === "introduced" ? "practicing" : existing.masteryState;
      await db.update(masteryRecordsTable)
        .set({ masteryState: newState, lastInteractedAt: new Date(), updatedAt: new Date() })
        .where(eq(masteryRecordsTable.id, existing.id));
    } else {
      await db.insert(masteryRecordsTable).values({
        studentId: student.id, topicName, masteryState: "introduced", confidenceScore: 30,
      });
    }
  }

  res.json({ logged: true, contentType, resourceId });
});

// GET /api/content/sequence
learningExperienceRouter.get("/content/sequence", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const student = await getStudent(req, res);
  if (!student) return;
  const courseId = req.query.courseId ? parseInt(req.query.courseId as string, 10) : null;

  const [path] = await db.select().from(learningPathsTable)
    .where(and(eq(learningPathsTable.studentId, student.id), courseId ? eq(learningPathsTable.courseId, courseId) : sql`1=1`)).limit(1);

  if (!path) { res.json({ sequence: [], courseId }); return; }

  const mastery = await db.select().from(masteryRecordsTable).where(eq(masteryRecordsTable.studentId, student.id));
  const masteryMap = Object.fromEntries(mastery.map(m => [m.topicName, m]));

  const nodes = (path.nodes as any[]).map(n => ({
    ...n,
    mastery: masteryMap[n.title],
    unlocked: n.order === 0 || (n.prerequisites as string[]).every((pid: string) => {
      const prereqNode = (path.nodes as any[]).find(pn => pn.id === pid);
      return prereqNode && masteryMap[prereqNode.title]?.masteryState === "mastered";
    }),
  }));

  res.json({ sequence: nodes, pathType: path.pathType });
});

// ─────────────────────────────────────────────────────────────────────────────
// MICRO ASSESSMENTS
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/micro-assessment/generate
learningExperienceRouter.post("/micro-assessment/generate", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const student = await getStudent(req, res);
  if (!student) return;
  const { topic, lessonId, type = "knowledge_check" } = req.body;

  const qbTopicCondition = topic ? eq(questionBankTable.topic, topic) : sql`topic IS NOT NULL`;
  const qbQuestions = await db.select().from(questionBankTable).where(qbTopicCondition).limit(8);

  const selectedTopic = topic ?? "General Knowledge";
  const questions = qbQuestions.slice(0, 4).map((q: any, idx: number) => {
    const options = Array.isArray(q.options) ? q.options.slice(0, 4) :
      ["Option A", "Option B", "Option C", "Option D"];
    while (options.length < 4) options.push(`Option ${String.fromCharCode(65 + options.length)}`);
    return {
      id: String(idx + 1), question: q.question ?? `Question ${idx + 1} on ${selectedTopic}`,
      options, correct: 0, explanation: q.markScheme ?? "Review your notes on this topic.",
      commonMistakes: "Watch out for common errors in this area.",
    };
  });

  if (questions.length < 3) {
    for (let i = questions.length; i < 4; i++) {
      questions.push({
        id: String(i + 1), question: `What is the key principle of ${selectedTopic}?`,
        options: ["Core concept A", "Core concept B", "Core concept C", "Core concept D"],
        correct: 0, explanation: `Review ${selectedTopic} in your notes.`,
        commonMistakes: "Students often confuse the core concepts here.",
      });
    }
  }

  const [assessment] = await db.insert(microAssessmentsTable).values({
    lessonId: lessonId ? parseInt(lessonId, 10) : undefined,
    studentId: student.id, type, topic: selectedTopic, questions,
  }).returning();

  res.json({ assessment, questionCount: questions.length });
});

// POST /api/micro-assessment/submit
learningExperienceRouter.post("/micro-assessment/submit", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const student = await getStudent(req, res);
  if (!student) return;
  const { assessmentId, answers } = req.body;
  if (!assessmentId || !answers) { res.status(400).json({ message: "assessmentId and answers required" }); return; }

  const [assessment] = await db.select().from(microAssessmentsTable)
    .where(and(eq(microAssessmentsTable.id, parseInt(assessmentId, 10)), eq(microAssessmentsTable.studentId, student.id))).limit(1);
  if (!assessment) { res.status(404).json({ message: "Assessment not found" }); return; }

  const questions = (assessment.questions as any[]);
  let correct = 0;
  const results = questions.map((q: any) => {
    const given = answers[q.id] ?? -1;
    const isCorrect = given === q.correct;
    if (isCorrect) correct++;
    return { questionId: q.id, correct: isCorrect, correctAnswer: q.options[q.correct], explanation: q.explanation };
  });

  const score = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
  const feedback = score >= 80 ? "Excellent! Keep this up." : score >= 60 ? "Good effort — review the ones you missed." : "Let's revisit this topic more carefully.";

  const [updated] = await db.update(microAssessmentsTable)
    .set({ answers, score: String(score), feedback, completedAt: new Date() })
    .where(eq(microAssessmentsTable.id, assessment.id)).returning();

  if (assessment.topic) {
    const [existing] = await db.select().from(masteryRecordsTable)
      .where(and(eq(masteryRecordsTable.studentId, student.id), eq(masteryRecordsTable.topicName, assessment.topic))).limit(1);

    const newState = score >= 90 ? "mastered" : score >= 75 ? "developing" : score >= 50 ? "practicing" : "introduced";
    if (existing) {
      await db.update(masteryRecordsTable).set({ masteryState: newState, confidenceScore: score, updatedAt: new Date() }).where(eq(masteryRecordsTable.id, existing.id));
    } else {
      await db.insert(masteryRecordsTable).values({ studentId: student.id, topicName: assessment.topic, masteryState: newState, confidenceScore: score });
    }
  }

  res.json({ score, correct, total: questions.length, results, feedback,
    nextStep: score >= 80 ? "Move to the next topic!" : score >= 50 ? "Review weak points, then retry" : "Revisit this topic with The Mentor",
  });
});

// GET /api/micro-assessment/history
learningExperienceRouter.get("/micro-assessment/history", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const student = await getStudent(req, res);
  if (!student) return;

  const history = await db.select().from(microAssessmentsTable)
    .where(and(eq(microAssessmentsTable.studentId, student.id), sql`completed_at IS NOT NULL`))
    .orderBy(desc(microAssessmentsTable.completedAt)).limit(20);

  const avgScore = history.length > 0
    ? Math.round(history.reduce((s: number, a: any) => s + parseFloat(String(a.score ?? 0)), 0) / history.length)
    : 0;

  res.json({ history, avgScore, count: history.length });
});

// ─────────────────────────────────────────────────────────────────────────────
// RECOMMENDATIONS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/recommendations
learningExperienceRouter.get("/recommendations", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const student = await getStudent(req, res);
  if (!student) return;

  const [echo, mastery, exams, recentAssessments, pendingHw] = await Promise.all([
    db.query.echoMemory?.findFirst({ where: (m: any, { eq }: any) => eq(m.studentId, student.id) }),
    db.select().from(masteryRecordsTable).where(eq(masteryRecordsTable.studentId, student.id)).orderBy(masteryRecordsTable.confidenceScore).limit(5),
    db.select({ id: examsTable.id, name: examsTable.name, examDate: examsTable.examDate, subjectName: subjectsTable.name })
      .from(examsTable)
      .leftJoin(subjectsTable, eq(examsTable.subjectId, subjectsTable.id))
      .where(and(
        student.teacherAccountId ? eq(examsTable.teacherAccountId, student.teacherAccountId) : sql`1=1`,
        gte(examsTable.examDate, new Date().toISOString().split("T")[0])
      )).limit(3),
    db.select().from(microAssessmentsTable)
      .where(and(eq(microAssessmentsTable.studentId, student.id), sql`completed_at IS NOT NULL`))
      .orderBy(desc(microAssessmentsTable.completedAt)).limit(5),
    db.select({ id: homeworkTable.id, title: homeworkTable.title, dueDate: homeworkTable.dueDate })
      .from(homeworkTable)
      .leftJoin(homeworkSubmissionsTable, and(eq(homeworkSubmissionsTable.homeworkId, homeworkTable.id), eq(homeworkSubmissionsTable.studentId, student.id)))
      .where(and(eq(homeworkTable.isPublished, true), sql`${homeworkSubmissionsTable.id} IS NULL`))
      .orderBy(homeworkTable.dueDate).limit(3),
  ]);

  const weakTopics = (echo?.weakTopics as string[]) ?? [];
  const recommendations = [];
  let priority = 1;

  for (const exam of exams) {
    const daysLeft = Math.ceil((new Date(exam.examDate as string).getTime() - Date.now()) / 86400000);
    if (daysLeft <= 14) {
      recommendations.push({
        id: `exam_sprint_${exam.id}`, type: "sprint_revision", title: `Sprint Revision: ${exam.name}`,
        reason: `${exam.name} is in ${daysLeft} day${daysLeft !== 1 ? "s" : ""} — intensive revision recommended`,
        actionUrl: "/revisit?mode=sprint", actionLabel: "Start Sprint",
        priority: priority++, daysLeft, subjectName: exam.subjectName, urgent: daysLeft <= 5,
      });
    }
  }

  for (const rec of mastery.slice(0, 2)) {
    recommendations.push({
      id: `mastery_${rec.id}`, type: "improve_mastery", title: `Strengthen: ${rec.topicName}`,
      reason: `Your mastery of ${rec.topicName} is ${rec.masteryState} — a focused session will help`,
      actionUrl: `/micro-assessment?topic=${encodeURIComponent(rec.topicName)}`, actionLabel: "Practice Now",
      priority: priority++, masteryState: rec.masteryState, confidenceScore: rec.confidenceScore,
    });
  }

  for (const topic of weakTopics.slice(0, 2)) {
    if (!recommendations.find(r => r.title.includes(topic))) {
      recommendations.push({
        id: `weak_${topic}`, type: "weak_topic", title: `Revise: ${topic}`,
        reason: `Echo has flagged ${topic} as a weak area based on your recent performance`,
        actionUrl: `/revisit?topic=${encodeURIComponent(topic)}`, actionLabel: "Revise",
        priority: priority++,
      });
    }
  }

  for (const hw of pendingHw) {
    const daysLeft = hw.dueDate ? Math.ceil((new Date(hw.dueDate).getTime() - Date.now()) / 86400000) : null;
    recommendations.push({
      id: `hw_${hw.id}`, type: "homework", title: `Assignment: ${hw.title}`,
      reason: daysLeft !== null && daysLeft <= 2 ? `Due in ${daysLeft} day${daysLeft !== 1 ? "s" : ""} — don't forget!` : "Pending assignment",
      actionUrl: "/my-homework", actionLabel: "Complete",
      priority: priority++, daysLeft, urgent: daysLeft !== null && daysLeft <= 1,
    });
  }

  recommendations.push({
    id: "daily_focus", type: "focus_session", title: "Start a Focus Session",
    reason: "Consistent daily study sessions are the #1 predictor of exam success",
    actionUrl: "/focus-zone", actionLabel: "Start Focus",
    priority: priority++,
  });

  res.json({ recommendations: recommendations.slice(0, 8), total: recommendations.length });
});

// POST /api/recommendations/feedback
learningExperienceRouter.post("/recommendations/feedback", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const student = await getStudent(req, res);
  if (!student) return;
  const { recommendationType, resourceId, rating } = req.body;
  if (!recommendationType || !rating) { res.status(400).json({ message: "recommendationType and rating required" }); return; }

  const [fb] = await db.insert(recommendationFeedbackTable).values({ studentId: student.id, recommendationType, resourceId, rating }).returning();
  res.json(fb);
});

// ─────────────────────────────────────────────────────────────────────────────
// REVISIT 2.0 ENHANCEMENTS
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/revisit/confidence
learningExperienceRouter.post("/revisit/confidence", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const student = await getStudent(req, res);
  if (!student) return;
  const { topic, confidenceRating } = req.body;
  if (!topic || !confidenceRating) { res.status(400).json({ message: "topic and confidenceRating (1-5) required" }); return; }

  const score = Math.round((confidenceRating / 5) * 100);
  const [existing] = await db.select().from(masteryRecordsTable)
    .where(and(eq(masteryRecordsTable.studentId, student.id), eq(masteryRecordsTable.topicName, topic))).limit(1);

  let record;
  if (existing) {
    [record] = await db.update(masteryRecordsTable)
      .set({ confidenceScore: score, lastInteractedAt: new Date(), updatedAt: new Date() })
      .where(eq(masteryRecordsTable.id, existing.id)).returning();
  } else {
    [record] = await db.insert(masteryRecordsTable).values({
      studentId: student.id, topicName: topic, masteryState: "practicing", confidenceScore: score,
    }).returning();
  }

  res.json({ record, confidenceRating, score });
});

// ─────────────────────────────────────────────────────────────────────────────
// LEARNING GOALS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/learning-goals
learningExperienceRouter.get("/learning-goals", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const student = await getStudent(req, res);
  if (!student) return;

  const goals = await db.select().from(learningGoalsTable)
    .where(eq(learningGoalsTable.studentId, student.id))
    .orderBy(desc(learningGoalsTable.createdAt));

  const active = goals.filter(g => g.status === "active");
  const achieved = goals.filter(g => g.status === "achieved");
  const attainmentRate = goals.length > 0 ? Math.round((achieved.length / goals.length) * 100) : 0;

  res.json({ goals, active, achieved, attainmentRate });
});

// POST /api/learning-goals
learningExperienceRouter.post("/learning-goals", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const student = await getStudent(req, res);
  if (!student) return;
  const { type, title, target, deadline, icon, xpReward } = req.body;
  if (!title) { res.status(400).json({ message: "title is required" }); return; }

  const [goal] = await db.insert(learningGoalsTable).values({
    studentId: student.id, type: type ?? "custom", title, target, deadline, icon: icon ?? "🎯", xpReward: xpReward ?? 100,
  }).returning();
  res.status(201).json(goal);
});

// PUT /api/learning-goals/:id
learningExperienceRouter.put("/learning-goals/:id", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const student = await getStudent(req, res);
  if (!student) return;
  const goalId = parseInt(req.params.id, 10);
  const { progress, status, title, target, deadline } = req.body;

  const [existing] = await db.select().from(learningGoalsTable)
    .where(and(eq(learningGoalsTable.id, goalId), eq(learningGoalsTable.studentId, student.id))).limit(1);
  if (!existing) { res.status(404).json({ message: "Goal not found" }); return; }

  const newProgress = Math.min(100, Math.max(0, progress ?? existing.progress));
  const newStatus = newProgress >= 100 ? "achieved" : status ?? existing.status;

  const [updated] = await db.update(learningGoalsTable)
    .set({ progress: newProgress, status: newStatus, title: title ?? existing.title, target: target ?? existing.target, deadline: deadline ?? existing.deadline, updatedAt: new Date() })
    .where(eq(learningGoalsTable.id, goalId)).returning();

  if (newStatus === "achieved" && existing.status !== "achieved") {
    const [profile] = await db.select().from(ascendProfilesTable).where(eq(ascendProfilesTable.studentAccountId, student.accountId)).limit(1);
    if (profile) {
      const newXp = (profile.xp ?? 0) + (existing.xpReward ?? 100);
      const newLevel = Math.max(1, Math.floor(Math.sqrt(newXp / 100)));
      await db.update(ascendProfilesTable).set({ xp: newXp, level: newLevel }).where(eq(ascendProfilesTable.id, profile.id));
    }
  }

  res.json(updated);
});

// DELETE /api/learning-goals/:id
learningExperienceRouter.delete("/learning-goals/:id", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const student = await getStudent(req, res);
  if (!student) return;
  const goalId = parseInt(req.params.id, 10);

  await db.delete(learningGoalsTable)
    .where(and(eq(learningGoalsTable.id, goalId), eq(learningGoalsTable.studentId, student.id)));
  res.json({ deleted: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// FOCUS ZONE 2.0
// ─────────────────────────────────────────────────────────────────────────────

// PATCH /api/focus-sessions/:id/complete (enhanced)
learningExperienceRouter.patch("/focus-sessions/:id/complete", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const student = await getStudent(req, res);
  if (!student) return;
  const sessionId = parseInt(req.params.id, 10);
  const { distractionsCount = 0, durationMinutes } = req.body;

  const [session] = await db.select().from(focusSessionsTable)
    .where(and(eq(focusSessionsTable.id, sessionId), eq(focusSessionsTable.studentId, student.id))).limit(1);
  if (!session) { res.status(404).json({ message: "Session not found" }); return; }

  const finalDuration = durationMinutes ?? session.durationMinutes;
  const productivityScore = Math.max(0, Math.round(100 - (distractionsCount * 8) - Math.max(0, finalDuration - 25) * 0.5));
  const xpEarned = Math.floor((finalDuration / 25) * 30 * (productivityScore / 100));

  const [updated] = await db.update(focusSessionsTable)
    .set({ durationMinutes: finalDuration, xpEarned, completedAt: new Date(), distractionsCount, productivityScore })
    .where(eq(focusSessionsTable.id, sessionId)).returning();

  const [profile] = await db.select().from(ascendProfilesTable).where(eq(ascendProfilesTable.studentAccountId, student.accountId)).limit(1);
  if (profile) {
    const delta = xpEarned - (session.xpEarned ?? 0);
    const newXp = Math.max(0, (profile.xp ?? 0) + delta);
    const newLevel = Math.max(1, Math.floor(Math.sqrt(newXp / 100)));
    await db.update(ascendProfilesTable).set({ xp: newXp, level: newLevel }).where(eq(ascendProfilesTable.id, profile.id));
  }

  res.json({ session: updated, xpEarned, productivityScore, distractionsCount });
});

// GET /api/focus-analytics
learningExperienceRouter.get("/focus-analytics", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const student = await getStudent(req, res);
  if (!student) return;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const sessions = await db.select().from(focusSessionsTable)
    .where(and(eq(focusSessionsTable.studentId, student.id), gte(focusSessionsTable.startedAt, thirtyDaysAgo)))
    .orderBy(focusSessionsTable.startedAt);

  const completed = sessions.filter((s: any) => s.completedAt);
  const totalMinutes = completed.reduce((acc: number, s: any) => acc + (s.durationMinutes ?? 0), 0);
  const avgProductivity = completed.length > 0
    ? Math.round(completed.reduce((acc: number, s: any) => acc + (s.productivityScore ?? 70), 0) / completed.length)
    : 0;

  const byDay: Record<string, { minutes: number; sessions: number; productivity: number }> = {};
  const byHour: Record<number, number> = {};

  for (const s of completed) {
    const day = (s.completedAt as Date).toISOString().split("T")[0];
    const hour = new Date(s.startedAt as Date).getHours();
    byDay[day] = byDay[day] ?? { minutes: 0, sessions: 0, productivity: 0 };
    byDay[day].minutes += s.durationMinutes ?? 0;
    byDay[day].sessions++;
    byDay[day].productivity = Math.round(((byDay[day].productivity * (byDay[day].sessions - 1)) + (s.productivityScore ?? 70)) / byDay[day].sessions);
    byHour[hour] = (byHour[hour] ?? 0) + 1;
  }

  const peakHour = Object.entries(byHour).sort((a, b) => b[1] - a[1])[0];
  const totalDistractions = completed.reduce((acc: number, s: any) => acc + (s.distractionsCount ?? 0), 0);

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(today.getTime() - i * 86400000).toISOString().split("T")[0];
    if (byDay[d]) streak++;
    else break;
  }

  res.json({
    totalHours: Math.round(totalMinutes / 60 * 10) / 10,
    totalSessions: completed.length,
    avgProductivity,
    streak,
    totalDistractions,
    byDay,
    byHour,
    peakHour: peakHour ? { hour: parseInt(peakHour[0]), sessions: peakHour[1] } : null,
    avgSessionMinutes: completed.length > 0 ? Math.round(totalMinutes / completed.length) : 0,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CHALLENGES
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/challenges
learningExperienceRouter.get("/challenges", ...anyAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const challenges = await db.select({
    id: challengesTable.id, title: challengesTable.title, description: challengesTable.description,
    type: challengesTable.type, xpReward: challengesTable.xpReward, startDate: challengesTable.startDate,
    endDate: challengesTable.endDate, createdAt: challengesTable.createdAt,
  }).from(challengesTable).orderBy(desc(challengesTable.createdAt)).limit(20);

  res.json({ challenges });
});

// POST /api/challenges (teacher/admin)
learningExperienceRouter.post("/challenges", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { title, description, type, rules, xpReward, startDate, endDate } = req.body;
  if (!title) { res.status(400).json({ message: "title required" }); return; }

  const [challenge] = await db.insert(challengesTable).values({
    title, description, type: type ?? "weekly", rules: rules ?? {}, xpReward: xpReward ?? 200,
    startDate, endDate, createdBy: req.userId!,
  }).returning();

  res.status(201).json(challenge);
});

// POST /api/challenges/:id/join
learningExperienceRouter.post("/challenges/:id/join", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const student = await getStudent(req, res);
  if (!student) return;
  const challengeId = parseInt(req.params.id, 10);

  const [existing] = await db.select().from(challengeParticipationsTable)
    .where(and(eq(challengeParticipationsTable.studentId, student.id), eq(challengeParticipationsTable.challengeId, challengeId))).limit(1);
  if (existing) { res.json({ participation: existing, alreadyJoined: true }); return; }

  const [participation] = await db.insert(challengeParticipationsTable)
    .values({ studentId: student.id, challengeId, status: "joined" }).returning();
  res.status(201).json({ participation });
});

// POST /api/challenges/:id/submit
learningExperienceRouter.post("/challenges/:id/submit", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const student = await getStudent(req, res);
  if (!student) return;
  const challengeId = parseInt(req.params.id, 10);
  const { score } = req.body;

  const [participation] = await db.select().from(challengeParticipationsTable)
    .where(and(eq(challengeParticipationsTable.studentId, student.id), eq(challengeParticipationsTable.challengeId, challengeId))).limit(1);
  if (!participation) { res.status(404).json({ message: "Must join challenge first" }); return; }

  const [updated] = await db.update(challengeParticipationsTable)
    .set({ status: "completed", score: String(score ?? 100), completedAt: new Date() })
    .where(eq(challengeParticipationsTable.id, participation.id)).returning();

  const [challenge] = await db.select().from(challengesTable).where(eq(challengesTable.id, challengeId)).limit(1);
  if (challenge) {
    const [profile] = await db.select().from(ascendProfilesTable).where(eq(ascendProfilesTable.studentAccountId, student.accountId)).limit(1);
    if (profile) {
      const newXp = (profile.xp ?? 0) + (challenge.xpReward ?? 200);
      const newLevel = Math.max(1, Math.floor(Math.sqrt(newXp / 100)));
      await db.update(ascendProfilesTable).set({ xp: newXp, level: newLevel }).where(eq(ascendProfilesTable.id, profile.id));
    }
  }

  res.json({ participation: updated, xpAwarded: challenge?.xpReward ?? 200 });
});

// GET /api/challenges/leaderboard/:id
learningExperienceRouter.get("/challenges/leaderboard/:id", ...anyAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const challengeId = parseInt(req.params.id, 10);

  const participations = await db.select({
    id: challengeParticipationsTable.id,
    studentId: challengeParticipationsTable.studentId,
    score: challengeParticipationsTable.score,
    status: challengeParticipationsTable.status,
    completedAt: challengeParticipationsTable.completedAt,
  }).from(challengeParticipationsTable)
    .where(eq(challengeParticipationsTable.challengeId, challengeId))
    .orderBy(desc(challengeParticipationsTable.score)).limit(20);

  const enriched = await Promise.all(participations.map(async (p) => {
    const [student] = await db.select({ id: studentsTable.id, studentName: studentsTable.studentName })
      .from(studentsTable).where(eq(studentsTable.id, p.studentId)).limit(1);
    return { ...p, studentName: student?.studentName ?? "Student" };
  }));

  res.json({ leaderboard: enriched, challengeId });
});

// ─────────────────────────────────────────────────────────────────────────────
// LEARNING ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/analytics/learning
learningExperienceRouter.get("/analytics/learning", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const student = await getStudent(req, res);
  if (!student) return;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  const [echo, mastery, goals, focusSessions, assessments, marks, attendance, snapshots] = await Promise.all([
    db.query.echoMemory?.findFirst({ where: (m: any, { eq }: any) => eq(m.studentId, student.id) }),
    db.select().from(masteryRecordsTable).where(eq(masteryRecordsTable.studentId, student.id)),
    db.select().from(learningGoalsTable).where(eq(learningGoalsTable.studentId, student.id)),
    db.select().from(focusSessionsTable)
      .where(and(eq(focusSessionsTable.studentId, student.id), gte(focusSessionsTable.startedAt, thirtyDaysAgo))),
    db.select().from(microAssessmentsTable)
      .where(and(eq(microAssessmentsTable.studentId, student.id), sql`completed_at IS NOT NULL`)).limit(20),
    db.select({ grade: studentMarksTable.marksObtained, totalMarks: studentMarksTable.totalMarks })
      .from(studentMarksTable).where(eq(studentMarksTable.studentId, student.id)).limit(20),
    db.select({ status: attendanceTable.status })
      .from(attendanceTable).where(eq(attendanceTable.studentId, student.id)).limit(100),
    db.select().from(learningAnalyticsSnapshotsTable)
      .where(eq(learningAnalyticsSnapshotsTable.studentId, student.id))
      .orderBy(desc(learningAnalyticsSnapshotsTable.date)).limit(14),
  ]);

  const states = ["not_started", "introduced", "practicing", "developing", "mastered", "expert"];
  const masteryPct = mastery.length > 0
    ? Math.round(mastery.reduce((acc: number, r) => acc + states.indexOf(r.masteryState) / 5 * 100, 0) / mastery.length)
    : 0;

  const completedGoals = goals.filter(g => g.status === "achieved").length;
  const goalRate = goals.length > 0 ? Math.round((completedGoals / goals.length) * 100) : 0;

  const completedSessions = focusSessions.filter((s: any) => s.completedAt);
  const totalStudyMinutes = completedSessions.reduce((acc: number, s: any) => acc + (s.durationMinutes ?? 0), 0);
  const avgProductivity = completedSessions.length > 0
    ? Math.round(completedSessions.reduce((acc: number, s: any) => acc + (s.productivityScore ?? 70), 0) / completedSessions.length)
    : 0;

  const avgGrade = marks.length > 0
    ? Math.round(marks.reduce((acc: number, m: any) => acc + (parseFloat(String(m.grade ?? 0)) / parseFloat(String(m.totalMarks || 100))) * 100, 0) / marks.length)
    : 0;

  const presentCount = attendance.filter((a: any) => a.status === "present").length;
  const attendancePct = attendance.length > 0 ? Math.round((presentCount / attendance.length) * 100) : 0;

  const weakTopics = (echo?.weakTopics as string[]) ?? [];
  const strongTopics = (echo?.strongTopics as string[]) ?? [];

  const masteredTopics = mastery.filter(m => m.masteryState === "mastered" || m.masteryState === "expert");
  const weakMastery = mastery.filter(m => m.masteryState === "not_started" || m.masteryState === "introduced");

  const assessmentAvg = assessments.length > 0
    ? Math.round(assessments.reduce((acc: number, a: any) => acc + parseFloat(String(a.score ?? 0)), 0) / assessments.length)
    : 0;

  const engagementScore = Math.round((masteryPct * 0.3) + (goalRate * 0.2) + (Math.min(100, totalStudyMinutes / 10) * 0.2) + (avgProductivity * 0.15) + (attendancePct * 0.15));
  const predictedGrade = Math.min(100, Math.round((avgGrade * 0.4) + (masteryPct * 0.3) + (assessmentAvg * 0.3)));

  const today = new Date().toISOString().split("T")[0];
  await db.insert(learningAnalyticsSnapshotsTable).values({
    studentId: student.id, date: today,
    metrics: { masteryPct, engagementScore, predictedGrade, revisionHours: Math.round(totalStudyMinutes / 60), completedGoals, streakDays: 0, weakTopicsCount: weakTopics.length, strongTopicsCount: strongTopics.length },
  }).onConflictDoNothing();

  res.json({
    masteryPct, goalRate, completedGoals, totalGoals: goals.length,
    studyHours: Math.round(totalStudyMinutes / 60 * 10) / 10,
    avgProductivity, avgGrade, attendancePct, assessmentAvg,
    engagementScore, predictedGrade,
    weakTopics, strongTopics,
    masteredTopics: masteredTopics.map(m => m.topicName),
    weakMasteryTopics: weakMastery.map(m => m.topicName),
    mastery, snapshots,
    radarData: [
      { subject: "Mastery", score: masteryPct },
      { subject: "Goals", score: goalRate },
      { subject: "Focus", score: avgProductivity },
      { subject: "Attendance", score: attendancePct },
      { subject: "Assessments", score: assessmentAvg },
      { subject: "Grades", score: avgGrade },
    ],
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OFFLINE SYNC
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/offline/pending
learningExperienceRouter.get("/offline/pending", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const student = await getStudent(req, res);
  if (!student) return;

  const items = await db.select().from(offlineContentTable)
    .where(and(eq(offlineContentTable.studentId, student.id), eq(offlineContentTable.status, "pending")))
    .orderBy(desc(offlineContentTable.createdAt)).limit(20);

  res.json({ items, count: items.length });
});

// POST /api/offline/sync
learningExperienceRouter.post("/offline/sync", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const student = await getStudent(req, res);
  if (!student) return;
  const { items } = req.body;
  if (!Array.isArray(items)) { res.status(400).json({ message: "items array required" }); return; }

  const synced = [];
  for (const item of items) {
    const [record] = await db.insert(offlineContentTable).values({
      studentId: student.id, contentType: item.contentType ?? "notes",
      contentData: item.contentData ?? {}, status: "synced", syncedAt: new Date(),
    }).returning();
    synced.push(record);
  }

  res.json({ synced: synced.length, items: synced });
});

// POST /api/offline/queue
learningExperienceRouter.post("/offline/queue", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const student = await getStudent(req, res);
  if (!student) return;
  const { contentType, contentData } = req.body;

  const [item] = await db.insert(offlineContentTable).values({
    studentId: student.id, contentType: contentType ?? "lesson", contentData: contentData ?? {},
  }).returning();
  res.status(201).json(item);
});
