import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { logError } from "../lib/log-error";
import {
  recordPaymentLedger, recordRefundLedger, getAccountBalance,
  verifyTransactionBalance, findImbalances, findMissingEntries,
  getPlatformCutPercent, setPlatformCutPercent,
} from "../lib/ledger-engine";

export const ledgerRouter = Router();

ledgerRouter.use(authenticate, requireRole("admin", "super_admin"));

/* ── GET /api/ledger/entries ────────────────────────────────────────────── */
ledgerRouter.get("/entries", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const q = req.query as Record<string, string>;
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (q.account_type) {
      params.push(q.account_type);
      conditions.push(`le.account_type = $${params.length}`);
    }
    if (q.entry_type) {
      params.push(q.entry_type);
      conditions.push(`le.entry_type = $${params.length}`);
    }
    if (q.transaction_id) {
      params.push(parseInt(q.transaction_id));
      conditions.push(`le.transaction_id = $${params.length}`);
    }
    if (q.is_reversal !== undefined) {
      params.push(q.is_reversal === "true");
      conditions.push(`le.is_reversal = $${params.length}`);
    }

    const limit = Math.min(parseInt(q.limit ?? "200"), 1000);
    const offset = parseInt(q.offset ?? "0");
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    params.push(limit, offset);
    const { rows } = await pool.query(
      `SELECT le.*,
              pt.amount AS tx_amount, pt.purpose, pt.status AS tx_status,
              u.display_name AS user_name
       FROM ledger_entries le
       LEFT JOIN payment_transactions pt ON pt.id = le.transaction_id
       LEFT JOIN accounts u ON u.id = pt.user_id
       ${where}
       ORDER BY le.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM ledger_entries le ${where}`,
      params.slice(0, -2),
    );

    res.json({ entries: rows, total: countRows[0]?.total ?? 0, limit, offset });
  } catch (err) {
    await logError(err, { route: "/api/ledger/entries" });
    res.status(500).json({ error: "Failed to fetch ledger entries" });
  }
});

/* ── GET /api/ledger/balances ───────────────────────────────────────────── */
ledgerRouter.get("/balances", async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [sw, tr, pr, rp, platformCut] = await Promise.allSettled([
      getAccountBalance("student_wallet"),
      getAccountBalance("teacher_revenue"),
      getAccountBalance("platform_revenue"),
      getAccountBalance("refund_pool"),
      getPlatformCutPercent(),
    ]);

    const { rows: summaryRows } = await pool.query(`
      SELECT
        COUNT(DISTINCT transaction_id)::int AS total_transactions,
        COUNT(*)::int AS total_entries,
        SUM(amount) FILTER (WHERE entry_type='debit')::numeric(12,2) AS total_debited,
        SUM(amount) FILTER (WHERE entry_type='credit')::numeric(12,2) AS total_credited,
        COUNT(*) FILTER (WHERE is_reversal=TRUE)::int AS reversal_entries
      FROM ledger_entries
    `);

    res.json({
      balances: {
        student_wallet:   sw.status === "fulfilled"  ? sw.value  : 0,
        teacher_revenue:  tr.status === "fulfilled"  ? tr.value  : 0,
        platform_revenue: pr.status === "fulfilled"  ? pr.value  : 0,
        refund_pool:      rp.status === "fulfilled"  ? rp.value  : 0,
      },
      platform_cut_percent: platformCut.status === "fulfilled" ? platformCut.value : 15,
      summary: summaryRows[0] ?? {},
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    await logError(err, { route: "/api/ledger/balances" });
    res.status(500).json({ error: "Failed to fetch ledger balances" });
  }
});

/* ── POST /api/ledger/record-payment ────────────────────────────────────── */
ledgerRouter.post("/record-payment", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { transactionId, reference } = req.body as { transactionId: number; reference?: string };
    if (!transactionId) { res.status(400).json({ error: "transactionId is required" }); return; }

    const { rows: txRows } = await pool.query(
      "SELECT * FROM payment_transactions WHERE id=$1 LIMIT 1",
      [transactionId],
    );
    if (txRows.length === 0) { res.status(404).json({ error: "Transaction not found" }); return; }

    const tx = txRows[0];
    const ref = reference ?? `TX-${transactionId}-${Date.now()}`;

    const result = await recordPaymentLedger({
      transactionId,
      amount: parseFloat(tx.amount),
      currency: tx.currency ?? "EGP",
      reference: ref,
    });

    res.status(201).json({ success: true, ...result, reference: ref });
  } catch (err) {
    const msg = (err as Error)?.message ?? "Ledger recording failed";
    if (msg.includes("violation")) { res.status(422).json({ error: msg }); return; }
    await logError(err, { route: "/api/ledger/record-payment" });
    res.status(500).json({ error: msg });
  }
});

/* ── POST /api/ledger/record-refund ─────────────────────────────────────── */
ledgerRouter.post("/record-refund", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { transactionId, refundAmount, reference } = req.body as {
      transactionId: number; refundAmount: number; reference?: string;
    };
    if (!transactionId || !refundAmount) {
      res.status(400).json({ error: "transactionId and refundAmount are required" });
      return;
    }
    const ref = reference ?? `REFUND-${transactionId}-${Date.now()}`;
    await recordRefundLedger({ transactionId, refundAmount, reference: ref });
    res.status(201).json({ success: true, reference: ref });
  } catch (err) {
    const msg = (err as Error)?.message ?? "Refund ledger recording failed";
    await logError(err, { route: "/api/ledger/record-refund" });
    res.status(500).json({ error: msg });
  }
});

/* ── GET /api/ledger/reconcile ──────────────────────────────────────────── */
ledgerRouter.get("/reconcile", async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [imbalances, missing] = await Promise.all([findImbalances(), findMissingEntries()]);

    const isClean = imbalances.length === 0 && missing.length === 0;
    const { rows: totals } = await pool.query(`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE entry_type='debit'),0)::numeric(12,4) AS total_debit,
        COALESCE(SUM(amount) FILTER (WHERE entry_type='credit'),0)::numeric(12,4) AS total_credit
      FROM ledger_entries
    `);

    res.json({
      status: isClean ? "balanced" : "issues_found",
      is_clean: isClean,
      imbalances,
      missing_entries: missing,
      totals: {
        total_debit: parseFloat(totals[0]?.total_debit ?? "0"),
        total_credit: parseFloat(totals[0]?.total_credit ?? "0"),
        net: parseFloat((parseFloat(totals[0]?.total_credit ?? "0") - parseFloat(totals[0]?.total_debit ?? "0")).toFixed(4)),
      },
      checked_at: new Date().toISOString(),
    });
  } catch (err) {
    await logError(err, { route: "/api/ledger/reconcile" });
    res.status(500).json({ error: "Reconciliation failed" });
  }
});

/* ── GET /api/ledger/transaction/:id ────────────────────────────────────── */
ledgerRouter.get("/transaction/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const txId = parseInt(req.params.id);
    const { rows } = await pool.query(
      `SELECT * FROM ledger_entries WHERE transaction_id=$1 ORDER BY id ASC`,
      [txId],
    );
    const balance = await verifyTransactionBalance(txId);
    res.json({ entries: rows, balance_check: balance });
  } catch (err) {
    await logError(err, { route: `/api/ledger/transaction/${req.params.id}` });
    res.status(500).json({ error: "Failed to fetch transaction ledger" });
  }
});

/* ── PATCH /api/ledger/settings ─────────────────────────────────────────── */
ledgerRouter.patch("/settings", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { platform_cut_percent } = req.body as { platform_cut_percent: number };
    if (typeof platform_cut_percent !== "number" || platform_cut_percent < 0 || platform_cut_percent > 50) {
      res.status(400).json({ error: "platform_cut_percent must be a number between 0 and 50" });
      return;
    }
    await setPlatformCutPercent(platform_cut_percent, req.userId!);
    res.json({ success: true, platform_cut_percent });
  } catch (err) {
    await logError(err, { route: "/api/ledger/settings" });
    res.status(500).json({ error: "Failed to update ledger settings" });
  }
});
