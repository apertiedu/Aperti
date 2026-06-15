import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";

export const contentCalendarRouter = Router();

contentCalendarRouter.use(authenticate, requireRole("admin"));

contentCalendarRouter.get("/admin/content-calendar", async (req: AuthRequest, res: Response) => {
  try {
    const { status, type } = req.query as Record<string, string>;
    let q = `
      SELECT cc.*, a.full_name AS creator_name
      FROM content_calendar cc
      LEFT JOIN accounts a ON a.id = cc.created_by
    `;
    const params: unknown[] = [];
    const where: string[] = [];
    if (status) { params.push(status); where.push(`cc.status = $${params.length}`); }
    if (type)   { params.push(type);   where.push(`cc.content_type = $${params.length}`); }
    if (where.length) q += " WHERE " + where.join(" AND ");
    q += " ORDER BY COALESCE(cc.scheduled_at, cc.created_at) DESC LIMIT 200";
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

contentCalendarRouter.get("/admin/content-calendar/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT cc.*, a.full_name AS creator_name
       FROM content_calendar cc
       LEFT JOIN accounts a ON a.id = cc.created_by
       WHERE cc.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

contentCalendarRouter.post("/admin/content-calendar", async (req: AuthRequest, res: Response) => {
  try {
    const { title, content_type, scheduled_at, payload } = req.body;
    if (!title || !content_type) return res.status(400).json({ error: "title and content_type are required" });
    const status = scheduled_at ? "scheduled" : "draft";
    const { rows } = await pool.query(
      `INSERT INTO content_calendar (title, content_type, status, scheduled_at, payload, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [title, content_type, status, scheduled_at || null, JSON.stringify(payload ?? {}), req.user!.id]
    );
    res.status(201).json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

contentCalendarRouter.put("/admin/content-calendar/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { title, content_type, status, scheduled_at, payload } = req.body;
    const { rows } = await pool.query(
      `UPDATE content_calendar
       SET title=$1, content_type=$2, status=$3, scheduled_at=$4, payload=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [title, content_type, status, scheduled_at || null, JSON.stringify(payload ?? {}), req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

contentCalendarRouter.post("/admin/content-calendar/:id/publish", async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `UPDATE content_calendar
       SET status='published', published_at=NOW(), updated_at=NOW()
       WHERE id=$1 AND status != 'published' RETURNING *`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found or already published" });
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

contentCalendarRouter.post("/admin/content-calendar/:id/cancel", async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `UPDATE content_calendar
       SET status='cancelled', updated_at=NOW()
       WHERE id=$1 AND status IN ('draft','scheduled') RETURNING *`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found or cannot cancel" });
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

contentCalendarRouter.delete("/admin/content-calendar/:id", async (req: AuthRequest, res: Response) => {
  try {
    await pool.query("DELETE FROM content_calendar WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

contentCalendarRouter.get("/admin/content-calendar-due", async (_req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM content_calendar
       WHERE status='scheduled' AND scheduled_at <= NOW()
       ORDER BY scheduled_at ASC`
    );
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
