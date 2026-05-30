import { Router, Response } from "express";
import { db } from "../lib/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import { lessonContentTable } from "@lib/db/schema/lesson-content";
import { eq, and } from "drizzle-orm";

export const contentCraftRouter = Router();

// GET /content-craft — teacher's lessons
contentCraftRouter.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const lessons = await db.query.lessonContent.findMany({
    where: (l, { eq }) => eq(l.teacherAccountId, teacherId),
    orderBy: (l, { desc }) => [desc(l.updatedAt)],
  });
  res.json(lessons);
});

// POST /content-craft — create new lesson
contentCraftRouter.post("/", authenticate, async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const { title, description, sections } = req.body;
  const [lesson] = await db.insert(lessonContentTable).values({
    teacherAccountId: teacherId,
    title,
    description,
    sections,
  }).returning();
  res.status(201).json(lesson);
});

// PUT /content-craft/:id — update lesson
contentCraftRouter.put("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const id = parseInt(req.params.id);
  const { title, description, sections } = req.body;
  const existing = await db.query.lessonContent.findFirst({
    where: (l, { eq, and }) => and(eq(l.id, id), eq(l.teacherAccountId, teacherId)),
  });
  if (!existing) return res.status(404).json({ error: "Not found" });
  await db.update(lessonContentTable)
    .set({ title, description, sections, updatedAt: new Date() })
    .where(eq(lessonContentTable.id, id));
  res.json({ success: true });
});

// DELETE /content-craft/:id
contentCraftRouter.delete("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const id = parseInt(req.params.id);
  await db.delete(lessonContentTable).where(and(eq(lessonContentTable.id, id), eq(lessonContentTable.teacherAccountId, teacherId)));
  res.json({ success: true });
});
