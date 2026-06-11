import { Router, type IRouter } from "express";
import { eq, and, gte, desc, sql, ilike } from "drizzle-orm";
import {
  db, studentsTable, attendanceTable, sessionsTable,
  studentMarksTable, examQuestionsTable, examsTable,
  homeworkTable, homeworkSubmissionsTable, resourcesTable, subjectsTable,
  invoicesTable, recordingsTable, questionBankTable,
  pool,
} from "@workspace/db";
import type { Response, NextFunction } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";

const router: IRouter = Router();

async function requireStudentAccess(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  authenticate(req, res, async () => {
    const accountId = req.userId;
    if (!accountId) { res.status(401).json({ message: "Not authenticated" }); return; }
    const [student] = await db.select().from(studentsTable).where(eq(studentsTable.accountId, accountId));
    if (!student) { res.status(403).json({ message: "No student record linked to this account" }); return; }
    (req as any).studentId = student.id;
    (req as any).teacherAccountId = student.teacherAccountId;
    next();
  });
}

// Get student profile + stats
router.get("/portal/me", requireStudentAccess, async (req, res): Promise<void> => {
  
  const studentId: number = (req as any).studentId;
  const teacherId: number = (req as any).teacherAccountId;

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
  
  const studentId: number = (req as any).studentId;

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
  
  const studentId: number = (req as any).studentId;
  const teacherId: number = (req as any).teacherAccountId;

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
  
  const studentId: number = (req as any).studentId;
  const hwId = parseInt(req.params.id as string, 10);
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
  
  const teacherId: number = (req as any).teacherAccountId;

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

// Student invoices
router.get("/portal/invoices", requireStudentAccess, async (req, res): Promise<void> => {
  
  const studentId: number = (req as any).studentId;
  const teacherId: number = (req as any).teacherAccountId;

  const rows = await db.select({
    id: invoicesTable.id,
    title: invoicesTable.title,
    description: invoicesTable.description,
    amount: invoicesTable.amount,
    currency: invoicesTable.currency,
    status: invoicesTable.status,
    dueDate: invoicesTable.dueDate,
    paidAt: invoicesTable.paidAt,
    notes: invoicesTable.notes,
    createdAt: invoicesTable.createdAt,
  }).from(invoicesTable)
    .where(
      and(
        eq(invoicesTable.teacherAccountId, teacherId),
        eq(invoicesTable.studentId, studentId)
      )
    )
    .orderBy(desc(invoicesTable.createdAt));

  res.json(rows);
});

// Student recordings
router.get("/portal/recordings", requireStudentAccess, async (req, res): Promise<void> => {
  
  const teacherId: number = (req as any).teacherAccountId;

  const rows = await db.select({
    id: recordingsTable.id,
    title: recordingsTable.title,
    description: recordingsTable.description,
    url: recordingsTable.url,
    passcode: recordingsTable.passcode,
    platform: recordingsTable.platform,
    accessType: recordingsTable.accessType,
    duration: recordingsTable.duration,
    recordedAt: recordingsTable.recordedAt,
    createdAt: recordingsTable.createdAt,
    viewCount: recordingsTable.viewCount,
    subjectName: subjectsTable.name,
  }).from(recordingsTable)
    .leftJoin(subjectsTable, eq(recordingsTable.subjectId, subjectsTable.id))
    .where(
      and(
        eq(recordingsTable.teacherAccountId, teacherId),
        eq(recordingsTable.isPublished, true)
      )
    )
    .orderBy(desc(recordingsTable.createdAt));

  res.json(rows);
});

// Student exam results
router.get("/portal/exams", requireStudentAccess, async (req, res): Promise<void> => {
  
  const studentId: number = (req as any).studentId;

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

// ── PORTAL: FLASHCARDS (student spaced repetition) ───────────────────────────

router.get("/portal/flashcards/stats", requireStudentAccess, async (req, res): Promise<void> => {
  
  const studentId: number = (req as any).studentId;
  const teacherId: number = (req as any).teacherAccountId;
  try {
    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM flashcards WHERE teacher_account_id=$1)::int AS total,
        (SELECT COUNT(*) FROM flashcard_progress fp
         JOIN flashcards f ON f.id=fp.flashcard_id
         WHERE fp.student_id=$2 AND f.teacher_account_id=$1 AND fp.reps >= 5)::int AS mastered,
        (SELECT COUNT(*) FROM flashcards f
         LEFT JOIN flashcard_progress fp ON fp.flashcard_id=f.id AND fp.student_id=$2
         WHERE f.teacher_account_id=$1
           AND (fp.next_review_at IS NULL OR fp.next_review_at <= NOW()))::int AS due
    `, [teacherId, studentId]);
    res.json({ total: rows[0]?.total ?? 0, mastered: rows[0]?.mastered ?? 0, due: rows[0]?.due ?? 0, streakDays: 0 });
  } catch {
    res.json({ total: 0, mastered: 0, due: 0, streakDays: 0 });
  }
});

router.get("/portal/flashcards/decks", requireStudentAccess, async (req, res): Promise<void> => {
  
  const teacherId: number = (req as any).teacherAccountId;
  try {
    const { rows } = await pool.query(`
      SELECT deck_name, COUNT(*)::int AS card_count
      FROM flashcards WHERE teacher_account_id=$1
      GROUP BY deck_name ORDER BY deck_name
    `, [teacherId]);
    res.json(rows);
  } catch {
    res.json([]);
  }
});

router.get("/portal/flashcards/review", requireStudentAccess, async (req, res): Promise<void> => {
  
  const studentId: number = (req as any).studentId;
  const teacherId: number = (req as any).teacherAccountId;
  const { deck } = req.query as Record<string, string>;
  const deckCond = deck ? `AND f.deck_name = $3` : "";
  const params: unknown[] = [studentId, teacherId];
  if (deck) params.push(deck);
  try {
    const { rows } = await pool.query(`
      SELECT f.*, COALESCE(fp.ease_factor, 2.5) AS ease_factor,
        COALESCE(fp.interval_days, 1) AS interval_days,
        COALESCE(fp.reps, 0) AS reps,
        fp.next_review_at, fp.last_quality
      FROM flashcards f
      LEFT JOIN flashcard_progress fp ON fp.flashcard_id = f.id AND fp.student_id = $1
      WHERE f.teacher_account_id = $2 ${deckCond}
        AND (fp.next_review_at IS NULL OR fp.next_review_at <= NOW())
      ORDER BY fp.next_review_at ASC NULLS FIRST LIMIT 20
    `, params);
    res.json(rows);
  } catch {
    res.json([]);
  }
});

router.post("/portal/flashcards/:id/review", requireStudentAccess, async (req, res): Promise<void> => {
  
  const studentId: number = (req as any).studentId;
  const flashcardId = parseInt(req.params.id as string, 10);
  const { quality } = req.body as { quality: number };
  if (quality === undefined || quality < 0 || quality > 5) { res.status(400).json({ message: "quality 0-5 required" }); return; }
  const { rows: existing } = await pool.query(
    `SELECT * FROM flashcard_progress WHERE student_id=$1 AND flashcard_id=$2`, [studentId, flashcardId]
  );
  let ef = parseFloat(existing[0]?.ease_factor ?? "2.5");
  let interval = parseInt(existing[0]?.interval_days ?? "1", 10);
  let reps = parseInt(existing[0]?.reps ?? "0", 10);
  if (quality >= 3) {
    if (reps === 0) interval = 1;
    else if (reps === 1) interval = 6;
    else interval = Math.round(interval * ef);
    reps++;
  } else { reps = 0; interval = 1; }
  ef = Math.max(1.3, ef + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  const nextReview = new Date(Date.now() + interval * 86400 * 1000);
  await pool.query(`
    INSERT INTO flashcard_progress (student_id, flashcard_id, ease_factor, interval_days, reps, last_quality, next_review_at, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
    ON CONFLICT (student_id, flashcard_id) DO UPDATE SET
      ease_factor=EXCLUDED.ease_factor, interval_days=EXCLUDED.interval_days,
      reps=EXCLUDED.reps, last_quality=EXCLUDED.last_quality,
      next_review_at=EXCLUDED.next_review_at, updated_at=NOW()
  `, [studentId, flashcardId, ef.toFixed(2), interval, reps, quality, nextReview.toISOString()]);
  res.json({ nextReview, interval, easeFactor: ef.toFixed(2), reps });
});

// ── PORTAL: PRACTICE QUESTIONS (question bank filtered by teacher) ────────────

router.get("/portal/practice-questions", requireStudentAccess, async (req, res): Promise<void> => {
  
  const teacherId: number = (req as any).teacherAccountId;
  const { topic, difficulty } = req.query as Record<string, string>;

  const conditions: ReturnType<typeof eq>[] = [eq(questionBankTable.teacherAccountId, teacherId)];
  if (topic) conditions.push(ilike(questionBankTable.topic!, `%${topic}%`) as any);
  if (difficulty) conditions.push(eq(questionBankTable.difficulty, difficulty) as any);

  const rows = await db.select({
    id: questionBankTable.id,
    questionText: questionBankTable.questionText,
    topic: questionBankTable.topic,
    subtopic: questionBankTable.subtopic,
    difficulty: questionBankTable.difficulty,
    maxMarks: questionBankTable.maxMarks,
    modelAnswer: questionBankTable.modelAnswer,
    subjectName: subjectsTable.name,
  }).from(questionBankTable)
    .leftJoin(subjectsTable, eq(questionBankTable.subjectId, subjectsTable.id))
    .where(and(...conditions))
    .orderBy(questionBankTable.topic, questionBankTable.difficulty);

  res.json(rows);
});

/* ── SUCCESS CENTER ──────────────────────────────────────────────────────────── */
router.get("/portal/success", requireStudentAccess, async (req, res): Promise<void> => {
  const studentId: number = (req as any).studentId;
  const teacherId: number = (req as any).teacherAccountId;

  try {
    const [weakTopicsR, upcomingTasksR, revisionR, mistakesR, overallR] = await Promise.allSettled([

      /* Weak topics from misconceptions */
      pool.query(`
        SELECT DISTINCT m.pattern AS topic, m.description, m.severity,
          s.name AS subject_name, s.id AS subject_id
        FROM misconceptions m
        JOIN student_exam_attempts sea ON sea.id = m.attempt_id
        JOIN exams e ON e.id = sea.exam_id
        JOIN subjects s ON s.id = e.subject_id
        WHERE sea.student_id = $1 AND m.resolved = false
        ORDER BY CASE m.severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
        LIMIT 8
      `, [studentId]).catch(() => ({ rows: [] })),

      /* Upcoming homework / exam tasks */
      pool.query(`
        (SELECT h.id, h.title, h.due_date AS "dueDate", s.name AS "subjectName", 'homework' AS type
         FROM homework h
         JOIN sessions sess ON sess.id = h.session_id
         JOIN subjects s ON s.id = sess.subject_id
         JOIN student_session_links ssl ON ssl.session_id = sess.id AND ssl.student_id = $1
         WHERE h.due_date >= CURRENT_DATE
         ORDER BY h.due_date ASC LIMIT 5)
        UNION ALL
        (SELECT e.id, e.name AS title, e.exam_date::text AS "dueDate", s.name AS "subjectName", 'exam' AS type
         FROM exams e
         JOIN subjects s ON s.id = e.subject_id
         WHERE s.teacher_account_id = $2 AND e.exam_date >= CURRENT_DATE
         ORDER BY e.exam_date ASC LIMIT 3)
        ORDER BY "dueDate" ASC LIMIT 8
      `, [studentId, teacherId]).catch(() => ({ rows: [] })),

      /* Recommended revision notes */
      pool.query(`
        SELECT rn.id, rn.title, s.name AS "subjectName",
          '/revision/' || rn.id AS href
        FROM revision_notes rn
        JOIN subjects s ON s.id = rn.subject_id
        WHERE s.teacher_account_id = $1 AND rn.published = true
        ORDER BY rn.updated_at DESC LIMIT 6
      `, [teacherId]).catch(() => ({ rows: [] })),

      /* Recent wrong answers */
      pool.query(`
        SELECT DISTINCT ON (qa.question_id)
          qa.question_id, q.question_text AS "questionText",
          q.topic, s.name AS "subjectName", e.name AS "examName"
        FROM question_answers qa
        JOIN student_exam_attempts sea ON sea.id = qa.attempt_id
        JOIN questions q ON q.id = qa.question_id
        LEFT JOIN exams e ON e.id = sea.exam_id
        LEFT JOIN subjects s ON s.id = e.subject_id
        WHERE sea.student_id = $1 AND qa.marks_awarded < qa.marks_available * 0.5
        ORDER BY qa.question_id, sea.submitted_at DESC
        LIMIT 4
      `, [studentId]).catch(() => ({ rows: [] })),

      /* Overall progress */
      pool.query(`
        SELECT
          COUNT(DISTINCT sea.id) AS total_attempts,
          ROUND(AVG(sea.score_percentage)::numeric, 1) AS avg_score,
          COUNT(DISTINCT CASE WHEN sea.score_percentage >= 60 THEN sea.id END) AS passing_exams
        FROM student_exam_attempts sea
        WHERE sea.student_id = $1
      `, [studentId]).catch(() => ({ rows: [{}] })),
    ]);

    res.json({
      weakTopics:          weakTopicsR.status === "fulfilled" ? weakTopicsR.value.rows : [],
      upcomingTasks:       upcomingTasksR.status === "fulfilled" ? upcomingTasksR.value.rows : [],
      recommendedRevision: revisionR.status === "fulfilled" ? revisionR.value.rows : [],
      recentMistakes:      mistakesR.status === "fulfilled" ? mistakesR.value.rows : [],
      overallProgress:     overallR.status === "fulfilled" ? overallR.value.rows[0] : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
