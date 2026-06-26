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

    // Server-side confirmation validation — require the exact confirmation phrase
    const CONFIRM_PHRASE = "delete my account";
    const { confirmation, reason } = req.body as { confirmation?: string; reason?: string };
    if (!confirmation || confirmation.trim().toLowerCase() !== CONFIRM_PHRASE) {
      res.status(400).json({ error: "Invalid confirmation phrase. Please type 'delete my account' to confirm." });
      return;
    }

    // Check if a pending deletion request already exists to prevent duplicates
    const existing = await pool.query(
      `SELECT id FROM compliance_requests WHERE user_id = $1
       AND (request_type = 'account_deletion' OR type = 'account_deletion')
       AND status IN ('pending', 'in_review')
       LIMIT 1`,
      [userId]
    ).catch(() => ({ rows: [] }));
    if (existing.rows.length > 0) {
      res.status(409).json({ error: "A deletion request is already pending for your account." });
      return;
    }

    await pool.query(
      `INSERT INTO compliance_requests (user_id, request_type, status, notes, created_at)
       VALUES ($1, 'account_deletion', 'pending', $2, NOW())`,
      [userId, reason?.slice(0, 500) ?? "User requested account deletion"]
    ).catch(async () => {
      // Fallback if column name is 'type' instead of 'request_type'
      await pool.query(
        `INSERT INTO compliance_requests (user_id, type, status, notes, created_at)
         VALUES ($1, 'account_deletion', 'pending', $2, NOW())`,
        [userId, reason?.slice(0, 500) ?? "User requested account deletion"]
      );
    });
    res.json({ success: true, message: "Your account deletion request has been submitted. Our team will process it within 30 days." });
  } catch (err) {
    res.status(500).json({ error: "Failed to submit deletion request" });
  }
});

// GET /api/user/deletion-request-status — check if user has a pending account deletion request
userExportRouter.get("/user/deletion-request-status", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    // Filter strictly to account_deletion requests (both column naming conventions)
    const { rows } = await pool.query(
      `SELECT status, created_at, notes
       FROM compliance_requests
       WHERE user_id = $1
         AND (request_type = 'account_deletion' OR type = 'account_deletion')
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    ).catch(async () => {
      // Fallback for older schema: try requested_at column
      const r2 = await pool.query(
        `SELECT status, requested_at AS created_at, notes
         FROM compliance_requests
         WHERE user_id = $1
           AND (request_type = 'account_deletion' OR type = 'account_deletion')
         ORDER BY requested_at DESC
         LIMIT 1`,
        [userId]
      );
      return { rows: r2.rows };
    });
    if (!rows.length) {
      res.json({ hasPending: false });
      return;
    }
    const r = rows[0];
    const hasPending = r.status === "pending" || r.status === "in_review";
    res.json({
      hasPending,
      status: r.status,
      requestedAt: r.created_at,
    });
  } catch {
    res.json({ hasPending: false });
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
