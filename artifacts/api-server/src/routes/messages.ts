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
  } catch (e: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
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
  } catch (e: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
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
  } catch (e: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
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
  } catch (e: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
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
  } catch (e: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

/* ── Announcements list ────────────────────────────────────────────────── */
messagesRouter.get("/announcements", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.userId!;
    const role = req.role;
    let query: string;
    if (role === "teacher" || role === "admin" || role === "assistant") {
      query = `SELECT a.*, acc.display_name AS sender_name,
        EXISTS(SELECT 1 FROM announcement_reads ar WHERE ar.announcement_id = a.id AND ar.user_id = $1) AS is_read
        FROM announcements a
        JOIN accounts acc ON acc.id = a.sender_id
        WHERE a.sender_id = $1
        ORDER BY a.created_at DESC`;
    } else {
      query = `SELECT a.*, acc.display_name AS sender_name,
        EXISTS(SELECT 1 FROM announcement_reads ar WHERE ar.announcement_id = a.id AND ar.user_id = $1) AS is_read
        FROM announcements a
        JOIN accounts acc ON acc.id = a.sender_id
        WHERE a.status = 'delivered'
        ORDER BY a.created_at DESC`;
    }
    const { rows } = await pool.query(query, [uid]);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

/* ── Create announcement ───────────────────────────────────────────────── */
messagesRouter.post("/announcements", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { title, body, audience_type, audience_ids, scheduled_at } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO announcements (sender_id, title, body, audience_type, audience_ids, status, created_at)
       VALUES ($1,$2,$3,$4,$5, 'delivered', NOW()) RETURNING *`,
      [req.userId!, title, body, audience_type || "all", audience_ids || null],
    );
    res.status(201).json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

/* ── Delete announcement ───────────────────────────────────────────────── */
messagesRouter.delete("/announcements/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query("DELETE FROM announcements WHERE id=$1 AND sender_id=$2", [req.params.id, req.userId!]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});
