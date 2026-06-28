import { EventEmitter } from "events";
import { pool } from "@workspace/db";

export type DomainEventType =
  | "transaction.created"
  | "transaction.failed"
  | "invoice.paid"
  | "invoice.created"
  | "invoice.voided"
  | "refund.processed"
  | "refund.rejected"
  | "dispute.opened"
  | "dispute.investigating"
  | "dispute.resolved"
  | "dispute.rejected"
  | "fraud.detected"
  | "anomaly.detected"
  | "grade.generated"
  | "enrollment.created"
  | "payout.processed"
  | "subscription.created"
  | "subscription.cancelled"
  | "auth.login"
  | "auth.logout"
  | "auth.mfa_success"
  | "ai.outage"
  | "ai.fallback";

export interface DomainEvent<T = Record<string, unknown>> {
  type: DomainEventType;
  payload: T;
  actorId?: number;
  actorRole?: string;
  correlationId?: string;
  timestamp: Date;
}

class ApertiBus extends EventEmitter {
  private persisting = false;

  async emit_event<T extends Record<string, unknown>>(
    type: DomainEventType,
    payload: T,
    meta: { actorId?: number; actorRole?: string; correlationId?: string } = {},
  ): Promise<void> {
    const event: DomainEvent<T> = {
      type,
      payload,
      actorId: meta.actorId,
      actorRole: meta.actorRole,
      correlationId: meta.correlationId ?? crypto.randomUUID(),
      timestamp: new Date(),
    };

    this.emit(type, event);
    this.emit("*", event);

    if (!this.persisting) {
      this.persisting = true;
      pool
        .query(
          `INSERT INTO domain_events (event_type, payload, actor_id, actor_role, correlation_id, created_at)
           VALUES ($1,$2,$3,$4,$5,NOW())`,
          [
            type,
            JSON.stringify(payload),
            meta.actorId ?? null,
            meta.actorRole ?? null,
            event.correlationId,
          ],
        )
        .catch(() => {})
        .finally(() => { this.persisting = false; });
    }
  }

  on_event<T extends Record<string, unknown>>(
    type: DomainEventType | "*",
    handler: (event: DomainEvent<T>) => void,
  ): this {
    return this.on(type, handler);
  }
}

export const eventBus = new ApertiBus();
eventBus.setMaxListeners(50);

eventBus.on_event("fraud.detected", (e) => {
  const p = e.payload as Record<string, unknown>;
  if (p.severity === "critical") {
    pool.query(
      `INSERT INTO system_validation_errors (source, error_type, field_missing, raw_response, fallback_used, created_at)
       VALUES ($1,$2,$3,$4,false,NOW())`,
      ["event-bus", "fraud.critical", null, JSON.stringify(p)],
    ).catch(() => {});
  }
});

eventBus.on_event("transaction.created", (e) => {
  const p = e.payload as Record<string, unknown>;
  pool.query(
    `UPDATE usage_tracking SET current_count = current_count + 1, updated_at = NOW()
     WHERE user_id = $1 AND resource = 'transactions'`,
    [p.user_id],
  ).catch(() => {});
});
