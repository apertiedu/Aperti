import { pool } from "@workspace/db";
import { logError } from "./log-error";
import { emitBillingEvent } from "./billing-event-bus";
import { logger } from "./logger";

export interface AutoRenewResult {
  processed: number;
  created: number;
  skipped: number;
  errors: Array<{ subscriptionId: number; reason: string }>;
  invoices: Array<{
    subscription_id: number;
    invoice_id: number;
    invoice_number: string;
    amount: number;
    due_at: string;
    user_id: number;
  }>;
}

function generateRenewalInvoiceNumber(): string {
  const now = new Date();
  const prefix = `RENEW-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const rand = Math.floor(Math.random() * 900000) + 100000;
  return `${prefix}-${rand}`;
}

export async function runAutoRenewInvoices(dryRun = false): Promise<AutoRenewResult> {
  const result: AutoRenewResult = { processed: 0, created: 0, skipped: 0, errors: [], invoices: [] };

  try {
    const { rows: expiring } = await pool.query(`
      SELECT
        s.id            AS subscription_id,
        s.account_id    AS user_id,
        s.end_date,
        s.plan_id,
        s.coupon_id,
        sp.name         AS plan_name,
        sp.price_egp    AS plan_price,
        sp.discount_pct,
        a.display_name  AS user_name,
        a.email         AS user_email,
        EXTRACT(DAY FROM (s.end_date - NOW()))::int AS days_until_expiry
      FROM subscriptions s
      JOIN subscription_plans sp ON sp.id = s.plan_id
      JOIN accounts a ON a.id = s.account_id
      WHERE s.status = 'active'
        AND s.auto_renew = TRUE
        AND s.end_date IS NOT NULL
        AND s.end_date BETWEEN NOW() + INTERVAL '6 days' AND NOW() + INTERVAL '8 days'
        AND NOT EXISTS (
          SELECT 1 FROM billing_invoices bi2
          WHERE bi2.subscription_id = s.id
            AND bi2.metadata->>'type' = 'auto_renewal'
            AND bi2.status NOT IN ('void')
            AND bi2.issued_at > NOW() - INTERVAL '14 days'
        )
    `);

    result.processed = expiring.length;
    logger.info(`[auto-renew] Found ${expiring.length} subscriptions needing renewal invoices`);

    for (const sub of expiring) {
      try {
        const rawPrice   = parseFloat(sub.plan_price) || 0;
        const discountPct = parseFloat(sub.discount_pct) || 0;
        const discountAmt = Math.round((rawPrice * discountPct / 100) * 100) / 100;
        const total      = Math.max(0, rawPrice - discountAmt);
        const dueAt      = sub.end_date;
        const invoiceNum = generateRenewalInvoiceNumber();

        const metadata = {
          type: "auto_renewal",
          subscription_id: sub.subscription_id,
          plan_id: sub.plan_id,
          plan_name: sub.plan_name,
          expires_at: sub.end_date,
          days_until_expiry: sub.days_until_expiry,
        };

        const items = [
          {
            name: `Subscription Renewal — ${sub.plan_name}`,
            description: `Auto-renewal for subscription expiring on ${new Date(sub.end_date).toLocaleDateString()}`,
            qty: 1,
            unit_price: total,
          },
        ];

        if (dryRun) {
          result.invoices.push({
            subscription_id: sub.subscription_id,
            invoice_id: -1,
            invoice_number: invoiceNum,
            amount: total,
            due_at: dueAt,
            user_id: sub.user_id,
          });
          result.created++;
          continue;
        }

        const client = await pool.connect();
        try {
          await client.query("BEGIN");

          const { rows: [inv] } = await client.query(`
            INSERT INTO billing_invoices
              (invoice_number, user_id, subscription_id, amount, plan_name,
               items, subtotal, discount, total, currency, due_at,
               status, metadata, notes)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'EGP',$10,'issued',$11,$12)
            RETURNING id, invoice_number, total, due_at, user_id
          `, [
            invoiceNum,
            sub.user_id,
            sub.subscription_id,
            total,
            sub.plan_name,
            JSON.stringify(items),
            rawPrice,
            discountAmt,
            total,
            dueAt,
            JSON.stringify(metadata),
            "Auto-generated renewal invoice — subscription expires in 7 days. Please complete payment before expiry to avoid interruption.",
          ]);

          await client.query(
            `UPDATE subscriptions SET pending_invoice_id=$1, updated_at=NOW() WHERE id=$2`,
            [inv.id, sub.subscription_id],
          );

          await client.query("COMMIT");

          await pool.query(
            `INSERT INTO notifications (account_id, type, title, message, is_read)
             VALUES ($1,'renewal_invoice','Subscription Renewal Invoice',$2,FALSE)`,
            [
              sub.user_id,
              `Your ${sub.plan_name} subscription renews in ${sub.days_until_expiry} day(s). A renewal invoice (${invoiceNum}) for EGP ${total.toFixed(2)} has been generated. Please complete payment before your subscription expires.`,
            ],
          ).catch(() => {});

          await emitBillingEvent({
            type: "renewal_invoice_created",
            entityId: inv.id,
            entityType: "billing_invoice",
            userId: sub.user_id,
            payload: {
              invoice_number: invoiceNum,
              subscription_id: sub.subscription_id,
              plan_name: sub.plan_name,
              amount: total,
              due_at: dueAt,
              days_until_expiry: sub.days_until_expiry,
            },
          });

          result.invoices.push({
            subscription_id: sub.subscription_id,
            invoice_id: inv.id,
            invoice_number: inv.invoice_number,
            amount: parseFloat(inv.total),
            due_at: inv.due_at,
            user_id: inv.user_id,
          });
          result.created++;

        } catch (txErr) {
          await client.query("ROLLBACK").catch(() => {});
          throw txErr;
        } finally {
          client.release();
        }

      } catch (subErr) {
        await logError(subErr, { route: "auto-renew-invoices", subscriptionId: sub.subscription_id });
        result.errors.push({ subscriptionId: sub.subscription_id, reason: String(subErr) });
      }
    }

  } catch (err) {
    await logError(err, { route: "auto-renew-invoices/batch" });
    result.errors.push({ subscriptionId: -1, reason: String(err) });
  }

  logger.info(`[auto-renew] Done: created=${result.created} skipped=${result.skipped} errors=${result.errors.length}`);
  return result;
}

export async function getUpcomingRenewals(): Promise<any[]> {
  try {
    const { rows } = await pool.query(`
      SELECT
        s.id            AS subscription_id,
        s.account_id    AS user_id,
        s.end_date,
        s.auto_renew,
        s.status,
        s.pending_invoice_id,
        sp.name         AS plan_name,
        sp.price_egp    AS plan_price,
        sp.discount_pct,
        a.display_name  AS user_name,
        a.email         AS user_email,
        EXTRACT(DAY FROM (s.end_date - NOW()))::int AS days_until_expiry,
        bi.id           AS renewal_invoice_id,
        bi.invoice_number AS renewal_invoice_number,
        bi.status       AS renewal_invoice_status,
        bi.total        AS renewal_invoice_total
      FROM subscriptions s
      JOIN subscription_plans sp ON sp.id = s.plan_id
      JOIN accounts a ON a.id = s.account_id
      LEFT JOIN billing_invoices bi
        ON bi.subscription_id = s.id
        AND bi.metadata->>'type' = 'auto_renewal'
        AND bi.status != 'void'
        AND bi.issued_at > NOW() - INTERVAL '14 days'
      WHERE s.status = 'active'
        AND s.end_date IS NOT NULL
        AND s.end_date > NOW()
        AND s.end_date < NOW() + INTERVAL '10 days'
      ORDER BY s.end_date ASC
    `);
    return rows;
  } catch (err) {
    await logError(err, { route: "auto-renew/upcoming" });
    return [];
  }
}

export async function getRecentAutoRenewInvoices(limit = 50): Promise<any[]> {
  try {
    const { rows } = await pool.query(`
      SELECT
        bi.*,
        a.display_name  AS user_name,
        a.email         AS user_email,
        s.status        AS subscription_status,
        s.end_date      AS subscription_end_date
      FROM billing_invoices bi
      JOIN accounts a ON a.id = bi.user_id
      LEFT JOIN subscriptions s ON s.id = bi.subscription_id
      WHERE bi.metadata->>'type' = 'auto_renewal'
      ORDER BY bi.issued_at DESC
      LIMIT $1
    `, [limit]);
    return rows;
  } catch {
    return [];
  }
}
