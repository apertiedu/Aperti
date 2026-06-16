import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { logError } from "../lib/log-error";
import { recordRefundLedger, createFraudAlert } from "../lib/ledger-engine";
import { auditLog, getClientIp } from "../lib/financial-audit";

export const disputesRouter = Router();

disputesRouter.use(authenticate);

/* ── POST /api/disputes ─────────────────────────────────────────────────── */
disputesRouter.post("/", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { transaction_id, reason, evidence = [] } = req.body as {
      transaction_id: number;
      reason: string;
      evidence?: string[];
    };

    if (!transaction_id || !reason?.trim()) {
      res.status(400).json({ error: "transaction_id and reason are required" });
      return;
    }

    const { rows: txRows } = await pool.query(
      "SELECT * FROM payment_transactions WHERE id=$1 AND user_id=$2 LIMIT 1",
      [transaction_id, req.userId],
    );
    if (txRows.length === 0) {
      res.status(404).json({ error: "Transaction not found or does not belong to you" });
      return;
    }

    const { rows: existing } = await pool.query(
      "SELECT id FROM disputes WHERE transaction_id=$1 AND status NOT IN ('resolved','rejected') LIMIT 1",
      [transaction_id],
    );
    if (existing.length > 0) {
      res.status(409).json({ error: "An active dispute already exists for this transaction" });
      return;
    }

    const { rows } = await pool.query(
      `INSERT INTO disputes (transaction_id, user_id, reason, evidence, status, created_at)
       VALUES ($1,$2,$3,$4,'open',NOW()) RETURNING *`,
      [transaction_id, req.userId, reason.trim(), JSON.stringify(evidence)],
    );

    await createFraudAlert({
      severity: "medium",
      type: "dispute_opened",
      entityId: transaction_id,
      entityType: "payment_transaction",
      message: `Dispute opened for transaction #${transaction_id}: ${reason.trim().slice(0, 120)}`,
      metadata: { user_id: req.userId, dispute_id: rows[0].id },
    });

    res.status(201).json({ dispute: rows[0] });
  } catch (err) {
    await logError(err, { route: "POST /api/disputes" });
    res.status(500).json({ error: "Failed to open dispute" });
  }
});

/* ── GET /api/disputes/my ───────────────────────────────────────────────── */
disputesRouter.get("/my", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      `SELECT d.*, pt.amount AS tx_amount, pt.currency, pt.purpose, pt.status AS tx_status,
              a.display_name AS resolved_by_name
       FROM disputes d
       JOIN payment_transactions pt ON pt.id = d.transaction_id
       LEFT JOIN accounts a ON a.id = d.resolved_by
       WHERE d.user_id = $1
       ORDER BY d.created_at DESC LIMIT 50`,
      [req.userId],
    );
    res.json({ disputes: rows });
  } catch (err) {
    await logError(err, { route: "GET /api/disputes/my" });
    res.status(500).json({ error: "Failed to fetch disputes" });
  }
});

/* ── GET /api/disputes ──────────────────────────────────────────────────── */
disputesRouter.get("/", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const q = req.query as Record<string, string>;
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (q.status) { params.push(q.status); conditions.push(`d.status = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = Math.min(parseInt(q.limit ?? "200"), 500);
    params.push(limit);

    const { rows } = await pool.query(
      `SELECT d.*, pt.amount AS tx_amount, pt.currency, pt.purpose, pt.status AS tx_status,
              u.display_name AS user_name, u.email,
              r.display_name AS resolved_by_name
       FROM disputes d
       JOIN payment_transactions pt ON pt.id = d.transaction_id
       LEFT JOIN accounts u ON u.id = d.user_id
       LEFT JOIN accounts r ON r.id = d.resolved_by
       ${where}
       ORDER BY CASE d.status WHEN 'open' THEN 1 WHEN 'under_review' THEN 2 ELSE 3 END,
                d.created_at DESC
       LIMIT $${params.length}`,
      params,
    );

    const { rows: stats } = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status='open')::int AS open,
        COUNT(*) FILTER (WHERE status='under_review')::int AS under_review,
        COUNT(*) FILTER (WHERE status='resolved')::int AS resolved,
        COUNT(*) FILTER (WHERE status='rejected')::int AS rejected,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS last_7d
      FROM disputes
    `);

    res.json({ disputes: rows, stats: stats[0] ?? {} });
  } catch (err) {
    await logError(err, { route: "GET /api/disputes" });
    res.status(500).json({ error: "Failed to fetch disputes" });
  }
});

/* ── GET /api/disputes/:id ──────────────────────────────────────────────── */
disputesRouter.get("/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      `SELECT d.*, pt.amount AS tx_amount, pt.currency, pt.purpose, pt.status AS tx_status,
              u.display_name AS user_name, u.email,
              r.display_name AS resolved_by_name,
              le.id AS ledger_entry_count
       FROM disputes d
       JOIN payment_transactions pt ON pt.id = d.transaction_id
       LEFT JOIN accounts u ON u.id = d.user_id
       LEFT JOIN accounts r ON r.id = d.resolved_by
       LEFT JOIN (SELECT transaction_id, COUNT(*)::int AS id FROM ledger_entries GROUP BY transaction_id) le
         ON le.transaction_id = d.transaction_id
       WHERE d.id = $1`,
      [parseInt(req.params.id)],
    );
    if (rows.length === 0) { res.status(404).json({ error: "Dispute not found" }); return; }
    const dispute = rows[0];
    if (req.role !== "admin" && req.role !== "super_admin" && dispute.user_id !== req.userId) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    res.json({ dispute });
  } catch (err) {
    await logError(err, { route: `GET /api/disputes/${req.params.id}` });
    res.status(500).json({ error: "Failed to fetch dispute" });
  }
});

/* ── POST /api/disputes/:id/start-review ────────────────────────────────── */
disputesRouter.post("/:id/start-review", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { admin_note } = req.body as { admin_note?: string };

    const { rows } = await pool.query("SELECT * FROM disputes WHERE id=$1 LIMIT 1", [id]);
    if (rows.length === 0) { res.status(404).json({ error: "Dispute not found" }); return; }
    if (rows[0].status !== "open") { res.status(409).json({ error: "Dispute is not open" }); return; }

    await pool.query(
      "UPDATE disputes SET status='under_review', admin_note=$1 WHERE id=$2",
      [admin_note ?? null, id],
    );

    await pool.query(
      `UPDATE teacher_payouts
       SET status='processing'
       WHERE status='pending'
         AND EXISTS (
           SELECT 1 FROM ledger_entries le
           WHERE le.transaction_id = $1
             AND le.account_type = 'teacher_revenue'
             AND le.entry_type = 'credit'
             AND le.is_reversal = FALSE
         )`,
      [rows[0].transaction_id],
    ).catch(() => {});

    res.json({ success: true, dispute_id: id });
  } catch (err) {
    await logError(err, { route: `POST /api/disputes/${req.params.id}/start-review` });
    res.status(500).json({ error: "Failed to start review" });
  }
});

/* ── POST /api/disputes/:id/resolve ─────────────────────────────────────── */
disputesRouter.post("/:id/resolve", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  const ip = getClientIp(req as unknown as { ip?: string; headers: Record<string, string | string[] | undefined> });
  try {
    const id = parseInt(req.params.id);
    const { outcome, refund_amount, resolution_note } = req.body as {
      outcome: "full_refund" | "partial_refund" | "rejected";
      refund_amount?: number;
      resolution_note: string;
    };

    if (!outcome || !resolution_note?.trim()) {
      res.status(400).json({ error: "outcome and resolution_note are required" });
      return;
    }

    const { rows } = await pool.query("SELECT * FROM disputes WHERE id=$1 LIMIT 1", [id]);
    if (rows.length === 0) { res.status(404).json({ error: "Dispute not found" }); return; }
    const dispute = rows[0];

    if (!["open", "under_review"].includes(dispute.status)) {
      res.status(409).json({ error: "Dispute is already resolved or rejected" });
      return;
    }

    const { rows: txRows } = await pool.query(
      "SELECT * FROM payment_transactions WHERE id=$1 LIMIT 1",
      [dispute.transaction_id],
    );
    const tx = txRows[0];

    let ledgerAction: string | null = null;

    if (outcome !== "rejected" && tx) {
      const refundAmt = outcome === "full_refund" ? parseFloat(tx.amount) : (refund_amount ?? 0);
      if (refundAmt > 0) {
        await recordRefundLedger({
          transactionId: dispute.transaction_id,
          refundAmount: refundAmt,
          reference: `DISPUTE-${id}-${outcome}`,
        }).catch(() => {});
        ledgerAction = `Reversal entry created for ${refundAmt} ${tx.currency ?? "EGP"}`;
      }
    }

    await pool.query(
      `UPDATE disputes
       SET status='resolved', resolution=$1, admin_note=$2, resolved_by=$3, resolved_at=NOW()
       WHERE id=$4`,
      [`${outcome}${refund_amount ? ` (${refund_amount} EGP)` : ""}`, resolution_note, req.userId, id],
    );

    auditLog({ actorId: req.userId!, actorRole: req.role!, action: "DISPUTE_RESOLVED", targetId: id, targetType: "dispute", ip, result: "success", metadata: { outcome, refund_amount, ledgerAction } });
    res.json({ success: true, outcome, ledger_action: ledgerAction });
  } catch (err) {
    await logError(err, { route: `POST /api/disputes/${req.params.id}/resolve` });
    res.status(500).json({ error: "Failed to resolve dispute" });
  }
});

/* ── POST /api/disputes/:id/reject ──────────────────────────────────────── */
disputesRouter.post("/:id/reject", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  const ip = getClientIp(req as unknown as { ip?: string; headers: Record<string, string | string[] | undefined> });
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body as { reason: string };
    const { rows } = await pool.query(
      `UPDATE disputes SET status='rejected', resolution=$1, resolved_by=$2, resolved_at=NOW()
       WHERE id=$3 AND status IN ('open','under_review')
       RETURNING id`,
      [reason?.trim() ?? "Rejected by admin", req.userId, id],
    );
    if (rows.length === 0) { res.status(404).json({ error: "Dispute not found or already resolved" }); return; }
    auditLog({ actorId: req.userId!, actorRole: req.role!, action: "DISPUTE_REJECTED", targetId: id, targetType: "dispute", ip, result: "success", metadata: { reason } });
    res.json({ success: true });
  } catch (err) {
    await logError(err, { route: `POST /api/disputes/${req.params.id}/reject` });
    res.status(500).json({ error: "Failed to reject dispute" });
  }
});
