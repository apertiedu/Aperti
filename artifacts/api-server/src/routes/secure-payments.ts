import { Router, Request, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { logError } from "../lib/log-error";
import { auditLog, getClientIp } from "../lib/financial-audit";

export const securePaymentsRouter = Router();

securePaymentsRouter.use(authenticate);

type Actor = { id: number; role: string };

interface TxRow {
  id: number;
  user_id: number;
  status: string;
  purpose: string;
  target_id: number | null;
  amount: string;
  currency: string;
  reference_number: string | null;
  screenshot_url: string | null;
  subscription_id: number | null;
  notes: string | null;
  created_at: Date;
}

async function checkApprovalPermission(
  actor: Actor,
  tx: TxRow,
): Promise<{ allowed: boolean; reason?: string }> {
  if (actor.role === "admin" || actor.role === "super_admin") {
    return { allowed: true };
  }

  if (actor.role === "teacher") {
    if (tx.purpose !== "course_enrollment") {
      return { allowed: false, reason: "Teachers may only approve course enrollment payments" };
    }
    if (!tx.target_id) {
      return { allowed: false, reason: "Transaction has no linked course" };
    }
    const { rows } = await pool.query(
      "SELECT id FROM aperti_courses WHERE id = $1 AND teacher_id = $2 LIMIT 1",
      [tx.target_id, actor.id],
    );
    if (rows.length === 0) {
      return { allowed: false, reason: "You do not own this course" };
    }
    return { allowed: true };
  }

  if (actor.role === "assistant") {
    if (tx.purpose !== "course_enrollment") {
      return { allowed: false, reason: "Assistants may only approve course enrollment payments" };
    }
    if (!tx.target_id) {
      return { allowed: false, reason: "Transaction has no linked course" };
    }
    const { rows } = await pool.query(
      `SELECT id FROM assistant_assignments
       WHERE assistant_id = $1
         AND active = TRUE
         AND course_ids @> jsonb_build_array($2::int)
       LIMIT 1`,
      [actor.id, tx.target_id],
    );
    if (rows.length === 0) {
      return { allowed: false, reason: "You are not assigned to this course" };
    }
    return { allowed: true };
  }

  return { allowed: false, reason: "Your role does not have payment approval privileges" };
}

/* ── GET /api/secure-payments/pending ──────────────────────────────────── */
securePaymentsRouter.get(
  "/pending",
  requireRole("admin", "super_admin", "teacher", "assistant"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const actor: Actor = { id: req.userId!, role: req.role! };
      let query: string;
      let params: unknown[];

      if (actor.role === "admin" || actor.role === "super_admin") {
        query = `
          SELECT pt.*, a.username, a.display_name, a.email
          FROM payment_transactions pt
          LEFT JOIN accounts a ON a.id = pt.user_id
          WHERE pt.status = 'pending'
          ORDER BY pt.created_at ASC`;
        params = [];
      } else if (actor.role === "teacher") {
        query = `
          SELECT pt.*, a.username, a.display_name, a.email
          FROM payment_transactions pt
          LEFT JOIN accounts a ON a.id = pt.user_id
          LEFT JOIN aperti_courses c ON c.id = pt.target_id
          WHERE pt.status = 'pending'
            AND pt.purpose = 'course_enrollment'
            AND c.teacher_id = $1
          ORDER BY pt.created_at ASC`;
        params = [actor.id];
      } else {
        query = `
          SELECT pt.*, a.username, a.display_name, a.email
          FROM payment_transactions pt
          LEFT JOIN accounts a ON a.id = pt.user_id
          LEFT JOIN assistant_assignments aa
            ON aa.assistant_id = $1
            AND aa.active = TRUE
            AND aa.course_ids @> jsonb_build_array(pt.target_id::int)
          WHERE pt.status = 'pending'
            AND pt.purpose = 'course_enrollment'
            AND aa.id IS NOT NULL
          ORDER BY pt.created_at ASC`;
        params = [actor.id];
      }

      const { rows } = await pool.query(query, params);
      res.json({ transactions: rows, count: rows.length });
    } catch (err) {
      await logError(err, { route: "/api/secure-payments/pending", method: "GET" });
      res.status(500).json({ status: "degraded", error: "Failed to fetch pending transactions", requiresReview: true });
    }
  },
);

/* ── GET /api/secure-payments/history ──────────────────────────────────── */
securePaymentsRouter.get(
  "/history",
  requireRole("admin", "super_admin", "teacher"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const actor: Actor = { id: req.userId!, role: req.role! };
      const limit = Math.min(parseInt(String(req.query.limit ?? "50")), 200);
      const offset = (parseInt(String(req.query.page ?? "1")) - 1) * limit;

      let baseWhere = "WHERE pt.status IN ('verified','rejected')";
      const params: unknown[] = [];

      if (actor.role === "teacher") {
        params.push(actor.id);
        baseWhere += ` AND c.teacher_id = $${params.length}`;
      }

      params.push(limit, offset);
      const { rows } = await pool.query(
        `SELECT pt.*, a.username, a.display_name,
                al.role AS approver_role, al.action AS approval_action,
                al.batch_id,
                approver.display_name AS approver_name, al.created_at AS decided_at
         FROM payment_transactions pt
         LEFT JOIN accounts a ON a.id = pt.user_id
         LEFT JOIN aperti_courses c ON c.id = pt.target_id
         LEFT JOIN approval_log al ON al.transaction_id = pt.id
         LEFT JOIN accounts approver ON approver.id = al.approved_by
         ${baseWhere}
         ORDER BY pt.created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      );
      res.json({ transactions: rows });
    } catch (err) {
      await logError(err, { route: "/api/secure-payments/history" });
      res.status(500).json({ error: "Failed to fetch history" });
    }
  },
);

/* ── POST /api/secure-payments/:id/approve ──────────────────────────────── */
securePaymentsRouter.post(
  "/:id/approve",
  requireRole("admin", "super_admin", "teacher", "assistant"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const txId = parseInt(req.params.id);
    const actor: Actor = { id: req.userId!, role: req.role! };
    const ip = getClientIp(req as unknown as { ip?: string; headers: Record<string, string | string[] | undefined> });
    const { notes } = req.body as { notes?: string };

    if (isNaN(txId)) {
      res.status(400).json({ error: "Invalid transaction ID" });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows } = await client.query<TxRow>(
        `SELECT * FROM payment_transactions WHERE id = $1 FOR UPDATE SKIP LOCKED`,
        [txId],
      );

      if (rows.length === 0) {
        await client.query("ROLLBACK");
        auditLog({ actorId: actor.id, actorRole: actor.role, action: "APPROVE_TX", targetId: txId, targetType: "payment_transaction", ip, result: "blocked", metadata: { reason: "Transaction locked or not found" } });
        res.status(409).json({ error: "Transaction is currently being processed or does not exist" });
        return;
      }

      const tx = rows[0];

      if (tx.status !== "pending") {
        await client.query("ROLLBACK");
        auditLog({ actorId: actor.id, actorRole: actor.role, action: "APPROVE_TX", targetId: txId, targetType: "payment_transaction", ip, result: "blocked", metadata: { reason: `Already ${tx.status}` } });
        res.status(409).json({ error: `Transaction is already ${tx.status}` });
        return;
      }

      const perm = await checkApprovalPermission(actor, tx);
      if (!perm.allowed) {
        await client.query("ROLLBACK");
        auditLog({ actorId: actor.id, actorRole: actor.role, action: "APPROVE_TX", targetId: txId, targetType: "payment_transaction", ip, result: "blocked", metadata: { reason: perm.reason } });
        res.status(403).json({ error: perm.reason ?? "Approval not permitted" });
        return;
      }

      await client.query(
        `UPDATE payment_transactions
         SET status = 'verified', verified_by = $1, verified_at = NOW(),
             approved_by_role = $2, notes = COALESCE($3, notes)
         WHERE id = $4`,
        [actor.id, actor.role, notes ?? null, txId],
      );

      await client.query(
        `INSERT INTO approval_log (transaction_id, approved_by, role, action, reason, created_at)
         VALUES ($1, $2, $3, 'approve', $4, NOW())`,
        [txId, actor.id, actor.role, notes ?? null],
      );

      if (tx.subscription_id) {
        await client.query(
          `UPDATE subscriptions SET status = 'active', payment_status = 'approved' WHERE id = $1`,
          [tx.subscription_id],
        );
      }

      await client.query(
        `INSERT INTO revenue_records (date, source, amount, currency, teacher_id)
         VALUES (CURRENT_DATE, $1, $2, $3, $4)`,
        [tx.purpose === "course_enrollment" ? "course" : "subscription", tx.amount, tx.currency, actor.id],
      ).catch(() => {});

      await client.query("COMMIT");

      auditLog({ actorId: actor.id, actorRole: actor.role, action: "APPROVE_TX", targetId: txId, targetType: "payment_transaction", ip, result: "success" });
      res.json({ success: true, transactionId: txId, approvedBy: actor.id, role: actor.role });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      await logError(err, { route: `/api/secure-payments/${txId}/approve`, method: "POST", userId: actor.id });
      auditLog({ actorId: actor.id, actorRole: actor.role, action: "APPROVE_TX", targetId: txId, targetType: "payment_transaction", ip, result: "blocked", metadata: { error: (err as Error)?.message } });
      res.status(500).json({ status: "degraded", message: "Approval failed — transaction remains pending", requiresReview: true, error_code: "APPROVAL_EXCEPTION" });
    } finally {
      client.release();
    }
  },
);

/* ── POST /api/secure-payments/:id/reject ───────────────────────────────── */
securePaymentsRouter.post(
  "/:id/reject",
  requireRole("admin", "super_admin", "teacher", "assistant"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const txId = parseInt(req.params.id);
    const actor: Actor = { id: req.userId!, role: req.role! };
    const ip = getClientIp(req as unknown as { ip?: string; headers: Record<string, string | string[] | undefined> });
    const { reason } = req.body as { reason?: string };

    if (isNaN(txId)) {
      res.status(400).json({ error: "Invalid transaction ID" });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows } = await client.query<TxRow>(
        `SELECT * FROM payment_transactions WHERE id = $1 FOR UPDATE SKIP LOCKED`,
        [txId],
      );

      if (rows.length === 0) {
        await client.query("ROLLBACK");
        res.status(409).json({ error: "Transaction is currently being processed or does not exist" });
        return;
      }

      const tx = rows[0];
      if (tx.status !== "pending") {
        await client.query("ROLLBACK");
        res.status(409).json({ error: `Transaction is already ${tx.status}` });
        return;
      }

      const perm = await checkApprovalPermission(actor, tx);
      if (!perm.allowed) {
        await client.query("ROLLBACK");
        auditLog({ actorId: actor.id, actorRole: actor.role, action: "REJECT_TX", targetId: txId, targetType: "payment_transaction", ip, result: "blocked", metadata: { reason: perm.reason } });
        res.status(403).json({ error: perm.reason ?? "Rejection not permitted" });
        return;
      }

      await client.query(
        `UPDATE payment_transactions
         SET status = 'rejected', verified_by = $1, verified_at = NOW(),
             approved_by_role = $2, notes = COALESCE($3, notes)
         WHERE id = $4`,
        [actor.id, actor.role, reason ?? null, txId],
      );

      await client.query(
        `INSERT INTO approval_log (transaction_id, approved_by, role, action, reason, created_at)
         VALUES ($1, $2, $3, 'reject', $4, NOW())`,
        [txId, actor.id, actor.role, reason ?? null],
      );

      await client.query("COMMIT");

      auditLog({ actorId: actor.id, actorRole: actor.role, action: "REJECT_TX", targetId: txId, targetType: "payment_transaction", ip, result: "success" });
      res.json({ success: true, transactionId: txId });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      await logError(err, { route: `/api/secure-payments/${txId}/reject`, method: "POST", userId: actor.id });
      res.status(500).json({ status: "degraded", message: "Rejection failed — transaction remains pending", requiresReview: true, error_code: "REJECTION_EXCEPTION" });
    } finally {
      client.release();
    }
  },
);

/* ── POST /api/secure-payments/submit ──────────────────────────────────── */
securePaymentsRouter.post(
  "/submit",
  async (req: AuthRequest, res: Response): Promise<void> => {
    const ip = getClientIp(req as unknown as { ip?: string; headers: Record<string, string | string[] | undefined> });
    try {
      const { userId, amount, referenceNumber, screenshotUrl, purpose = "platform_subscription", targetId, subscriptionId, notes } = req.body as {
        userId: number; amount: number; referenceNumber?: string;
        screenshotUrl?: string; purpose?: string; targetId?: number;
        subscriptionId?: number; notes?: string;
      };

      if (!userId || !amount) {
        res.status(400).json({ error: "userId and amount are required" });
        return;
      }

      if (referenceNumber) {
        const { rows } = await pool.query(
          "SELECT id FROM payment_transactions WHERE reference_number = $1 LIMIT 1",
          [referenceNumber],
        );
        if (rows.length > 0) {
          auditLog({ actorId: userId, actorRole: "user", action: "SUBMIT_TX_DUPLICATE", targetId: referenceNumber, targetType: "payment_transaction", ip, result: "blocked" });
          res.status(409).json({ error: "Duplicate reference number — this payment has already been submitted" });
          return;
        }
      }

      const { rows } = await pool.query(
        `INSERT INTO payment_transactions
           (user_id, subscription_id, amount, currency, method, reference_number,
            screenshot_url, status, purpose, target_id, notes, created_at)
         VALUES ($1, $2, $3, 'EGP', 'instapay', $4, $5, 'pending', $6, $7, $8, NOW())
         RETURNING *`,
        [userId, subscriptionId ?? null, amount, referenceNumber ?? null, screenshotUrl ?? null, purpose, targetId ?? null, notes ?? null],
      );

      auditLog({ actorId: userId, actorRole: "user", action: "SUBMIT_TX", targetId: rows[0].id, targetType: "payment_transaction", ip, result: "success" });
      res.status(201).json(rows[0]);
    } catch (err) {
      await logError(err, { route: "/api/secure-payments/submit", method: "POST" });
      res.status(500).json({ status: "degraded", message: "Submission failed", requiresReview: true, error_code: "SUBMIT_EXCEPTION" });
    }
  },
);

/* ── POST /api/secure-payments/bulk ─────────────────────────────────────── */
securePaymentsRouter.post(
  "/bulk",
  requireRole("admin", "super_admin"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const actor: Actor = { id: req.userId!, role: req.role! };
    const ip = getClientIp(req as unknown as { ip?: string; headers: Record<string, string | string[] | undefined> });
    const { ids, action, reason, notes } = req.body as {
      ids: number[];
      action: "approve" | "reject";
      reason?: string;
      notes?: string;
    };

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "ids must be a non-empty array" });
      return;
    }
    if (ids.length > 100) {
      res.status(400).json({ error: "Bulk operations are limited to 100 transactions at once" });
      return;
    }
    if (!["approve", "reject"].includes(action)) {
      res.status(400).json({ error: "action must be 'approve' or 'reject'" });
      return;
    }
    if (action === "reject" && !reason?.trim()) {
      res.status(400).json({ error: "reason is required for bulk rejection" });
      return;
    }

    const batchId = crypto.randomUUID();
    const approved: number[] = [];
    const rejectedIds: number[] = [];
    const failed: Array<{ id: number; error: string }> = [];

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const validIds = ids.filter(id => !isNaN(id) && id > 0);
      const { rows: txRows } = await client.query<TxRow>(
        `SELECT * FROM payment_transactions WHERE id = ANY($1) AND status = 'pending' FOR UPDATE SKIP LOCKED`,
        [validIds],
      );

      const lockedIds = new Set(txRows.map(r => r.id));
      for (const id of validIds) {
        if (!lockedIds.has(id)) {
          failed.push({ id, error: "Transaction locked or already processed" });
        }
      }

      for (const tx of txRows) {
        const perm = await checkApprovalPermission(actor, tx);
        if (!perm.allowed) {
          failed.push({ id: tx.id, error: perm.reason ?? "Not permitted" });
          continue;
        }

        if (action === "approve") {
          await client.query(
            `UPDATE payment_transactions
             SET status = 'verified', verified_by = $1, verified_at = NOW(),
                 approved_by_role = $2, notes = COALESCE($3, notes)
             WHERE id = $4`,
            [actor.id, actor.role, notes ?? null, tx.id],
          );
          await client.query(
            `INSERT INTO approval_log (transaction_id, approved_by, role, action, reason, batch_id, created_at)
             VALUES ($1, $2, $3, 'approve', $4, $5, NOW())`,
            [tx.id, actor.id, actor.role, notes ?? null, batchId],
          );
          if (tx.subscription_id) {
            await client.query(
              `UPDATE subscriptions SET status = 'active', payment_status = 'approved' WHERE id = $1`,
              [tx.subscription_id],
            );
          }
          await client.query(
            `INSERT INTO revenue_records (date, source, amount, currency, teacher_id)
             VALUES (CURRENT_DATE, $1, $2, $3, $4)`,
            [tx.purpose === "course_enrollment" ? "course" : "subscription", tx.amount, tx.currency, actor.id],
          ).catch(() => {});
          approved.push(tx.id);
        } else {
          await client.query(
            `UPDATE payment_transactions
             SET status = 'rejected', verified_by = $1, verified_at = NOW(),
                 approved_by_role = $2, notes = COALESCE($3, notes)
             WHERE id = $4`,
            [actor.id, actor.role, reason ?? null, tx.id],
          );
          await client.query(
            `INSERT INTO approval_log (transaction_id, approved_by, role, action, reason, batch_id, created_at)
             VALUES ($1, $2, $3, 'reject', $4, $5, NOW())`,
            [tx.id, actor.id, actor.role, reason ?? null, batchId],
          );
          rejectedIds.push(tx.id);
        }
      }

      await client.query("COMMIT");

      auditLog({
        actorId: actor.id,
        actorRole: actor.role,
        action: action === "approve" ? "BULK_APPROVE_TX" : "BULK_REJECT_TX",
        targetId: batchId,
        targetType: "payment_transaction_batch",
        ip,
        result: "success",
        metadata: { batchId, requested: ids.length, approved: approved.length, rejected: rejectedIds.length, failed: failed.length },
      });

      res.json({
        batchId,
        action,
        approved,
        rejected: rejectedIds,
        failed,
        summary: { requested: ids.length, processed: approved.length + rejectedIds.length, failed: failed.length },
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      await logError(err, { route: "/api/secure-payments/bulk", method: "POST", userId: actor.id });
      auditLog({
        actorId: actor.id,
        actorRole: actor.role,
        action: action === "approve" ? "BULK_APPROVE_TX" : "BULK_REJECT_TX",
        targetId: batchId,
        targetType: "payment_transaction_batch",
        ip,
        result: "blocked",
        metadata: { error: (err as Error)?.message },
      });
      res.status(500).json({ error: "Bulk operation failed", batchId });
    } finally {
      client.release();
    }
  },
);

/* ── GET /api/secure-payments/batch/:batchId ────────────────────────────── */
securePaymentsRouter.get(
  "/batch/:batchId",
  requireRole("admin", "super_admin"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { batchId } = req.params;
      const { rows } = await pool.query(
        `SELECT al.id, al.transaction_id, al.action, al.reason, al.created_at,
                pt.amount, pt.currency, pt.purpose, pt.reference_number,
                a.display_name AS user_name,
                approver.display_name AS approver_name
         FROM approval_log al
         JOIN payment_transactions pt ON pt.id = al.transaction_id
         JOIN accounts a ON a.id = pt.user_id
         JOIN accounts approver ON approver.id = al.approved_by
         WHERE al.batch_id = $1
         ORDER BY al.created_at ASC`,
        [batchId],
      );
      res.json({ batchId, entries: rows, count: rows.length });
    } catch (err) {
      await logError(err, { route: `/api/secure-payments/batch/${req.params.batchId}` });
      res.status(500).json({ error: "Failed to fetch batch audit trail" });
    }
  },
);

/* ── GET /api/secure-payments/audit-log (admin only) ───────────────────── */
securePaymentsRouter.get(
  "/audit-log",
  requireRole("admin", "super_admin"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const limit = Math.min(parseInt(String((req.query as Record<string, string>).limit ?? "100")), 500);
      const { rows } = await pool.query(
        `SELECT fal.*, a.display_name AS actor_name
         FROM financial_audit_log fal
         LEFT JOIN accounts a ON a.id = fal.actor_id
         ORDER BY fal.created_at DESC
         LIMIT $1`,
        [limit],
      );
      res.json({ logs: rows });
    } catch (err) {
      await logError(err, { route: "/api/secure-payments/audit-log" });
      res.status(500).json({ error: "Failed to fetch audit log" });
    }
  },
);

/* ── GET /api/secure-payments/dashboard (admin only) ───────────────────── */
securePaymentsRouter.get(
  "/dashboard",
  requireRole("admin", "super_admin"),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const [pending, approvalStats, discountStats, assistantCount] = await Promise.allSettled([
        pool.query(`
          SELECT COUNT(*)::int AS total,
            SUM(CASE WHEN purpose = 'course_enrollment' THEN 1 ELSE 0 END)::int AS course_count,
            SUM(CASE WHEN purpose = 'platform_subscription' THEN 1 ELSE 0 END)::int AS subscription_count,
            SUM(amount::numeric)::text AS total_amount
          FROM payment_transactions WHERE status = 'pending'`),
        pool.query(`
          SELECT al.action, al.role, COUNT(*)::int AS count
          FROM approval_log al
          WHERE al.created_at > NOW() - INTERVAL '30 days'
          GROUP BY al.action, al.role ORDER BY count DESC`),
        pool.query(`
          SELECT scope, COUNT(*)::int AS total_codes,
            SUM(used_count)::int AS total_uses
          FROM coupons WHERE is_active = TRUE GROUP BY scope`),
        pool.query(`SELECT COUNT(*)::int AS total FROM assistant_assignments WHERE active = TRUE`),
      ]);

      res.json({
        pending: pending.status === "fulfilled" ? pending.value.rows[0] : {},
        approvalStats: approvalStats.status === "fulfilled" ? approvalStats.value.rows : [],
        discountStats: discountStats.status === "fulfilled" ? discountStats.value.rows : [],
        activeAssistants: assistantCount.status === "fulfilled" ? assistantCount.value.rows[0]?.total ?? 0 : 0,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      await logError(err, { route: "/api/secure-payments/dashboard" });
      res.status(500).json({ error: "Failed to fetch dashboard data" });
    }
  },
);
