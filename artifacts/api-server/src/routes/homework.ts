import { Router, Response } from "express";
import { db, pool } from "@workspace/db";
import { authenticate, AuthRequest, requireRole } from "../middleware/auth";
import { homeworkTable, homeworkSubmissionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { sendPushToRole, sendPushToUser } from "../lib/push";

export const homeworkRouter = Router();

// ─── TEACHER ROUTES ───

// GET /homework/teacher — list all homework for this teacher
homeworkRouter.get("/teacher", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const list = await db.query.homework.findMany({
    where: (h, { eq }) => eq(h.teacherAccountId, teacherId),
    orderBy: (h, { desc }) => [desc(h.createdAt)],
  });
  res.json(list);
});

// POST /homework — create new homework
homeworkRouter.post("/", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const { subjectId, title, description, instructions, dueDate, totalMarks, allowLate, classFilter } = req.body;
  const [hw] = await db.insert(homeworkTable).values({
    teacherAccountId: teacherId,
    subjectId, title, description, instructions, dueDate, totalMarks: totalMarks?.toString(),
    allowLate, classFilter, isPublished: true,
  }).returning();
  // Push notification to all students
  sendPushToRole("student", {
    title: "New Assignment Posted 📚",
    body: title ? `"${title}" has been assigned.` : "A new homework assignment has been posted.",
    url: "/my-homework",
  }).catch(() => {});
  res.status(201).json(hw);
});

// PUT /homework/:id — update homework
homeworkRouter.put("/:id", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const id = parseInt(req.params.id);
  // ensure ownership
  const existing = await db.query.homework.findFirst({ where: (h, { eq, and }) => and(eq(h.id, id), eq(h.teacherAccountId, teacherId)) });
  if (!existing) return res.status(404).json({ error: "Not found" });
  await db.update(homeworkTable).set(req.body).where(eq(homeworkTable.id, id));
  res.json({ success: true });
});

// DELETE /homework/:id
homeworkRouter.delete("/:id", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const id = parseInt(req.params.id);
  await db.delete(homeworkTable).where(and(eq(homeworkTable.id, id), eq(homeworkTable.teacherAccountId, teacherId)));
  res.json({ success: true });
});

// GET /homework/:id/submissions — teacher views all submissions for a homework
homeworkRouter.get("/:id/submissions", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  const homeworkId = parseInt(req.params.id);
  const subs = await db.query.homeworkSubmissions.findMany({
    where: (s, { eq }) => eq(s.homeworkId, homeworkId),
    with: { student: true }, // requires relation in schema — we can add later
  });
  res.json(subs);
});

// POST /homework/:id/submissions/:subId/grade — teacher grades a submission
homeworkRouter.post("/:id/submissions/:subId/grade", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  const subId = parseInt(req.params.subId);
  const { marksAwarded, teacherFeedback, status } = req.body;
  // Fetch submission to get the student's account ID before updating
  const sub = await db.query.homeworkSubmissions.findFirst({ where: (s, { eq }) => eq(s.id, subId) });
  await db.update(homeworkSubmissionsTable)
    .set({ marksAwarded: marksAwarded?.toString(), teacherFeedback, status, gradedAt: new Date() })
    .where(eq(homeworkSubmissionsTable.id, subId));
  // Push grade notification to the specific student
  if (sub?.studentId) {
    sendPushToUser(sub.studentId, {
      title: "Assignment Graded ✅",
      body: marksAwarded != null
        ? `Your work has been graded: ${marksAwarded} marks awarded.`
        : "Your assignment has been reviewed by your teacher.",
      url: "/my-homework",
    }).catch(() => {});
  }
  res.json({ success: true });
});

// ─── STUDENT ROUTES ───

// GET /homework/student — list homework for the enrolled student
homeworkRouter.get("/student", authenticate, requireRole("student"), async (req: AuthRequest, res: Response) => {
  // In a full system we'd look up the student's teacher and filter homework by that teacher + subject
  // For now, return all published homework
  const list = await db.query.homework.findMany({
    where: (h, { eq }) => eq(h.isPublished, true),
    orderBy: (h, { desc }) => [desc(h.createdAt)],
  });
  res.json(list);
});

// POST /homework/:id/submit — student submits work
homeworkRouter.post("/:id/submit", authenticate, requireRole("student"), async (req: AuthRequest, res: Response) => {
  const homeworkId = parseInt(req.params.id);
  const studentId = req.userId!; // in student context, userId is the student's account ID
  const { content } = req.body; // content could be JSON with text or file URLs
  // Upsert: if already exists, update; else insert
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

// GET /homework/:id/my-submission — student views their own submission
homeworkRouter.get("/:id/my-submission", authenticate, requireRole("student"), async (req: AuthRequest, res: Response) => {
  const homeworkId = parseInt(req.params.id);
  const studentId = req.userId!;
  const sub = await db.query.homeworkSubmissions.findFirst({
    where: (s, { eq, and }) => and(eq(s.homeworkId, homeworkId), eq(s.studentId, studentId)),
  });
  res.json(sub || null);
});
