import { Router } from "express";
import { db } from "@workspace/db";
import { sessionSlotsTable } from "@workspace/db";
import { requireRole } from "../middleware/auth";
import { eq, and } from "drizzle-orm";

export const sessionSlotsConflictsRouter = Router();
sessionSlotsConflictsRouter.use(requireRole("admin", "super_admin", "teacher"));

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function slotsOverlap(a: { startTime: string; endTime?: string | null }, b: { startTime: string; endTime?: string | null }): boolean {
  const aStart = timeToMinutes(a.startTime);
  const bStart = timeToMinutes(b.startTime);
  if (!a.endTime && !b.endTime) return aStart === bStart;
  const aEnd = a.endTime ? timeToMinutes(a.endTime) : aStart + 60;
  const bEnd = b.endTime ? timeToMinutes(b.endTime) : bStart + 60;
  return aStart < bEnd && bStart < aEnd;
}

sessionSlotsConflictsRouter.get("/", async (_req, res) => {
  try {
    const slots = await db.select().from(sessionSlotsTable).where(eq(sessionSlotsTable.isActive, true));

    const conflicts: Array<{ slot1: any; slot2: any; reason: string }> = [];

    // Check each pair of slots on the same day for time overlaps
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const a = slots[i];
        const b = slots[j];

        // Same lesson, same day, same slot label — duplicate
        if (a.lessonId === b.lessonId && a.dayOfWeek === b.dayOfWeek && a.slotLabel === b.slotLabel) {
          conflicts.push({ slot1: a, slot2: b, reason: "Duplicate slot (same lesson, day, label)" });
          continue;
        }

        // Same lesson, same day, overlapping times
        if (a.lessonId === b.lessonId && a.dayOfWeek === b.dayOfWeek && slotsOverlap(a, b)) {
          conflicts.push({ slot1: a, slot2: b, reason: "Time overlap for the same lesson on the same day" });
        }

        // Different lessons, same day, same room, overlapping times (room conflict)
        if (
          a.lessonId !== b.lessonId &&
          a.dayOfWeek === b.dayOfWeek &&
          a.roomOrLink && b.roomOrLink &&
          a.roomOrLink === b.roomOrLink &&
          a.mode !== "online" && b.mode !== "online" &&
          slotsOverlap(a, b)
        ) {
          conflicts.push({ slot1: a, slot2: b, reason: `Room conflict: both use "${a.roomOrLink}" at overlapping times` });
        }
      }
    }

    res.json({ hasConflicts: conflicts.length > 0, conflicts, scannedSlots: slots.length });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});
