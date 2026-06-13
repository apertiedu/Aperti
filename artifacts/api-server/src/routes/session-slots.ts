import { Router, Request, Response } from "express";
import { db, pool } from "@workspace/db";
import { sessionSlotsTable } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { eq, asc, inArray } from "drizzle-orm";

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

sessionSlotsRouter.use(authenticate);
sessionSlotsRouter.use(requireRole("admin", "super_admin", "teacher"));

async function getTeacherLessonIds(teacherId: number): Promise<number[]> {
  try {
    const { rows } = await pool.query(
      `SELECT id FROM sessions WHERE teacher_account_id = $1 UNION
       SELECT id FROM sessions WHERE created_by = $1`,
      [teacherId]
    );
    if (rows.length > 0) return rows.map((r: any) => r.id);
    const { rows: r2 } = await pool.query(
      `SELECT id FROM sessions WHERE teacher_account_id = $1`,
      [teacherId]
    );
    return r2.map((r: any) => r.id);
  } catch {
    return [];
  }
}

async function verifySlotOwnership(slotId: number, req: AuthRequest): Promise<boolean> {
  if (req.role === "admin" || req.role === "super_admin") return true;
  const [slot] = await db.select({ lessonId: sessionSlotsTable.lessonId })
    .from(sessionSlotsTable)
    .where(eq(sessionSlotsTable.id, slotId));
  if (!slot) return false;
  const lessonIds = await getTeacherLessonIds(req.userId!);
  return lessonIds.includes(slot.lessonId);
}

// GET /api/session-slots — all slots (admin sees all; teacher sees only their lessons' slots)
sessionSlotsRouter.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = req.role === "admin" || req.role === "super_admin";
    const lessonId = req.query.lessonId ? parseInt(req.query.lessonId as string) : undefined;

    if (!isAdmin) {
      const teacherLessonIds = await getTeacherLessonIds(req.userId!);
      if (teacherLessonIds.length === 0) return res.json([]);

      if (lessonId) {
        if (!teacherLessonIds.includes(lessonId)) {
          return res.status(403).json({ error: "Access denied: this lesson does not belong to you" });
        }
        const slots = await db.select().from(sessionSlotsTable)
          .where(eq(sessionSlotsTable.lessonId, lessonId))
          .orderBy(asc(sessionSlotsTable.sortOrder));
        return res.json(slots);
      }

      const slots = await db.select().from(sessionSlotsTable)
        .where(inArray(sessionSlotsTable.lessonId, teacherLessonIds))
        .orderBy(asc(sessionSlotsTable.sortOrder), asc(sessionSlotsTable.startTime));
      return res.json(slots);
    }

    const slots = lessonId
      ? await db.select().from(sessionSlotsTable)
          .where(eq(sessionSlotsTable.lessonId, lessonId))
          .orderBy(asc(sessionSlotsTable.sortOrder))
      : await db.select().from(sessionSlotsTable)
          .orderBy(asc(sessionSlotsTable.sortOrder), asc(sessionSlotsTable.startTime));
    res.json(slots);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/session-slots/conflicts — detect scheduling conflicts
sessionSlotsRouter.get("/conflicts", async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = req.role === "admin" || req.role === "super_admin";
    let slots;

    if (!isAdmin) {
      const teacherLessonIds = await getTeacherLessonIds(req.userId!);
      if (teacherLessonIds.length === 0) return res.json({ hasConflicts: false, conflicts: [], scannedSlots: 0 });
      slots = await db.select().from(sessionSlotsTable)
        .where(inArray(sessionSlotsTable.lessonId, teacherLessonIds));
      slots = slots.filter(s => s.isActive);
    } else {
      slots = await db.select().from(sessionSlotsTable).where(eq(sessionSlotsTable.isActive, true));
    }

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

// GET /api/session-slots/:id
sessionSlotsRouter.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const slotId = parseInt(req.params.id);
    const [slot] = await db.select().from(sessionSlotsTable).where(eq(sessionSlotsTable.id, slotId));
    if (!slot) return res.status(404).json({ error: "Session slot not found" });
    const hasAccess = await verifySlotOwnership(slotId, req);
    if (!hasAccess) return res.status(403).json({ error: "Access denied" });
    res.json(slot);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/session-slots — create slot
sessionSlotsRouter.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const { lessonId, slotLabel, dayOfWeek, startTime, endTime, roomOrLink, mode, capacity, sortOrder } = req.body;
    if (!lessonId || !slotLabel || !dayOfWeek || !startTime) {
      return res.status(400).json({ error: "lessonId, slotLabel, dayOfWeek, startTime are required" });
    }
    const isAdmin = req.role === "admin" || req.role === "super_admin";
    if (!isAdmin) {
      const teacherLessonIds = await getTeacherLessonIds(req.userId!);
      if (!teacherLessonIds.includes(parseInt(String(lessonId)))) {
        return res.status(403).json({ error: "Access denied: this lesson does not belong to you" });
      }
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
sessionSlotsRouter.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const slotId = parseInt(req.params.id);
    const hasAccess = await verifySlotOwnership(slotId, req);
    if (!hasAccess) return res.status(403).json({ error: "Access denied" });
    const { slotLabel, dayOfWeek, startTime, endTime, roomOrLink, mode, capacity, isActive, sortOrder } = req.body;
    const [slot] = await db.update(sessionSlotsTable)
      .set({ slotLabel, dayOfWeek, startTime, endTime, roomOrLink, mode, capacity, isActive, sortOrder, updatedAt: new Date() })
      .where(eq(sessionSlotsTable.id, slotId))
      .returning();
    if (!slot) return res.status(404).json({ error: "Session slot not found" });
    res.json(slot);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/session-slots/:id — deactivate slot
sessionSlotsRouter.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const slotId = parseInt(req.params.id);
    const hasAccess = await verifySlotOwnership(slotId, req);
    if (!hasAccess) return res.status(403).json({ error: "Access denied" });
    await db.update(sessionSlotsTable).set({ isActive: false, updatedAt: new Date() }).where(eq(sessionSlotsTable.id, slotId));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
