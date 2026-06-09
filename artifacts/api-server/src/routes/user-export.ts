import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import { requireRole } from "../middleware/auth";

export const userExportRouter = Router();

userExportRouter.post("/user/export", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const [profile, submissions, grades, messages, subscriptions] = await Promise.all([
      pool.query(`SELECT id, username, display_name, email, role, created_at, country, bio FROM accounts WHERE id = $1`, [userId]).catch(() => ({ rows: [] })),
      pool.query(`SELECT * FROM exam_submissions WHERE student_id = $1 ORDER BY submitted_at DESC LIMIT 200`, [userId]).catch(() => ({ rows: [] })),
      pool.query(`SELECT * FROM grades WHERE student_id = $1 ORDER BY graded_at DESC LIMIT 200`, [userId]).catch(() => ({ rows: [] })),
      pool.query(`SELECT id, subject, body, created_at FROM messages WHERE sender_id = $1 ORDER BY created_at DESC LIMIT 200`, [userId]).catch(() => ({ rows: [] })),
      pool.query(`SELECT s.*, sp.name as plan_name FROM subscriptions s LEFT JOIN subscription_plans sp ON s.plan_id = sp.id WHERE s.user_id = $1`, [userId]).catch(() => ({ rows: [] })),
    ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      profile: profile.rows[0] ?? {},
      submissions: submissions.rows,
      grades: grades.rows,
      messages: messages.rows,
      subscriptions: subscriptions.rows,
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename=aperti-data-export-${userId}-${Date.now()}.json`);
    res.send(JSON.stringify(exportData, null, 2));
  } catch (err) {
    res.status(500).json({ error: "Export failed" });
  }
});

userExportRouter.post("/user/deletion-request", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    await pool.query(
      `INSERT INTO compliance_requests (user_id, request_type, status, notes, created_at)
       VALUES ($1, 'account_deletion', 'pending', $2, NOW())
       ON CONFLICT DO NOTHING`,
      [userId, req.body.reason ?? "User requested account deletion"]
    ).catch(async () => {
      await pool.query(
        `INSERT INTO compliance_requests (user_id, request_type, status, created_at)
         VALUES ($1, 'account_deletion', 'pending', NOW())`,
        [userId]
      );
    });
    res.json({ success: true, message: "Your account deletion request has been submitted. Our team will process it within 30 days." });
  } catch (err) {
    res.status(500).json({ error: "Failed to submit deletion request" });
  }
});

userExportRouter.get("/admin/deletion-requests", requireRole("admin", "super_admin"), async (_req, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT cr.*, a.display_name, a.email, a.username, a.role
      FROM compliance_requests cr
      LEFT JOIN accounts a ON cr.user_id = a.id
      WHERE cr.request_type = 'account_deletion'
      ORDER BY cr.created_at DESC
    `).catch(() => ({ rows: [] }));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch deletion requests" });
  }
});
