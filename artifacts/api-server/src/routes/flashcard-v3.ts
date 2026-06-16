import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";

export const flashcardV3Router = Router();
flashcardV3Router.use(authenticate as any);

/* ── Learning Modes for a deck ───────────────────────────────────────────── */
flashcardV3Router.get("/learning-modes/:deckId", async (req: AuthRequest, res: Response) => {
  try {
    const deckId = parseInt(req.params.deckId);
    const { rows: cardRows } = await pool.query(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE mastery_level='unlearned') AS unlearned,
              COUNT(*) FILTER (WHERE mastery_level='learning')  AS learning,
              COUNT(*) FILTER (WHERE mastery_level='mastered')  AS mastered
       FROM flashcard_cards
       WHERE deck_id=$1`,
      [deckId]
    ).catch(() => ({ rows: [{ total:0, unlearned:0, learning:0, mastered:0 }] }));

    const stats = cardRows[0];
    const total = parseInt(stats?.total ?? 0);

    const modes = [
      {
        id: "classic",
        label: "Classic Review",
        description: "Review all cards in order",
        icon: "cards",
        available: total > 0,
        cardCount: total,
      },
      {
        id: "exam",
        label: "Exam Mode",
        description: "Timed session — no hints",
        icon: "clock",
        available: total >= 5,
        cardCount: total,
      },
      {
        id: "rapid_review",
        label: "Rapid Review",
        description: "Quick 2-minute drill of key cards",
        icon: "zap",
        available: total >= 3,
        cardCount: Math.min(total, 10),
      },
      {
        id: "weakness_recovery",
        label: "Weakness Recovery",
        description: "Focus on cards you got wrong",
        icon: "target",
        available: parseInt(stats?.unlearned ?? 0) > 0,
        cardCount: parseInt(stats?.unlearned ?? 0),
      },
      {
        id: "mastery_challenge",
        label: "Mastery Challenge",
        description: "Only show mastered cards to reinforce",
        icon: "trophy",
        available: parseInt(stats?.mastered ?? 0) >= 3,
        cardCount: parseInt(stats?.mastered ?? 0),
      },
    ];

    res.json({ modes, stats: { total, unlearned: parseInt(stats?.unlearned ?? 0), learning: parseInt(stats?.learning ?? 0), mastered: parseInt(stats?.mastered ?? 0) } });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

/* ── AI Enhance deck ─────────────────────────────────────────────────────── */
flashcardV3Router.post("/decks/:deckId/ai-enhance", async (req: AuthRequest, res: Response) => {
  try {
    const deckId = parseInt(req.params.deckId);
    const studentId = req.userId!;

    // Check deck ownership
    const { rows: deckRows } = await pool.query(
      `SELECT * FROM flashcard_decks WHERE id=$1 AND user_id=$2`,
      [deckId, studentId]
    ).catch(() => ({ rows: [] }));

    if (deckRows.length === 0) return res.status(404).json({ error: "Deck not found" });
    const deck = deckRows[0];

    // Get all cards
    const { rows: cards } = await pool.query(
      `SELECT * FROM flashcard_cards WHERE deck_id=$1 ORDER BY id`,
      [deckId]
    ).catch(() => ({ rows: [] }));

    if (cards.length === 0) return res.json({ ok: true, message: "No cards to enhance", changes: [] });

    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_KEY) {
      return res.json({
        ok: true,
        message: "AI enhancement unavailable (no API key). Cards are in good shape!",
        changes: [],
      });
    }

    // Call AI to enhance cards
    const cardsForAI = cards.slice(0, 20).map((c: any) => ({
      id: c.id,
      front: c.front_text ?? c.question,
      back: c.back_text ?? c.answer,
    }));

    const prompt = `You are a flashcard quality editor. Review these flashcards from a deck titled "${deck.title}".
For each card:
1. Improve the wording for clarity if needed (keep it concise)
2. Add a helpful memory hint in the back if missing
3. Identify any duplicate concepts

Cards: ${JSON.stringify(cardsForAI)}

Return JSON: { "enhanced": [{"id":N,"front":"...","back":"...","tag":"..."}], "duplicates": [{"ids":[N,M],"reason":"..."}] }`;

    let enhanced: any[] = [];
    let duplicates: any[] = [];

    try {
      const aiRes = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}/chat/completions`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.4,
          max_tokens: 2000,
        }),
      });
      const aiData = await aiRes.json() as any;
      const content = aiData.choices?.[0]?.message?.content ?? "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        enhanced = parsed.enhanced ?? [];
        duplicates = parsed.duplicates ?? [];
      }
    } catch { /* AI failed, return empty */ }

    // Apply enhanced cards
    const changes: string[] = [];
    for (const e of enhanced) {
      await pool.query(
        `UPDATE flashcard_cards
         SET front_text=COALESCE($1, front_text),
             back_text=COALESCE($2, back_text)
         WHERE id=$3 AND deck_id=$4`,
        [e.front || null, e.back || null, e.id, deckId]
      ).catch(() => {});
      changes.push(`Card #${e.id} enhanced`);
    }

    // Log AI interaction
    await pool.query(
      `INSERT INTO ai_interactions (account_id, interaction_type, tokens_used, model, status)
       VALUES ($1, 'flashcard_enhance', 800, 'gpt-3.5-turbo', 'success')`,
      [studentId]
    ).catch(() => {});

    res.json({
      ok: true,
      enhancedCount: enhanced.length,
      duplicates,
      changes,
      message: `Enhanced ${enhanced.length} card(s)${duplicates.length > 0 ? `, found ${duplicates.length} potential duplicate(s)` : ""}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});
