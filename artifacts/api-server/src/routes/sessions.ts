import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, sessionsTable, attendanceTable, studentsTable } from "@workspace/db";
import { CreateSessionBody, DeleteSessionParams } from "@workspace/api-zod";

const VALID_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const router: IRouter = Router();

function getTeacherId(req: any): number | null {
  if (req.session.role === "admin") return null;
  if (req.session.role === "teacher") return req.session.accountId;
  return req.session.teacherAccountId || req.session.accountId;
}

router.get("/sessions", async (req, res): Promise<void> => {
  const teacherId = getTeacherId(req);
  const rows = teacherId
    ? await db.select().from(sessionsTable).where(eq(sessionsTable.teacherAccountId, teacherId))
    : await db.select().from(sessionsTable);
  res.json(rows);
});

router.post("/sessions", async (req, res): Promise<void> => {
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: parsed.error.message }); return; }

  const { type, capacity, subjectId, onlineLink } = req.body;
  const teacherId = getTeacherId(req) ?? req.session.accountId;

  const [session] = await db.insert(sessionsTable).values({
    ...parsed.data,
    type: type || "centre",
    capacity: capacity ? parseInt(capacity, 10) : null,
    subjectId: subjectId ? parseInt(subjectId, 10) : null,
    teacherAccountId: teacherId,
    onlineLink: onlineLink || null,
  }).returning();
  res.status(201).json(session);
});

router.patch("/sessions/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid session ID" }); return; }

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

  const [existing] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, id));
  if (!existing) { res.status(404).json({ message: "Session not found" }); return; }

  const [updated] = await db.update(sessionsTable).set(updates).where(eq(sessionsTable.id, id)).returning();
  res.json(updated);
});

router.delete("/sessions/:id", async (req, res): Promise<void> => {
  const params = DeleteSessionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ message: "Invalid session ID" }); return; }
  await db.delete(sessionsTable).where(eq(sessionsTable.id, params.data.id));
  res.json({ message: "Session deleted" });
});

// Capacity check for a session today
router.get("/sessions/:id/capacity", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
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
});

export default router;
