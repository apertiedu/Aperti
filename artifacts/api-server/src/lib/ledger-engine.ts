import { pool } from "@workspace/db";
import type { PoolClient } from "pg";

export type AccountType = "student_wallet" | "teacher_revenue" | "platform_revenue" | "refund_pool";

interface EntryInput {
  transaction_id: number;
  account_type: AccountType;
  entry_type: "debit" | "credit";
  amount: number;
  currency?: string;
  reference: string;
  is_reversal?: boolean;
  reversal_of?: number | null;
}

async function insertEntry(client: PoolClient, e: EntryInput): Promise<number> {
  const { rows } = await client.query(
    `INSERT INTO ledger_entries
       (transaction_id, account_type, entry_type, amount, currency, reference, is_reversal, reversal_of, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW()) RETURNING id`,
    [e.transaction_id, e.account_type, e.entry_type, e.amount.toFixed(4),
     e.currency ?? "EGP", e.reference, e.is_reversal ?? false, e.reversal_of ?? null],
  );
  return rows[0].id as number;
}

export async function getPlatformCutPercent(): Promise<number> {
  const { rows } = await pool.query(
    `SELECT value FROM platform_settings WHERE key = 'platform_cut_percent' LIMIT 1`,
  ).catch(() => ({ rows: [] }));
  const val = rows[0]?.value;
  if (val && typeof val === "object" && "percent" in val) return parseFloat(String(val.percent));
  return 15;
}

export async function setPlatformCutPercent(percent: number, actorId: number): Promise<void> {
  await pool.query(
    `INSERT INTO platform_settings (key, value, updated_by, updated_at)
     VALUES ('platform_cut_percent', $1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_by = $2, updated_at = NOW()`,
    [JSON.stringify({ percent }), actorId],
  );
}

export async function recordPaymentLedger(opts: {
  transactionId: number;
  amount: number;
  currency?: string;
  reference: string;
  platformCutPercent?: number;
}): Promise<{ debitId: number; teacherCreditId: number; platformCreditId: number }> {
  const cutPercent = opts.platformCutPercent ?? (await getPlatformCutPercent());
  const rawPlatformCut = (opts.amount * cutPercent) / 100;
  const platformCut = parseFloat(rawPlatformCut.toFixed(4));
  const teacherRevenue = parseFloat((opts.amount - platformCut).toFixed(4));
  const totalCredits = parseFloat((teacherRevenue + platformCut).toFixed(4));

  if (Math.abs(opts.amount - totalCredits) > 0.01) {
    throw new Error(`Ledger balance violation: debit=${opts.amount} credits=${totalCredits}`);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const debitId = await insertEntry(client, {
      transaction_id: opts.transactionId, account_type: "student_wallet",
      entry_type: "debit", amount: opts.amount, currency: opts.currency, reference: opts.reference,
    });
    const teacherCreditId = await insertEntry(client, {
      transaction_id: opts.transactionId, account_type: "teacher_revenue",
      entry_type: "credit", amount: teacherRevenue, currency: opts.currency, reference: opts.reference,
    });
    const platformCreditId = await insertEntry(client, {
      transaction_id: opts.transactionId, account_type: "platform_revenue",
      entry_type: "credit", amount: platformCut, currency: opts.currency, reference: opts.reference,
    });
    await client.query("COMMIT");
    return { debitId, teacherCreditId, platformCreditId };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function recordRefundLedger(opts: {
  transactionId: number;
  refundAmount: number;
  currency?: string;
  reference: string;
}): Promise<void> {
  const { rows: originals } = await pool.query(
    `SELECT * FROM ledger_entries WHERE transaction_id=$1 AND is_reversal=FALSE ORDER BY id ASC`,
    [opts.transactionId],
  );
  if (originals.length === 0) throw new Error(`No ledger entries for transaction ${opts.transactionId}`);

  const totalOriginalDebit = originals
    .filter((r: { entry_type: string }) => r.entry_type === "debit")
    .reduce((s: number, r: { amount: string }) => s + parseFloat(r.amount), 0);

  const ratio = Math.min(opts.refundAmount / totalOriginalDebit, 1);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const orig of originals) {
      const reversalAmount = parseFloat((parseFloat(orig.amount) * ratio).toFixed(4));
      if (reversalAmount < 0.001) continue;
      await insertEntry(client, {
        transaction_id: opts.transactionId,
        account_type: orig.account_type,
        entry_type: orig.entry_type === "debit" ? "credit" : "debit",
        amount: reversalAmount,
        currency: opts.currency ?? orig.currency,
        reference: `REVERSAL:${opts.reference}`,
        is_reversal: true,
        reversal_of: orig.id,
      });
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function getAccountBalance(accountType: AccountType): Promise<number> {
  const { rows } = await pool.query(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE entry_type='credit'),0) -
       COALESCE(SUM(amount) FILTER (WHERE entry_type='debit'),0) AS balance
     FROM ledger_entries WHERE account_type=$1`,
    [accountType],
  );
  return parseFloat(rows[0]?.balance ?? "0");
}

export async function verifyTransactionBalance(transactionId: number): Promise<{ balanced: boolean; debit: number; credit: number; gap: number }> {
  const { rows } = await pool.query(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE entry_type='debit'),0)::numeric(12,4) AS total_debit,
       COALESCE(SUM(amount) FILTER (WHERE entry_type='credit'),0)::numeric(12,4) AS total_credit
     FROM ledger_entries WHERE transaction_id=$1`,
    [transactionId],
  );
  const debit = parseFloat(rows[0]?.total_debit ?? "0");
  const credit = parseFloat(rows[0]?.total_credit ?? "0");
  const gap = parseFloat(Math.abs(debit - credit).toFixed(4));
  return { balanced: gap < 0.01, debit, credit, gap };
}

export async function findImbalances(): Promise<Array<{ transaction_id: number; total_debit: number; total_credit: number; gap: number }>> {
  const { rows } = await pool.query(`
    SELECT
      transaction_id,
      COALESCE(SUM(amount) FILTER (WHERE entry_type='debit'),0)::numeric(12,4) AS total_debit,
      COALESCE(SUM(amount) FILTER (WHERE entry_type='credit'),0)::numeric(12,4) AS total_credit,
      ABS(
        COALESCE(SUM(amount) FILTER (WHERE entry_type='debit'),0) -
        COALESCE(SUM(amount) FILTER (WHERE entry_type='credit'),0)
      )::numeric(12,4) AS gap
    FROM ledger_entries
    GROUP BY transaction_id
    HAVING ABS(
      COALESCE(SUM(amount) FILTER (WHERE entry_type='debit'),0) -
      COALESCE(SUM(amount) FILTER (WHERE entry_type='credit'),0)
    ) > 0.01
    ORDER BY gap DESC
  `);
  return rows;
}

export async function findMissingEntries(): Promise<Array<{ transaction_id: number; amount: string; status: string; created_at: string }>> {
  const { rows } = await pool.query(`
    SELECT pt.id AS transaction_id, pt.amount, pt.status, pt.created_at
    FROM payment_transactions pt
    WHERE pt.status IN ('verified','approved')
      AND pt.id NOT IN (
        SELECT DISTINCT transaction_id FROM ledger_entries WHERE transaction_id IS NOT NULL
      )
    ORDER BY pt.created_at DESC
    LIMIT 100
  `);
  return rows;
}

export async function createFraudAlert(opts: {
  severity: "low" | "medium" | "high";
  type: string;
  entityId: string | number;
  entityType: string;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await pool.query(
    `INSERT INTO fraud_alerts (severity, type, entity_id, entity_type, message, metadata, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
    [opts.severity, opts.type, String(opts.entityId), opts.entityType,
     opts.message, JSON.stringify(opts.metadata ?? {})],
  ).catch(() => {});
}
