import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { logError } from "../lib/log-error";
import { recordPaymentLedger } from "../lib/ledger-engine";

export const billingInvoicesRouter = Router();

billingInvoicesRouter.use(authenticate);

function generateInvoiceNumber(): string {
  const now = new Date();
  const prefix = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const rand = Math.floor(Math.random() * 90000) + 10000;
  return `${prefix}-${rand}`;
}

/* ── POST /api/billing/invoices ─────────────────────────────────────────── */
billingInvoicesRouter.post("/invoices", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      user_id, items, discount = 0, currency = "EGP", expires_in_hours = 48,
      metadata = {},
    } = req.body as {
      user_id?: number;
      items: Array<{ description: string; amount: number }>;
      discount?: number;
      currency?: string;
      expires_in_hours?: number;
      metadata?: Record<string, unknown>;
    };

    const targetUserId = user_id ?? req.userId;
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "items array is required and must not be empty" });
      return;
    }

    const subtotal = items.reduce((s, item) => s + item.amount, 0);
    const total = Math.max(0, subtotal - discount);
    const invoiceNumber = generateInvoiceNumber();

    const { rows } = await pool.query(
      `INSERT INTO billing_invoices
         (invoice_number, user_id, items, subtotal, discount, total, currency, status, expires_at, metadata, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',NOW() + INTERVAL '1 hour' * $8,$9,NOW())
       RETURNING *`,
      [invoiceNumber, targetUserId, JSON.stringify(items), subtotal, discount, total, currency, expires_in_hours, JSON.stringify(metadata)],
    );

    res.status(201).json({ invoice: rows[0] });
  } catch (err) {
    await logError(err, { route: "POST /api/billing/invoices" });
    res.status(500).json({ error: "Failed to create invoice" });
  }
});

/* ── GET /api/billing/invoices/my ───────────────────────────────────────── */
billingInvoicesRouter.get("/invoices/my", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      `SELECT bi.*, r.id AS receipt_id, r.generated_at AS receipt_generated_at
       FROM billing_invoices bi
       LEFT JOIN receipts r ON r.invoice_id = bi.id
       WHERE bi.user_id = $1
       ORDER BY bi.created_at DESC LIMIT 100`,
      [req.userId],
    );
    res.json({ invoices: rows });
  } catch (err) {
    await logError(err, { route: "GET /api/billing/invoices/my" });
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

/* ── GET /api/billing/invoices ──────────────────────────────────────────── */
billingInvoicesRouter.get("/invoices", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const q = req.query as Record<string, string>;
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (q.status) { params.push(q.status); conditions.push(`bi.status = $${params.length}`); }
    if (q.user_id) { params.push(parseInt(q.user_id)); conditions.push(`bi.user_id = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = Math.min(parseInt(q.limit ?? "200"), 1000);
    params.push(limit);

    const { rows } = await pool.query(
      `SELECT bi.*, a.display_name AS user_name, a.email,
              r.id AS receipt_id, r.ledger_reference, r.generated_at AS receipt_date
       FROM billing_invoices bi
       LEFT JOIN accounts a ON a.id = bi.user_id
       LEFT JOIN receipts r ON r.invoice_id = bi.id
       ${where}
       ORDER BY bi.created_at DESC
       LIMIT $${params.length}`,
      params,
    );

    const { rows: stats } = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status='pending')::int AS pending,
        COUNT(*) FILTER (WHERE status='paid')::int AS paid,
        COUNT(*) FILTER (WHERE status='expired')::int AS expired,
        COALESCE(SUM(total) FILTER (WHERE status='paid'),0)::numeric(12,2) AS total_revenue
      FROM billing_invoices
    `);

    res.json({ invoices: rows, stats: stats[0] ?? {} });
  } catch (err) {
    await logError(err, { route: "GET /api/billing/invoices" });
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

/* ── GET /api/billing/invoices/:id ─────────────────────────────────────── */
billingInvoicesRouter.get("/invoices/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      `SELECT bi.*, a.display_name AS user_name, a.email,
              r.id AS receipt_id, r.ledger_reference, r.paid_amount AS receipt_amount,
              r.generated_at AS receipt_date, r.metadata AS receipt_metadata
       FROM billing_invoices bi
       LEFT JOIN accounts a ON a.id = bi.user_id
       LEFT JOIN receipts r ON r.invoice_id = bi.id
       WHERE bi.id = $1`,
      [parseInt(req.params.id)],
    );
    if (rows.length === 0) { res.status(404).json({ error: "Invoice not found" }); return; }

    const inv = rows[0];
    if (req.role !== "admin" && req.role !== "super_admin" && inv.user_id !== req.userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    res.json({ invoice: inv });
  } catch (err) {
    await logError(err, { route: `GET /api/billing/invoices/${req.params.id}` });
    res.status(500).json({ error: "Failed to fetch invoice" });
  }
});

/* ── POST /api/billing/invoices/:id/confirm-payment ─────────────────────── */
billingInvoicesRouter.post("/invoices/:id/confirm-payment", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { transaction_id, ledger_reference } = req.body as { transaction_id?: number; ledger_reference?: string };

    const { rows: invRows } = await pool.query("SELECT * FROM billing_invoices WHERE id=$1 LIMIT 1", [id]);
    if (invRows.length === 0) { res.status(404).json({ error: "Invoice not found" }); return; }
    const inv = invRows[0];
    if (inv.status === "paid") { res.status(409).json({ error: "Invoice already paid" }); return; }
    if (inv.status === "expired") { res.status(422).json({ error: "Invoice is expired" }); return; }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `UPDATE billing_invoices SET status='paid', transaction_id=$1, paid_at=NOW() WHERE id=$2`,
        [transaction_id ?? null, id],
      );

      const ledgerRef = ledger_reference ?? `INV-${inv.invoice_number}-${Date.now()}`;
      let ledgerEntryIds: Record<string, number> = {};

      if (transaction_id) {
        try {
          const { rows: txRows } = await client.query("SELECT * FROM payment_transactions WHERE id=$1 LIMIT 1", [transaction_id]);
          if (txRows.length > 0) {
            ledgerEntryIds = await recordPaymentLedger({
              transactionId: transaction_id,
              amount: parseFloat(inv.total),
              currency: inv.currency,
              reference: ledgerRef,
            });
          }
        } catch {
          // ledger recording failure is non-fatal here — invoice still gets marked paid
        }
      }

      const { rows: receiptRows } = await client.query(
        `INSERT INTO receipts (invoice_id, transaction_id, ledger_reference, paid_amount, currency, metadata, generated_at)
         VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING *`,
        [id, transaction_id ?? null, ledgerRef, inv.total, inv.currency, JSON.stringify({ ...ledgerEntryIds, invoice_number: inv.invoice_number })],
      );

      await client.query("COMMIT");
      res.json({ success: true, invoice_id: id, receipt: receiptRows[0], ledger_reference: ledgerRef });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    await logError(err, { route: `POST /api/billing/invoices/${req.params.id}/confirm-payment` });
    res.status(500).json({ error: "Payment confirmation failed" });
  }
});

/* ── POST /api/billing/invoices/:id/void ────────────────────────────────── */
billingInvoicesRouter.post("/invoices/:id/void", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      `UPDATE billing_invoices SET status='expired' WHERE id=$1 AND status='pending' RETURNING id`,
      [parseInt(req.params.id)],
    );
    if (rows.length === 0) { res.status(404).json({ error: "Invoice not found or not pending" }); return; }
    res.json({ success: true });
  } catch (err) {
    await logError(err, { route: `POST /api/billing/invoices/${req.params.id}/void` });
    res.status(500).json({ error: "Failed to void invoice" });
  }
});

/* ── GET /api/billing/receipts/my ───────────────────────────────────────── */
billingInvoicesRouter.get("/receipts/my", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, bi.invoice_number, bi.total AS invoice_total, bi.currency AS invoice_currency,
              bi.items, bi.metadata AS invoice_metadata
       FROM receipts r
       JOIN billing_invoices bi ON bi.id = r.invoice_id
       WHERE bi.user_id = $1
       ORDER BY r.generated_at DESC LIMIT 100`,
      [req.userId],
    );
    res.json({ receipts: rows });
  } catch (err) {
    await logError(err, { route: "GET /api/billing/receipts/my" });
    res.status(500).json({ error: "Failed to fetch receipts" });
  }
});

/* ── GET /api/billing/receipts ──────────────────────────────────────────── */
billingInvoicesRouter.get("/receipts", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) ?? "200"), 500);
    const { rows } = await pool.query(
      `SELECT r.*, bi.invoice_number, bi.total AS invoice_total, bi.currency,
              a.display_name AS user_name, a.email
       FROM receipts r
       JOIN billing_invoices bi ON bi.id = r.invoice_id
       LEFT JOIN accounts a ON a.id = bi.user_id
       ORDER BY r.generated_at DESC LIMIT $1`,
      [limit],
    );
    res.json({ receipts: rows });
  } catch (err) {
    await logError(err, { route: "GET /api/billing/receipts" });
    res.status(500).json({ error: "Failed to fetch receipts" });
  }
});

/* ── GET /api/billing/receipts/:id ─────────────────────────────────────── */
billingInvoicesRouter.get("/receipts/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, bi.invoice_number, bi.items, bi.subtotal, bi.discount, bi.total,
              bi.currency, bi.user_id, bi.metadata AS invoice_metadata,
              a.display_name AS user_name, a.email
       FROM receipts r
       JOIN billing_invoices bi ON bi.id = r.invoice_id
       LEFT JOIN accounts a ON a.id = bi.user_id
       WHERE r.id = $1`,
      [parseInt(req.params.id)],
    );
    if (rows.length === 0) { res.status(404).json({ error: "Receipt not found" }); return; }
    const receipt = rows[0];
    if (req.role !== "admin" && req.role !== "super_admin" && receipt.user_id !== req.userId) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    res.json({ receipt });
  } catch (err) {
    await logError(err, { route: `GET /api/billing/receipts/${req.params.id}` });
    res.status(500).json({ error: "Failed to fetch receipt" });
  }
});
