import { Router, Request, Response } from "express";
import { pool, db } from "@workspace/db";
import { requireRole } from "../middleware/auth";
import { sql } from "drizzle-orm";

export const adminSupportRouter = Router();
adminSupportRouter.use(requireRole("admin", "super_admin"));

adminSupportRouter.get("/tickets", async (req: Request, res: Response) => {
  try {
    const { status, page = "1", limit = "50" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    // Use parameterized queries to prevent SQL injection
    if (status) {
      const { rows } = await pool.query(
        `SELECT t.*, a.username, a.display_name, a.email
         FROM helpdesk_tickets t
         LEFT JOIN accounts a ON a.id = t.account_id
         WHERE t.status = $1
         ORDER BY t.created_at DESC
         LIMIT $2 OFFSET $3`,
        [status, limitNum, offset]
      ).catch(() => ({ rows: [] }));
      const { rows: cnt } = await pool.query(
        `SELECT count(*)::int as c FROM helpdesk_tickets WHERE status = $1`,
        [status]
      ).catch(() => ({ rows: [{ c: 0 }] }));
      return res.json({ tickets: rows, total: cnt[0].c });
    } else {
      const { rows } = await pool.query(
        `SELECT t.*, a.username, a.display_name, a.email
         FROM helpdesk_tickets t
         LEFT JOIN accounts a ON a.id = t.account_id
         ORDER BY t.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limitNum, offset]
      ).catch(() => ({ rows: [] }));
      const { rows: cnt } = await pool.query(
        `SELECT count(*)::int as c FROM helpdesk_tickets`
      ).catch(() => ({ rows: [{ c: 0 }] }));
      return res.json({ tickets: rows, total: cnt[0].c });
    }
  } catch (err) {
    console.error("[admin-support] GET /tickets error:", err);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

adminSupportRouter.put("/tickets/:id/assign", async (req: Request, res: Response) => {
  try {
    const ticketId = parseInt(req.params.id);
    const { assigneeId } = req.body;
    if (!ticketId || isNaN(ticketId)) return res.status(400).json({ error: "Invalid ticket ID" });
    await pool.query(
      "UPDATE helpdesk_tickets SET assigned_to = $1 WHERE id = $2",
      [assigneeId, ticketId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("[admin-support] PUT /tickets/:id/assign error:", err);
    res.status(500).json({ error: "Failed to assign ticket" });
  }
});

adminSupportRouter.put("/tickets/:id/resolve", async (req: Request, res: Response) => {
  try {
    const ticketId = parseInt(req.params.id);
    const { resolution } = req.body;
    if (!ticketId || isNaN(ticketId)) return res.status(400).json({ error: "Invalid ticket ID" });
    await pool.query(
      "UPDATE helpdesk_tickets SET status = 'resolved', resolution = $1, resolved_at = NOW() WHERE id = $2",
      [resolution, ticketId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("[admin-support] PUT /tickets/:id/resolve error:", err);
    res.status(500).json({ error: "Failed to resolve ticket" });
  }
});

adminSupportRouter.get("/tickets/analytics", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        count(*) as total,
        sum(case when status='open' then 1 else 0 end) as open,
        sum(case when status='resolved' then 1 else 0 end) as resolved,
        sum(case when status='in_progress' then 1 else 0 end) as in_progress
      FROM helpdesk_tickets
    `).catch(() => ({ rows: [{ total: 0, open: 0, resolved: 0, in_progress: 0 }] }));
    res.json(rows[0]);
  } catch (err) {
    console.error("[admin-support] GET /tickets/analytics error:", err);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});
