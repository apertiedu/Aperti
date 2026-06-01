import { Router, Response } from "express";
import { db } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import { lessonsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const lessonsRouter = Router();

lessonsRouter.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const lessons = await db.query.lessons.findMany({
    where: (l, { eq }) => eq(l.teacherAccountId, teacherId),
  });
  res.json(lessons);
});

lessonsRouter.post("/", authenticate, async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const { lessonNumber, dayOfWeek, startTime, type, subjectId, capacity, onlineLink } = req.body;
  const [lesson] = await db.insert(lessonsTable).values({
    lessonNumber, dayOfWeek, startTime, type, subjectId, teacherAccountId: teacherId, capacity, onlineLink,
  }).returning();
  res.status(201).json(lesson);
});

lessonsRouter.put("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const id = parseInt(req.params.id);
  const updates = req.body;
  await db.update(lessonsTable).set(updates).where(eq(lessonsTable.id, id));
  res.json({ success: true });
});

lessonsRouter.delete("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  await db.delete(lessonsTable).where(eq(lessonsTable.id, id));
  res.json({ success: true });
});
