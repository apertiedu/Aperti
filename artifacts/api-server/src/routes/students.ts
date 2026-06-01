import { Router, Response } from "express";
import { db } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import { studentsTable, accountsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";

export const studentsRouter = Router();

studentsRouter.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const role = req.role!;
  const students = role === "admin"
    ? await db.select().from(studentsTable)
    : await db.select().from(studentsTable).where(eq(studentsTable.teacherAccountId, teacherId));
  res.json(students);
});

studentsRouter.post("/bulk", authenticate, async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const { students } = req.body as { students: Array<{ studentName: string; studentCode: string }> };
  if (!Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ error: "students array required" });
  }
  const rows = students.map(s => ({
    studentName: s.studentName,
    studentCode: s.studentCode,
    teacherAccountId: teacherId,
  }));
  const inserted = await db.insert(studentsTable).values(rows).returning();
  res.json(inserted);
});

studentsRouter.post("/", authenticate, async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const { studentName, studentCode, lesson1SessionId, lesson2SessionId, lesson3SessionId } = req.body;
  if (!studentName || !studentCode) return res.status(400).json({ error: "studentName and studentCode required" });
  const [student] = await db.insert(studentsTable).values({
    studentName,
    studentCode,
    teacherAccountId: teacherId,
    lesson1SessionId: lesson1SessionId || null,
    lesson2SessionId: lesson2SessionId || null,
    lesson3SessionId: lesson3SessionId || null,
  }).returning();
  res.status(201).json(student);
});

studentsRouter.patch("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const { studentName, studentCode, lesson1SessionId, lesson2SessionId, lesson3SessionId } = req.body;
  const [updated] = await db.update(studentsTable)
    .set({
      ...(studentName !== undefined && { studentName }),
      ...(studentCode !== undefined && { studentCode }),
      ...(lesson1SessionId !== undefined && { lesson1SessionId: lesson1SessionId || null }),
      ...(lesson2SessionId !== undefined && { lesson2SessionId: lesson2SessionId || null }),
      ...(lesson3SessionId !== undefined && { lesson3SessionId: lesson3SessionId || null }),
    })
    .where(eq(studentsTable.id, id))
    .returning();
  if (!updated) return res.status(404).json({ error: "Student not found" });
  res.json(updated);
});

studentsRouter.delete("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  await db.delete(studentsTable).where(eq(studentsTable.id, id));
  res.json({ success: true });
});

studentsRouter.post("/:id/create-account", authenticate, async (req: AuthRequest, res: Response) => {
  const studentId = Number(req.params.id);
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: "password required" });

  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, studentId)).limit(1);
  if (!student) return res.status(404).json({ error: "Student not found" });

  const username = student.studentCode.toLowerCase();
  const hash = await bcrypt.hash(password, 12);
  const [account] = await db.insert(accountsTable).values({
    username,
    passwordHash: hash,
    displayName: student.studentName,
    role: "student",
    status: "active",
  }).returning();

  await db.update(studentsTable).set({ accountId: account.id }).where(eq(studentsTable.id, studentId));
  res.json({ success: true, accountId: account.id, username });
});
