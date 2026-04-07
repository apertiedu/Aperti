import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, studentsTable, sessionsTable } from "@workspace/db";
import {
  CreateStudentBody,
  DeleteStudentParams,
  BulkCreateStudentsBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function studentWithSessions(studentId: number) {
  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, studentId));
  if (!student) return null;

  const sessions = await db.select().from(sessionsTable);
  const sessionMap = Object.fromEntries(sessions.map((s) => [s.id, s]));

  return {
    ...student,
    lesson1Session: student.lesson1SessionId ? sessionMap[student.lesson1SessionId] ?? null : null,
    lesson2Session: student.lesson2SessionId ? sessionMap[student.lesson2SessionId] ?? null : null,
    lesson3Session: student.lesson3SessionId ? sessionMap[student.lesson3SessionId] ?? null : null,
  };
}

router.get("/students", async (_req, res): Promise<void> => {
  const students = await db.select().from(studentsTable).orderBy(studentsTable.createdAt);
  const sessions = await db.select().from(sessionsTable);
  const sessionMap = Object.fromEntries(sessions.map((s) => [s.id, s]));

  const result = students.map((s) => ({
    ...s,
    lesson1Session: s.lesson1SessionId ? sessionMap[s.lesson1SessionId] ?? null : null,
    lesson2Session: s.lesson2SessionId ? sessionMap[s.lesson2SessionId] ?? null : null,
    lesson3Session: s.lesson3SessionId ? sessionMap[s.lesson3SessionId] ?? null : null,
  }));

  res.json(result);
});

router.post("/students", async (req, res): Promise<void> => {
  const parsed = CreateStudentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.message });
    return;
  }

  const { studentCode, studentName, lesson1SessionId, lesson2SessionId, lesson3SessionId } = parsed.data;

  if (!studentCode.trim() || !studentName.trim()) {
    res.status(400).json({ message: "Student code and name are required" });
    return;
  }

  const existing = await db.select().from(studentsTable).where(eq(studentsTable.studentCode, studentCode.trim()));
  if (existing.length > 0) {
    res.status(409).json({ message: `Student code "${studentCode}" already exists` });
    return;
  }

  const [created] = await db.insert(studentsTable).values({
    studentCode: studentCode.trim(),
    studentName: studentName.trim(),
    lesson1SessionId: lesson1SessionId ?? null,
    lesson2SessionId: lesson2SessionId ?? null,
    lesson3SessionId: lesson3SessionId ?? null,
  }).returning();

  const full = await studentWithSessions(created.id);
  res.status(201).json(full);
});

router.delete("/students/:id", async (req, res): Promise<void> => {
  const params = DeleteStudentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ message: params.error.message });
    return;
  }

  const [deleted] = await db.delete(studentsTable).where(eq(studentsTable.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ message: "Student not found" });
    return;
  }

  res.json({ message: "Student deleted" });
});

router.post("/students/bulk", async (req, res): Promise<void> => {
  const parsed = BulkCreateStudentsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.message });
    return;
  }

  let added = 0;
  let skipped = 0;

  for (const s of parsed.data.students) {
    if (!s.studentCode?.trim() || !s.studentName?.trim()) {
      skipped++;
      continue;
    }

    const existing = await db.select().from(studentsTable).where(eq(studentsTable.studentCode, s.studentCode.trim()));
    if (existing.length > 0) {
      skipped++;
      continue;
    }

    await db.insert(studentsTable).values({
      studentCode: s.studentCode.trim(),
      studentName: s.studentName.trim(),
      lesson1SessionId: s.lesson1SessionId ?? null,
      lesson2SessionId: s.lesson2SessionId ?? null,
      lesson3SessionId: s.lesson3SessionId ?? null,
    });
    added++;
  }

  res.json({ added, skipped, total: parsed.data.students.length });
});

export default router;
