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
  const { lessonNumber, dayOfWeek, startTime, type, mode, subjectId, capacity, onlineLink } = req.body;
  try {
    const [lesson] = await db.insert(lessonsTable).values({
      lessonNumber, dayOfWeek, startTime,
      type: type || mode || "online",
      mode: mode || type || "online",
      subjectId: subjectId || null,
      teacherAccountId: teacherId,
      capacity: capacity || null,
      onlineLink: onlineLink || null,
    }).returning();
    res.status(201).json(lesson);
  } catch (err: any) {
    const msg = /duplicate|unique|constraint/i.test(err.message)
      ? "A lesson with this title already exists"
      : "Invalid lesson data";
    res.status(400).json({ error: msg });
  }
});

lessonsRouter.put("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const id = parseInt(req.params.id);
  const { lessonNumber, dayOfWeek, startTime, type, mode, subjectId, capacity, onlineLink } = req.body;
  const updates: Record<string, unknown> = {};
  if (lessonNumber !== undefined) updates.lessonNumber = lessonNumber;
  if (dayOfWeek !== undefined) updates.dayOfWeek = dayOfWeek;
  if (startTime !== undefined) updates.startTime = startTime;
  if (mode !== undefined) { updates.mode = mode; updates.type = mode; }
  else if (type !== undefined) { updates.type = type; updates.mode = type; }
  if (subjectId !== undefined) updates.subjectId = subjectId || null;
  if (capacity !== undefined) updates.capacity = capacity || null;
  if (onlineLink !== undefined) updates.onlineLink = onlineLink || null;
  try {
    const [updated] = await db.update(lessonsTable).set(updates).where(eq(lessonsTable.id, id)).returning();
    res.json(updated || { success: true });
  } catch (err: any) {
    const msg2 = /duplicate|unique|constraint/i.test(err.message)
      ? "A lesson with this title already exists"
      : "Invalid lesson data";
    res.status(400).json({ error: msg2 });
  }
});

lessonsRouter.post("/:id/duplicate", authenticate, async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const id = parseInt(req.params.id);
  const [src] = await db.select().from(lessonsTable).where(eq(lessonsTable.id, id)).limit(1);
  if (!src) return res.status(404).json({ error: "Lesson not found" });
  const maxNum = await db.select({ max: lessonsTable.lessonNumber })
    .from(lessonsTable)
    .where(eq(lessonsTable.teacherAccountId, teacherId));
  const nextNum = Math.max(...maxNum.map((r: any) => r.max || 0)) + 1;
  const [copy] = await db.insert(lessonsTable).values({
    lessonNumber: nextNum,
    dayOfWeek: src.dayOfWeek,
    startTime: src.startTime,
    type: src.type,
    mode: (src as any).mode || src.type || "online",
    subjectId: src.subjectId,
    teacherAccountId: teacherId,
    capacity: src.capacity,
    onlineLink: src.onlineLink,
  }).returning();
  res.status(201).json(copy);
});

lessonsRouter.delete("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  await db.delete(lessonsTable).where(eq(lessonsTable.id, id));
  res.json({ success: true });
});
