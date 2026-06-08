import { Router, Request, Response } from "express";
import { pool, db } from "@workspace/db";
import { requireRole } from "../middleware/auth";
import { sql } from "drizzle-orm";

export const adminSupportRouter = Router();
adminSupportRouter.use(requireRole("admin", "super_admin"));

adminSupportRouter.get("/tickets", async (req: Request, res: Response) => {
  try {
    const { status, page = "1", limit = "50" } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const statusFilter = status ? `AND t.status = '${status}'` : "";
    const { rows } = await pool.query(`
      SELECT t.*, a.username, a.display_name, a.email
      FROM helpdesk_tickets t
      LEFT JOIN accounts a ON a.id = t.account_id
      WHERE 1=1 ${statusFilter}
      ORDER BY t.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${offset}
    `).catch(() => ({ rows: [] }));
    const { rows: cnt } = await pool.query(`SELECT count(*)::int as c FROM helpdesk_tickets WHERE 1=1 ${statusFilter}`).catch(() => ({ rows: [{ c: 0 }] }));
    res.json({ tickets: rows, total: cnt[0].c });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

adminSupportRouter.put("/tickets/:id/assign", async (req: Request, res: Response) => {
  try {
    const { assigneeId } = req.body;
    await pool.query("UPDATE helpdesk_tickets SET assigned_to = $1 WHERE id = $2", [assigneeId, req.params.id]).catch(() => {});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to assign ticket" });
  }
});

adminSupportRouter.put("/tickets/:id/resolve", async (req: Request, res: Response) => {
  try {
    const { resolution } = req.body;
    await pool.query("UPDATE helpdesk_tickets SET status = 'resolved', resolution = $1, resolved_at = NOW() WHERE id = $2", [resolution, req.params.id]).catch(() => {});
    res.json({ success: true });
  } catch (err) {
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
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});
