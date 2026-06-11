import { Router, Request, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";

export const problemReportsRouter = Router();

// POST /problem-reports — submit a bug/problem report
problemReportsRouter.post("/problem-reports", authenticate as any, async (req: AuthRequest, res: Response) => {
  try {
    const { category, description, pageUrl, userAgent } = req.body;
    if (!description?.trim()) {
      return res.status(400).json({ error: "Description is required" });
    }
    const { pool } = await import("@workspace/db");
    await pool.query(
      `INSERT INTO problem_reports
         (account_id, category, description, page_url, user_agent, ip_address, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'open', NOW())`,
      [
        req.userId ?? null,
        (category || "Other").slice(0, 100),
        description.trim().slice(0, 2000),
        (pageUrl || "").slice(0, 500),
        (userAgent || req.headers["user-agent"] || "").slice(0, 500),
        req.ip ?? null,
      ]
    ).catch(async (err: any) => {
      // Table may not exist yet — create it and retry
      if (err.code === "42P01") {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS problem_reports (
            id SERIAL PRIMARY KEY,
            account_id INT REFERENCES accounts(id) ON DELETE SET NULL,
            category VARCHAR(100) NOT NULL DEFAULT 'Other',
            description TEXT NOT NULL,
            page_url VARCHAR(500),
            user_agent TEXT,
            ip_address VARCHAR(60),
            status VARCHAR(20) NOT NULL DEFAULT 'open',
            admin_notes TEXT,
            resolved_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
        await pool.query(
          `INSERT INTO problem_reports
             (account_id, category, description, page_url, user_agent, ip_address, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'open', NOW())`,
          [
            req.userId ?? null,
            (category || "Other").slice(0, 100),
            description.trim().slice(0, 2000),
            (pageUrl || "").slice(0, 500),
            (userAgent || req.headers["user-agent"] || "").slice(0, 500),
            req.ip ?? null,
          ]
        );
      } else {
        throw err;
      }
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("Problem report error:", err);
    res.status(500).json({ error: "Failed to save report" });
  }
});

// GET /admin/problem-reports — admin view all reports
problemReportsRouter.get("/admin/problem-reports", authenticate as any, async (req: AuthRequest, res: Response) => {
  if (req.role !== "admin" && req.role !== "assistant") {
    return res.status(403).json({ error: "Admin only" });
  }
  try {
    const { pool } = await import("@workspace/db");
    const { rows } = await pool.query(`
      SELECT pr.*, a.username, a.display_name, a.role as user_role
      FROM problem_reports pr
      LEFT JOIN accounts a ON a.id = pr.account_id
      ORDER BY pr.created_at DESC
      LIMIT 200
    `);
    res.json(rows);
  } catch (err: any) {
    if (err.code === "42P01") return res.json([]);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

// PATCH /admin/problem-reports/:id — update status/notes
problemReportsRouter.patch("/admin/problem-reports/:id", authenticate as any, async (req: AuthRequest, res: Response) => {
  if (req.role !== "admin" && req.role !== "assistant") {
    return res.status(403).json({ error: "Admin only" });
  }
  try {
    const id = parseInt(req.params.id as string, 10);
    const { status, adminNotes } = req.body;
    const { pool } = await import("@workspace/db");
    const resolved = status === "resolved" ? "NOW()" : "NULL";
    await pool.query(
      `UPDATE problem_reports
       SET status = COALESCE($1, status),
           admin_notes = COALESCE($2, admin_notes),
           resolved_at = ${resolved}
       WHERE id = $3`,
      [status || null, adminNotes || null, id]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Update failed" });
  }
});
