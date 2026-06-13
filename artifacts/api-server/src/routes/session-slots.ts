import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { sessionSlotsTable, lessonsTable } from "@workspace/db";
import { requireRole } from "../middleware/auth";
import { eq, asc } from "drizzle-orm";

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}
function slotsOverlap(a: { startTime: string; endTime?: string | null }, b: { startTime: string; endTime?: string | null }): boolean {
  const aStart = timeToMinutes(a.startTime), bStart = timeToMinutes(b.startTime);
  const aEnd = a.endTime ? timeToMinutes(a.endTime) : aStart + 60;
  const bEnd = b.endTime ? timeToMinutes(b.endTime) : bStart + 60;
  return aStart < bEnd && bStart < aEnd;
}

export const sessionSlotsRouter = Router();
sessionSlotsRouter.use(requireRole("admin", "super_admin", "teacher"));

// GET /api/session-slots — all slots (optionally filter by lessonId)
sessionSlotsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const lessonId = req.query.lessonId ? parseInt(req.query.lessonId as string) : undefined;
    const query = db.select().from(sessionSlotsTable).orderBy(asc(sessionSlotsTable.sortOrder), asc(sessionSlotsTable.startTime));
    const slots = lessonId
      ? await db.select().from(sessionSlotsTable).where(eq(sessionSlotsTable.lessonId, lessonId)).orderBy(asc(sessionSlotsTable.sortOrder))
      : await query;
    res.json(slots);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/session-slots/:id
sessionSlotsRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const [slot] = await db.select().from(sessionSlotsTable).where(eq(sessionSlotsTable.id, parseInt(req.params.id)));
    if (!slot) return res.status(404).json({ error: "Session slot not found" });
    res.json(slot);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/session-slots — create slot
sessionSlotsRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { lessonId, slotLabel, dayOfWeek, startTime, endTime, roomOrLink, mode, capacity, sortOrder } = req.body;
    if (!lessonId || !slotLabel || !dayOfWeek || !startTime) {
      return res.status(400).json({ error: "lessonId, slotLabel, dayOfWeek, startTime are required" });
    }
    const [slot] = await db.insert(sessionSlotsTable).values({
      lessonId, slotLabel, dayOfWeek, startTime, endTime, roomOrLink,
      mode: mode ?? "in-person", capacity, sortOrder: sortOrder ?? 0,
    }).returning();
    res.status(201).json(slot);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/session-slots/:id — update slot
sessionSlotsRouter.put("/:id", async (req: Request, res: Response) => {
  try {
    const { slotLabel, dayOfWeek, startTime, endTime, roomOrLink, mode, capacity, isActive, sortOrder } = req.body;
    const [slot] = await db.update(sessionSlotsTable)
      .set({ slotLabel, dayOfWeek, startTime, endTime, roomOrLink, mode, capacity, isActive, sortOrder, updatedAt: new Date() })
      .where(eq(sessionSlotsTable.id, parseInt(req.params.id)))
      .returning();
    if (!slot) return res.status(404).json({ error: "Session slot not found" });
    res.json(slot);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/session-slots/:id — deactivate slot
sessionSlotsRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    await db.update(sessionSlotsTable).set({ isActive: false, updatedAt: new Date() }).where(eq(sessionSlotsTable.id, parseInt(req.params.id)));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/session-slots/conflicts — detect scheduling conflicts
sessionSlotsRouter.get("/conflicts", async (_req: Request, res: Response) => {
  try {
    const slots = await db.select().from(sessionSlotsTable).where(eq(sessionSlotsTable.isActive, true));
    const conflicts: Array<{ slot1: any; slot2: any; reason: string }> = [];
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const a = slots[i], b = slots[j];
        if (a.lessonId === b.lessonId && a.dayOfWeek === b.dayOfWeek && a.slotLabel === b.slotLabel) {
          conflicts.push({ slot1: a, slot2: b, reason: "Duplicate slot (same lesson, day, label)" });
        } else if (a.lessonId === b.lessonId && a.dayOfWeek === b.dayOfWeek && slotsOverlap(a, b)) {
          conflicts.push({ slot1: a, slot2: b, reason: "Time overlap for the same lesson on the same day" });
        } else if (
          a.lessonId !== b.lessonId && a.dayOfWeek === b.dayOfWeek &&
          a.roomOrLink && b.roomOrLink && a.roomOrLink === b.roomOrLink &&
          a.mode !== "online" && b.mode !== "online" && slotsOverlap(a, b)
        ) {
          conflicts.push({ slot1: a, slot2: b, reason: `Room conflict: both use "${a.roomOrLink}"` });
        }
      }
    }
    res.json({ hasConflicts: conflicts.length > 0, conflicts, scannedSlots: slots.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
