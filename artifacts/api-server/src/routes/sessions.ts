import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, sessionsTable } from "@workspace/db";
import {
  CreateSessionBody,
  DeleteSessionParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/sessions", async (_req, res): Promise<void> => {
  const sessions = await db.select().from(sessionsTable).orderBy(sessionsTable.date);
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
