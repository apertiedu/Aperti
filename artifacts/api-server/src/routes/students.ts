import { Router, Response } from "express";
import { db } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import { studentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const studentsRouter = Router();

// GET /students – returns students of the logged‑in teacher
studentsRouter.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const students = await db.query.students.findMany({
    where: (s, { eq }) => eq(s.teacherAccountId, teacherId),
  });
  res.json(students);
});
