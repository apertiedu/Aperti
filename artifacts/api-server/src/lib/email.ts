/**
 * Email delivery — Aperti
 *
 * Uses nodemailer with SMTP credentials from environment.
 * Falls back to console-logging the message in development.
 * Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 * to enable real delivery.
 */
import nodemailer from "nodemailer";

export interface EmailOpts {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

function buildTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: process.env.NODE_ENV === "production" },
  });
}

export const SMTP_CONFIGURED = !!(
  process.env.SMTP_HOST &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS
);

export async function sendEmail(opts: EmailOpts): Promise<void> {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@aperti.ai";

  const transport = buildTransport();
  if (!transport) {
    // Dev: print to stdout so engineers can see what would be sent
    console.info(
      `[email-stub] Would send to=${opts.to} subject="${opts.subject}"\n` +
      `  text: ${opts.text ?? "(html only)"}`
    );
    return;
  }

  await transport.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
}

/**
 * Build a password-reset email body with a tokenised link.
 */
export function buildPasswordResetEmail(opts: {
  displayName: string;
  resetUrl: string;
  expiryMinutes: number;
}): { html: string; text: string } {
  const { displayName, resetUrl, expiryMinutes } = opts;
  return {
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1e40af">Reset your Aperti password</h2>
        <p>Hi ${displayName},</p>
        <p>We received a request to reset your password. Click the button below to choose a new one.
           This link expires in <strong>${expiryMinutes} minutes</strong>.</p>
        <p style="margin:24px 0">
          <a href="${resetUrl}"
             style="background:#1e40af;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px">
            Reset password
          </a>
        </p>
        <p style="color:#666;font-size:13px">
          If you didn't request this, you can safely ignore this email.
          Your password will not change until you click the link above.
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
        <p style="color:#999;font-size:12px">Aperti · Educational OS</p>
      </div>
    `,
    text: `Reset your Aperti password\n\nHi ${displayName},\n\nClick the link below to reset your password (expires in ${expiryMinutes} minutes):\n${resetUrl}\n\nIf you didn't request this, ignore this email.\n`,
  };
}
