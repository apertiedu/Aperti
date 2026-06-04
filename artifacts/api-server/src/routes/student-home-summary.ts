import { Router } from "express";
import { eq, and, gte, lte, desc, lt, sql } from "drizzle-orm";
import {
  db, studentsTable, accountsTable, homeworkTable, homeworkSubmissionsTable,
  examsTable, subjectsTable, attendanceTable, echoMemoryTable,
  ascendProfilesTable, focusSessionsTable, studentGoalsTable,
  studentFeedItemsTable, notificationsTable, questsTable,
  studentMarksTable, examQuestionsTable,
} from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import type { Response } from "express";

const router = Router();
const studentGuard = [authenticate, requireRole("student")];

router.get("/student/home-summary", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const [student] = await db.select().from(studentsTable)
    .where(eq(studentsTable.accountId, req.userId!)).limit(1);
  if (!student) { res.status(403).json({ message: "No student record" }); return; }

  const [account] = await db.select({ displayName: accountsTable.displayName, firstName: accountsTable.firstName })
    .from(accountsTable).where(eq(accountsTable.id, req.userId!)).limit(1);

  const studentId = student.id;
  const teacherId = student.teacherAccountId!;
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

  const [
    ascendData,
    echoData,
    upcomingHomework,
    overdueHomework,
    upcomingExams,
    recentAttendance,
    focusSessions7d,
    focusSessionsToday,
    todayGoals,
    todayCompletedGoals,
    activeGoals,
    feedItems,
    notifications,
    recentMarks,
  ] = await Promise.all([
    db.select().from(ascendProfilesTable)
      .where(eq(ascendProfilesTable.studentAccountId, req.userId!)).limit(1),

    db.select().from(echoMemoryTable)
      .where(eq(echoMemoryTable.studentId, studentId)).limit(1),

    db.select({
      id: homeworkTable.id,
      title: homeworkTable.title,
      dueDate: homeworkTable.dueDate,
      subjectName: subjectsTable.name,
      submissionStatus: homeworkSubmissionsTable.status,
    }).from(homeworkTable)
      .leftJoin(subjectsTable, eq(homeworkTable.subjectId, subjectsTable.id))
      .leftJoin(homeworkSubmissionsTable, and(
        eq(homeworkSubmissionsTable.homeworkId, homeworkTable.id),
        eq(homeworkSubmissionsTable.studentId, studentId)
      ))
      .where(and(
        eq(homeworkTable.teacherAccountId, teacherId),
        eq(homeworkTable.isPublished, true),
        gte(homeworkTable.dueDate, todayStr)
      ))
      .orderBy(homeworkTable.dueDate)
      .limit(5),

    db.select({
      id: homeworkTable.id,
      title: homeworkTable.title,
      dueDate: homeworkTable.dueDate,
      subjectName: subjectsTable.name,
      submissionStatus: homeworkSubmissionsTable.status,
    }).from(homeworkTable)
      .leftJoin(subjectsTable, eq(homeworkTable.subjectId, subjectsTable.id))
      .leftJoin(homeworkSubmissionsTable, and(
        eq(homeworkSubmissionsTable.homeworkId, homeworkTable.id),
        eq(homeworkSubmissionsTable.studentId, studentId)
      ))
      .where(and(
        eq(homeworkTable.teacherAccountId, teacherId),
        eq(homeworkTable.isPublished, true),
        lt(homeworkTable.dueDate, todayStr),
        sql`(${homeworkSubmissionsTable.status} IS NULL OR ${homeworkSubmissionsTable.status} = 'pending')`
      ))
      .orderBy(desc(homeworkTable.dueDate))
      .limit(3),

    db.select({
      id: examsTable.id,
      name: examsTable.name,
      examDate: examsTable.examDate,
      subjectName: subjectsTable.name,
      totalMarks: examsTable.totalMarks,
      timeLimitMinutes: examsTable.timeLimitMinutes,
    }).from(examsTable)
      .leftJoin(subjectsTable, eq(examsTable.subjectId, subjectsTable.id))
      .where(and(
        eq(examsTable.teacherAccountId, teacherId),
        gte(examsTable.examDate, todayStr)
      ))
      .orderBy(examsTable.examDate)
      .limit(3),

    db.select({ status: attendanceTable.status, date: attendanceTable.date })
      .from(attendanceTable)
      .where(and(
        eq(attendanceTable.studentId, studentId),
        sql`${attendanceTable.date} >= ${thirtyDaysAgoStr}`
      ))
      .orderBy(desc(attendanceTable.date)),

    db.select({
      durationMinutes: focusSessionsTable.durationMinutes,
      completedAt: focusSessionsTable.completedAt,
      xpEarned: focusSessionsTable.xpEarned,
    }).from(focusSessionsTable)
      .where(and(
        eq(focusSessionsTable.studentId, studentId),
        gte(focusSessionsTable.completedAt, sevenDaysAgo)
      ))
      .orderBy(desc(focusSessionsTable.completedAt)),

    db.select({ xpEarned: focusSessionsTable.xpEarned })
      .from(focusSessionsTable)
      .where(and(
        eq(focusSessionsTable.studentId, studentId),
        sql`DATE(${focusSessionsTable.completedAt}) = ${todayStr}`
      )),

    db.select({ id: studentGoalsTable.id, completedAt: studentGoalsTable.completedAt })
      .from(studentGoalsTable)
      .where(and(
        eq(studentGoalsTable.studentId, studentId),
        sql`(${studentGoalsTable.targetDate} = ${todayStr} OR ${studentGoalsTable.type} = 'daily')`
      ))
      .limit(50),

    db.select({ id: studentGoalsTable.id })
      .from(studentGoalsTable)
      .where(and(
        eq(studentGoalsTable.studentId, studentId),
        sql`DATE(${studentGoalsTable.completedAt}) = ${todayStr}`
      )),

    db.select().from(studentGoalsTable)
      .where(and(
        eq(studentGoalsTable.studentId, studentId),
        sql`${studentGoalsTable.completedAt} IS NULL`
      ))
      .orderBy(studentGoalsTable.createdAt)
      .limit(10),

    db.select().from(studentFeedItemsTable)
      .where(and(
        eq(studentFeedItemsTable.studentId, studentId),
        eq(studentFeedItemsTable.isRead, false)
      ))
      .orderBy(desc(studentFeedItemsTable.priority), desc(studentFeedItemsTable.createdAt))
      .limit(8),

    db.select({
      id: notificationsTable.id,
      title: notificationsTable.title,
      message: notificationsTable.message,
      type: notificationsTable.type,
      isRead: notificationsTable.isRead,
      createdAt: notificationsTable.createdAt,
    }).from(notificationsTable)
      .where(and(
        eq(notificationsTable.accountId, req.userId!),
        eq(notificationsTable.isRead, false)
      ))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(10),

    db.select({
      scored: sql<number>`sum(${studentMarksTable.marksScored})::numeric`,
      max: sql<number>`sum(${examQuestionsTable.maxMarks})::numeric`,
      examId: studentMarksTable.examId,
    }).from(studentMarksTable)
      .innerJoin(examQuestionsTable, eq(studentMarksTable.questionId, examQuestionsTable.id))
      .where(eq(studentMarksTable.studentId, studentId))
      .groupBy(studentMarksTable.examId)
      .orderBy(desc(studentMarksTable.examId))
      .limit(10),
  ]);

  const ascend = ascendData[0] ?? null;
  const echo = echoData[0] ?? null;

  // ── Greeting ────────────────────────────────────────────────────────────────
  const hour = now.getHours();
  const timeGreeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = account?.firstName
    ?? account?.displayName?.split(" ")[0]
    ?? student.studentName.split(" ")[0];
  const greeting = `${timeGreeting}, ${firstName}!`;

  // ── Today's goal progress (scoped to today's goals only) ─────────────────────
  const todayTotalGoals = todayGoals.length;
  const todayCompletedCount = todayCompletedGoals.length;
  const goalProgressPct = todayTotalGoals > 0
    ? Math.round((todayCompletedCount / todayTotalGoals) * 100)
    : 0;

  // ── XP earned today ─────────────────────────────────────────────────────────
  const xpEarnedToday = focusSessionsToday.reduce((s, f) => s + (f.xpEarned ?? 0), 0);

  // ── Streak: consecutive days with focus session OR attendance present ─────────
  // Build sets of "active days" from both sources
  const focusDays = new Set(focusSessions7d.map(f =>
    (f.completedAt as Date).toISOString().split("T")[0]
  ));
  const presentDays = new Set(
    recentAttendance.filter(a => a.status === "Present").map(a => a.date as string)
  );
  const activeDays = new Set([...focusDays, ...presentDays]);

  let streak = 0;
  const streakCursor = new Date(now);
  while (streak < 30) {
    const key = streakCursor.toISOString().split("T")[0];
    if (activeDays.has(key)) {
      streak++;
      streakCursor.setDate(streakCursor.getDate() - 1);
    } else {
      break;
    }
  }

  // ── Attendance summary ──────────────────────────────────────────────────────
  const present = recentAttendance.filter(a => a.status === "Present").length;
  const absent = recentAttendance.filter(a => a.status === "Absent").length;
  const attendancePct = present + absent > 0
    ? Math.round((present / (present + absent)) * 100)
    : null;

  // ── Nearest exam countdown ──────────────────────────────────────────────────
  const nextExam = upcomingExams[0] ?? null;
  const daysUntilExam = nextExam ? Math.max(0, Math.ceil(
    (new Date(nextExam.examDate as string).getTime() - now.getTime()) / 86400000
  )) : null;

  // ── Homework completion rate ─────────────────────────────────────────────────
  const hwSubmitted = upcomingHomework.filter(h =>
    h.submissionStatus === "submitted" || h.submissionStatus === "graded"
  ).length;
  const hwCompletionRate = upcomingHomework.length > 0
    ? Math.round((hwSubmitted / upcomingHomework.length) * 100)
    : null;

  // ── Average grade from recent marks ─────────────────────────────────────────
  const gradedExams = recentMarks.filter(m => m.max > 0);
  const avgGrade = gradedExams.length > 0
    ? Math.round(gradedExams.reduce((s, m) => s + Math.round((m.scored / m.max) * 100), 0) / gradedExams.length)
    : null;

  const confidenceScore = echo ? parseFloat(String(echo.confidenceScore ?? 0)) : 0;
  const targetGrade = avgGrade !== null
    ? Math.min(100, avgGrade + Math.round(5 + (confidenceScore / 10)))
    : 80;

  const recentQuizAvg = avgGrade ?? 0;
  const readinessScore = Math.round(
    ((attendancePct ?? 0) * 0.3) + ((hwCompletionRate ?? 0) * 0.3) + (recentQuizAvg * 0.4)
  );

  // ── Daily mission: top weak topic + nearest OVERDUE homework ───────────────
  const weakTopics = (echo?.weakTopics as string[]) ?? [];
  const retentionScores = (echo?.retentionScores as Record<string, number>) ?? {};
  const topWeakTopic = weakTopics.length > 0
    ? [...weakTopics].sort((a, b) =>
        (retentionScores[a] ?? 100) - (retentionScores[b] ?? 100)
      )[0]
    : null;

  // First overdue, unsubmitted homework
  const mostOverdueHw = overdueHomework[0] ?? null;

  const dailyMission: { type: string; title: string; description: string; xpReward: number } | null =
    topWeakTopic
      ? {
          type: "revision",
          title: `Revise: ${topWeakTopic}`,
          description: `Your retention for "${topWeakTopic}" is low. Spend 20 minutes reviewing this topic.`,
          xpReward: 50,
        }
      : mostOverdueHw
        ? {
            type: "homework",
            title: `Overdue: ${mostOverdueHw.title}`,
            description: `Due ${mostOverdueHw.dueDate} — this assignment is overdue. Submit it as soon as possible.`,
            xpReward: 75,
          }
        : null;

  // ── AI insight (deterministic from echo data) ─────────────────────────────
  let aiInsight: string | null = null;
  if (echo) {
    const burnout = parseFloat(String(echo.burnoutRisk ?? 0));
    if (burnout > 70) {
      aiInsight = "Your study intensity has been high lately — consider a lighter revision session today and ensure you're getting enough rest before your next exam.";
    } else if (weakTopics.length > 3) {
      aiInsight = `You have ${weakTopics.length} flagged weak areas. Even 15 minutes of targeted revision per topic significantly boosts retention over time.`;
    } else if (streak >= 3) {
      aiInsight = `${streak}-day streak! Consistency is your strongest asset — keep the momentum with a quick flashcard review today.`;
    } else if (daysUntilExam !== null && daysUntilExam <= 7) {
      aiInsight = `${nextExam?.name} is in ${daysUntilExam} day${daysUntilExam === 1 ? "" : "s"}. Prioritise past-paper practice and a TrialVault mock today.`;
    } else {
      aiInsight = `Your learning pace is ${echo.learningPace}. Daily focus sessions are the most reliable way to maintain and build on your current performance.`;
    }
  }

  res.json({
    greeting,
    student: {
      id: studentId,
      name: student.studentName,
      firstName,
      accountId: req.userId,
    },
    todayProgress: {
      goalProgressPct,
      completedGoals: todayCompletedCount,
      totalGoals: todayTotalGoals,
      xpEarnedToday,
    },
    ascend: ascend ? {
      xp: ascend.xp,
      level: ascend.level,
      streak: ascend.streak,
      rank: ascend.rank,
      archetype: ascend.archetype,
    } : null,
    streakDays: streak,
    nextExam: nextExam ? {
      id: nextExam.id,
      name: nextExam.name,
      examDate: nextExam.examDate,
      subject: nextExam.subjectName,
      daysUntil: daysUntilExam,
    } : null,
    dailyMission,
    aiInsight,
    academicSnapshot: {
      avgGrade,
      targetGrade,
      readinessScore,
      attendancePct,
      hwCompletionRate,
    },
    upcomingHomework: upcomingHomework.map(h => ({
      id: h.id,
      title: h.title,
      dueDate: h.dueDate,
      subject: h.subjectName,
      status: h.submissionStatus ?? "pending",
    })),
    overdueHomework: overdueHomework.map(h => ({
      id: h.id,
      title: h.title,
      dueDate: h.dueDate,
      subject: h.subjectName,
    })),
    activeGoals: activeGoals.slice(0, 5).map(g => ({
      id: g.id,
      title: g.title,
      type: g.type,
      targetDate: g.targetDate,
      xpReward: g.xpReward,
    })),
    feedItems: feedItems.map(f => ({
      id: f.id,
      type: f.type,
      title: f.title,
      subtitle: f.subtitle,
      actionUrl: f.actionUrl,
      icon: f.icon,
    })),
    notifications: notifications.map(n => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      createdAt: n.createdAt,
    })),
    unreadCount: notifications.length + feedItems.length,
  });
});

export default router;
