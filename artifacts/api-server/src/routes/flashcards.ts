import { Router, Response } from "express";
import { db } from "@workspace/db";
import { authenticate, AuthRequest, requireRole } from "../middleware/auth";
import { flashcardDecksTable, flashcardItemsTable, flashcardProgressTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export const flashcardsRouter = Router();

// ─── TEACHER ROUTES ───

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
  const { title, description, subjectId } = req.body;
  const [deck] = await db.insert(flashcardDecksTable).values({ teacherAccountId: teacherId, title, description, subjectId }).returning();
  res.status(201).json(deck);
});

// DELETE /flashcards/decks/:id
flashcardsRouter.delete("/decks/:id", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  await db.delete(flashcardDecksTable).where(eq(flashcardDecksTable.id, id));
  res.json({ success: true });
});

// GET /flashcards/decks/:id/cards — cards in a deck
flashcardsRouter.get("/decks/:id/cards", authenticate, async (req: AuthRequest, res: Response) => {
  const deckId = parseInt(req.params.id);
  const cards = await db.query.flashcardItems.findMany({
    where: (c, { eq }) => eq(c.deckId, deckId),
  });
  res.json(cards);
});

// POST /flashcards/decks/:id/cards — add card
flashcardsRouter.post("/decks/:id/cards", authenticate, requireRole("teacher", "admin", "assistant"), async (req: AuthRequest, res: Response) => {
  const deckId = parseInt(req.params.id);
  const { front, back, imageUrl, latexContent, difficulty } = req.body;
  const [card] = await db.insert(flashcardItemsTable).values({ deckId, front, back, imageUrl, latexContent, difficulty }).returning();
  res.status(201).json(card);
});

// DELETE /flashcards/cards/:id
flashcardsRouter.delete("/cards/:id", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  await db.delete(flashcardItemsTable).where(eq(flashcardItemsTable.id, id));
  res.json({ success: true });
});

// ─── STUDENT SWIPE ROUTES ───

// GET /flashcards?limit=N — cards for student swipe mode (all cards across all decks)
flashcardsRouter.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string || "20", 10), 100);
    const cards = await db.query.flashcardItems.findMany({ limit });
    res.json(cards);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /flashcards/track — track card confidence (student)
flashcardsRouter.post("/track", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.userId!;
    const { cardId, confidence } = req.body;
    if (!cardId) return res.status(400).json({ error: "cardId required" });
    const quality = confidence === "know" ? 5 : confidence === "unsure" ? 3 : 1;
    const existing = await db.query.flashcardProgress.findFirst({
      where: (p, { and, eq }) => and(eq(p.studentId, studentId), eq(p.cardId, cardId)),
    });
    if (existing) {
      await db.update(flashcardProgressTable).set({
        lastReview: new Date(),
        masteryLevel: quality >= 4 ? "mastered" : quality >= 3 ? "learning" : "struggling",
      }).where(eq(flashcardProgressTable.id, existing.id));
    } else {
      await db.insert(flashcardProgressTable).values({
        studentId, cardId, repetitions: 1, easeFactor: 250, interval: 1,
        nextReview: new Date(Date.now() + 86400000), lastReview: new Date(),
        masteryLevel: quality >= 4 ? "mastered" : "new",
      });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── STUDENT ROUTES ───

// GET /flashcards/student/decks — decks available to student
flashcardsRouter.get("/student/decks", authenticate, requireRole("student"), async (req: AuthRequest, res: Response) => {
  // In a full system, we'd find the student's teacher and return their decks + public decks
  const decks = await db.query.flashcardDecks.findMany();
  res.json(decks);
});

// POST /flashcards/review — log review (SM-2 algorithm)
flashcardsRouter.post("/review", authenticate, requireRole("student"), async (req: AuthRequest, res: Response) => {
  const studentId = req.userId!;
  const { cardId, quality } = req.body; // quality: 0-5 rating

  // Fetch existing progress or create new
  let progress = await db.query.flashcardProgress.findFirst({
    where: (p, { eq, and }) => and(eq(p.studentId, studentId), eq(p.cardId, cardId)),
  });

  let { repetitions = 0, easeFactor = 250, interval = 0 } = progress || {};

  // SM-2 algorithm
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

  if (progress) {
    await db.update(flashcardProgressTable).set({
      repetitions, easeFactor: Math.round(easeFactor), interval,
      nextReview, lastReview: new Date(),
      masteryLevel: quality >= 4 ? "mastered" : quality >= 3 ? "learning" : "struggling",
    }).where(eq(flashcardProgressTable.id, progress.id));
  } else {
    await db.insert(flashcardProgressTable).values({
      studentId, cardId, repetitions, easeFactor: Math.round(easeFactor),
      interval, nextReview, lastReview: new Date(),
      masteryLevel: "new",
    });
  }

  res.json({ nextReview, interval, repetitions });
});
