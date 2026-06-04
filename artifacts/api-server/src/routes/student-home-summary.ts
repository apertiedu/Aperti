import { Router } from "express";
import { eq, and, gte, desc, sql, gt } from "drizzle-orm";
import {
  db, studentsTable, homeworkTable, homeworkSubmissionsTable, examsTable,
  subjectsTable, attendanceTable, echoMemoryTable, ascendProfilesTable,
  focusSessionsTable, studentGoalsTable, studentFeedItemsTable,
  notificationsTable, questsTable,
} from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import type { Response } from "express";

const router = Router();

router.get("/student/home-summary", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const [student] = await db.select().from(studentsTable)
    .where(eq(studentsTable.accountId, req.userId!)).limit(1);
  if (!student) { res.status(403).json({ message: "No student record" }); return; }

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
    upcomingExams,
    recentAttendance,
    focusSessions7d,
    activeGoals,
    feedItems,
    notifications,
    allQuests,
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

    db.select({ status: attendanceTable.status, count: sql<number>`count(*)::int` })
      .from(attendanceTable)
      .where(and(
        eq(attendanceTable.studentId, studentId),
        sql`${attendanceTable.date} >= ${thirtyDaysAgoStr}`
      ))
      .groupBy(attendanceTable.status),

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

    db.select().from(studentGoalsTable)
      .where(and(
        eq(studentGoalsTable.studentId, studentId),
        sql`${studentGoalsTable.completedAt} IS NULL`
      ))
      .orderBy(studentGoalsTable.createdAt)
      .limit(5),

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

    db.select().from(questsTable).limit(5),
  ]);

  const ascend = ascendData[0] ?? null;
  const echo = echoData[0] ?? null;

  const present = recentAttendance.find(r => r.status === "Present")?.count ?? 0;
  const absent = recentAttendance.find(r => r.status === "Absent")?.count ?? 0;
  const attendancePct = present + absent > 0 ? Math.round((present / (present + absent)) * 100) : null;

  const totalFocusMinutes7d = focusSessions7d.reduce((s, f) => s + (f.durationMinutes ?? 0), 0);
  const studyStreakDays = (() => {
    const byDay = new Set(focusSessions7d.map(f =>
      (f.completedAt as Date).toISOString().split("T")[0]
    ));
    let streak = 0;
    const d = new Date(now);
    while (streak < 7) {
      const key = d.toISOString().split("T")[0];
      if (byDay.has(key)) { streak++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return streak;
  })();

  const pendingHomework = upcomingHomework.filter(h =>
    !h.submissionStatus || h.submissionStatus === "pending"
  ).length;

  const weakTopics = (echo?.weakTopics as string[]) ?? [];
  const strongTopics = (echo?.strongTopics as string[]) ?? [];

  const daysUntilNextExam = upcomingExams.length > 0 ? (() => {
    const examDate = new Date(upcomingExams[0].examDate as string);
    return Math.ceil((examDate.getTime() - now.getTime()) / 86400000);
  })() : null;

  const homeworkCompletionRate = upcomingHomework.length > 0
    ? Math.round(
        (upcomingHomework.filter(h => h.submissionStatus === "submitted" || h.submissionStatus === "graded").length
         / upcomingHomework.length) * 100
      )
    : null;

  res.json({
    student: {
      id: studentId,
      name: student.studentName,
      accountId: req.userId,
    },
    ascend: ascend ? {
      xp: ascend.xp,
      level: ascend.level,
      streak: ascend.streak,
      rank: ascend.rank,
      archetype: ascend.archetype,
    } : null,
    echo: echo ? {
      learningPace: echo.learningPace,
      preferredStyle: echo.preferredStyle,
      burnoutRisk: parseFloat(String(echo.burnoutRisk)),
      confidenceScore: parseFloat(String(echo.confidenceScore)),
      weakTopicCount: weakTopics.length,
      strongTopicCount: strongTopics.length,
      topWeakTopics: weakTopics.slice(0, 3),
    } : null,
    stats: {
      attendancePct,
      studyStreakDays,
      totalFocusMinutes7d,
      focusSessions7d: focusSessions7d.length,
      pendingHomework,
      daysUntilNextExam,
      homeworkCompletionRate,
      activeGoalCount: activeGoals.length,
      unreadNotifications: notifications.length + feedItems.length,
    },
    upcomingHomework: upcomingHomework.map(h => ({
      id: h.id,
      title: h.title,
      dueDate: h.dueDate,
      subject: h.subjectName,
      status: h.submissionStatus ?? "pending",
    })),
    upcomingExams: upcomingExams.map(e => ({
      id: e.id,
      name: e.name,
      examDate: e.examDate,
      subject: e.subjectName,
      totalMarks: e.totalMarks,
      timeLimitMinutes: e.timeLimitMinutes,
    })),
    activeGoals: activeGoals.map(g => ({
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
    quests: allQuests.map(q => ({
      id: q.id,
      title: q.title,
      description: q.description,
      type: q.type,
      xpReward: q.xpReward,
    })),
  });
});

export default router;
