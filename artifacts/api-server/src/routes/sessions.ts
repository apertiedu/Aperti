import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, sessionsTable, attendanceTable } from "@workspace/db";
import { CreateSessionBody, DeleteSessionParams } from "@workspace/api-zod";
import { authenticate, AuthRequest } from "../middleware/auth";

const VALID_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const router: IRouter = Router();

function getTeacherId(req: AuthRequest): number | null {
  if (req.role === "admin") return null;
  return req.userId ?? null;
}

function ownsSession(teacherId: number | null, session: typeof sessionsTable.$inferSelect): boolean {
  if (teacherId === null) return true;
  return session.teacherAccountId === teacherId;
}

router.get("/sessions", authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    const teacherId = getTeacherId(req);
    const rows = teacherId
      ? await db.select().from(sessionsTable).where(eq(sessionsTable.teacherAccountId, teacherId))
      : await db.select().from(sessionsTable);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to load sessions" });
  }
});

router.post("/sessions", authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    const parsed = CreateSessionBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: parsed.error.message }); return; }

    const { type, capacity, subjectId, onlineLink } = req.body;
    const teacherId = getTeacherId(req) ?? req.userId!;

    const [session] = await db.insert(sessionsTable).values({
      ...parsed.data,
      type: type || "centre",
      capacity: capacity ? parseInt(capacity, 10) : null,
      subjectId: subjectId ? parseInt(subjectId, 10) : null,
      teacherAccountId: teacherId,
      onlineLink: onlineLink || null,
    }).returning();
    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ error: "Failed to create session" });
  }
});

router.patch("/sessions/:id", authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ message: "Invalid session ID" }); return; }

    const teacherId = getTeacherId(req);
    const [existing] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, id));
    if (!existing) { res.status(404).json({ message: "Session not found" }); return; }
    if (!ownsSession(teacherId, existing)) { res.status(403).json({ message: "Access denied" }); return; }

    const { lessonNumber, dayOfWeek, startTime, type, capacity, subjectId, onlineLink } = req.body;
    const updates: Record<string, unknown> = {};

    if (lessonNumber !== undefined) {
      const n = Number(lessonNumber);
      if (![1, 2, 3].includes(n)) { res.status(400).json({ message: "lessonNumber must be 1, 2, or 3" }); return; }
      updates.lessonNumber = n;
    }
    if (dayOfWeek !== undefined) {
      if (!VALID_DAYS.includes(dayOfWeek)) { res.status(400).json({ message: "Invalid dayOfWeek" }); return; }
      updates.dayOfWeek = dayOfWeek;
    }
    if (startTime !== undefined) updates.startTime = startTime;
    if (type !== undefined) updates.type = type;
    if ("capacity" in req.body) updates.capacity = capacity ? parseInt(capacity, 10) : null;
    if ("subjectId" in req.body) updates.subjectId = subjectId ? parseInt(subjectId, 10) : null;
    if ("onlineLink" in req.body) updates.onlineLink = onlineLink || null;

    if (Object.keys(updates).length === 0) { res.status(400).json({ message: "No fields to update" }); return; }

    const [updated] = await db.update(sessionsTable).set(updates).where(eq(sessionsTable.id, id)).returning();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update session" });
  }
});

router.delete("/sessions/:id", authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    const params = DeleteSessionParams.safeParse(req.params);
    if (!params.success) { res.status(400).json({ message: "Invalid session ID" }); return; }

    const teacherId = getTeacherId(req);
    const [existing] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, params.data.id));
    if (!existing) { res.status(404).json({ message: "Session not found" }); return; }
    if (!ownsSession(teacherId, existing)) { res.status(403).json({ message: "Access denied" }); return; }

    await db.delete(sessionsTable).where(eq(sessionsTable.id, params.data.id));
    res.json({ message: "Session deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete session" });
  }
});

router.get("/sessions/:id/capacity", authenticate, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, id));
    if (!session) { res.status(404).json({ message: "Session not found" }); return; }

    if (session.type !== "centre" || !session.capacity) {
      res.json({ type: session.type, capacity: null, enrolled: 0, available: null, isFull: false });
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const [presentCount] = await db.select({ count: sql<number>`count(*)::int` })
      .from(attendanceTable)
      .where(and(eq(attendanceTable.sessionId, id), eq(attendanceTable.date, today), eq(attendanceTable.status, "Present")));

    const enrolled = presentCount?.count || 0;
    const available = session.capacity - enrolled;
    res.json({ type: session.type, capacity: session.capacity, enrolled, available, isFull: available <= 0 });
  } catch (err) {
    res.status(500).json({ error: "Failed to load capacity" });
  }
});

export default router;
