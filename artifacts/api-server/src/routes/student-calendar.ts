import { Router } from "express";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import {
  db, studentsTable, homeworkTable, examsTable, subjectsTable,
  homeworkSubmissionsTable, lessonsTable, echoMemoryTable,
} from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import type { Response } from "express";

const router = Router();

const DAY_INDEX: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};

function expandRecurring(dayOfWeek: string, start: Date, end: Date): string[] {
  const target = DAY_INDEX[dayOfWeek];
  if (target === undefined) return [];
  const dates: string[] = [];
  const cur = new Date(start);
  while (cur.getDay() !== target) cur.setDate(cur.getDate() + 1);
  while (cur <= end) {
    dates.push(cur.toISOString().split("T")[0]);
    cur.setDate(cur.getDate() + 7);
  }
  return dates;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

router.get("/student/calendar", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const [student] = await db.select().from(studentsTable)
    .where(eq(studentsTable.accountId, req.userId!)).limit(1);
  if (!student) { res.status(403).json({ message: "No student record" }); return; }

  const { start, end } = req.query as { start?: string; end?: string };
  const now = new Date();
  const startDate = start ? new Date(start) : new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = end ? new Date(end) : new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const startStr = formatDate(startDate);
  const endStr = formatDate(endDate);

  const teacherId = student.teacherAccountId!;
  const studentId = student.id;

  const events: Array<{
    id: string; type: string; date: string; title: string;
    subtitle: string; color: string; meta: Record<string, unknown>;
  }> = [];

  const [hwRows, examRows, lessonRows, echoMem] = await Promise.all([
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
        eq(homeworkTable.isPublished, true)
      )),

    db.select({
      id: examsTable.id,
      name: examsTable.name,
      examDate: examsTable.examDate,
      subjectName: subjectsTable.name,
    }).from(examsTable)
      .leftJoin(subjectsTable, eq(examsTable.subjectId, subjectsTable.id))
      .where(and(
        eq(examsTable.teacherAccountId, teacherId),
        gte(examsTable.examDate, startStr),
        lte(examsTable.examDate, endStr)
      )),

    db.select({
      id: lessonsTable.id,
      dayOfWeek: lessonsTable.dayOfWeek,
      startTime: lessonsTable.startTime,
      subjectId: lessonsTable.subjectId,
    }).from(lessonsTable)
      .where(eq(lessonsTable.teacherAccountId, teacherId)),

    db.select().from(echoMemoryTable)
      .where(eq(echoMemoryTable.studentId, studentId)).limit(1),
  ]);

  // ── Homework events ───────────────────────────────────────────────────
  for (const hw of hwRows) {
    if (!hw.dueDate) continue;
    const dueStr = typeof hw.dueDate === "string" ? hw.dueDate : (hw.dueDate as Date).toISOString().split("T")[0];
    if (dueStr < startStr || dueStr > endStr) continue;
    events.push({
      id: `hw-${hw.id}`,
      type: "homework",
      date: dueStr,
      title: hw.title,
      subtitle: `${hw.subjectName ?? "Homework"} · ${hw.submissionStatus ?? "pending"}`,
      color: "amber",
      meta: { homeworkId: hw.id, submissionStatus: hw.submissionStatus },
    });
  }

  // ── Exam events ───────────────────────────────────────────────────────
  for (const exam of examRows) {
    if (!exam.examDate) continue;
    const dateStr = typeof exam.examDate === "string" ? exam.examDate : (exam.examDate as Date).toISOString().split("T")[0];
    events.push({
      id: `exam-${exam.id}`,
      type: "exam",
      date: dateStr,
      title: exam.name,
      subtitle: exam.subjectName ?? "Exam",
      color: "purple",
      meta: { examId: exam.id },
    });
  }

  // ── Lesson events (recurring) ─────────────────────────────────────────
  for (const lesson of lessonRows) {
    const dates = expandRecurring(lesson.dayOfWeek, startDate, endDate);
    for (const date of dates) {
      events.push({
        id: `lesson-${lesson.id}-${date}`,
        type: "lesson",
        date,
        title: "Lesson",
        subtitle: lesson.startTime?.slice(0, 5) ?? "",
        color: "blue",
        meta: { lessonId: lesson.id },
      });
    }
  }

  // ── Revision plan slots from echo memory ─────────────────────────────
  // Generate one revision slot per weak topic, spreading across the window
  const weakTopics = (echoMem[0]?.weakTopics as string[]) ?? [];
  const retentionScores = (echoMem[0]?.retentionScores as Record<string, number>) ?? {};

  // Sort weak topics by lowest retention (most critical first)
  const sortedWeak = [...weakTopics].sort((a, b) =>
    (retentionScores[a] ?? 100) - (retentionScores[b] ?? 100)
  );

  const windowDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000));
  sortedWeak.forEach((topic, i) => {
    // Space revision slots evenly across the calendar window, starting day 1
    const dayOffset = Math.min(i * Math.max(1, Math.floor(windowDays / Math.max(sortedWeak.length, 1))), windowDays - 1);
    const revisionDate = addDays(startDate, dayOffset);
    const revDateStr = formatDate(revisionDate);
    if (revDateStr < startStr || revDateStr > endStr) return;

    const retention = retentionScores[topic] ?? 50;
    events.push({
      id: `revision-${i}-${topic.replace(/\s+/g, "_")}`,
      type: "revision",
      date: revDateStr,
      title: `Revise: ${topic}`,
      subtitle: `Retention ${retention}% — scheduled study`,
      color: retention < 40 ? "red" : retention < 70 ? "orange" : "green",
      meta: { topic, retention, source: "echo" },
    });
  });

  events.sort((a, b) => a.date.localeCompare(b.date));
  res.json(events);
});

export default router;
