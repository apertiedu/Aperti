/**
 * alert-dispatch.ts
 * Fires email and/or webhook notifications for critical founder alerts.
 * Config is loaded from the `founder_alert_config` DB row and cached 5 min.
 */
import nodemailer from "nodemailer";
import { pool } from "@workspace/db";

interface AlertConfig {
  email_enabled: boolean;
  email_to: string | null;
  smtp_host: string | null;
  smtp_port: number;
  smtp_user: string | null;
  smtp_pass: string | null;
  smtp_from: string | null;
  webhook_enabled: boolean;
  webhook_url: string | null;
}

let configCache: AlertConfig | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 min

async function getConfig(): Promise<AlertConfig | null> {
  try {
    if (configCache && Date.now() < cacheExpiry) return configCache;
    const { rows } = await pool.query(
      `SELECT * FROM founder_alert_config ORDER BY id LIMIT 1`
    );
    if (!rows.length) return null;
    configCache = rows[0] as AlertConfig;
    cacheExpiry = Date.now() + CACHE_TTL;
    return configCache;
  } catch {
    return null;
  }
}

export function invalidateConfigCache() {
  configCache = null;
  cacheExpiry = 0;
}

async function sendEmail(config: AlertConfig, subject: string, html: string): Promise<void> {
  if (!config.email_enabled || !config.email_to || !config.smtp_host) return;
  const transporter = nodemailer.createTransport({
    host: config.smtp_host,
    port: config.smtp_port || 587,
    secure: (config.smtp_port || 587) === 465,
    auth: config.smtp_user && config.smtp_pass
      ? { user: config.smtp_user, pass: config.smtp_pass }
      : undefined,
  });
  await transporter.sendMail({
    from: config.smtp_from || config.smtp_user || "alerts@aperti.ai",
    to: config.email_to,
    subject,
    html,
  });
}

async function sendWebhook(config: AlertConfig, payload: object): Promise<void> {
  if (!config.webhook_enabled || !config.webhook_url) return;
  await fetch(config.webhook_url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
}

function buildEmailHtml(type: string, message: string, severity: string, meta?: Record<string, string>): string {
  const color = severity === "critical" ? "#dc2626" : severity === "warning" ? "#d97706" : "#2563eb";
  const badge = `<span style="background:${color};color:#fff;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700;text-transform:uppercase">${severity}</span>`;
  const metaRows = meta
    ? Object.entries(meta).map(([k, v]) => `<tr><td style="color:#6b7280;padding:4px 8px 4px 0;font-size:13px">${k}</td><td style="font-size:13px;font-weight:600">${v}</td></tr>`).join("")
    : "";
  return `
    <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;background:#f9fafb;padding:24px;border-radius:12px">
      <div style="background:#fff;border-radius:10px;border:1px solid #e5e7eb;padding:24px">
        <div style="margin-bottom:16px">
          <img src="https://aperti.ai/logo.png" alt="Aperti" style="height:28px" onerror="this.style.display='none'" />
        </div>
        <div style="margin-bottom:12px">${badge} <span style="color:#6b7280;font-size:12px;margin-left:8px">${type.replace(/_/g, " ").toUpperCase()}</span></div>
        <p style="font-size:16px;font-weight:600;color:#111827;margin:0 0 12px">${message}</p>
        ${metaRows ? `<table style="width:100%;margin-top:12px">${metaRows}</table>` : ""}
        <p style="font-size:12px;color:#9ca3af;margin-top:20px">Aperti · ${new Date().toLocaleString()} UTC</p>
      </div>
    </div>`;
}

export interface DispatchPayload {
  type: string;
  message: string;
  severity: "info" | "warning" | "critical";
  meta?: Record<string, string>;
}

export async function dispatchAlert(payload: DispatchPayload): Promise<void> {
  try {
    const config = await getConfig();
    if (!config) return;

    const { type, message, severity, meta } = payload;
    const subject = `[Aperti ${severity.toUpperCase()}] ${message.slice(0, 80)}`;
    const webhookBody = {
      source: "aperti",
      event: type,
      severity,
      message,
      meta: meta ?? {},
      timestamp: new Date().toISOString(),
    };

    await Promise.allSettled([
      sendEmail(config, subject, buildEmailHtml(type, message, severity, meta)),
      sendWebhook(config, webhookBody),
    ]);
  } catch {
    // Never crash the caller
  }
}
