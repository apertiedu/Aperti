/**
 * Account suspension workflow — Aperti SaaS
 *
 * Endpoints (all require admin or super_admin):
 *   POST /api/admin/accounts/:id/suspend    — suspend account + notify
 *   POST /api/admin/accounts/:id/unsuspend  — reinstate account + notify
 *   GET  /api/admin/accounts/suspended      — list all suspended accounts
 *   GET  /api/admin/accounts/:id/suspension-history — audit trail
 */
import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { requireRole, AuthRequest } from "../middleware/auth";
import { sendEmail } from "../lib/email";
import { logError } from "../lib/log-error";

export const accountSuspensionRouter = Router();
accountSuspensionRouter.use(requireRole("admin", "super_admin"));

// ── Ensure suspension audit table ─────────────────────────────────────────────
pool.query(`
  CREATE TABLE IF NOT EXISTS account_suspension_log (
    id           serial PRIMARY KEY,
    account_id   integer NOT NULL,
    action       text    NOT NULL CHECK (action IN ('suspended', 'unsuspended')),
    reason       text,
    actor_id     integer,
    actor_role   text,
    created_at   timestamptz NOT NULL DEFAULT NOW()
  )
`).catch(() => {});

pool.query(`
  CREATE INDEX IF NOT EXISTS idx_suspension_log_account
  ON account_suspension_log (account_id, created_at DESC)
`).catch(() => {});

// ── POST /api/admin/accounts/:id/suspend ─────────────────────────────────────
accountSuspensionRouter.post(
  "/:id/suspend",
  async (req: AuthRequest, res: Response): Promise<void> => {
    const accountId = parseInt(req.params.id, 10);
    if (isNaN(accountId)) {
      res.status(400).json({ error: "Invalid account ID" });
      return;
    }

    const { reason } = req.body as { reason?: string };

    try {
      const { rows } = await pool.query(
        `SELECT id, username, display_name, email, status, role FROM accounts WHERE id = $1`,
        [accountId],
      );
      if (!rows.length) {
        res.status(404).json({ error: "Account not found" });
        return;
      }
      const account = rows[0];

      if (account.status === "suspended") {
        res.status(409).json({ error: "Account is already suspended" });
        return;
      }

      // Prevent suspending other admins/super_admins unless actor is super_admin
      if (
        (account.role === "admin" || account.role === "super_admin") &&
        req.role !== "super_admin"
      ) {
        res.status(403).json({ error: "Only super_admin can suspend admin accounts" });
        return;
      }

      await pool.query(
        `UPDATE accounts SET status = 'suspended', updated_at = NOW() WHERE id = $1`,
        [accountId],
      );

      await pool.query(
        `INSERT INTO account_suspension_log (account_id, action, reason, actor_id, actor_role)
         VALUES ($1, 'suspended', $2, $3, $4)`,
        [accountId, reason?.slice(0, 500) ?? null, req.userId, req.role],
      ).catch(() => {});

      // Audit via audit_logs if table available
      await pool.query(
        `INSERT INTO audit_logs (account_id, action, severity, details, created_at)
         VALUES ($1, 'account_suspended', 'high', $2, NOW())`,
        [
          accountId,
          JSON.stringify({ reason, actor_id: req.userId, actor_role: req.role }),
        ],
      ).catch(() => {});

      // Notify the suspended user if they have an email
      if (account.email) {
        sendEmail({
          to: account.email,
          subject: "Your Aperti account has been suspended",
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
              <h2 style="color:#dc2626">Account suspended</h2>
              <p>Hi ${account.display_name ?? account.username},</p>
              <p>Your Aperti account has been suspended${reason ? ` for the following reason: <strong>${reason}</strong>` : ""}.</p>
              <p>If you believe this is an error, please contact our support team.</p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
              <p style="color:#999;font-size:12px">Aperti · Educational OS</p>
            </div>
          `,
          text: `Your Aperti account has been suspended${reason ? ` for the following reason: ${reason}` : ""}.\n\nContact support if you believe this is an error.`,
        }).catch(() => {});
      }

      res.json({
        ok: true,
        account_id: accountId,
        status: "suspended",
        reason: reason ?? null,
        suspended_at: new Date().toISOString(),
      });
    } catch (err) {
      await logError(err, { route: `POST /api/admin/accounts/${accountId}/suspend` });
      res.status(500).json({ error: "Failed to suspend account" });
    }
  },
);

// ── POST /api/admin/accounts/:id/unsuspend ───────────────────────────────────
accountSuspensionRouter.post(
  "/:id/unsuspend",
  async (req: AuthRequest, res: Response): Promise<void> => {
    const accountId = parseInt(req.params.id, 10);
    if (isNaN(accountId)) {
      res.status(400).json({ error: "Invalid account ID" });
      return;
    }

    const { note } = req.body as { note?: string };

    try {
      const { rows } = await pool.query(
        `SELECT id, username, display_name, email, status FROM accounts WHERE id = $1`,
        [accountId],
      );
      if (!rows.length) {
        res.status(404).json({ error: "Account not found" });
        return;
      }
      const account = rows[0];

      if (account.status !== "suspended") {
        res.status(409).json({ error: `Account is not suspended (current status: ${account.status})` });
        return;
      }

      await pool.query(
        `UPDATE accounts SET status = 'active', updated_at = NOW() WHERE id = $1`,
        [accountId],
      );

      await pool.query(
        `INSERT INTO account_suspension_log (account_id, action, reason, actor_id, actor_role)
         VALUES ($1, 'unsuspended', $2, $3, $4)`,
        [accountId, note?.slice(0, 500) ?? null, req.userId, req.role],
      ).catch(() => {});

      await pool.query(
        `INSERT INTO audit_logs (account_id, action, severity, details, created_at)
         VALUES ($1, 'account_unsuspended', 'medium', $2, NOW())`,
        [accountId, JSON.stringify({ note, actor_id: req.userId })],
      ).catch(() => {});

      // Notify the reinstated user
      if (account.email) {
        sendEmail({
          to: account.email,
          subject: "Your Aperti account has been reinstated",
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
              <h2 style="color:#16a34a">Account reinstated</h2>
              <p>Hi ${account.display_name ?? account.username},</p>
              <p>Your Aperti account has been reinstated and you can now log in again.</p>
              ${note ? `<p>Note from our team: <em>${note}</em></p>` : ""}
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
              <p style="color:#999;font-size:12px">Aperti · Educational OS</p>
            </div>
          `,
          text: `Your Aperti account has been reinstated. You can now log in again.${note ? `\n\nNote: ${note}` : ""}`,
        }).catch(() => {});
      }

      res.json({
        ok: true,
        account_id: accountId,
        status: "active",
        reinstated_at: new Date().toISOString(),
      });
    } catch (err) {
      await logError(err, { route: `POST /api/admin/accounts/${accountId}/unsuspend` });
      res.status(500).json({ error: "Failed to unsuspend account" });
    }
  },
);

// ── GET /api/admin/accounts/suspended ────────────────────────────────────────
accountSuspensionRouter.get(
  "/suspended",
  async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(`
        SELECT a.id, a.username, a.display_name, a.email, a.role, a.updated_at AS suspended_since,
               sl.reason AS suspension_reason, sl.actor_id,
               actor.display_name AS suspended_by
        FROM accounts a
        LEFT JOIN LATERAL (
          SELECT reason, actor_id
          FROM account_suspension_log
          WHERE account_id = a.id AND action = 'suspended'
          ORDER BY created_at DESC
          LIMIT 1
        ) sl ON true
        LEFT JOIN accounts actor ON actor.id = sl.actor_id
        WHERE a.status = 'suspended'
        ORDER BY a.updated_at DESC
      `);
      res.json({ suspended: rows, count: rows.length });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch suspended accounts" });
    }
  },
);

// ── GET /api/admin/accounts/:id/suspension-history ───────────────────────────
accountSuspensionRouter.get(
  "/:id/suspension-history",
  async (req: AuthRequest, res: Response): Promise<void> => {
    const accountId = parseInt(req.params.id, 10);
    if (isNaN(accountId)) {
      res.status(400).json({ error: "Invalid account ID" });
      return;
    }
    try {
      const { rows } = await pool.query(
        `SELECT sl.*, a.display_name AS actor_name
         FROM account_suspension_log sl
         LEFT JOIN accounts a ON a.id = sl.actor_id
         WHERE sl.account_id = $1
         ORDER BY sl.created_at DESC`,
        [accountId],
      );
      res.json({ history: rows, count: rows.length });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch suspension history" });
    }
  },
);
