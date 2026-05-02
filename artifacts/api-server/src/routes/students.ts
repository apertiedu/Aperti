import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, studentsTable, sessionsTable, accountsTable } from "@workspace/db";
import { CreateStudentBody, DeleteStudentParams, BulkCreateStudentsBody } from "@workspace/api-zod";

const router: IRouter = Router();

function getTeacherId(req: any): number | null {
  if (req.session.role === "admin") return null;
  if (req.session.role === "teacher") return req.session.accountId;
  return req.session.teacherAccountId || req.session.accountId;
}

function ownsStudent(teacherId: number | null, student: typeof studentsTable.$inferSelect): boolean {
  if (teacherId === null) return true; // admin owns all
  return student.teacherAccountId === teacherId;
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
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid student ID" }); return; }

  const teacherId = getTeacherId(req);
  const [existing] = await db.select().from(studentsTable).where(eq(studentsTable.id, id));
  if (!existing) { res.status(404).json({ message: "Student not found" }); return; }
  if (!ownsStudent(teacherId, existing)) { res.status(403).json({ message: "Access denied" }); return; }

  const { studentName, studentCode, lesson1SessionId, lesson2SessionId, lesson3SessionId, phone, parentPhone, notes, status } = req.body;

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

  const teacherId = getTeacherId(req);
  const [existing] = await db.select().from(studentsTable).where(eq(studentsTable.id, params.data.id));
  if (!existing) { res.status(404).json({ message: "Student not found" }); return; }
  if (!ownsStudent(teacherId, existing)) { res.status(403).json({ message: "Access denied" }); return; }

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

// Create a student login account
router.post("/students/:id/create-account", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const { password } = req.body;
  if (!password || password.length < 6) { res.status(400).json({ message: "Password must be at least 6 characters" }); return; }

  const teacherId = getTeacherId(req);
  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, id));
  if (!student) { res.status(404).json({ message: "Student not found" }); return; }
  if (!ownsStudent(teacherId, student)) { res.status(403).json({ message: "Access denied" }); return; }
  if (student.accountId) { res.status(400).json({ message: "Student already has a login account" }); return; }

  const username = student.studentCode.toLowerCase();
  const existing = await db.select({ id: accountsTable.id }).from(accountsTable).where(eq(accountsTable.username, username));
  if (existing.length > 0) { res.status(400).json({ message: `Username '${username}' is already taken` }); return; }

  const hash = await bcrypt.hash(password, 10);
  const [account] = await db.insert(accountsTable).values({
    username,
    passwordHash: hash,
    displayName: student.studentName,
    role: "student",
    status: "active",
    teacherAccountId: student.teacherAccountId,
  }).returning();

  await db.update(studentsTable).set({ accountId: account.id }).where(eq(studentsTable.id, id));
  res.status(201).json({ message: "Student account created", username, accountId: account.id });
});

// Delete student account
router.delete("/students/:id/account", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const teacherId = getTeacherId(req);

  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, id));
  if (!student?.accountId) { res.status(404).json({ message: "No account linked" }); return; }
  if (!ownsStudent(teacherId, student)) { res.status(403).json({ message: "Access denied" }); return; }

  await db.update(studentsTable).set({ accountId: null }).where(eq(studentsTable.id, id));
  await db.delete(accountsTable).where(eq(accountsTable.id, student.accountId));
  res.json({ message: "Student account removed" });
});

export default router;
