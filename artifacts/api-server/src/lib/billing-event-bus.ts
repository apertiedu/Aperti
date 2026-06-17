import { pool } from "@workspace/db";
import { logError } from "./log-error";

export type BillingEventType =
  | "invoice_created"
  | "payment_submitted"
  | "payment_confirmed"
  | "subscription_activated"
  | "subscription_expired"
  | "subscription_cancelled"
  | "subscription_suspended"
  | "subscription_restored"
  | "plan_upgraded"
  | "plan_downgraded"
  | "refund_issued"
  | "fraud_detected"
  | "recovery_scheduled"
  | "recovery_succeeded"
  | "recovery_failed"
  | "grace_period_started"
  | "experiment_assigned";

export interface BillingEvent {
  type: BillingEventType;
  entityId: string | number;
  entityType?: string;
  userId?: number;
  payload?: Record<string, unknown>;
}

export async function emitBillingEvent(event: BillingEvent): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO billing_events (type, entity_id, entity_type, user_id, payload, created_at)
       VALUES ($1,$2,$3,$4,$5,NOW())`,
      [
        event.type,
        String(event.entityId),
        event.entityType ?? "subscription",
        event.userId ?? null,
        JSON.stringify(event.payload ?? {}),
      ],
    );
  } catch (err) {
    await logError(err, { route: "billing-event-bus/emit", eventType: event.type });
  }
}

export async function getRecentBillingEvents(limit = 50): Promise<any[]> {
  try {
    const { rows } = await pool.query(
      `SELECT be.*, a.display_name AS user_name
       FROM billing_events be
       LEFT JOIN accounts a ON a.id = be.user_id
       ORDER BY be.created_at DESC LIMIT $1`,
      [limit],
    );
    return rows;
  } catch {
    return [];
  }
}
