import { Router } from "express";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import {
  db, studentsTable, homeworkTable, homeworkSubmissionsTable,
  subjectsTable, resourcesTable, notificationsTable, echoMemoryTable,
  lessonsTable,
} from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";

const studentGuard = [authenticate, requireRole("student")];
import type { Response } from "express";

const router = Router();

async function requireStudent(req: AuthRequest, res: Response): Promise<{ studentId: number; teacherId: number } | null> {
  const accountId = req.userId!;
  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.accountId, accountId));
  if (!student) { res.status(403).json({ message: "No student record" }); return null; }
  return { studentId: student.id, teacherId: student.teacherAccountId! };
}

router.get("/student/feed", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const ctx = await requireStudent(req, res);
  if (!ctx) return;
  const { studentId, teacherId } = ctx;

  const now = new Date();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);

  const feedItems: Array<{
    type: string; title: string; subtitle: string;
    priority: number; createdAt: string; actionUrl: string; icon: string;
  }> = [];

  const [hwRows, resourceRows, notifRows, echoMem, lessonRows] = await Promise.all([
    db.select({
      id: homeworkTable.id,
      title: homeworkTable.title,
      dueDate: homeworkTable.dueDate,
      subjectName: subjectsTable.name,
      submissionStatus: homeworkSubmissionsTable.status,
      createdAt: homeworkTable.createdAt,
    }).from(homeworkTable)
      .leftJoin(subjectsTable, eq(homeworkTable.subjectId, subjectsTable.id))
      .leftJoin(homeworkSubmissionsTable, and(
        eq(homeworkSubmissionsTable.homeworkId, homeworkTable.id),
        eq(homeworkSubmissionsTable.studentId, studentId)
      ))
      .where(and(eq(homeworkTable.teacherAccountId, teacherId), eq(homeworkTable.isPublished, true)))
      .orderBy(homeworkTable.dueDate)
      .limit(20),

    db.select({
      id: resourcesTable.id,
      title: resourcesTable.title,
      type: resourcesTable.type,
      createdAt: resourcesTable.createdAt,
    }).from(resourcesTable)
      .where(and(
        eq(resourcesTable.teacherAccountId, teacherId),
        eq(resourcesTable.isStudentVisible, true),
        gte(resourcesTable.createdAt, twoWeeksAgo)
      ))
      .orderBy(desc(resourcesTable.createdAt))
      .limit(5),

    db.select({
      id: notificationsTable.id,
      title: notificationsTable.title,
      message: notificationsTable.message,
      createdAt: notificationsTable.createdAt,
      isRead: notificationsTable.isRead,
    }).from(notificationsTable)
      .where(and(eq(notificationsTable.accountId, req.userId!), eq(notificationsTable.isRead, false)))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(5),

    db.select().from(echoMemoryTable).where(eq(echoMemoryTable.studentId, studentId)).limit(1),

    db.select({
      id: lessonsTable.id,
      dayOfWeek: lessonsTable.dayOfWeek,
      startTime: lessonsTable.startTime,
      createdAt: lessonsTable.createdAt,
    }).from(lessonsTable)
      .where(and(
        eq(lessonsTable.teacherAccountId, teacherId),
        gte(lessonsTable.createdAt, twoWeeksAgo)
      ))
      .orderBy(desc(lessonsTable.createdAt))
      .limit(5),
  ]);

  const weakTopics = (echoMem[0]?.weakTopics as string[]) ?? [];
  const retentionScores = (echoMem[0]?.retentionScores as Record<string, number>) ?? {};

  // ── Homework items: urgency×weakness÷hours_until_due scoring ───────────
  for (const hw of hwRows) {
    if (!hw.dueDate || hw.submissionStatus === "graded") continue;

    const due = new Date(hw.dueDate);
    const hoursUntilDue = (due.getTime() - now.getTime()) / 3600000;
    const isPastDue = hoursUntilDue < 0;
    const hoursEffective = Math.max(0.5, Math.abs(hoursUntilDue));

    // Urgency: higher when closer to due, max 10
    const urgencyWeight = isPastDue ? 10 : Math.min(10, 24 * 7 / hoursEffective);

    // Weakness weight: if homework subject overlaps with weak topics, boost
    const subjectName = hw.subjectName ?? "";
    const weaknessWeight = weakTopics.some(t =>
      subjectName.toLowerCase().includes(t.toLowerCase()) ||
      hw.title.toLowerCase().includes(t.toLowerCase())
    ) ? 2.0 : 1.0;

    const priority = Math.min(100, Math.max(0, (urgencyWeight * weaknessWeight) / (hoursEffective / 24) * 3));

    feedItems.push({
      type: isPastDue ? "overdue_homework" : "homework",
      title: hw.title,
      subtitle: `${hw.subjectName ?? "Homework"} · Due ${hw.dueDate}`,
      priority,
      createdAt: (hw.createdAt as Date).toISOString(),
      actionUrl: `/portal/homework/${hw.id}`,
      icon: isPastDue ? "alert-circle" : "clipboard",
    });
  }

  // ── Announcements (unread notifications) ──────────────────────────────
  for (const notif of notifRows) {
    feedItems.push({
      type: "announcement",
      title: notif.title,
      subtitle: notif.message ?? "",
      priority: 60,
      createdAt: (notif.createdAt as Date).toISOString(),
      actionUrl: "/portal/notifications",
      icon: "bell",
    });
  }

  // ── New resources ─────────────────────────────────────────────────────
  for (const r of resourceRows) {
    feedItems.push({
      type: "resource",
      title: r.title,
      subtitle: `New ${r.type ?? "resource"} added`,
      priority: 20,
      createdAt: (r.createdAt as Date).toISOString(),
      actionUrl: `/portal/resources/${r.id}`,
      icon: "book-open",
    });
  }

  // ── New lessons (last 14 days) ────────────────────────────────────────
  for (const lesson of lessonRows) {
    feedItems.push({
      type: "new_lesson",
      title: `New Lesson: ${lesson.dayOfWeek} at ${lesson.startTime?.slice(0, 5) ?? ""}`,
      subtitle: "A new lesson session has been added",
      priority: 35,
      createdAt: (lesson.createdAt as Date).toISOString(),
      actionUrl: `/portal/timetable`,
      icon: "calendar",
    });
  }

  // ── Echo revision recommendations ─────────────────────────────────────
  for (const topic of weakTopics.slice(0, 3)) {
    const retention = retentionScores[topic] ?? 40;
    // Higher priority for lower retention
    const weaknessPriority = Math.max(30, 90 - retention);

    feedItems.push({
      type: "revision_recommendation",
      title: `Revise: ${topic}`,
      subtitle: `Retention ${retention}% — needs practice`,
      priority: weaknessPriority,
      createdAt: now.toISOString(),
      actionUrl: `/portal/revisit?topic=${encodeURIComponent(topic)}`,
      icon: "brain",
    });
  }

  feedItems.sort((a, b) => b.priority - a.priority);

  // Cursor-based pagination: cursor is the index of the last seen item
  const cursorParam = req.query.cursor as string | undefined;
  const limitParam = parseInt((req.query.limit as string) ?? "20", 10);
  const startIdx = cursorParam ? parseInt(cursorParam, 10) : 0;
  const paginated = feedItems.slice(startIdx, startIdx + limitParam);
  const nextCursor = startIdx + paginated.length < feedItems.length
    ? String(startIdx + paginated.length)
    : null;

  res.json({ items: paginated, nextCursor, total: feedItems.length });
});

export default router;
