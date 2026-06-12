import { Router, Response } from "express";
import { db, pool } from "@workspace/db";
import { authenticate, AuthRequest, requireRole } from "../middleware/auth";
import { flashcardDecksTable, flashcardItemsTable, flashcardProgressTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

export const flashcardsRouter = Router();

// ─── Confidence → SM-2 quality mapping ──────────────────────────────────────
// Easy   = 5 (perfect recall, no hesitation)
// Okay   = 3 (recalled with some effort)
// Hard   = 1 (failed / barely recalled)
function confidenceToQuality(confidence: string): number {
  switch (confidence) {
    case "easy":       return 5;
    case "okay":       return 3;
    case "hard":       return 1;
    case "know":       return 5;
    case "unsure":     return 3;
    case "struggling": return 1;
    default:           return parseInt(confidence, 10) || 3;
  }
}

function qualityToMastery(quality: number): string {
  if (quality >= 4) return "mastered";
  if (quality >= 3) return "learning";
  return "struggling";
}

// ─── SM-2 algorithm ──────────────────────────────────────────────────────────
function sm2(repetitions: number, easeFactor: number, interval: number, quality: number) {
  if (quality >= 3) {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * (easeFactor / 100));
    repetitions++;
  } else {
    repetitions = 0;
    interval = 1;
  }
  easeFactor = Math.max(130, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)) * 100);
  const nextReview = new Date(Date.now() + interval * 86400000);
  return { repetitions, easeFactor: Math.round(easeFactor), interval, nextReview };
}

// ─── TEACHER ROUTES ───────────────────────────────────────────────────────────

// GET /flashcards/decks — teacher's decks
flashcardsRouter.get("/decks", authenticate, requireRole("teacher", "admin", "assistant"), async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const decks = await db.query.flashcardDecks.findMany({
    where: (d, { eq }) => eq(d.teacherAccountId, teacherId),
    orderBy: (d, { desc }) => [desc(d.createdAt)],
  });
  res.json(decks);
});

// POST /flashcards/decks — create new deck
flashcardsRouter.post("/decks", authenticate, requireRole("teacher", "admin", "assistant"), async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const { title, description, subjectId, isPublic } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: "title is required" });
  const [deck] = await db.insert(flashcardDecksTable).values({
    teacherAccountId: teacherId, title: title.trim(), description, subjectId,
    isPublic: isPublic ?? false,
  }).returning();
  res.status(201).json(deck);
});

// PATCH /flashcards/decks/:id — update deck metadata
flashcardsRouter.patch("/decks/:id", authenticate, requireRole("teacher", "admin", "assistant"), async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const { title, description, isPublic } = req.body;
  const updates: Record<string, any> = {};
  if (title !== undefined) updates.title = title.trim();
  if (description !== undefined) updates.description = description;
  if (isPublic !== undefined) updates.isPublic = isPublic;
  await db.update(flashcardDecksTable).set(updates).where(eq(flashcardDecksTable.id, id));
  res.json({ success: true });
});

// DELETE /flashcards/decks/:id
flashcardsRouter.delete("/decks/:id", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  await db.delete(flashcardDecksTable).where(eq(flashcardDecksTable.id, id));
  res.json({ success: true });
});

// GET /flashcards/decks/:id/cards — cards in a deck
flashcardsRouter.get("/decks/:id/cards", authenticate, async (_req: AuthRequest, res: Response) => {
  const deckId = parseInt(_req.params.id);
  const cards = await db.query.flashcardItems.findMany({
    where: (c, { eq }) => eq(c.deckId, deckId),
    orderBy: (c, { asc }) => [asc(c.id)],
  });
  res.json(cards);
});

// POST /flashcards/decks/:id/cards — add card
flashcardsRouter.post("/decks/:id/cards", authenticate, requireRole("teacher", "admin", "assistant"), async (req: AuthRequest, res: Response) => {
  const deckId = parseInt(req.params.id);
  const { front, back, imageUrl, latexContent, difficulty } = req.body;
  if (!front?.trim() || !back?.trim()) return res.status(400).json({ error: "front and back are required" });
  const [card] = await db.insert(flashcardItemsTable).values({
    deckId, front: front.trim(), back: back.trim(), imageUrl, latexContent,
    difficulty: difficulty || "medium",
  }).returning();
  res.status(201).json(card);
});

// DELETE /flashcards/cards/:id
flashcardsRouter.delete("/cards/:id", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  await db.delete(flashcardItemsTable).where(eq(flashcardItemsTable.id, id));
  res.json({ success: true });
});

// GET /flashcards/decks/:id/mastery — per-deck mastery progression (Phase 33)
flashcardsRouter.get("/decks/:id/mastery", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const deckId = parseInt(req.params.id);
    const studentId = req.userId!;

    const [cardsResult, progressResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total FROM flashcard_items WHERE deck_id = $1`, [deckId]),
      pool.query(`
        SELECT
          fp.mastery_level,
          COUNT(*)            AS count,
          ROUND(AVG(fp.ease_factor)) AS avg_ease,
          MIN(fp.next_review) AS next_due
        FROM flashcard_progress fp
        JOIN flashcard_items fi ON fi.id = fp.card_id
        WHERE fi.deck_id = $1 AND fp.student_id = $2
        GROUP BY fp.mastery_level
      `, [deckId, studentId]),
    ]);

    const total = parseInt(cardsResult.rows[0]?.total ?? 0);
    const breakdown: Record<string, number> = { new: 0, struggling: 0, learning: 0, mastered: 0 };
    let nextDue: string | null = null;

    for (const row of progressResult.rows) {
      breakdown[row.mastery_level] = parseInt(row.count);
      if (row.next_due && (!nextDue || row.next_due < nextDue)) nextDue = row.next_due;
    }

    const studied = Object.values(breakdown).reduce((s, v) => s + v, 0);
    breakdown.new = Math.max(0, total - studied);

    const masteryPct = total > 0
      ? Math.round(((breakdown.mastered ?? 0) / total) * 100)
      : 0;

    res.json({
      deckId,
      total,
      studied,
      masteryPercent: masteryPct,
      breakdown,
      nextDue,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── STUDENT SWIPE ROUTES ─────────────────────────────────────────────────────

// GET /flashcards?limit=N — cards for student swipe mode
flashcardsRouter.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string || "20", 10), 100);
    const cards = await db.query.flashcardItems.findMany({ limit });
    res.json(cards);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /flashcards/track — track card confidence (Easy / Okay / Hard)
flashcardsRouter.post("/track", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.userId!;
    const { cardId, confidence } = req.body;
    if (!cardId) return res.status(400).json({ error: "cardId required" });
    if (!confidence) return res.status(400).json({ error: "confidence required (easy/okay/hard)" });

    const quality = confidenceToQuality(confidence);

    const existing = await db.query.flashcardProgress.findFirst({
      where: (p, { and, eq }) => and(eq(p.studentId, studentId), eq(p.cardId, cardId)),
    });

    const { repetitions, easeFactor, interval, nextReview } = sm2(
      existing?.repetitions ?? 0,
      existing?.easeFactor ?? 250,
      existing?.interval ?? 0,
      quality,
    );

    if (existing) {
      await db.update(flashcardProgressTable).set({
        repetitions, easeFactor, interval, nextReview,
        lastReview: new Date(),
        masteryLevel: qualityToMastery(quality),
      }).where(eq(flashcardProgressTable.id, existing.id));
    } else {
      await db.insert(flashcardProgressTable).values({
        studentId, cardId, repetitions, easeFactor, interval, nextReview,
        lastReview: new Date(),
        masteryLevel: "new",
      });
    }
    res.json({ success: true, nextReview, interval, masteryLevel: qualityToMastery(quality) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /flashcards/student/decks — decks available to student
flashcardsRouter.get("/student/decks", authenticate, requireRole("student"), async (_req: AuthRequest, res: Response) => {
  try {
    const decks = await db.query.flashcardDecks.findMany({
      orderBy: (d, { desc }) => [desc(d.createdAt)],
    });
    res.json(decks);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /flashcards/review — SM-2 review (quality 0-5 or confidence string)
flashcardsRouter.post("/review", authenticate, requireRole("student"), async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.userId!;
    const { cardId, quality: rawQuality, confidence } = req.body;
    if (!cardId) return res.status(400).json({ error: "cardId required" });

    const quality = confidence
      ? confidenceToQuality(confidence)
      : Math.max(0, Math.min(5, parseInt(rawQuality ?? "3", 10)));

    let progress = await db.query.flashcardProgress.findFirst({
      where: (p, { eq, and }) => and(eq(p.studentId, studentId), eq(p.cardId, cardId)),
    });

    const { repetitions, easeFactor, interval, nextReview } = sm2(
      progress?.repetitions ?? 0,
      progress?.easeFactor ?? 250,
      progress?.interval ?? 0,
      quality,
    );

    if (progress) {
      await db.update(flashcardProgressTable).set({
        repetitions, easeFactor, interval, nextReview,
        lastReview: new Date(),
        masteryLevel: qualityToMastery(quality),
      }).where(eq(flashcardProgressTable.id, progress.id));
    } else {
      await db.insert(flashcardProgressTable).values({
        studentId, cardId, repetitions, easeFactor, interval, nextReview,
        lastReview: new Date(), masteryLevel: "new",
      });
    }

    res.json({ nextReview, interval, repetitions, masteryLevel: qualityToMastery(quality) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
