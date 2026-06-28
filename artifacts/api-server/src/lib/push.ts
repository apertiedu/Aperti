import webpush from "web-push";
import { pool } from "@workspace/db";

let vapidInitialized = false;

function ensureVapid() {
  if (vapidInitialized) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:support@aperti.ai";

  if (!publicKey || !privateKey) {
    const keys = webpush.generateVAPIDKeys();
    console.warn("[push] VAPID keys not set — generated temporary keys (ephemeral, will not persist across restarts). Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Replit Secrets.");
    webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
    (global as any).__VAPID_PUBLIC_KEY__ = keys.publicKey;
  } else {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    (global as any).__VAPID_PUBLIC_KEY__ = publicKey;
  }
  vapidInitialized = true;
}

export function getVapidPublicKey(): string {
  ensureVapid();
  return (global as any).__VAPID_PUBLIC_KEY__ || "";
}

export async function saveSubscription(
  userId: number,
  endpoint: string,
  auth: string,
  p256dh: string
): Promise<void> {
  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, auth, p256dh)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, endpoint) DO UPDATE SET auth=$3, p256dh=$4`,
    [userId, endpoint, auth, p256dh]
  );
}

export async function removeSubscription(userId: number, endpoint: string): Promise<void> {
  await pool.query(
    `DELETE FROM push_subscriptions WHERE user_id=$1 AND endpoint=$2`,
    [userId, endpoint]
  );
}

export async function sendPushToUser(
  userId: number,
  payload: { title: string; body: string; url?: string; icon?: string }
): Promise<void> {
  ensureVapid();
  const { rows } = await pool.query(
    `SELECT endpoint, auth, p256dh FROM push_subscriptions WHERE user_id=$1`,
    [userId]
  );
  const message = JSON.stringify({ ...payload, icon: payload.icon || "/favicon.svg" });
  for (const row of rows) {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { auth: row.auth, p256dh: row.p256dh } },
        message
      );
    } catch (err: any) {
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        // Subscription expired — remove it
        await pool.query(
          `DELETE FROM push_subscriptions WHERE user_id=$1 AND endpoint=$2`,
          [userId, row.endpoint]
        ).catch(() => {});
      }
    }
  }
}

export async function sendPushToRole(
  role: string,
  payload: { title: string; body: string; url?: string }
): Promise<void> {
  ensureVapid();
  const { rows } = await pool.query(
    `SELECT ps.user_id, ps.endpoint, ps.auth, ps.p256dh
     FROM push_subscriptions ps
     JOIN accounts a ON a.id = ps.user_id
     WHERE a.role = $1`,
    [role]
  );
  const message = JSON.stringify({ ...payload, icon: "/favicon.svg" });
  for (const row of rows) {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { auth: row.auth, p256dh: row.p256dh } },
        message
      );
    } catch (err: any) {
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        await pool.query(
          `DELETE FROM push_subscriptions WHERE user_id=$1 AND endpoint=$2`,
          [row.user_id, row.endpoint]
        ).catch(() => {});
      }
    }
  }
}

export async function sendPushToAll(
  payload: { title: string; body: string; url?: string }
): Promise<void> {
  ensureVapid();
  const { rows } = await pool.query(
    `SELECT user_id, endpoint, auth, p256dh FROM push_subscriptions`
  );
  const message = JSON.stringify({ ...payload, icon: "/favicon.svg" });
  for (const row of rows) {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { auth: row.auth, p256dh: row.p256dh } },
        message
      );
    } catch (err: any) {
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        await pool.query(
          `DELETE FROM push_subscriptions WHERE user_id=$1 AND endpoint=$2`,
          [row.user_id, row.endpoint]
        ).catch(() => {});
      }
    }
  }
}
