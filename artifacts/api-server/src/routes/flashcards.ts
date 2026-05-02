import { Router, type IRouter } from "express";
import { eq, and, desc, lte, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireTenantAccess } from "../middleware/tenant";
import { pool } from "@workspace/db";

const router: IRouter = Router();

function tenantWhere(teacherId: number | null, isAdmin: boolean) {
  return isAdmin ? sql`1=1` : sql`teacher_account_id = ${teacherId}`;
}

// ── DECKS (grouped view) ──────────────────────────────────────────────────────

router.get("/flashcards/decks", requireTenantAccess, async (req, res): Promise<void> => {
  const { teacherId, isAdmin } = req.tenant;
  const clause = isAdmin ? "" : `WHERE teacher_account_id = ${teacherId}`;
  const { rows } = await pool.query(`
    SELECT deck_name, COUNT(*)::int AS card_count,
      MIN(created_at) AS created_at
    FROM flashcards ${clause}
    GROUP BY deck_name ORDER BY deck_name
  `);
  res.json(rows);
});

// ── CARDS ─────────────────────────────────────────────────────────────────────

router.get("/flashcards", requireTenantAccess, async (req, res): Promise<void> => {
  const { teacherId, isAdmin } = req.tenant;
  const { deck, topic, difficulty, search } = req.query as Record<string, string>;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (!isAdmin && teacherId) { conditions.push(`teacher_account_id = $${i++}`); params.push(teacherId); }
  if (deck) { conditions.push(`deck_name = $${i++}`); params.push(deck); }
  if (topic) { conditions.push(`topic ILIKE $${i++}`); params.push(`%${topic}%`); }
  if (difficulty) { conditions.push(`difficulty = $${i++}`); params.push(difficulty); }
  if (search) { conditions.push(`(front ILIKE $${i} OR back ILIKE $${i++})`); params.push(`%${search}%`); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await pool.query(`SELECT * FROM flashcards ${where} ORDER BY created_at DESC`, params);
  res.json(rows);
});

router.post("/flashcards", requireTenantAccess, async (req, res): Promise<void> => {
  const { teacherId, accountId, isAdmin } = req.tenant;
  const { front, back, deckName, topic, difficulty, tags, subjectId, aiGenerated } = req.body;
  if (!front?.trim() || !back?.trim()) { res.status(400).json({ message: "Front and back are required" }); return; }
  const effectiveTeacherId = isAdmin ? accountId : (teacherId ?? accountId);
  const { rows } = await pool.query(
    `INSERT INTO flashcards (teacher_account_id, subject_id, deck_name, front, back, difficulty, tags, topic, ai_generated)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [effectiveTeacherId, subjectId || null, deckName?.trim() || "General", front.trim(), back.trim(),
     difficulty || "medium", tags?.trim() || null, topic?.trim() || null, aiGenerated || false]
  );
  res.status(201).json(rows[0]);
});

router.patch("/flashcards/:id", requireTenantAccess, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { teacherId, isAdmin } = req.tenant;
  const { front, back, deckName, topic, difficulty, tags } = req.body;
  const sets: string[] = []; const params: unknown[] = []; let i = 1;
  if (front) { sets.push(`front = $${i++}`); params.push(front.trim()); }
  if (back) { sets.push(`back = $${i++}`); params.push(back.trim()); }
  if ("deckName" in req.body) { sets.push(`deck_name = $${i++}`); params.push(deckName?.trim() || "General"); }
  if ("topic" in req.body) { sets.push(`topic = $${i++}`); params.push(topic?.trim() || null); }
  if (difficulty) { sets.push(`difficulty = $${i++}`); params.push(difficulty); }
  if ("tags" in req.body) { sets.push(`tags = $${i++}`); params.push(tags?.trim() || null); }
  if (!sets.length) { res.status(400).json({ message: "Nothing to update" }); return; }
  const tenantCond = isAdmin ? "" : ` AND teacher_account_id = ${teacherId}`;
  params.push(id);
  const { rows } = await pool.query(`UPDATE flashcards SET ${sets.join(",")} WHERE id = $${i}${tenantCond} RETURNING *`, params);
  if (!rows[0]) { res.status(404).json({ message: "Card not found" }); return; }
  res.json(rows[0]);
});

router.delete("/flashcards/:id", requireTenantAccess, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { teacherId, isAdmin } = req.tenant;
  const tenantCond = isAdmin ? "" : ` AND teacher_account_id = ${teacherId}`;
  await pool.query(`DELETE FROM flashcards WHERE id = $1${tenantCond}`, [id]);
  res.json({ message: "Deleted" });
});

// ── BULK CREATE (AI-generated set) ────────────────────────────────────────────

router.post("/flashcards/bulk", requireTenantAccess, async (req, res): Promise<void> => {
  const { teacherId, accountId, isAdmin } = req.tenant;
  const { cards, deckName } = req.body as { cards: { front: string; back: string; topic?: string }[]; deckName: string };
  if (!Array.isArray(cards) || cards.length === 0) { res.status(400).json({ message: "cards array required" }); return; }
  const effectiveTeacherId = isAdmin ? accountId : (teacherId ?? accountId);
  const deck = deckName?.trim() || "AI Generated";
  const inserted = [];
  for (const c of cards) {
    if (!c.front?.trim() || !c.back?.trim()) continue;
    const { rows } = await pool.query(
      `INSERT INTO flashcards (teacher_account_id, deck_name, front, back, topic, ai_generated) VALUES ($1,$2,$3,$4,$5,TRUE) RETURNING *`,
      [effectiveTeacherId, deck, c.front.trim(), c.back.trim(), c.topic?.trim() || null]
    );
    inserted.push(rows[0]);
  }
  res.status(201).json(inserted);
});

// ── STUDENT REVIEW (spaced repetition) ───────────────────────────────────────

router.get("/flashcards/review", requireTenantAccess, async (req, res): Promise<void> => {
  const { studentId, teacherId, isAdmin } = req.tenant;
  if (!studentId) { res.status(403).json({ message: "Students only" }); return; }
  const { deck } = req.query as Record<string, string>;
  const deckCond = deck ? `AND f.deck_name = $3` : "";
  const params: unknown[] = [studentId, teacherId];
  if (deck) params.push(deck);
  // Due cards (never reviewed or next_review_at <= now)
  const { rows } = await pool.query(`
    SELECT f.*, COALESCE(fp.ease_factor, 2.5) AS ease_factor,
      COALESCE(fp.interval_days, 1) AS interval_days,
      COALESCE(fp.reps, 0) AS reps,
      fp.next_review_at, fp.last_quality
    FROM flashcards f
    LEFT JOIN flashcard_progress fp ON fp.flashcard_id = f.id AND fp.student_id = $1
    WHERE f.teacher_account_id = $2 ${deckCond}
      AND (fp.next_review_at IS NULL OR fp.next_review_at <= NOW())
    ORDER BY fp.next_review_at ASC NULLS FIRST
    LIMIT 20
  `, params);
  res.json(rows);
});

router.post("/flashcards/:id/review", requireTenantAccess, async (req, res): Promise<void> => {
  const flashcardId = parseInt(req.params.id, 10);
  const { studentId } = req.tenant;
  if (!studentId) { res.status(403).json({ message: "Students only" }); return; }
  const { quality } = req.body as { quality: number }; // 0-5
  if (quality === undefined || quality < 0 || quality > 5) { res.status(400).json({ message: "quality 0-5 required" }); return; }

  // SM-2 algorithm
  const { rows: existing } = await pool.query(
    `SELECT * FROM flashcard_progress WHERE student_id=$1 AND flashcard_id=$2`, [studentId, flashcardId]
  );
  let ef = parseFloat(existing[0]?.ease_factor ?? "2.5");
  let interval = parseInt(existing[0]?.interval_days ?? "1", 10);
  let reps = parseInt(existing[0]?.reps ?? "0", 10);
  if (quality >= 3) {
    if (reps === 0) interval = 1;
    else if (reps === 1) interval = 6;
    else interval = Math.round(interval * ef);
    reps++;
  } else {
    reps = 0; interval = 1;
  }
  ef = Math.max(1.3, ef + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  const nextReview = new Date(Date.now() + interval * 86400 * 1000);
  await pool.query(`
    INSERT INTO flashcard_progress (student_id, flashcard_id, ease_factor, interval_days, reps, last_quality, next_review_at, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
    ON CONFLICT (student_id, flashcard_id) DO UPDATE SET
      ease_factor=EXCLUDED.ease_factor, interval_days=EXCLUDED.interval_days,
      reps=EXCLUDED.reps, last_quality=EXCLUDED.last_quality,
      next_review_at=EXCLUDED.next_review_at, updated_at=NOW()
  `, [studentId, flashcardId, ef.toFixed(2), interval, reps, quality, nextReview.toISOString()]);
  res.json({ nextReview, interval, easeFactor: ef.toFixed(2), reps });
});

// ── STUDENT STATS ─────────────────────────────────────────────────────────────

router.get("/flashcards/stats", requireTenantAccess, async (req, res): Promise<void> => {
  const { studentId, teacherId } = req.tenant;
  if (!studentId || !teacherId) { res.json({ total: 0, mastered: 0, due: 0, streakDays: 0 }); return; }
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM flashcards WHERE teacher_account_id=$1)::int AS total,
      (SELECT COUNT(*) FROM flashcard_progress fp
       JOIN flashcards f ON f.id=fp.flashcard_id
       WHERE fp.student_id=$2 AND f.teacher_account_id=$1 AND fp.reps >= 5)::int AS mastered,
      (SELECT COUNT(*) FROM flashcards f
       LEFT JOIN flashcard_progress fp ON fp.flashcard_id=f.id AND fp.student_id=$2
       WHERE f.teacher_account_id=$1 AND (fp.next_review_at IS NULL OR fp.next_review_at <= NOW()))::int AS due
  `, [teacherId, studentId]);
  res.json({ ...rows[0], streakDays: 0 });
});

export default router;
