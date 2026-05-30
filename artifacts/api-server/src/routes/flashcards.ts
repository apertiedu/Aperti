import { Router, Response } from "express";
import { db } from "../lib/db";
import { authenticate, AuthRequest, requireRole } from "../middleware/auth";
import { flashcardDecksTable, flashcardItemsTable, flashcardProgressTable } from "@lib/db/schema/flashcards";
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
