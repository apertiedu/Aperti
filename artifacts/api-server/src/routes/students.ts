import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, studentsTable } from "@workspace/db";
import {
  CreateStudentBody,
  DeleteStudentParams,
  BulkCreateStudentsBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/students", async (_req, res): Promise<void> => {
  const students = await db.select().from(studentsTable).orderBy(studentsTable.createdAt);
  res.json(students);
});

router.post("/students", async (req, res): Promise<void> => {
  const parsed = CreateStudentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.message });
    return;
  }

  const { studentCode, studentName, timeSlot } = parsed.data;

  if (!studentCode.trim() || !studentName.trim() || !timeSlot.trim()) {
    res.status(400).json({ message: "All fields are required and cannot be empty" });
    return;
  }

  const existing = await db.select().from(studentsTable).where(eq(studentsTable.studentCode, studentCode));
  if (existing.length > 0) {
    res.status(409).json({ message: "Student code already exists" });
    return;
  }

  const [student] = await db.insert(studentsTable).values({
    studentCode: studentCode.trim(),
    studentName: studentName.trim(),
    timeSlot: timeSlot.trim(),
  }).returning();

  res.status(201).json(student);
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
    if (!s.studentCode?.trim() || !s.studentName?.trim() || !s.timeSlot?.trim()) {
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
      timeSlot: s.timeSlot.trim(),
    });
    added++;
  }

  res.json({ added, skipped, total: parsed.data.students.length });
});

export default router;
