import { Router, Response } from "express";
import { authenticate, AuthRequest, requireRole } from "../middleware/auth";
import { pool } from "@workspace/db";
import { openaiChat } from "../lib/ai-config";

export const revisionNotesRouter = Router();

// GET /api/revision-notes — list user's notes
revisionNotesRouter.get("/revision-notes", authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { source_type, ai_only, pending_review } = req.query as Record<string, string>;
  let query = `SELECT * FROM revision_notes WHERE user_id = $1`;
  const params: unknown[] = [userId];
  if (source_type) { query += ` AND source_type = $2`; params.push(source_type); }
  if (ai_only === "true") { query += ` AND ai_generated = true`; }
  if (pending_review === "true") { query += ` AND ai_generated = true AND teacher_reviewed = false`; }
  query += ` ORDER BY updated_at DESC`;
  const { rows } = await pool.query(query, params);
  res.json(rows);
});

// GET /api/revision-notes/pending-review — AI notes awaiting teacher review
revisionNotesRouter.get("/revision-notes/pending-review", authenticate, requireRole("teacher", "admin", "assistant"), async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { rows } = await pool.query(
    `SELECT rn.*, ac.display_name AS author_name
     FROM revision_notes rn
     LEFT JOIN accounts ac ON ac.id = rn.user_id
     WHERE rn.ai_generated = true AND rn.teacher_reviewed = false
       AND (rn.user_id = $1 OR EXISTS (
         SELECT 1 FROM students s
         JOIN subjects sub ON sub.id = rn.source_id::int
         WHERE s.account_id = rn.user_id AND sub.teacher_account_id = $1
       ))
     ORDER BY rn.created_at DESC
     LIMIT 50`,
    [userId]
  ).catch(() => ({ rows: [] }));
  res.json(rows);
});

// GET /api/revision-notes/:id — single note
revisionNotesRouter.get("/revision-notes/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { rows } = await pool.query(
    `SELECT * FROM revision_notes WHERE id = $1 AND user_id = $2`,
    [req.params.id, userId],
  );
  if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
  res.json(rows[0]);
});

// POST /api/revision-notes — create note
revisionNotesRouter.post("/revision-notes", authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { title, content, source_type, source_id } = req.body;
  if (!title && !content) return res.status(400).json({ error: "title or content is required" });
  const { rows } = await pool.query(
    `INSERT INTO revision_notes (user_id, title, content, source_type, source_id, ai_generated, teacher_reviewed)
     VALUES ($1, $2, $3, $4, $5, false, true) RETURNING *`,
    [userId, title || "Untitled Note", content || "", source_type || null, source_id || null],
  );
  res.status(201).json(rows[0]);
});

// PUT /api/revision-notes/:id — update note
revisionNotesRouter.put("/revision-notes/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { title, content } = req.body;
  const { rows } = await pool.query(
    `UPDATE revision_notes SET title = COALESCE($1, title), content = COALESCE($2, content), updated_at = NOW()
     WHERE id = $3 AND user_id = $4 RETURNING *`,
    [title, content, req.params.id, userId],
  );
  if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
  res.json(rows[0]);
});

// PATCH /api/revision-notes/:id/approve — teacher marks AI note as reviewed
revisionNotesRouter.patch("/revision-notes/:id/approve", authenticate, requireRole("teacher", "admin", "assistant"), async (req: AuthRequest, res: Response) => {
  const { rows } = await pool.query(
    `UPDATE revision_notes SET teacher_reviewed = true, updated_at = NOW()
     WHERE id = $1 RETURNING id, title, teacher_reviewed`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  res.json({ success: true, note: rows[0] });
});

// PATCH /api/revision-notes/:id/reject — teacher deletes/rejects AI note
revisionNotesRouter.patch("/revision-notes/:id/reject", authenticate, requireRole("teacher", "admin", "assistant"), async (req: AuthRequest, res: Response) => {
  await pool.query(`DELETE FROM revision_notes WHERE id = $1 AND ai_generated = true`, [req.params.id]);
  res.json({ success: true });
});

// DELETE /api/revision-notes/:id — delete note
revisionNotesRouter.delete("/revision-notes/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  await pool.query(`DELETE FROM revision_notes WHERE id = $1 AND user_id = $2`, [req.params.id, userId]);
  res.json({ success: true });
});

// POST /api/revision-notes/generate — AI-generate notes from source
revisionNotesRouter.post("/revision-notes/generate", authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { source_type, source_id, topic, content: sourceContent } = req.body;

  let contextText = sourceContent || topic || "general revision notes";

  if (source_type === "lesson" && source_id) {
    const r = await pool.query(
      `SELECT lc.content FROM lesson_content lc
       JOIN lessons l ON l.id = lc.lesson_id
       WHERE l.id = $1 LIMIT 1`,
      [source_id],
    );
    if (r.rows[0]?.content) contextText = JSON.stringify(r.rows[0].content).substring(0, 2000);
  } else if (source_type === "past_paper" && source_id) {
    const r = await pool.query(
      `SELECT title, subject, year FROM past_papers WHERE id = $1 LIMIT 1`,
      [source_id],
    );
    if (r.rows[0]) contextText = `Past paper: ${r.rows[0].title} (${r.rows[0].subject}, ${r.rows[0].year})`;
  }

  const aiResponse = await openaiChat({
    systemPrompt: `You are an expert educational content writer. Generate comprehensive revision notes that are well-structured, clear, and examination-focused. Return JSON: {"title":"...","content":"...","keyPoints":["..."],"examTips":["..."]}`,
    userMessage: `Generate revision notes for: ${contextText.substring(0, 2000)}`,
    maxTokens: 1500,
  });

  let parsed: Record<string, unknown> = {};
  if (aiResponse) {
    try {
      const m = aiResponse.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    } catch { parsed = { title: "AI Revision Notes", content: aiResponse }; }
  }

  const title = (parsed.title as string) || "AI Revision Notes";
  const noteContent = [
    parsed.content as string,
    parsed.keyPoints ? `\n\n**Key Points:**\n${(parsed.keyPoints as string[]).map(p => `• ${p}`).join("\n")}` : "",
    parsed.examTips ? `\n\n**Exam Tips:**\n${(parsed.examTips as string[]).map(t => `• ${t}`).join("\n")}` : "",
  ].join("").trim();

  const { rows } = await pool.query(
    `INSERT INTO revision_notes (user_id, title, content, source_type, source_id, ai_generated, teacher_reviewed)
     VALUES ($1, $2, $3, $4, $5, true, false) RETURNING *`,
    [userId, title, noteContent, source_type || null, source_id || null],
  );
  res.status(201).json({ ...rows[0], pendingReview: true });
});
