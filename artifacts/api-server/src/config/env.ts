/**
 * Environment validation — Aperti
 *
 * Called once at startup. Exits the process if required variables are
 * missing or fail minimum security thresholds.
 *
 * Required:
 *   DATABASE_URL   — PostgreSQL connection string
 *   JWT_SECRET     — JWT signing key, ≥ 32 chars
 *
 * Recommended (warning only):
 *   SESSION_SECRET     — express-session secret (falls back to JWT_SECRET if absent)
 *   NVIDIA_API_KEY /
 *   OPENAI_API_KEY     — AI features disabled if absent
 *   VAPID_PUBLIC_KEY /
 *   VAPID_PRIVATE_KEY  — push notifications use ephemeral keys if absent (not persistent)
 *   INSTAPAY_PHONE     — payment instructions show placeholder if absent
 *   PUBLIC_URL         — certificate verification links use fallback URL if absent
 *   EXAM_VAULT_KEY     — exam vault encryption disabled if absent
 */
export function validateEnv(): void {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProd = process.env.NODE_ENV === "production";

  if (isProd) {
    const prodRequired = [
      "ALLOWED_ORIGINS",
      "EXAM_VAULT_KEY",
      "VAPID_PUBLIC_KEY",
      "VAPID_PRIVATE_KEY",
      "INSTAPAY_PHONE",
      "INSTAPAY_NAME",
    ];
    for (const k of prodRequired) {
      if (!process.env[k]) {
        console.error(`[FATAL] ${k} must be set in production`);
        errors.push(`  ${k} is required in production but not set.`);
      }
    }
  }

  // ── Required ───────────────────────────────────────────────────────────────
  if (!process.env["DATABASE_URL"]) {
    errors.push("  DATABASE_URL is missing — cannot connect to PostgreSQL.");
  }

  // JWT_SECRET: fall back to SESSION_SECRET in non-production environments
  // so the server can start during development when only SESSION_SECRET is set.
  if (!process.env["JWT_SECRET"] && process.env["SESSION_SECRET"]) {
    process.env["JWT_SECRET"] = process.env["SESSION_SECRET"];
    warnings.push("  JWT_SECRET not set — using SESSION_SECRET as fallback (set JWT_SECRET explicitly for production).");
  }

  if (!process.env["JWT_SECRET"]) {
    if (isProd) {
      errors.push("  JWT_SECRET is missing — authentication cannot function.");
    } else {
      errors.push("  JWT_SECRET is missing — set JWT_SECRET or SESSION_SECRET to start the server.");
    }
  } else if (process.env["JWT_SECRET"].length < 32) {
    if (isProd) {
      errors.push(`  JWT_SECRET is too short (${process.env["JWT_SECRET"].length} chars) — must be at least 32 characters for security.`);
    } else {
      warnings.push(`  JWT_SECRET is short (${process.env["JWT_SECRET"].length} chars) — use ≥32 chars in production.`);
    }
  }

  const jwtInsecure = ["dev-secret", "change-me", "default-secret"];
  if (isProd && process.env["JWT_SECRET"] && jwtInsecure.some(v => process.env["JWT_SECRET"]!.toLowerCase().includes(v))) {
    errors.push("  JWT_SECRET contains an insecure default value. Use a cryptographically random secret.");
  }

  // ── Recommended ────────────────────────────────────────────────────────────
  if (!process.env["SESSION_SECRET"]) {
    warnings.push("  SESSION_SECRET not set — falling back to JWT_SECRET (set SESSION_SECRET for production).");
  }

  const hasAi = !!(
    process.env["OPENAI_API_KEY"] ||
    process.env["NVIDIA_API_KEY"] ||
    process.env["REPLIT_AI_AVAILABLE"] ||
    process.env["AI_INTEGRATIONS_OPENAI_API_KEY"]
  );
  if (!hasAi) {
    warnings.push("  No AI API key configured (OPENAI_API_KEY / NVIDIA_API_KEY) — AI features will be disabled.");
  }

  if (!process.env["VAPID_PUBLIC_KEY"] || !process.env["VAPID_PRIVATE_KEY"]) {
    warnings.push("  VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set — push notifications will use ephemeral keys (not persistent across restarts).");
  }

  if (!process.env["INSTAPAY_PHONE"]) {
    warnings.push("  INSTAPAY_PHONE not set — payment instructions will show a placeholder phone number.");
  }

  if (!process.env["PUBLIC_URL"]) {
    warnings.push("  PUBLIC_URL not set — certificate verification links will use the default aperti.ai URL.");
  }

  if (!process.env["EXAM_VAULT_KEY"]) {
    warnings.push("  EXAM_VAULT_KEY not set — exam vault encryption is disabled.");
  }

  // SMTP — optional but strongly recommended in production
  const hasSmtp = !!(process.env["SMTP_HOST"] && process.env["SMTP_USER"] && process.env["SMTP_PASS"]);
  if (!hasSmtp) {
    warnings.push(
      "  SMTP_HOST / SMTP_USER / SMTP_PASS not set — transactional email (password reset, alerts) will be console-logged only.\n" +
      "  Set SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS, SMTP_FROM to enable real delivery."
    );
  }

  // ALLOWED_ORIGINS — must be set in production for tight CORS
  if (isProd && !process.env["ALLOWED_ORIGINS"] && !process.env["REPLIT_DOMAINS"]) {
    errors.push(
      "  ALLOWED_ORIGINS must be set in production. Provide a comma-separated list of allowed frontend origins.\n" +
      "  Example: ALLOWED_ORIGINS=https://your-app.replit.app,https://yourdomain.com"
    );
  }

  // ── Report ──────────────────────────────────────────────────────────────────
  if (errors.length > 0) {
    console.error("\n[startup] FATAL — Missing or invalid environment variables:");
    for (const e of errors) console.error(e);
    console.error("\n  Set these in your .env file or Replit Secrets before starting the server.\n");
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn("\n[startup] WARN — Optional environment variables not configured:");
    for (const w of warnings) console.warn(w);
    console.warn("");
  }
}
