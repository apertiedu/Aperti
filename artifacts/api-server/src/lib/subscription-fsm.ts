import { pool } from "@workspace/db";
import { logError } from "./log-error";

export type SubscriptionStatus =
  | "inactive"
  | "pending_payment"
  | "pending_confirmation"
  | "active"
  | "grace_period"
  | "expired"
  | "suspended";

export type TriggeredBy = "system" | "admin" | "payment" | "user";

const VALID_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  inactive:             ["pending_payment"],
  pending_payment:      ["pending_confirmation", "expired", "inactive"],
  pending_confirmation: ["active", "pending_payment"],
  active:               ["grace_period", "suspended", "pending_payment", "expired"],
  grace_period:         ["pending_payment", "expired", "active", "suspended"],
  expired:              ["pending_payment"],
  suspended:            ["active", "expired"],
};

export function canTransition(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function accessGranted(status: SubscriptionStatus): boolean {
  return status === "active" || status === "grace_period";
}

export function isGracePeriod(status: SubscriptionStatus): boolean {
  return status === "grace_period";
}

export async function auditTransition(opts: {
  subscriptionId: number | null;
  userId: number | null;
  previousStatus: string;
  newStatus: string;
  reason: string;
  triggeredBy: TriggeredBy;
  actorId?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO subscription_audit_log
         (subscription_id, user_id, previous_status, new_status, reason, triggered_by, actor_id, metadata, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
      [
        opts.subscriptionId,
        opts.userId,
        opts.previousStatus,
        opts.newStatus,
        opts.reason,
        opts.triggeredBy,
        opts.actorId ?? null,
        JSON.stringify(opts.metadata ?? {}),
      ],
    );
  } catch (err) {
    await logError(err, { route: "subscription-fsm/auditTransition" });
  }
}

export async function transitionSubscription(opts: {
  subscriptionId: number;
  to: SubscriptionStatus;
  reason: string;
  triggeredBy: TriggeredBy;
  actorId?: number;
  metadata?: Record<string, unknown>;
  extraUpdates?: Record<string, unknown>;
}): Promise<{ success: boolean; error?: string; subscription?: Record<string, unknown> }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT id, account_id, status FROM subscriptions WHERE id = $1 FOR UPDATE`,
      [opts.subscriptionId],
    );
    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return { success: false, error: "Subscription not found" };
    }

    const current = rows[0];
    const from = current.status as SubscriptionStatus;

    if (!canTransition(from, opts.to)) {
      await client.query("ROLLBACK");
      return {
        success: false,
        error: `Invalid transition: ${from} → ${opts.to}`,
      };
    }

    const setParts: string[] = ["status = $1", "updated_at = NOW()"];
    const vals: unknown[] = [opts.to];
    let idx = 2;

    if (opts.extraUpdates) {
      for (const [k, v] of Object.entries(opts.extraUpdates)) {
        setParts.push(`${k} = $${idx}`);
        vals.push(v);
        idx++;
      }
    }

    vals.push(opts.subscriptionId);
    const { rows: updated } = await client.query(
      `UPDATE subscriptions SET ${setParts.join(", ")} WHERE id = $${idx} RETURNING *`,
      vals,
    );

    await client.query(
      `INSERT INTO subscription_audit_log
         (subscription_id, user_id, previous_status, new_status, reason, triggered_by, actor_id, metadata, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
      [
        opts.subscriptionId,
        current.account_id,
        from,
        opts.to,
        opts.reason,
        opts.triggeredBy,
        opts.actorId ?? null,
        JSON.stringify(opts.metadata ?? {}),
      ],
    );

    await client.query("COMMIT");
    return { success: true, subscription: updated[0] };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    await logError(err, { route: "subscription-fsm/transitionSubscription" });
    return { success: false, error: (err as Error)?.message };
  } finally {
    client.release();
  }
}

export async function activateWithLedger(opts: {
  subscriptionId: number;
  userId: number;
  amount: number;
  planName: string;
  adminId: number;
  paymentReference: string;
  invoiceId?: number;
}): Promise<{ success: boolean; error?: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: subRows } = await client.query(
      `SELECT id, account_id, status, plan_id FROM subscriptions WHERE id = $1 FOR UPDATE`,
      [opts.subscriptionId],
    );
    if (subRows.length === 0) {
      await client.query("ROLLBACK");
      return { success: false, error: "Subscription not found" };
    }
    const sub = subRows[0];

    if (!canTransition(sub.status as SubscriptionStatus, "active")) {
      await client.query("ROLLBACK");
      return { success: false, error: `Cannot activate from state: ${sub.status}` };
    }

    const { rows: existing } = await client.query(
      `SELECT id FROM ledger_entries
       WHERE account_id = $1 AND reference_id = $2 AND entry_type = 'credit' LIMIT 1`,
      [opts.userId, opts.subscriptionId],
    );
    if (existing.length > 0) {
      await client.query("ROLLBACK");
      return { success: false, error: "Ledger entry already exists for this subscription (duplicate activation prevented)" };
    }

    await client.query(
      `INSERT INTO ledger_entries
         (account_id, entry_type, amount, currency, description, reference_id, reference_type, created_at)
       VALUES ($1,'credit',$2,'EGP',$3,$4,'subscription',NOW())`,
      [opts.userId, opts.amount, `Subscription payment: ${opts.planName}`, opts.subscriptionId],
    );

    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    await client.query(
      `UPDATE subscriptions SET
         status = 'active',
         start_date = NOW(),
         end_date = $1,
         payment_status = 'paid',
         verified_by = $2,
         verified_at = NOW(),
         grace_period_ends_at = NULL,
         payment_attempt_count = 0,
         fraud_flags = '[]',
         updated_at = NOW()
       WHERE id = $3`,
      [endDate.toISOString(), opts.adminId, opts.subscriptionId],
    );

    if (opts.invoiceId) {
      await client.query(
        `UPDATE billing_invoices SET status = 'paid', paid_at = NOW() WHERE id = $1`,
        [opts.invoiceId],
      ).catch(() => {});
    }

    await client.query(
      `INSERT INTO subscription_audit_log
         (subscription_id, user_id, previous_status, new_status, reason, triggered_by, actor_id, metadata, created_at)
       VALUES ($1,$2,$3,'active',$4,'admin',$5,$6,NOW())`,
      [
        opts.subscriptionId,
        opts.userId,
        sub.status,
        `Admin confirmed payment. Ledger entry created. Reference: ${opts.paymentReference}`,
        opts.adminId,
        JSON.stringify({ amount: opts.amount, plan: opts.planName, reference: opts.paymentReference }),
      ],
    );

    await client.query("COMMIT");
    return { success: true };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    await logError(err, { route: "subscription-fsm/activateWithLedger" });
    return { success: false, error: (err as Error)?.message };
  } finally {
    client.release();
  }
}

export async function runGraceAndExpiryCheck(): Promise<{
  moved_to_grace: number[];
  expired: number[];
  errors: string[];
}> {
  const movedToGrace: number[] = [];
  const expired: number[] = [];
  const errors: string[] = [];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: activeExpired } = await client.query(
      `SELECT id, account_id, grace_period_days
       FROM subscriptions
       WHERE status = 'active' AND end_date < NOW() AND end_date IS NOT NULL
       FOR UPDATE SKIP LOCKED`,
    );

    for (const sub of activeExpired) {
      try {
        const graceDays = sub.grace_period_days ?? 3;
        const graceEnds = new Date(Date.now() + graceDays * 24 * 60 * 60 * 1000);

        await client.query(
          `UPDATE subscriptions SET status = 'grace_period', grace_period_ends_at = $1, updated_at = NOW() WHERE id = $2`,
          [graceEnds.toISOString(), sub.id],
        );

        await client.query(
          `INSERT INTO subscription_audit_log
             (subscription_id, user_id, previous_status, new_status, reason, triggered_by, created_at)
           VALUES ($1,$2,'active','grace_period','Subscription expired — entered grace period','system',NOW())`,
          [sub.id, sub.account_id],
        );
        movedToGrace.push(sub.id);
      } catch (e) {
        errors.push(`grace ${sub.id}: ${(e as Error)?.message}`);
      }
    }

    const { rows: graceExpired } = await client.query(
      `SELECT id, account_id FROM subscriptions
       WHERE status = 'grace_period'
         AND grace_period_ends_at IS NOT NULL
         AND grace_period_ends_at < NOW()
       FOR UPDATE SKIP LOCKED`,
    );

    for (const sub of graceExpired) {
      try {
        await client.query(
          `UPDATE subscriptions SET status = 'expired', updated_at = NOW() WHERE id = $1`,
          [sub.id],
        );
        await client.query(
          `INSERT INTO subscription_audit_log
             (subscription_id, user_id, previous_status, new_status, reason, triggered_by, created_at)
           VALUES ($1,$2,'grace_period','expired','Grace period ended — subscription expired','system',NOW())`,
          [sub.id, sub.account_id],
        );
        expired.push(sub.id);
      } catch (e) {
        errors.push(`expire ${sub.id}: ${(e as Error)?.message}`);
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    errors.push(`transaction: ${(err as Error)?.message}`);
  } finally {
    client.release();
  }

  return { moved_to_grace: movedToGrace, expired, errors };
}

export async function checkFraudFlags(userId: number, subscriptionId: number): Promise<{
  flagged: boolean;
  reasons: string[];
}> {
  const reasons: string[] = [];

  const { rows: recentFails } = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM subscription_audit_log
     WHERE user_id = $1
       AND new_status = 'pending_confirmation'
       AND created_at > NOW() - INTERVAL '24 hours'`,
    [userId],
  ).catch(() => ({ rows: [{ cnt: 0 }] }));
  if (recentFails[0]?.cnt >= 3) reasons.push("3+ failed payment submissions in 24h");

  const { rows: loops } = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM subscription_audit_log
     WHERE user_id = $1
       AND new_status IN ('pending_payment','pending_confirmation')
       AND created_at > NOW() - INTERVAL '1 hour'`,
    [userId],
  ).catch(() => ({ rows: [{ cnt: 0 }] }));
  if (loops[0]?.cnt >= 5) reasons.push("Rapid upgrade/downgrade loop detected (5+ state changes in 1h)");

  const { rows: codeReuse } = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM subscriptions
     WHERE instapay_code = (SELECT instapay_code FROM subscriptions WHERE id = $1)
       AND instapay_code IS NOT NULL
       AND id != $1`,
    [subscriptionId],
  ).catch(() => ({ rows: [{ cnt: 0 }] }));
  if (codeReuse[0]?.cnt > 0) reasons.push("Instapay code reused across multiple subscriptions");

  if (reasons.length > 0) {
    await pool.query(
      `UPDATE subscriptions SET fraud_flags = $1::jsonb WHERE id = $2`,
      [JSON.stringify(reasons), subscriptionId],
    ).catch(() => {});
  }

  return { flagged: reasons.length > 0, reasons };
}
