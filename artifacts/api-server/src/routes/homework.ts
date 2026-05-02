import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, homeworkTable, homeworkSubmissionsTable, studentsTable, subjectsTable } from "@workspace/db";
import { requireTenantAccess } from "../middleware/tenant";

const router: IRouter = Router();

router.get("/homework", requireTenantAccess, async (req, res): Promise<void> => {
  const { teacherId, isAdmin } = req.tenant;

  const rows = await db.select({
    id: homeworkTable.id,
    title: homeworkTable.title,
    description: homeworkTable.description,
    dueDate: homeworkTable.dueDate,
    totalMarks: homeworkTable.totalMarks,
    classFilter: homeworkTable.classFilter,
    allowLate: homeworkTable.allowLate,
    isPublished: homeworkTable.isPublished,
    subjectId: homeworkTable.subjectId,
    subjectName: subjectsTable.name,
    createdAt: homeworkTable.createdAt,
    submissionCount: sql<number>`(SELECT COUNT(*) FROM homework_submissions WHERE homework_id = ${homeworkTable.id})::int`,
    gradedCount: sql<number>`(SELECT COUNT(*) FROM homework_submissions WHERE homework_id = ${homeworkTable.id} AND status = 'graded')::int`,
  }).from(homeworkTable)
    .leftJoin(subjectsTable, eq(homeworkTable.subjectId, subjectsTable.id))
    .where(!isAdmin && teacherId ? eq(homeworkTable.teacherAccountId, teacherId) : sql`1=1`)
    .orderBy(desc(homeworkTable.createdAt));

  res.json(rows);
});

router.post("/homework", requireTenantAccess, async (req, res): Promise<void> => {
  const { teacherId, isAdmin, accountId } = req.tenant;
  const { title, description, instructions, dueDate, totalMarks, subjectId, classFilter, allowLate } = req.body;

  if (!title?.trim()) { res.status(400).json({ message: "Title is required" }); return; }

  const effectiveTeacherId = isAdmin ? accountId : (teacherId ?? accountId);

  const [created] = await db.insert(homeworkTable).values({
    teacherAccountId: effectiveTeacherId,
    title: title.trim(),
    description: description?.trim() || null,
    instructions: instructions?.trim() || null,
    dueDate: dueDate || null,
    totalMarks: totalMarks ? String(totalMarks) : null,
    subjectId: subjectId ? parseInt(subjectId, 10) : null,
    classFilter: classFilter || null,
    allowLate: !!allowLate,
    isPublished: true,
  }).returning();

  res.status(201).json(created);
});

router.patch("/homework/:id", requireTenantAccess, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { teacherId, isAdmin } = req.tenant;
  const { title, description, instructions, dueDate, totalMarks, subjectId, classFilter, allowLate, isPublished } = req.body;

  const updates: Record<string, unknown> = {};
  if (title) updates.title = title.trim();
  if ("description" in req.body) updates.description = description?.trim() || null;
  if ("instructions" in req.body) updates.instructions = instructions?.trim() || null;
  if ("dueDate" in req.body) updates.dueDate = dueDate || null;
  if ("totalMarks" in req.body) updates.totalMarks = totalMarks ? String(totalMarks) : null;
  if ("subjectId" in req.body) updates.subjectId = subjectId ? parseInt(subjectId, 10) : null;
  if ("classFilter" in req.body) updates.classFilter = classFilter || null;
  if ("allowLate" in req.body) updates.allowLate = !!allowLate;
  if ("isPublished" in req.body) updates.isPublished = !!isPublished;

  const condition = isAdmin ? eq(homeworkTable.id, id) : and(eq(homeworkTable.id, id), eq(homeworkTable.teacherAccountId, teacherId!));
  const [updated] = await db.update(homeworkTable).set(updates).where(condition!).returning();
  if (!updated) { res.status(404).json({ message: "Homework not found" }); return; }
  res.json(updated);
});

router.delete("/homework/:id", requireTenantAccess, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { teacherId, isAdmin } = req.tenant;
  const condition = isAdmin ? eq(homeworkTable.id, id) : and(eq(homeworkTable.id, id), eq(homeworkTable.teacherAccountId, teacherId!));
  await db.delete(homeworkTable).where(condition!);
  res.json({ message: "Homework deleted" });
});

// Get submissions for a homework
router.get("/homework/:id/submissions", requireTenantAccess, async (req, res): Promise<void> => {
  const hwId = parseInt(req.params.id, 10);

  const submissions = await db.select({
    id: homeworkSubmissionsTable.id,
    studentId: homeworkSubmissionsTable.studentId,
    studentName: studentsTable.studentName,
    studentCode: studentsTable.studentCode,
    content: homeworkSubmissionsTable.content,
    status: homeworkSubmissionsTable.status,
    marksAwarded: homeworkSubmissionsTable.marksAwarded,
    teacherFeedback: homeworkSubmissionsTable.teacherFeedback,
    submittedAt: homeworkSubmissionsTable.submittedAt,
    gradedAt: homeworkSubmissionsTable.gradedAt,
  }).from(homeworkSubmissionsTable)
    .innerJoin(studentsTable, eq(homeworkSubmissionsTable.studentId, studentsTable.id))
    .where(eq(homeworkSubmissionsTable.homeworkId, hwId))
    .orderBy(studentsTable.studentName);

  res.json(submissions);
});

// Grade a submission
router.patch("/homework/submissions/:id/grade", requireTenantAccess, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { marksAwarded, teacherFeedback } = req.body;

  const [updated] = await db.update(homeworkSubmissionsTable).set({
    marksAwarded: marksAwarded !== undefined ? String(marksAwarded) : null,
    teacherFeedback: teacherFeedback?.trim() || null,
    status: "graded",
    gradedAt: new Date(),
  }).where(eq(homeworkSubmissionsTable.id, id)).returning();

  if (!updated) { res.status(404).json({ message: "Submission not found" }); return; }
  res.json(updated);
});

export default router;
