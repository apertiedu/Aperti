import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { logError } from "../lib/log-error";
import { getPlatformCutPercent, recordPaymentLedger } from "../lib/ledger-engine";
import { auditLog, getClientIp } from "../lib/financial-audit";

export const teacherPayoutsRouter = Router();

teacherPayoutsRouter.use(authenticate);

async function getRefundWindowDays(): Promise<number> {
  const { rows } = await pool.query(
    `SELECT value FROM platform_settings WHERE key='refund_window_days' LIMIT 1`,
  ).catch(() => ({ rows: [] }));
  const val = rows[0]?.value;
  if (val && typeof val === "object" && "days" in val) return parseInt(String(val.days));
  return 7;
}

async function computeTeacherEarnings(teacherId: number, opts: { refundWindowDays?: number; cutPercent?: number } = {}) {
  const refundWindow = opts.refundWindowDays ?? (await getRefundWindowDays());
  const cutPercent = opts.cutPercent ?? (await getPlatformCutPercent());

  const { rows: ledgerRows } = await pool.query(
    `SELECT
       le.id, le.transaction_id, le.amount, le.currency, le.reference,
       le.created_at, le.is_reversal,
       pt.target_id AS course_id, c.name AS course_name, pt.amount AS original_tx_amount
     FROM ledger_entries le
     JOIN payment_transactions pt ON pt.id = le.transaction_id
     JOIN aperti_courses c ON c.id = pt.target_id
     WHERE le.account_type = 'teacher_revenue'
       AND le.entry_type = 'credit'
       AND le.is_reversal = FALSE
       AND c.teacher_id = $1
       AND pt.status IN ('verified','approved')
       AND pt.created_at < NOW() - INTERVAL '1 day' * $2
       AND pt.id NOT IN (
         SELECT rr.transaction_id FROM refund_requests rr
         WHERE rr.status IN ('pending','approved','partial')
       )
       AND le.transaction_id NOT IN (
         SELECT DISTINCT tp.id FROM teacher_payouts tp
         JOIN LATERAL jsonb_array_elements(tp.ledger_snapshot->'entry_ids') AS eid(val) ON TRUE
         WHERE tp.teacher_id = $1 AND tp.status IN ('pending','processing','paid')
       )
     ORDER BY le.created_at ASC`,
    [teacherId, refundWindow],
  );

  const gross = ledgerRows.reduce((s: number, r: { amount: string }) => s + parseFloat(r.amount), 0);
  const entryIds = ledgerRows.map((r: { id: number }) => r.id);
  const courseBreakdown = ledgerRows.reduce((acc: Record<number, { course_name: string; amount: number; count: number }>, r: { course_id: number; course_name: string; amount: string }) => {
    if (!acc[r.course_id]) acc[r.course_id] = { course_name: r.course_name, amount: 0, count: 0 };
    acc[r.course_id].amount += parseFloat(r.amount);
    acc[r.course_id].count += 1;
    return acc;
  }, {});

  return {
    teacher_id: teacherId,
    gross_earnings: parseFloat(gross.toFixed(2)),
    platform_cut_percent: cutPercent,
    net_payout: parseFloat(gross.toFixed(2)),
    eligible_entry_count: ledgerRows.length,
    entry_ids: entryIds,
    course_breakdown: Object.values(courseBreakdown),
    period_start: ledgerRows.length > 0 ? ledgerRows[0].created_at : null,
    period_end: ledgerRows.length > 0 ? ledgerRows[ledgerRows.length - 1].created_at : null,
  };
}

/* ── GET /api/payouts/my ────────────────────────────────────────────────── */
teacherPayoutsRouter.get("/my", requireRole("teacher"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows: payouts } = await pool.query(
      `SELECT tp.*, a.display_name AS processed_by_name
       FROM teacher_payouts tp
       LEFT JOIN accounts a ON a.id = tp.processed_by
       WHERE tp.teacher_id = $1
       ORDER BY tp.created_at DESC LIMIT 50`,
      [req.userId],
    );
    const earnings = await computeTeacherEarnings(req.userId!);
    res.json({ payouts, pending_earnings: earnings });
  } catch (err) {
    await logError(err, { route: "/api/payouts/my" });
    res.status(500).json({ error: "Failed to fetch payout data" });
  }
});

/* ── GET /api/payouts/teacher/:id ────────────────────────────────────────── */
teacherPayoutsRouter.get("/teacher/:id", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacherId = parseInt(req.params.id);
    if (isNaN(teacherId)) { res.status(400).json({ error: "Invalid teacher ID" }); return; }
    const { rows: payouts } = await pool.query(
      `SELECT tp.*, a.display_name AS processed_by_name
       FROM teacher_payouts tp
       LEFT JOIN accounts a ON a.id = tp.processed_by
       WHERE tp.teacher_id = $1
       ORDER BY tp.created_at DESC`,
      [teacherId],
    );
    const earnings = await computeTeacherEarnings(teacherId);
    res.json({ payouts, pending_earnings: earnings });
  } catch (err) {
    await logError(err, { route: `/api/payouts/teacher/${req.params.id}` });
    res.status(500).json({ error: "Failed to fetch payout data" });
  }
});

/* ── GET /api/payouts/pending ────────────────────────────────────────────── */
teacherPayoutsRouter.get("/pending", requireRole("admin", "super_admin"), async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      `SELECT tp.*, a.display_name AS teacher_name, a.email AS teacher_email,
              p.display_name AS processed_by_name
       FROM teacher_payouts tp
       JOIN accounts a ON a.id = tp.teacher_id
       LEFT JOIN accounts p ON p.id = tp.processed_by
       WHERE tp.status IN ('pending','processing')
       ORDER BY tp.created_at ASC`,
    );
    res.json({ payouts: rows });
  } catch (err) {
    await logError(err, { route: "/api/payouts/pending" });
    res.status(500).json({ error: "Failed to fetch pending payouts" });
  }
});

/* ── POST /api/payouts/calculate/:teacherId ─────────────────────────────── */
teacherPayoutsRouter.post("/calculate/:teacherId", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacherId = parseInt(req.params.teacherId);
    if (isNaN(teacherId)) { res.status(400).json({ error: "Invalid teacher ID" }); return; }

    const earnings = await computeTeacherEarnings(teacherId);
    if (earnings.gross_earnings < 0.01) {
      res.status(422).json({ error: "No eligible earnings available for payout", details: earnings });
      return;
    }

    const { rows } = await pool.query(
      `INSERT INTO teacher_payouts
         (teacher_id, gross_amount, platform_cut, net_payout, status, method, period_start, period_end, ledger_snapshot, created_at)
       VALUES ($1, $2, $3, $4, 'pending', 'instapay', $5, $6, $7, NOW())
       RETURNING *`,
      [
        teacherId,
        earnings.gross_earnings,
        0,
        earnings.net_payout,
        earnings.period_start ?? new Date().toISOString(),
        earnings.period_end ?? new Date().toISOString(),
        JSON.stringify({ entry_ids: earnings.entry_ids, course_breakdown: earnings.course_breakdown }),
      ],
    );

    res.status(201).json({ payout: rows[0], earnings });
  } catch (err) {
    await logError(err, { route: `/api/payouts/calculate/${req.params.teacherId}` });
    res.status(500).json({ error: "Payout calculation failed" });
  }
});

/* ── POST /api/payouts/batch-calculate ──────────────────────────────────── */
teacherPayoutsRouter.post("/batch-calculate", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  const ip = getClientIp(req as unknown as { ip?: string; headers: Record<string, string | string[] | undefined> });
  try {
    const { rows: teachers } = await pool.query(
      `SELECT DISTINCT a.id, a.display_name
       FROM accounts a
       JOIN aperti_courses c ON c.teacher_id = a.id
       JOIN payment_transactions pt ON pt.target_id = c.id
       WHERE a.role = 'teacher' AND pt.status IN ('verified','approved')`,
    );

    const results: Array<{ teacher_id: number; teacher_name: string; status: string; amount?: number; reason?: string }> = [];
    const [refundWindow, cutPercent] = await Promise.all([getRefundWindowDays(), getPlatformCutPercent()]);

    for (const teacher of teachers) {
      try {
        const earnings = await computeTeacherEarnings(teacher.id, { refundWindowDays: refundWindow, cutPercent });
        if (earnings.gross_earnings < 0.01) {
          results.push({ teacher_id: teacher.id, teacher_name: teacher.display_name, status: "skipped", reason: "no eligible earnings" });
          continue;
        }

        await pool.query(
          `INSERT INTO teacher_payouts
             (teacher_id, gross_amount, platform_cut, net_payout, status, method, period_start, period_end, ledger_snapshot, created_at)
           VALUES ($1,$2,0,$3,'pending','instapay',$4,$5,$6,NOW())`,
          [
            teacher.id, earnings.gross_earnings, earnings.net_payout,
            earnings.period_start ?? new Date().toISOString(),
            earnings.period_end ?? new Date().toISOString(),
            JSON.stringify({ entry_ids: earnings.entry_ids, course_breakdown: earnings.course_breakdown }),
          ],
        );
        results.push({ teacher_id: teacher.id, teacher_name: teacher.display_name, status: "created", amount: earnings.net_payout });
      } catch {
        results.push({ teacher_id: teacher.id, teacher_name: teacher.display_name, status: "error" });
      }
    }

    auditLog({ actorId: req.userId!, actorRole: req.role!, action: "BATCH_PAYOUT_CALCULATE", targetId: 0, targetType: "teacher_payouts", ip, result: "success", metadata: { created: results.filter(r => r.status === "created").length } });
    res.json({ results, summary: { total: results.length, created: results.filter(r => r.status === "created").length, skipped: results.filter(r => r.status === "skipped").length, errors: results.filter(r => r.status === "error").length } });
  } catch (err) {
    await logError(err, { route: "/api/payouts/batch-calculate" });
    res.status(500).json({ error: "Batch calculation failed" });
  }
});

/* ── POST /api/payouts/:id/process ──────────────────────────────────────── */
teacherPayoutsRouter.post("/:id/process", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  const ip = getClientIp(req as unknown as { ip?: string; headers: Record<string, string | string[] | undefined> });
  try {
    const id = parseInt(req.params.id);
    const { reference } = req.body as { reference?: string };

    const { rows } = await pool.query("SELECT * FROM teacher_payouts WHERE id=$1 LIMIT 1", [id]);
    if (rows.length === 0) { res.status(404).json({ error: "Payout not found" }); return; }
    if (rows[0].status === "paid") { res.status(409).json({ error: "Already paid" }); return; }

    const updated = await pool.query(
      `UPDATE teacher_payouts SET status='paid', reference=$1, processed_by=$2, processed_at=NOW()
       WHERE id=$3 RETURNING *`,
      [reference ?? `PAYOUT-${id}-${Date.now()}`, req.userId, id],
    );

    auditLog({ actorId: req.userId!, actorRole: req.role!, action: "PAYOUT_PROCESSED", targetId: id, targetType: "teacher_payout", ip, result: "success", metadata: { amount: rows[0].net_payout, teacher_id: rows[0].teacher_id } });
    res.json({ success: true, payout: updated.rows[0] });
  } catch (err) {
    await logError(err, { route: `/api/payouts/${req.params.id}/process` });
    res.status(500).json({ error: "Failed to process payout" });
  }
});

/* ── POST /api/payouts/:id/cancel ────────────────────────────────────────── */
teacherPayoutsRouter.post("/:id/cancel", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { rows } = await pool.query(
      `UPDATE teacher_payouts SET status='cancelled' WHERE id=$1 AND status='pending' RETURNING id, status`,
      [id],
    );
    if (rows.length === 0) { res.status(404).json({ error: "Payout not found or not pending" }); return; }
    res.json({ success: true, payout: rows[0] });
  } catch (err) {
    await logError(err, { route: `/api/payouts/${req.params.id}/cancel` });
    res.status(500).json({ error: "Failed to cancel payout" });
  }
});

/* ── GET /api/payouts/overview (admin summary) ───────────────────────────── */
teacherPayoutsRouter.get("/overview", requireRole("admin", "super_admin"), async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)::int AS total_payouts,
        COUNT(*) FILTER (WHERE status='pending')::int AS pending_count,
        COUNT(*) FILTER (WHERE status='paid')::int AS paid_count,
        COALESCE(SUM(net_payout) FILTER (WHERE status='paid'),0)::numeric(12,2) AS total_paid_out,
        COALESCE(SUM(net_payout) FILTER (WHERE status='pending'),0)::numeric(12,2) AS pending_amount,
        COUNT(DISTINCT teacher_id)::int AS teachers_with_payouts
      FROM teacher_payouts
    `);
    const cutPercent = await getPlatformCutPercent();
    res.json({ overview: rows[0] ?? {}, platform_cut_percent: cutPercent });
  } catch (err) {
    await logError(err, { route: "/api/payouts/overview" });
    res.status(500).json({ error: "Failed to fetch payout overview" });
  }
});

/* ── POST /api/payouts/ledger-record (admin: record a manual payment to ledger) */
teacherPayoutsRouter.post("/ledger-record", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { transactionId, reference } = req.body as { transactionId: number; reference?: string };
    if (!transactionId) { res.status(400).json({ error: "transactionId is required" }); return; }

    const { rows: txRows } = await pool.query("SELECT * FROM payment_transactions WHERE id=$1 LIMIT 1", [transactionId]);
    if (txRows.length === 0) { res.status(404).json({ error: "Transaction not found" }); return; }

    const result = await recordPaymentLedger({
      transactionId,
      amount: parseFloat(txRows[0].amount),
      currency: txRows[0].currency ?? "EGP",
      reference: reference ?? `TX-${transactionId}-${Date.now()}`,
    });

    res.status(201).json({ success: true, ...result });
  } catch (err) {
    const msg = (err as Error)?.message ?? "Ledger recording failed";
    await logError(err, { route: "/api/payouts/ledger-record" });
    res.status(500).json({ error: msg });
  }
});
