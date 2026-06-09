import { Router, Request, Response } from "express";
import { pool } from "@workspace/db";
import { requireRole } from "../middleware/auth";

export const adminDocsRouter = Router();
adminDocsRouter.use(requireRole("admin", "super_admin"));

adminDocsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const { category, search } = req.query as Record<string, string>;
    let sql = `SELECT * FROM doc_articles WHERE 1=1`;
    const params: any[] = [];
    if (category) { params.push(category); sql += ` AND category = $${params.length}`; }
    if (search) { params.push(`%${search}%`); sql += ` AND (title ILIKE $${params.length} OR content ILIKE $${params.length})`; }
    sql += ` ORDER BY category, title`;
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch documentation articles" });
  }
});

adminDocsRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM doc_articles WHERE id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Article not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch article" });
  }
});

adminDocsRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { title, category, content } = req.body;
    if (!title || !content) return res.status(400).json({ error: "title and content are required" });
    const { rows } = await pool.query(
      `INSERT INTO doc_articles (title, category, content) VALUES ($1, $2, $3) RETURNING *`,
      [title, category || "general", content]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to create article" });
  }
});

adminDocsRouter.put("/:id", async (req: Request, res: Response) => {
  try {
    const { title, category, content } = req.body;
    const { rows } = await pool.query(
      `UPDATE doc_articles SET title=$1, category=$2, content=$3, updated_at=NOW() WHERE id=$4 RETURNING *`,
      [title, category, content, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Article not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to update article" });
  }
});

adminDocsRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    await pool.query(`DELETE FROM doc_articles WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete article" });
  }
});
