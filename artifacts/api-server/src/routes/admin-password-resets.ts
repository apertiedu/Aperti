/**
 * Admin-Assisted Password Reset
 *
 * No email is sent at any point. Flow:
 *   1. User submits request via POST /auth/forgot-password (stores a DB row)
 *   2. Admin views pending requests via GET  /api/admin/password-resets
 *   3. Admin approves → temp password generated, must_change_password set
 *   4. Admin rejects → request marked rejected with optional note
 */
import { Router, Request, Response } from "express";
import { pool } from "@workspace/db";
import bcrypt from "bcryptjs";
import { requireRole } from "../middleware/auth";

export const adminPasswordResetsRouter = Router();
adminPasswordResetsRouter.use(requireRole("admin", "super_admin"));

// ── GET /api/admin/password-resets ────────────────────────────────────────────
adminPasswordResetsRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        pr.id,
        pr.status,
        pr.email,
        pr.username,
        pr.admin_note,
        pr.created_at,
        pr.resolved_at,
        a.id          AS account_id,
        a.display_name,
        a.username    AS account_username,
        a.email       AS account_email,
        a.role,
        ra.display_name AS resolved_by_name
      FROM password_reset_requests pr
      LEFT JOIN accounts a  ON a.id  = pr.account_id
      LEFT JOIN accounts ra ON ra.id = pr.resolved_by
      ORDER BY
        CASE pr.status WHEN 'pending' THEN 0 ELSE 1 END,
        pr.created_at DESC
      LIMIT 200
    `);
    res.json(rows);
  } catch (err: any) {
    console.error("password-resets list error:", err);
    res.status(500).json({ error: "Failed to fetch password reset requests" });
  }
});

// ── POST /api/admin/password-resets/:id/approve ───────────────────────────────
adminPasswordResetsRouter.post("/:id/approve", async (req: Request, res: Response) => {
  const { id } = req.params;
  const adminId = (req as any).userId;
  try {
    const { rows } = await pool.query(
      `SELECT pr.*, a.id AS account_id FROM password_reset_requests pr
       LEFT JOIN accounts a ON a.id = pr.account_id
       WHERE pr.id = $1 AND pr.status = 'pending'`,
      [parseInt(id)]
    );
    if (!rows.length) {
      return res.status(404).json({ error: "Request not found or already resolved" });
    }
    const req_row = rows[0];

    // Generate a secure temporary password
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
    let tempPassword = "";
    for (let i = 0; i < 12; i++) {
      tempPassword += chars[Math.floor(Math.random() * chars.length)];
    }
    const hash = await bcrypt.hash(tempPassword, 12);

    await pool.query(
      `UPDATE accounts
       SET password_hash = $1, must_change_password = TRUE, updated_at = NOW()
       WHERE id = $2`,
      [hash, req_row.account_id]
    );

    await pool.query(
      `UPDATE password_reset_requests
       SET status = 'approved', resolved_at = NOW(), resolved_by = $1, temp_password = $2
       WHERE id = $3`,
      [adminId, tempPassword, parseInt(id)]
    );

    res.json({
      success: true,
      tempPassword,
      message: "Password reset approved. Share the temporary password securely with the user. They will be required to change it on next login.",
    });
  } catch (err: any) {
    console.error("password-reset approve error:", err);
    res.status(500).json({ error: "Failed to approve password reset" });
  }
});

// ── POST /api/admin/password-resets/:id/reject ────────────────────────────────
adminPasswordResetsRouter.post("/:id/reject", async (req: Request, res: Response) => {
  const { id } = req.params;
  const adminId = (req as any).userId;
  const { note } = req.body;
  try {
    const result = await pool.query(
      `UPDATE password_reset_requests
       SET status = 'rejected', resolved_at = NOW(), resolved_by = $1, admin_note = $2
       WHERE id = $3 AND status = 'pending'
       RETURNING id`,
      [adminId, note?.slice(0, 500) ?? null, parseInt(id)]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: "Request not found or already resolved" });
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error("password-reset reject error:", err);
    res.status(500).json({ error: "Failed to reject password reset request" });
  }
});
