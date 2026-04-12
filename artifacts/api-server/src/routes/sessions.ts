import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, sessionsTable } from "@workspace/db";
import {
  CreateSessionBody,
  DeleteSessionParams,
} from "@workspace/api-zod";

const VALID_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const router: IRouter = Router();

router.get("/sessions", async (_req, res): Promise<void> => {
  const sessions = await db.select().from(sessionsTable).orderBy(sessionsTable.lessonNumber);
  res.json(sessions);
});

router.post("/sessions", async (req, res): Promise<void> => {
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.message });
    return;
  }

  const [session] = await db.insert(sessionsTable).values(parsed.data).returning();
  res.status(201).json(session);
});

router.patch("/sessions/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ message: "Invalid session ID" });
    return;
  }

  const { lessonNumber, dayOfWeek, startTime } = req.body;
  const updates: Record<string, unknown> = {};

  if (lessonNumber !== undefined) {
    const n = Number(lessonNumber);
    if (![1, 2, 3].includes(n)) {
      res.status(400).json({ message: "lessonNumber must be 1, 2, or 3" });
      return;
    }
    updates.lessonNumber = n;
  }
  if (dayOfWeek !== undefined) {
    if (!VALID_DAYS.includes(dayOfWeek)) {
      res.status(400).json({ message: "Invalid dayOfWeek" });
      return;
    }
    updates.dayOfWeek = dayOfWeek;
  }
  if (startTime !== undefined) updates.startTime = startTime;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ message: "No fields to update" });
    return;
  }

  const [existing] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, id));
  if (!existing) {
    res.status(404).json({ message: "Session not found" });
    return;
  }

  const [updated] = await db
    .update(sessionsTable)
    .set(updates)
    .where(eq(sessionsTable.id, id))
    .returning();

  res.json(updated);
});

router.delete("/sessions/:id", async (req, res): Promise<void> => {
  const params = DeleteSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ message: params.error.message });
    return;
  }

  const [deleted] = await db.delete(sessionsTable).where(eq(sessionsTable.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ message: "Session not found" });
    return;
  }

  res.json({ message: "Session deleted" });
});

export default router;
