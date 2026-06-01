import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const inkspaceRouter = Router();

async function ensureTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS inkspace_notes (
      id SERIAL PRIMARY KEY,
      account_id INTEGER NOT NULL UNIQUE,
      strokes JSONB NOT NULL DEFAULT '[]',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}
ensureTable().catch(console.error);

inkspaceRouter.get("/load", authenticate, async (req: any, res) => {
  try {
    const rows = await db.execute(
      sql`SELECT strokes FROM inkspace_notes WHERE account_id = ${req.user.id}`
    );
    if (rows.rows.length === 0) return res.json({ strokes: [] });
    return res.json({ strokes: rows.rows[0].strokes });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to load" });
  }
});

inkspaceRouter.post("/save", authenticate, async (req: any, res) => {
  try {
    const { strokes } = req.body;
    await db.execute(sql`
      INSERT INTO inkspace_notes (account_id, strokes, updated_at)
      VALUES (${req.user.id}, ${JSON.stringify(strokes)}::jsonb, NOW())
      ON CONFLICT (account_id) DO UPDATE
        SET strokes = ${JSON.stringify(strokes)}::jsonb,
            updated_at = NOW()
    `);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to save" });
  }
});

export default inkspaceRouter;
