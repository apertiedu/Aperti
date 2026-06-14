/**
 * Email stub — no SMTP budget is available.
 *
 * All calls succeed silently so that callers don't crash,
 * but nothing is actually sent. Any feature that previously
 * relied on email (e.g. password reset) now uses an
 * admin-assisted in-app flow instead.
 */

export async function sendEmail(_opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  // Email sending is intentionally disabled.
  // See admin-password-resets.ts for the replacement flow.
}
