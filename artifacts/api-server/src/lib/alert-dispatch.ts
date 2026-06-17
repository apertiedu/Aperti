/**
 * alert-dispatch.ts
 * Fires webhook notifications for critical founder alerts.
 * Email sending is intentionally disabled (no SMTP dependency).
 * Config is loaded from the `founder_alert_config` DB row and cached 5 min.
 */
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
const CACHE_TTL = 5 * 60 * 1000;

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

async function sendWebhook(config: AlertConfig, payload: object): Promise<void> {
  if (!config.webhook_enabled || !config.webhook_url) return;
  await fetch(config.webhook_url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
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
    const webhookBody = {
      source: "aperti",
      event: type,
      severity,
      message,
      meta: meta ?? {},
      timestamp: new Date().toISOString(),
    };

    await sendWebhook(config, webhookBody);
  } catch {
    // Never crash the caller
  }
}
