import { Router, Response } from "express";
import { db, pool } from "@workspace/db";
import { authenticate, AuthRequest, requireRole } from "../middleware/auth";
import { homeworkTable, homeworkSubmissionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { sendPushToRole, sendPushToUser } from "../lib/push";

export const homeworkRouter = Router();

homeworkRouter.get("/teacher", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const list = await db.query.homework.findMany({
    where: (h, { eq }) => eq(h.teacherAccountId, teacherId),
    orderBy: (h, { desc }) => [desc(h.createdAt)],
    limit: 200,
  });
  res.json(list);
});

homeworkRouter.post("/", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const { subjectId, title, description, instructions, dueDate, totalMarks, allowLate, classFilter } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: "title is required" });
  try {
    if (subjectId) {
      const { rows } = await pool.query(
        "SELECT id FROM subjects WHERE id=$1 AND teacher_account_id=$2 LIMIT 1",
        [subjectId, teacherId],
      );
      if (!rows.length) return res.status(403).json({ error: "You do not own this subject" });
    }
    const [hw] = await db.insert(homeworkTable).values({
      teacherAccountId: teacherId,
      subjectId: subjectId || null,
      title, description, instructions, dueDate,
      totalMarks: totalMarks != null ? totalMarks.toString() : null,
      allowLate: allowLate ?? false,
      classFilter: classFilter || null,
      isPublished: true,
    }).returning();
    sendPushToRole("student", {
      title: "New Assignment Posted",
      body: title ? `"${title}" has been assigned.` : "A new homework assignment has been posted.",
      url: "/my-homework",
    }).catch(() => {});
    res.status(201).json(hw);
  } catch (err: any) {
    const msg = /duplicate|unique|constraint/i.test(err.message)
      ? "A homework entry with this title already exists"
      : "Invalid homework data";
    res.status(400).json({ error: msg });
  }
});

homeworkRouter.put("/:id", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const id = parseInt(req.params.id);
  const existing = await db.query.homework.findFirst({ where: (h, { eq, and }) => and(eq(h.id, id), eq(h.teacherAccountId, teacherId)) });
  if (!existing) return res.status(404).json({ error: "Not found" });
  await db.update(homeworkTable).set(req.body).where(eq(homeworkTable.id, id));
  res.json({ success: true });
});

homeworkRouter.delete("/:id", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const id = parseInt(req.params.id);
  await db.delete(homeworkTable).where(and(eq(homeworkTable.id, id), eq(homeworkTable.teacherAccountId, teacherId)));
  res.json({ success: true });
});

homeworkRouter.get("/:id/submissions", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const homeworkId = parseInt(req.params.id);
  if (isNaN(homeworkId)) return res.status(400).json({ error: "Invalid homework ID" });

  const owned = await db.query.homework.findFirst({
    where: (h, { eq, and }) => and(eq(h.id, homeworkId), eq(h.teacherAccountId, teacherId)),
  });
  if (!owned) return res.status(403).json({ error: "Access denied" });

  const subs = await db.query.homeworkSubmissions.findMany({
    where: (s, { eq }) => eq(s.homeworkId, homeworkId),
    with: { student: true },
  });
  res.json(subs);
});

homeworkRouter.post("/:id/submissions/:subId/grade", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const homeworkId = parseInt(req.params.id);
  const subId = parseInt(req.params.subId);
  if (isNaN(homeworkId) || isNaN(subId)) return res.status(400).json({ error: "Invalid IDs" });

  const owned = await db.query.homework.findFirst({
    where: (h, { eq, and }) => and(eq(h.id, homeworkId), eq(h.teacherAccountId, teacherId)),
  });
  if (!owned) return res.status(403).json({ error: "Access denied" });

  const { marksAwarded, teacherFeedback, status } = req.body;
  const sub = await db.query.homeworkSubmissions.findFirst({
    where: (s, { eq, and }) => and(eq(s.id, subId), eq(s.homeworkId, homeworkId)),
  });
  if (!sub) return res.status(404).json({ error: "Submission not found" });

  await db.update(homeworkSubmissionsTable)
    .set({ marksAwarded: marksAwarded?.toString(), teacherFeedback, status, gradedAt: new Date() })
    .where(eq(homeworkSubmissionsTable.id, subId));

  if (sub.studentId) {
    sendPushToUser(sub.studentId, {
      title: "Assignment Graded",
      body: marksAwarded != null
        ? `Your work has been graded: ${marksAwarded} marks awarded.`
        : "Your assignment has been reviewed by your teacher.",
      url: "/my-homework",
    }).catch(() => {});
  }
  res.json({ success: true });
});

homeworkRouter.get("/student", authenticate, requireRole("student"), async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.userId!;
    const { rows } = await pool.query<{ teacher_account_id: number }>(
      `SELECT s.teacher_account_id
       FROM students s
       WHERE s.account_id = $1
       LIMIT 1`,
      [studentId],
    );
    const teacherAccountId = rows[0]?.teacher_account_id;
    if (!teacherAccountId) {
      return res.json([]);
    }
    const list = await db.query.homework.findMany({
      where: (h, { eq, and }) => and(eq(h.isPublished, true), eq(h.teacherAccountId, teacherAccountId)),
      orderBy: (h, { desc }) => [desc(h.createdAt)],
    });
    res.json(list);
  } catch {
    res.status(500).json({ error: "Failed to load assignments" });
  }
});

homeworkRouter.post("/:id/submit", authenticate, requireRole("student"), async (req: AuthRequest, res: Response) => {
  const homeworkId = parseInt(req.params.id);
  const studentId = req.userId!;
  if (isNaN(homeworkId)) return res.status(400).json({ error: "Invalid homework ID" });
  const { content } = req.body;
  const existing = await db.query.homeworkSubmissions.findFirst({
    where: (s, { eq, and }) => and(eq(s.homeworkId, homeworkId), eq(s.studentId, studentId)),
  });
  if (existing) {
    await db.update(homeworkSubmissionsTable)
      .set({ content, status: "submitted", submittedAt: new Date() })
      .where(eq(homeworkSubmissionsTable.id, existing.id));
  } else {
    await db.insert(homeworkSubmissionsTable).values({
      homeworkId, studentId, content, status: "submitted", submittedAt: new Date(),
    });
  }
  res.json({ success: true });
});

homeworkRouter.get("/:id/my-submission", authenticate, requireRole("student"), async (req: AuthRequest, res: Response) => {
  const homeworkId = parseInt(req.params.id);
  const studentId = req.userId!;
  if (isNaN(homeworkId)) return res.status(400).json({ error: "Invalid homework ID" });
  const sub = await db.query.homeworkSubmissions.findFirst({
    where: (s, { eq, and }) => and(eq(s.homeworkId, homeworkId), eq(s.studentId, studentId)),
  });
  if (!sub) { res.json(null); return; }

  // HUMAN GRADING AUTHORITY: mask grade/feedback until teacher has approved it.
  // Students see their submission status but not the grade until it is officially released.
  const gradeReleased = sub.gradingStatus === "approved";
  res.json({
    ...sub,
    marksAwarded: gradeReleased ? sub.marksAwarded : null,
    teacherFeedback: gradeReleased ? sub.teacherFeedback : null,
    gradingStatus: sub.gradingStatus,
    gradeReleased,
  });
});
