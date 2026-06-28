/**
 * Email verification workflow — Aperti SaaS
 *
 * Endpoints:
 *   POST /api/auth/send-verification-email   — generate token + send link
 *   GET  /api/auth/verify-email?token=X      — consume token + mark verified
 *   GET  /api/auth/email-verification-status — current verified status
 */
import { Router, Response } from "express";
import { randomBytes } from "crypto";
import { pool } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import { sendEmail } from "../lib/email";
import { logError } from "../lib/log-error";

export const emailVerificationRouter = Router();

// ── Ensure token table ────────────────────────────────────────────────────────
pool.query(`
  CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id          serial PRIMARY KEY,
    account_id  integer NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    token       text    NOT NULL UNIQUE,
    expires_at  timestamptz NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
    used_at     timestamptz,
    created_at  timestamptz NOT NULL DEFAULT NOW()
  )
`).catch(() => {});

pool.query(`
  CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_account
  ON email_verification_tokens (account_id)
`).catch(() => {});

// ── Rate-limit: one send per 5 minutes per account ───────────────────────────
const SEND_COOLDOWN_MS = 5 * 60 * 1000;
const sendCooldown = new Map<number, number>();

// ── POST /api/auth/send-verification-email ───────────────────────────────────
emailVerificationRouter.post(
  "/auth/send-verification-email",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId!;

      // Check if already verified
      const { rows: acctRows } = await pool.query(
        `SELECT email, display_name, email_verified FROM accounts WHERE id = $1`,
        [userId],
      );
      if (!acctRows.length) {
        res.status(404).json({ error: "Account not found" });
        return;
      }
      const acct = acctRows[0];

      if (acct.email_verified) {
        res.json({ ok: true, already_verified: true, message: "Email is already verified." });
        return;
      }

      if (!acct.email) {
        res.status(400).json({ error: "No email address on file. Add an email address first." });
        return;
      }

      // Rate-limit check
      const lastSent = sendCooldown.get(userId) ?? 0;
      if (Date.now() - lastSent < SEND_COOLDOWN_MS) {
        const retryAfterSec = Math.ceil((SEND_COOLDOWN_MS - (Date.now() - lastSent)) / 1000);
        res.status(429).json({ error: "Verification email sent recently. Please wait.", retryAfterSec });
        return;
      }

      // Invalidate any unused tokens for this account
      await pool.query(
        `UPDATE email_verification_tokens
         SET used_at = NOW()
         WHERE account_id = $1 AND used_at IS NULL`,
        [userId],
      ).catch(() => {});

      // Generate token
      const token = randomBytes(32).toString("hex");
      await pool.query(
        `INSERT INTO email_verification_tokens (account_id, token, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '24 hours')`,
        [userId, token],
      );

      sendCooldown.set(userId, Date.now());

      // Build verification URL
      const baseUrl =
        process.env.PUBLIC_URL ??
        (process.env.NODE_ENV === "production"
          ? "https://aperti.ai"
          : `https://${process.env.REPLIT_DEV_DOMAIN ?? "localhost:5000"}`);
      const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

      await sendEmail({
        to: acct.email,
        subject: "Verify your Aperti email address",
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
            <h2 style="color:#1e40af">Verify your email address</h2>
            <p>Hi ${acct.display_name ?? "there"},</p>
            <p>Click the button below to verify your email address. The link expires in <strong>24 hours</strong>.</p>
            <p style="margin:24px 0">
              <a href="${verifyUrl}"
                 style="background:#1e40af;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block">
                Verify email
              </a>
            </p>
            <p style="color:#666;font-size:13px">
              If you didn't create an Aperti account, you can safely ignore this email.
            </p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
            <p style="color:#999;font-size:12px">Aperti · Educational OS</p>
          </div>
        `,
        text: `Verify your Aperti email\n\nHi ${acct.display_name ?? "there"},\n\nClick the link below to verify your email (expires in 24 hours):\n${verifyUrl}\n\nIf you didn't create an Aperti account, ignore this email.\n`,
      });

      res.json({ ok: true, message: "Verification email sent. Please check your inbox." });
    } catch (err) {
      await logError(err, { route: "POST /api/auth/send-verification-email" });
      res.status(500).json({ error: "Failed to send verification email" });
    }
  },
);

// ── GET /api/auth/verify-email?token=X ───────────────────────────────────────
emailVerificationRouter.get(
  "/auth/verify-email",
  async (req, res): Promise<void> => {
    const { token } = req.query as { token?: string };

    const frontendBase =
      process.env.PUBLIC_URL ??
      (process.env.NODE_ENV === "production"
        ? "https://aperti.ai"
        : `https://${process.env.REPLIT_DEV_DOMAIN ?? "localhost:5000"}`);

    if (!token || typeof token !== "string" || token.length < 16) {
      res.redirect(`${frontendBase}/verify-email?error=invalid_token`);
      return;
    }

    try {
      // Look up token
      const { rows } = await pool.query(
        `SELECT evt.id, evt.account_id, evt.expires_at, evt.used_at, a.email_verified
         FROM email_verification_tokens evt
         JOIN accounts a ON a.id = evt.account_id
         WHERE evt.token = $1`,
        [token],
      );

      if (!rows.length) {
        res.redirect(`${frontendBase}/verify-email?error=invalid_token`);
        return;
      }

      const row = rows[0];

      if (row.used_at) {
        res.redirect(`${frontendBase}/verify-email?error=token_used`);
        return;
      }

      if (new Date(row.expires_at) < new Date()) {
        res.redirect(`${frontendBase}/verify-email?error=token_expired`);
        return;
      }

      // Mark token used + account verified (idempotent)
      await Promise.all([
        pool.query(
          `UPDATE email_verification_tokens SET used_at = NOW() WHERE id = $1`,
          [row.id],
        ),
        pool.query(
          `UPDATE accounts
           SET email_verified = true, verified_at = NOW(), updated_at = NOW()
           WHERE id = $1 AND (email_verified IS NULL OR email_verified = false)`,
          [row.account_id],
        ),
      ]);

      res.redirect(`${frontendBase}/verify-email?success=1`);
    } catch (err) {
      await logError(err, { route: "GET /api/auth/verify-email" });
      res.redirect(`${frontendBase}/verify-email?error=server_error`);
    }
  },
);

// ── GET /api/auth/email-verification-status ──────────────────────────────────
emailVerificationRouter.get(
  "/auth/email-verification-status",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT email, email_verified, verified_at FROM accounts WHERE id = $1`,
        [req.userId],
      );
      if (!rows.length) {
        res.status(404).json({ error: "Account not found" });
        return;
      }
      const { email, email_verified, verified_at } = rows[0];

      // Check if a pending (un-expired) token exists
      const { rows: tokenRows } = await pool.query(
        `SELECT expires_at FROM email_verification_tokens
         WHERE account_id = $1 AND used_at IS NULL AND expires_at > NOW()
         ORDER BY created_at DESC LIMIT 1`,
        [req.userId],
      ).catch(() => ({ rows: [] }));

      res.json({
        email,
        email_verified: !!email_verified,
        verified_at: verified_at ?? null,
        pending_token: tokenRows.length > 0,
        token_expires_at: tokenRows[0]?.expires_at ?? null,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch verification status" });
    }
  },
);
