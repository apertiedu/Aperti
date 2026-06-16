import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { logError } from "../lib/log-error";
import { auditLog, getClientIp } from "../lib/financial-audit";

export const refundEngineRouter = Router();

refundEngineRouter.use(authenticate);

interface RefundRule {
  id: number;
  name: string;
  condition_type: string;
  condition_value: string;
  action: "full" | "partial" | "reject";
  refund_percent: number;
  priority: number;
  is_active: boolean;
}

interface RefundDecision {
  transaction_id: number;
  status: "approved" | "partial" | "rejected";
  refund_amount: number;
  reason: string;
  rules_triggered: string[];
}

async function evaluateRefundRules(txId: number): Promise<RefundDecision> {
  const { rows: txRows } = await pool.query(
    `SELECT pt.*, EXTRACT(EPOCH FROM (NOW() - pt.created_at)) / 3600 AS hours_since_payment
     FROM payment_transactions pt WHERE pt.id = $1 LIMIT 1`,
    [txId],
  );

  if (txRows.length === 0) {
    return { transaction_id: txId, status: "rejected", refund_amount: 0, reason: "Transaction not found", rules_triggered: ["transaction_not_found"] };
  }

  const tx = txRows[0];

  if (!["verified", "rejected"].includes(tx.status)) {
    return { transaction_id: txId, status: "rejected", refund_amount: 0, reason: "Only completed transactions are eligible for refund review", rules_triggered: ["invalid_status"] };
  }

  const hoursSince = parseFloat(tx.hours_since_payment ?? "9999");
  const originalAmount = parseFloat(tx.amount ?? "0");

  let courseAccessed = false;
  if (tx.purpose === "course_enrollment" && tx.target_id) {
    const { rows: accessRows } = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM attendance
       WHERE lesson_id IN (SELECT id FROM lessons WHERE course_id = $1)
         AND student_id = (SELECT id FROM students WHERE account_id = $2 LIMIT 1)`,
      [tx.target_id, tx.user_id],
    ).catch(() => ({ rows: [{ cnt: 0 }] }));
    courseAccessed = (accessRows[0]?.cnt ?? 0) > 0;
  }

  const { rows: rules } = await pool.query<RefundRule>(
    `SELECT * FROM refund_rules WHERE is_active = TRUE ORDER BY priority DESC`,
  );

  const rulesTriggered: string[] = [];
  let finalAction: "full" | "partial" | "reject" = "reject";
  let finalPercent = 0;

  for (const rule of rules) {
    let triggered = false;

    if (rule.condition_type === "hours_since_payment_lt" && hoursSince < parseFloat(rule.condition_value)) triggered = true;
    if (rule.condition_type === "hours_since_payment_gte" && hoursSince >= parseFloat(rule.condition_value)) triggered = true;
    if (rule.condition_type === "course_accessed" && courseAccessed) triggered = true;
    if (rule.condition_type === "course_not_accessed" && !courseAccessed && tx.purpose === "course_enrollment") triggered = true;

    if (triggered) {
      rulesTriggered.push(rule.name);
      if (rule.action === "reject") {
        finalAction = "reject";
        finalPercent = 0;
        break;
      }
      if (finalAction === "reject" || rule.refund_percent < finalPercent) {
        finalAction = rule.action;
        finalPercent = rule.refund_percent;
      }
    }
  }

  if (rulesTriggered.length === 0) {
    finalAction = "reject";
    finalPercent = 0;
    rulesTriggered.push("no_rules_matched");
  }

  const refundAmount = parseFloat(((originalAmount * finalPercent) / 100).toFixed(2));

  return {
    transaction_id: txId,
    status: finalAction === "full" ? "approved" : finalAction === "partial" ? "partial" : "rejected",
    refund_amount: refundAmount,
    reason: rulesTriggered.map((r) => r.replace(/_/g, " ")).join("; "),
    rules_triggered: rulesTriggered,
  };
}

/* ── POST /api/refunds/request ──────────────────────────────────────────── */
refundEngineRouter.post("/request", async (req: AuthRequest, res: Response): Promise<void> => {
  const ip = getClientIp(req as unknown as { ip?: string; headers: Record<string, string | string[] | undefined> });
  try {
    const { transactionId, reason } = req.body as { transactionId: number; reason?: string };
    if (!transactionId) { res.status(400).json({ error: "transactionId is required" }); return; }

    const { rows: txRows } = await pool.query(
      "SELECT * FROM payment_transactions WHERE id = $1 LIMIT 1",
      [transactionId],
    );
    if (txRows.length === 0) { res.status(404).json({ error: "Transaction not found" }); return; }

    const tx = txRows[0];
    if (tx.user_id !== req.userId && req.role !== "admin" && req.role !== "super_admin") {
      auditLog({ actorId: req.userId!, actorRole: req.role!, action: "REFUND_REQUEST_UNAUTHORIZED", targetId: transactionId, targetType: "payment_transaction", ip, result: "blocked" });
      res.status(403).json({ error: "You can only request refunds for your own transactions" });
      return;
    }

    const { rows: existing } = await pool.query(
      "SELECT id, status FROM refund_requests WHERE transaction_id = $1 LIMIT 1",
      [transactionId],
    );
    if (existing.length > 0) {
      res.status(409).json({ error: `A refund request already exists for this transaction (status: ${existing[0].status})` });
      return;
    }

    const decision = await evaluateRefundRules(transactionId);

    const { rows } = await pool.query(
      `INSERT INTO refund_requests
         (transaction_id, requested_by, status, refund_amount, reason, rules_triggered, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [transactionId, req.userId, decision.status === "rejected" ? "pending" : decision.status, decision.refund_amount, reason ?? decision.reason, JSON.stringify(decision.rules_triggered)],
    );

    auditLog({ actorId: req.userId!, actorRole: req.role!, action: "REFUND_REQUEST", targetId: transactionId, targetType: "payment_transaction", ip, result: "success", metadata: { decision } });
    res.status(201).json({ refund_request: rows[0], initial_evaluation: decision });
  } catch (err) {
    await logError(err, { route: "/api/refunds/request" });
    res.status(500).json({ error: "Failed to submit refund request" });
  }
});

/* ── GET /api/refunds ───────────────────────────────────────────────────── */
refundEngineRouter.get("/", requireRole("admin", "super_admin", "teacher"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isAdmin = req.role === "admin" || req.role === "super_admin";
    const status = (req.query as Record<string, string>).status;
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (!isAdmin) {
      params.push(req.userId);
      conditions.push(`c.teacher_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`rr.status = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT rr.*,
              pt.amount AS original_amount, pt.currency, pt.purpose, pt.reference_number,
              u.display_name AS requester_name, u.email AS requester_email,
              d.display_name AS decided_by_name,
              c.name AS course_name
       FROM refund_requests rr
       LEFT JOIN payment_transactions pt ON pt.id = rr.transaction_id
       LEFT JOIN accounts u ON u.id = rr.requested_by
       LEFT JOIN accounts d ON d.id = rr.decided_by
       LEFT JOIN aperti_courses c ON c.id = pt.target_id
       ${where}
       ORDER BY rr.created_at DESC
       LIMIT 200`,
      params,
    );
    res.json({ refund_requests: rows });
  } catch (err) {
    await logError(err, { route: "/api/refunds" });
    res.status(500).json({ error: "Failed to fetch refund requests" });
  }
});

/* ── POST /api/refunds/:id/evaluate ────────────────────────────────────── */
refundEngineRouter.post("/:id/evaluate", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { rows } = await pool.query("SELECT * FROM refund_requests WHERE id = $1 LIMIT 1", [id]);
    if (rows.length === 0) { res.status(404).json({ error: "Refund request not found" }); return; }

    const decision = await evaluateRefundRules(rows[0].transaction_id);
    res.json({ evaluation: decision });
  } catch (err) {
    await logError(err, { route: `/api/refunds/${req.params.id}/evaluate` });
    res.status(500).json({ error: "Evaluation failed" });
  }
});

/* ── POST /api/refunds/:id/process ─────────────────────────────────────── */
refundEngineRouter.post("/:id/process", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  const ip = getClientIp(req as unknown as { ip?: string; headers: Record<string, string | string[] | undefined> });
  try {
    const id = parseInt(req.params.id);
    const { action, notes } = req.body as { action: "approved" | "partial" | "rejected"; notes?: string };

    if (!["approved", "partial", "rejected"].includes(action)) {
      res.status(400).json({ error: "action must be approved, partial, or rejected" });
      return;
    }

    const { rows } = await pool.query("SELECT * FROM refund_requests WHERE id = $1 LIMIT 1", [id]);
    if (rows.length === 0) { res.status(404).json({ error: "Refund request not found" }); return; }
    if (rows[0].status !== "pending") { res.status(409).json({ error: `Already processed (${rows[0].status})` }); return; }

    await pool.query(
      `UPDATE refund_requests SET status = $1, decided_by = $2, decided_at = NOW(), reason = COALESCE($3, reason) WHERE id = $4`,
      [action, req.userId, notes ?? null, id],
    );

    if (action !== "rejected") {
      await pool.query(
        `UPDATE payment_transactions SET status = 'refunded' WHERE id = $1`,
        [rows[0].transaction_id],
      ).catch(() => {});
    }

    auditLog({ actorId: req.userId!, actorRole: req.role!, action: `REFUND_${action.toUpperCase()}`, targetId: id, targetType: "refund_request", ip, result: "success", metadata: { transactionId: rows[0].transaction_id } });
    res.json({ success: true, status: action });
  } catch (err) {
    await logError(err, { route: `/api/refunds/${req.params.id}/process` });
    res.status(500).json({ error: "Failed to process refund" });
  }
});

/* ── GET /api/refunds/rules ─────────────────────────────────────────────── */
refundEngineRouter.get("/rules", requireRole("admin", "super_admin"), async (_req, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query("SELECT * FROM refund_rules ORDER BY priority DESC");
    res.json({ rules: rows });
  } catch (err) {
    await logError(err, { route: "/api/refunds/rules" });
    res.status(500).json({ error: "Failed to fetch rules" });
  }
});

/* ── POST /api/refunds/rules ────────────────────────────────────────────── */
refundEngineRouter.post("/rules", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  const ip = getClientIp(req as unknown as { ip?: string; headers: Record<string, string | string[] | undefined> });
  try {
    const { name, condition_type, condition_value, action, refund_percent, priority } = req.body as {
      name: string; condition_type: string; condition_value: string;
      action: string; refund_percent: number; priority?: number;
    };
    if (!name || !condition_type || !condition_value || !action) {
      res.status(400).json({ error: "name, condition_type, condition_value, and action are required" });
      return;
    }
    const { rows } = await pool.query(
      `INSERT INTO refund_rules (name, condition_type, condition_value, action, refund_percent, priority, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW()) RETURNING *`,
      [name, condition_type, condition_value, action, refund_percent ?? 100, priority ?? 0],
    );
    auditLog({ actorId: req.userId!, actorRole: req.role!, action: "CREATE_REFUND_RULE", targetId: rows[0].id, targetType: "refund_rule", ip, result: "success" });
    res.status(201).json(rows[0]);
  } catch (err) {
    await logError(err, { route: "/api/refunds/rules", method: "POST" });
    res.status(500).json({ error: "Failed to create rule" });
  }
});
