/**
 * ContentCraft Studio API
 *
 * Serves the block-based lesson page editor.
 *
 * Routes (all under /api/contentcraft):
 *   GET    /pages                          — list teacher's pages
 *   GET    /pages/:id                      — get page + its blocks
 *   POST   /pages                          — create page
 *   PUT    /pages/:id                      — update page metadata
 *   DELETE /pages/:id                      — delete page
 *   POST   /pages/:pid/blocks              — add block to page
 *   PUT    /blocks/:id                     — update block content
 *   DELETE /blocks/:id                     — delete block
 *   POST   /blocks/:id/duplicate           — duplicate block
 *   GET    /blocks/:id/version-history     — get block versions
 *   GET    /templates                      — list built-in templates
 *   POST   /generate-from-template        — create page from template
 */
import { Router, Response } from "express";
import { eq, asc, desc, and } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";

export const contentcraftStudioRouter = Router();
contentcraftStudioRouter.use(authenticate);

// ── helpers ──────────────────────────────────────────────────────────────────
async function ensureTableExists() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contentcraft_pages (
        id            SERIAL PRIMARY KEY,
        teacher_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        title         TEXT NOT NULL DEFAULT 'Untitled Page',
        description   TEXT,
        board         TEXT,
        subject       TEXT,
        topic         TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS contentcraft_blocks (
        id          SERIAL PRIMARY KEY,
        page_id     INTEGER NOT NULL REFERENCES contentcraft_pages(id) ON DELETE CASCADE,
        block_type  TEXT NOT NULL DEFAULT 'text',
        content     JSONB NOT NULL DEFAULT '{}',
        position    INTEGER NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS contentcraft_block_versions (
        id          SERIAL PRIMARY KEY,
        block_id    INTEGER NOT NULL REFERENCES contentcraft_blocks(id) ON DELETE CASCADE,
        version     INTEGER NOT NULL DEFAULT 1,
        content     JSONB NOT NULL DEFAULT '{}',
        author_id   INTEGER REFERENCES accounts(id),
        author_name TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  } catch { /* already exists */ }
}

// Run table creation once on module load
ensureTableExists().catch(() => {});

// ── GET /pages — list my pages ────────────────────────────────────────────────
contentcraftStudioRouter.get("/pages", async (req: AuthRequest, res: Response) => {
  try {
    const accountId = req.user?.id;
    const { rows } = await pool.query<any>(
      `SELECT p.*,
         (SELECT COUNT(*) FROM contentcraft_blocks b WHERE b.page_id = p.id)::int AS block_count
       FROM contentcraft_pages p
       WHERE p.teacher_account_id = $1
       ORDER BY p.updated_at DESC`,
      [accountId],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch pages" });
  }
});

// ── GET /pages/:id — get page with blocks ─────────────────────────────────────
contentcraftStudioRouter.get("/pages/:id", async (req: AuthRequest, res: Response) => {
  try {
    const accountId = req.user?.id;
    const { id } = req.params;
    const { rows: pages } = await pool.query<any>(
      `SELECT * FROM contentcraft_pages WHERE id = $1 AND teacher_account_id = $2`,
      [id, accountId],
    );
    if (!pages.length) { res.status(404).json({ error: "Page not found" }); return; }
    const { rows: blocks } = await pool.query<any>(
      `SELECT * FROM contentcraft_blocks WHERE page_id = $1 ORDER BY position ASC, id ASC`,
      [id],
    );
    res.json({ ...pages[0], blocks });
  } catch {
    res.status(500).json({ error: "Failed to fetch page" });
  }
});

// ── POST /pages — create page ─────────────────────────────────────────────────
contentcraftStudioRouter.post("/pages", async (req: AuthRequest, res: Response) => {
  try {
    const accountId = req.user?.id;
    const { title = "New Page", description, board, subject, topic } = req.body as any;
    const { rows } = await pool.query<any>(
      `INSERT INTO contentcraft_pages (teacher_account_id, title, description, board, subject, topic)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [accountId, title, description || null, board || null, subject || null, topic || null],
    );
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ error: "Failed to create page" });
  }
});

// ── PUT /pages/:id — update page metadata ─────────────────────────────────────
contentcraftStudioRouter.put("/pages/:id", async (req: AuthRequest, res: Response) => {
  try {
    const accountId = req.user?.id;
    const { id } = req.params;
    const { title, description, board, subject, topic } = req.body as any;
    const { rows } = await pool.query<any>(
      `UPDATE contentcraft_pages
       SET title=$1, description=$2, board=$3, subject=$4, topic=$5, updated_at=NOW()
       WHERE id=$6 AND teacher_account_id=$7 RETURNING *`,
      [title, description || null, board || null, subject || null, topic || null, id, accountId],
    );
    if (!rows.length) { res.status(404).json({ error: "Page not found" }); return; }
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Failed to update page" });
  }
});

// ── DELETE /pages/:id — delete page ───────────────────────────────────────────
contentcraftStudioRouter.delete("/pages/:id", async (req: AuthRequest, res: Response) => {
  try {
    const accountId = req.user?.id;
    const { id } = req.params;
    await pool.query(
      `DELETE FROM contentcraft_pages WHERE id=$1 AND teacher_account_id=$2`,
      [id, accountId],
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete page" });
  }
});

// ── POST /pages/:pid/blocks — add block ───────────────────────────────────────
contentcraftStudioRouter.post("/pages/:pid/blocks", async (req: AuthRequest, res: Response) => {
  try {
    const accountId = req.user?.id;
    const { pid } = req.params;
    const { blockType = "text", content = {} } = req.body as any;
    // Verify ownership
    const { rows: pages } = await pool.query<any>(
      `SELECT id FROM contentcraft_pages WHERE id=$1 AND teacher_account_id=$2`,
      [pid, accountId],
    );
    if (!pages.length) { res.status(404).json({ error: "Page not found" }); return; }
    // Get max position
    const { rows: posRows } = await pool.query<any>(
      `SELECT COALESCE(MAX(position),0) AS maxpos FROM contentcraft_blocks WHERE page_id=$1`,
      [pid],
    );
    const nextPos = (posRows[0]?.maxpos ?? 0) + 1;
    const { rows } = await pool.query<any>(
      `INSERT INTO contentcraft_blocks (page_id, block_type, content, position)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [pid, blockType, JSON.stringify(content), nextPos],
    );
    // Update page updated_at
    await pool.query(`UPDATE contentcraft_pages SET updated_at=NOW() WHERE id=$1`, [pid]);
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ error: "Failed to add block" });
  }
});

// ── PUT /blocks/:id — update block content ────────────────────────────────────
contentcraftStudioRouter.put("/blocks/:id", async (req: AuthRequest, res: Response) => {
  try {
    const accountId = req.user?.id;
    const { id } = req.params;
    const { content } = req.body as any;
    // Get block and verify ownership via page
    const { rows: blockRows } = await pool.query<any>(
      `SELECT b.*, p.teacher_account_id FROM contentcraft_blocks b
       JOIN contentcraft_pages p ON p.id = b.page_id
       WHERE b.id=$1`,
      [id],
    );
    if (!blockRows.length || blockRows[0].teacher_account_id !== accountId) {
      res.status(404).json({ error: "Block not found" }); return;
    }
    const block = blockRows[0];
    // Save version before updating
    const { rows: verRows } = await pool.query<any>(
      `SELECT COALESCE(MAX(version),0) AS maxver FROM contentcraft_block_versions WHERE block_id=$1`,
      [id],
    );
    const nextVer = (verRows[0]?.maxver ?? 0) + 1;
    await pool.query(
      `INSERT INTO contentcraft_block_versions (block_id, version, content, author_id)
       VALUES ($1,$2,$3,$4)`,
      [id, nextVer, JSON.stringify(block.content), accountId],
    );
    // Update block
    const { rows } = await pool.query<any>(
      `UPDATE contentcraft_blocks SET content=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [JSON.stringify(content), id],
    );
    await pool.query(`UPDATE contentcraft_pages SET updated_at=NOW() WHERE id=$1`, [block.page_id]);
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Failed to update block" });
  }
});

// ── DELETE /blocks/:id — delete block ────────────────────────────────────────
contentcraftStudioRouter.delete("/blocks/:id", async (req: AuthRequest, res: Response) => {
  try {
    const accountId = req.user?.id;
    const { id } = req.params;
    const { rows } = await pool.query<any>(
      `SELECT b.page_id, p.teacher_account_id FROM contentcraft_blocks b
       JOIN contentcraft_pages p ON p.id = b.page_id WHERE b.id=$1`,
      [id],
    );
    if (!rows.length || rows[0].teacher_account_id !== accountId) {
      res.status(404).json({ error: "Block not found" }); return;
    }
    await pool.query(`DELETE FROM contentcraft_blocks WHERE id=$1`, [id]);
    await pool.query(`UPDATE contentcraft_pages SET updated_at=NOW() WHERE id=$1`, [rows[0].page_id]);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete block" });
  }
});

// ── POST /blocks/:id/duplicate — duplicate block ──────────────────────────────
contentcraftStudioRouter.post("/blocks/:id/duplicate", async (req: AuthRequest, res: Response) => {
  try {
    const accountId = req.user?.id;
    const { id } = req.params;
    const { rows: orig } = await pool.query<any>(
      `SELECT b.*, p.teacher_account_id FROM contentcraft_blocks b
       JOIN contentcraft_pages p ON p.id = b.page_id WHERE b.id=$1`,
      [id],
    );
    if (!orig.length || orig[0].teacher_account_id !== accountId) {
      res.status(404).json({ error: "Block not found" }); return;
    }
    const { rows: posRows } = await pool.query<any>(
      `SELECT COALESCE(MAX(position),0) AS maxpos FROM contentcraft_blocks WHERE page_id=$1`,
      [orig[0].page_id],
    );
    const nextPos = (posRows[0]?.maxpos ?? 0) + 1;
    const { rows } = await pool.query<any>(
      `INSERT INTO contentcraft_blocks (page_id, block_type, content, position)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [orig[0].page_id, orig[0].block_type, JSON.stringify(orig[0].content), nextPos],
    );
    await pool.query(`UPDATE contentcraft_pages SET updated_at=NOW() WHERE id=$1`, [orig[0].page_id]);
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ error: "Failed to duplicate block" });
  }
});

// ── GET /blocks/:id/version-history — block versions ─────────────────────────
contentcraftStudioRouter.get("/blocks/:id/version-history", async (req: AuthRequest, res: Response) => {
  try {
    const accountId = req.user?.id;
    const { id } = req.params;
    // Verify ownership
    const { rows: check } = await pool.query<any>(
      `SELECT b.id FROM contentcraft_blocks b
       JOIN contentcraft_pages p ON p.id = b.page_id
       WHERE b.id=$1 AND p.teacher_account_id=$2`,
      [id, accountId],
    );
    if (!check.length) { res.status(404).json({ error: "Block not found" }); return; }
    const { rows } = await pool.query<any>(
      `SELECT v.*, a.display_name AS author_name
       FROM contentcraft_block_versions v
       LEFT JOIN accounts a ON a.id = v.author_id
       WHERE v.block_id=$1 ORDER BY v.version DESC LIMIT 20`,
      [id],
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch version history" });
  }
});

// ── GET /templates — built-in templates ──────────────────────────────────────
contentcraftStudioRouter.get("/templates", async (_req: AuthRequest, res: Response) => {
  res.json({
    builtin: [
      {
        id: "lesson-plan",
        name: "Lesson Plan",
        description: "Structured lesson with objectives, activities, and assessment",
        blocks: [
          { blockType: "heading", content: { text: "Lesson Objectives", level: 2 } },
          { blockType: "callout", content: { text: "By the end of this lesson, students will be able to...", variant: "info" } },
          { blockType: "heading", content: { text: "Introduction", level: 2 } },
          { blockType: "text", content: { text: "Start with an engaging hook..." } },
          { blockType: "heading", content: { text: "Main Activity", level: 2 } },
          { blockType: "text", content: { text: "Describe the main activity..." } },
          { blockType: "heading", content: { text: "Assessment", level: 2 } },
          { blockType: "quiz", content: { question: "Check for understanding:", options: ["Option A", "Option B", "Option C", "Option D"], answer: 0 } },
        ],
      },
      {
        id: "flashcard-deck",
        name: "Flashcard Deck",
        description: "Key terms and definitions for revision",
        blocks: [
          { blockType: "heading", content: { text: "Key Terms", level: 1 } },
          { blockType: "key-terms", content: { terms: [{ term: "Term 1", definition: "Definition 1" }, { term: "Term 2", definition: "Definition 2" }] } },
        ],
      },
      {
        id: "revision-notes",
        name: "Revision Notes",
        description: "Structured notes for exam preparation",
        blocks: [
          { blockType: "heading", content: { text: "Topic Overview", level: 1 } },
          { blockType: "callout", content: { text: "Key exam tip: Focus on...", variant: "warning" } },
          { blockType: "text", content: { text: "Main concepts..." } },
          { blockType: "divider", content: {} },
          { blockType: "key-terms", content: { terms: [] } },
        ],
      },
      {
        id: "blank",
        name: "Blank Page",
        description: "Start from scratch",
        blocks: [],
      },
    ],
  });
});

// ── POST /generate-from-template — create page from template ──────────────────
contentcraftStudioRouter.post("/generate-from-template", async (req: AuthRequest, res: Response) => {
  try {
    const accountId = req.user?.id;
    const { templateId, title = "New Page" } = req.body as any;
    // Fetch template definition (reusing same static list)
    const TEMPLATES: Record<string, any[]> = {
      "lesson-plan": [
        { blockType: "heading", content: { text: "Lesson Objectives", level: 2 } },
        { blockType: "callout", content: { text: "By the end of this lesson, students will be able to...", variant: "info" } },
        { blockType: "heading", content: { text: "Introduction", level: 2 } },
        { blockType: "text", content: { text: "Start with an engaging hook..." } },
        { blockType: "heading", content: { text: "Main Activity", level: 2 } },
        { blockType: "text", content: { text: "Describe the main activity..." } },
        { blockType: "heading", content: { text: "Assessment", level: 2 } },
        { blockType: "quiz", content: { question: "Check for understanding:", options: ["Option A", "Option B", "Option C", "Option D"], answer: 0 } },
      ],
      "flashcard-deck": [
        { blockType: "heading", content: { text: "Key Terms", level: 1 } },
        { blockType: "key-terms", content: { terms: [{ term: "Term 1", definition: "Definition 1" }, { term: "Term 2", definition: "Definition 2" }] } },
      ],
      "revision-notes": [
        { blockType: "heading", content: { text: "Topic Overview", level: 1 } },
        { blockType: "callout", content: { text: "Key exam tip: Focus on...", variant: "warning" } },
        { blockType: "text", content: { text: "Main concepts..." } },
        { blockType: "divider", content: {} },
        { blockType: "key-terms", content: { terms: [] } },
      ],
      "blank": [],
    };
    const blocks = TEMPLATES[templateId] ?? [];
    // Create page
    const { rows: pages } = await pool.query<any>(
      `INSERT INTO contentcraft_pages (teacher_account_id, title) VALUES ($1,$2) RETURNING *`,
      [accountId, title],
    );
    const page = pages[0];
    // Insert template blocks
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      await pool.query(
        `INSERT INTO contentcraft_blocks (page_id, block_type, content, position) VALUES ($1,$2,$3,$4)`,
        [page.id, b.blockType, JSON.stringify(b.content), i + 1],
      );
    }
    res.status(201).json({ ...page, block_count: blocks.length });
  } catch {
    res.status(500).json({ error: "Failed to generate from template" });
  }
});
