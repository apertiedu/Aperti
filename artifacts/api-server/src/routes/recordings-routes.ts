import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, recordingsTable, subjectsTable } from "@workspace/db";
import { requireTenantAccess } from "../middleware/tenant";

const router: IRouter = Router();

// GET /api/recordings
router.get("/recordings", requireTenantAccess, async (req, res): Promise<void> => {
  const { teacherId, isAdmin } = req.tenant;
  const filter = !isAdmin && teacherId ? eq(recordingsTable.teacherAccountId, teacherId) : sql`1=1`;

  const rows = await db.select({
    id: recordingsTable.id,
    title: recordingsTable.title,
    description: recordingsTable.description,
    url: recordingsTable.url,
    passcode: recordingsTable.passcode,
    platform: recordingsTable.platform,
    accessType: recordingsTable.accessType,
    accessUntil: recordingsTable.accessUntil,
    isPublished: recordingsTable.isPublished,
    viewCount: recordingsTable.viewCount,
    duration: recordingsTable.duration,
    recordedAt: recordingsTable.recordedAt,
    createdAt: recordingsTable.createdAt,
    subjectName: subjectsTable.name,
    subjectId: recordingsTable.subjectId,
  }).from(recordingsTable)
    .leftJoin(subjectsTable, eq(recordingsTable.subjectId, subjectsTable.id))
    .where(filter)
    .orderBy(desc(recordingsTable.createdAt));

  res.json(rows);
});

// POST /api/recordings
router.post("/recordings", requireTenantAccess, async (req, res): Promise<void> => {
  const { teacherId, isAdmin, accountId } = req.tenant;
  const teacherAccountId = isAdmin ? (req.body.teacherAccountId ?? accountId) : teacherId ?? accountId;
  const { title, description, url, passcode, platform, accessType, accessUntil, duration, subjectId, recordedAt } = req.body;

  if (!title?.trim()) { res.status(400).json({ message: "Title is required" }); return; }
  if (!url?.trim()) { res.status(400).json({ message: "URL is required" }); return; }

  const [created] = await db.insert(recordingsTable).values({
    teacherAccountId,
    subjectId: subjectId ? parseInt(subjectId, 10) : null,
    title: title.trim(),
    description: description?.trim() || null,
    url: url.trim(),
    passcode: passcode?.trim() || null,
    platform: platform || "zoom",
    accessType: accessType || "free",
    accessUntil: accessUntil ? new Date(accessUntil) : null,
    duration: duration?.trim() || null,
    isPublished: true,
    viewCount: 0,
    recordedAt: recordedAt ? new Date(recordedAt) : null,
  }).returning();

  res.status(201).json(created);
});

// PATCH /api/recordings/:id
router.patch("/recordings/:id", requireTenantAccess, async (req, res): Promise<void> => {
  const { teacherId, isAdmin } = req.tenant;
  const id = parseInt(req.params.id as string, 10);

  const [existing] = await db.select().from(recordingsTable).where(eq(recordingsTable.id, id));
  if (!existing) { res.status(404).json({ message: "Recording not found" }); return; }
  if (!isAdmin && existing.teacherAccountId !== teacherId) { res.status(403).json({ message: "Access denied" }); return; }

  const { title, description, url, passcode, platform, accessType, accessUntil, duration, subjectId, isPublished, recordedAt } = req.body;
  const updates: Record<string, any> = {};
  if (title !== undefined) updates.title = title.trim();
  if (description !== undefined) updates.description = description?.trim() || null;
  if (url !== undefined) updates.url = url.trim();
  if (passcode !== undefined) updates.passcode = passcode?.trim() || null;
  if (platform !== undefined) updates.platform = platform;
  if (accessType !== undefined) updates.accessType = accessType;
  if (accessUntil !== undefined) updates.accessUntil = accessUntil ? new Date(accessUntil) : null;
  if (duration !== undefined) updates.duration = duration?.trim() || null;
  if (subjectId !== undefined) updates.subjectId = subjectId ? parseInt(subjectId, 10) : null;
  if (isPublished !== undefined) updates.isPublished = Boolean(isPublished);
  if (recordedAt !== undefined) updates.recordedAt = recordedAt ? new Date(recordedAt) : null;

  const [updated] = await db.update(recordingsTable).set(updates).where(eq(recordingsTable.id, id)).returning();
  res.json(updated);
});

// DELETE /api/recordings/:id
router.delete("/recordings/:id", requireTenantAccess, async (req, res): Promise<void> => {
  const { teacherId, isAdmin } = req.tenant;
  const id = parseInt(req.params.id as string, 10);

  const [existing] = await db.select().from(recordingsTable).where(eq(recordingsTable.id, id));
  if (!existing) { res.status(404).json({ message: "Recording not found" }); return; }
  if (!isAdmin && existing.teacherAccountId !== teacherId) { res.status(403).json({ message: "Access denied" }); return; }

  await db.delete(recordingsTable).where(eq(recordingsTable.id, id));
  res.json({ message: "Deleted" });
});

export default router;
