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
  const id = parseInt(req.params.id as string, 10);
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
  const id = parseInt(req.params.id as string, 10);
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


export default router;
