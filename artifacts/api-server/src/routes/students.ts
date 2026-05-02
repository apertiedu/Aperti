import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, studentsTable, sessionsTable } from "@workspace/db";
import { CreateStudentBody, DeleteStudentParams, BulkCreateStudentsBody } from "@workspace/api-zod";

const router: IRouter = Router();

function getTeacherId(req: any): number | null {
  if (req.session.role === "admin") return null;
  if (req.session.role === "teacher") return req.session.accountId;
  return req.session.teacherAccountId || req.session.accountId;
}

async function buildStudentResponse(student: typeof studentsTable.$inferSelect, sessions: (typeof sessionsTable.$inferSelect)[]) {
  const sessionMap = Object.fromEntries(sessions.map((s) => [s.id, s]));
  return {
    ...student,
    lesson1Session: student.lesson1SessionId ? sessionMap[student.lesson1SessionId] ?? null : null,
    lesson2Session: student.lesson2SessionId ? sessionMap[student.lesson2SessionId] ?? null : null,
    lesson3Session: student.lesson3SessionId ? sessionMap[student.lesson3SessionId] ?? null : null,
  };
}

router.get("/students", async (req, res): Promise<void> => {
  const teacherId = getTeacherId(req);
  const studentRows = teacherId
    ? await db.select().from(studentsTable).where(eq(studentsTable.teacherAccountId, teacherId))
    : await db.select().from(studentsTable);

  const sessions = await db.select().from(sessionsTable);
  const result = await Promise.all(studentRows.map((s) => buildStudentResponse(s, sessions)));
  res.json(result);
});

router.post("/students", async (req, res): Promise<void> => {
  const parsed = CreateStudentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: parsed.error.message }); return; }

  const teacherId = getTeacherId(req) ?? req.session.accountId;
  const { phone, parentPhone, notes } = req.body;

  const [created] = await db.insert(studentsTable).values({
    ...parsed.data,
    teacherAccountId: teacherId,
    phone: phone || null,
    parentPhone: parentPhone || null,
    notes: notes || null,
    status: "active",
  }).returning();

  const sessions = await db.select().from(sessionsTable);
  res.status(201).json(await buildStudentResponse(created, sessions));
});

router.patch("/students/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid student ID" }); return; }

  const { studentName, studentCode, lesson1SessionId, lesson2SessionId, lesson3SessionId, phone, parentPhone, notes, status } = req.body;

  const [existing] = await db.select().from(studentsTable).where(eq(studentsTable.id, id));
  if (!existing) { res.status(404).json({ message: "Student not found" }); return; }

  const updates: Record<string, unknown> = {};
  if (studentName !== undefined) updates.studentName = String(studentName).trim();
  if (studentCode !== undefined) updates.studentCode = String(studentCode).trim();
  if ("lesson1SessionId" in req.body) updates.lesson1SessionId = lesson1SessionId ?? null;
  if ("lesson2SessionId" in req.body) updates.lesson2SessionId = lesson2SessionId ?? null;
  if ("lesson3SessionId" in req.body) updates.lesson3SessionId = lesson3SessionId ?? null;
  if ("phone" in req.body) updates.phone = phone || null;
  if ("parentPhone" in req.body) updates.parentPhone = parentPhone || null;
  if ("notes" in req.body) updates.notes = notes || null;
  if ("status" in req.body) updates.status = status;

  if (Object.keys(updates).length === 0) { res.status(400).json({ message: "No fields to update" }); return; }

  const [updated] = await db.update(studentsTable).set(updates).where(eq(studentsTable.id, id)).returning();
  const sessions = await db.select().from(sessionsTable);
  res.json(await buildStudentResponse(updated, sessions));
});

router.delete("/students/:id", async (req, res): Promise<void> => {
  const params = DeleteStudentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ message: "Invalid student ID" }); return; }
  await db.delete(studentsTable).where(eq(studentsTable.id, params.data.id));
  res.json({ message: "Student deleted" });
});

router.post("/students/bulk", async (req, res): Promise<void> => {
  const parsed = BulkCreateStudentsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: parsed.error.message }); return; }

  const teacherId = getTeacherId(req) ?? req.session.accountId;
  let added = 0;
  let skipped = 0;

  for (const s of parsed.data.students) {
    const existing = await db.select().from(studentsTable).where(eq(studentsTable.studentCode, s.studentCode));
    if (existing.length > 0) { skipped++; continue; }
    await db.insert(studentsTable).values({ ...s, teacherAccountId: teacherId, status: "active" });
    added++;
  }

  res.json({ added, skipped });
});

export default router;
