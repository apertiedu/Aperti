import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, AuthRequest, requireRole } from "../middleware/auth";

export const notificationRulesRouter = Router();
notificationRulesRouter.use(authenticate as any);
notificationRulesRouter.use(requireRole("admin", "super_admin") as any);

notificationRulesRouter.get("/", async (_req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT nr.*, a.display_name AS user_name, a.email AS user_email
       FROM notification_rules nr
       LEFT JOIN accounts a ON nr.user_id=a.id
       ORDER BY nr.created_at DESC LIMIT 100`
    );
    res.json({ rules: rows });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

notificationRulesRouter.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const { user_id, rule_type, config } = req.body;
    if (!rule_type) return res.status(400).json({ error: "rule_type required" });

    const { rows } = await pool.query(
      `INSERT INTO notification_rules (user_id, rule_type, config)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [user_id ?? null, rule_type, JSON.stringify(config ?? {})]
    );
    res.status(201).json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

notificationRulesRouter.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { rule_type, config, is_active } = req.body;
    const { rows } = await pool.query(
      `UPDATE notification_rules
       SET rule_type=COALESCE($1, rule_type),
           config=COALESCE($2::jsonb, config),
           is_active=COALESCE($3, is_active)
       WHERE id=$4 RETURNING *`,
      [rule_type ?? null, config ? JSON.stringify(config) : null, is_active ?? null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

notificationRulesRouter.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(`DELETE FROM notification_rules WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});
