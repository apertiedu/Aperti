import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { pool } from "@workspace/db";

export const messagesRouter = Router();

/* ── Unread count ──────────────────────────────────────────────────────── */
messagesRouter.get("/messages/unread-count", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS count FROM messages WHERE to_account_id=$1 AND read=false`,
      [req.userId!],
    );
    res.json({ count: Number(rows[0].count) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── Conversations list ────────────────────────────────────────────────── */
messagesRouter.get("/messages/conversations", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.userId!;
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (other_id)
         other_id,
         other_name,
         other_role,
         last_body,
         last_at,
         unread
       FROM (
         SELECT
           CASE WHEN m.from_account_id=$1 THEN m.to_account_id ELSE m.from_account_id END AS other_id,
           a.display_name AS other_name,
           a.role AS other_role,
           m.body AS last_body,
           m.created_at AS last_at,
           (m.to_account_id=$1 AND m.read=false) AS unread
         FROM messages m
         JOIN accounts a ON a.id = CASE WHEN m.from_account_id=$1 THEN m.to_account_id ELSE m.from_account_id END
         WHERE m.from_account_id=$1 OR m.to_account_id=$1
         ORDER BY m.created_at DESC
       ) sub
       ORDER BY other_id, last_at DESC`,
      [uid],
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── Thread with one account ───────────────────────────────────────────── */
messagesRouter.get("/messages/thread/:accountId", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.userId!;
    const other = parseInt(req.params.accountId);
    const { rows } = await pool.query(
      `SELECT m.*, a.display_name AS sender_name
         FROM messages m
         JOIN accounts a ON a.id = m.from_account_id
        WHERE (m.from_account_id=$1 AND m.to_account_id=$2)
           OR (m.from_account_id=$2 AND m.to_account_id=$1)
        ORDER BY m.created_at ASC`,
      [uid, other],
    );
    await pool.query("UPDATE messages SET read=true WHERE to_account_id=$1 AND from_account_id=$2 AND read=false", [uid, other]);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── Send message ──────────────────────────────────────────────────────── */
messagesRouter.post("/messages", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { to_account_id, subject, body } = req.body;
    if (!to_account_id || !body) return res.status(400).json({ error: "Missing fields" });
    const { rows } = await pool.query(
      `INSERT INTO messages (from_account_id, to_account_id, subject, body) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.userId!, to_account_id, subject || null, body],
    );
    res.status(201).json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── List contacts (students + parents linked to teacher) ──────────────── */
messagesRouter.get("/messages/contacts", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.userId!;
    const { rows } = await pool.query(
      `SELECT a.id, a.display_name, a.role
         FROM accounts a
        WHERE a.role IN ('student','parent')
        ORDER BY a.display_name
        LIMIT 200`,
      [],
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── Announcements list ────────────────────────────────────────────────── */
messagesRouter.get("/announcements", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.*, s.name AS subject_name
         FROM announcements a
         LEFT JOIN subjects s ON a.subject_id = s.id
        WHERE a.teacher_account_id=$1
        ORDER BY a.created_at DESC`,
      [req.userId!],
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── Create announcement ───────────────────────────────────────────────── */
messagesRouter.post("/announcements", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { title, body, audience, subject_id } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO announcements (teacher_account_id, title, body, audience, subject_id, sent_at)
       VALUES ($1,$2,$3,$4,$5, NOW()) RETURNING *`,
      [req.userId!, title, body, audience || "all", subject_id || null],
    );
    res.status(201).json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── Delete announcement ───────────────────────────────────────────────── */
messagesRouter.delete("/announcements/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query("DELETE FROM announcements WHERE id=$1 AND teacher_account_id=$2", [req.params.id, req.userId!]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
