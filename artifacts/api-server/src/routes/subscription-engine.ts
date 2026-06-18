import { Router, Response } from "express";
import rateLimit from "express-rate-limit";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { logError } from "../lib/log-error";
import { auditLog, getClientIp } from "../lib/financial-audit";
import { sendPushToUser } from "../lib/push";
import {
  transitionSubscription,
  activateWithLedger,
  runGraceAndExpiryCheck,
  checkFraudFlags,
  canTransition,
  type SubscriptionStatus,
} from "../lib/subscription-fsm";
import crypto from "crypto";

export const subscriptionEngineRouter = Router();
subscriptionEngineRouter.use(authenticate);

function genRef(): string {
  return "APT-" + crypto.randomBytes(4).toString("hex").toUpperCase();
}

const INSTAPAY_PHONE = process.env.INSTAPAY_PHONE ?? "01XXXXXXXXXX";
const INSTAPAY_NAME  = process.env.INSTAPAY_NAME  ?? "Aperti Educational Platform";

const paymentAttemptLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  handler: (_req, res) => {
    res.status(429).json({
      error: "Too many payment attempts. Maximum 3 attempts per 10 minutes.",
      code: "RATE_LIMIT_PAYMENT",
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/* ── POST /api/sub-engine/initiate ─────────────────────────────────────── */
subscriptionEngineRouter.post("/initiate", paymentAttemptLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  const ip = getClientIp(req as unknown as { ip?: string; headers: Record<string, string | string[] | undefined> });
  try {
    const userId = req.userId!;
    const { planId, discountCode } = req.body as { planId: number; discountCode?: string };
    if (!planId) { res.status(400).json({ error: "planId is required" }); return; }

    const { rows: [plan] } = await pool.query(
      `SELECT * FROM subscription_plans WHERE id = $1 AND (visibility = TRUE OR visibility IS NULL)`,
      [planId],
    );
    if (!plan) { res.status(400).json({ error: "Plan not found" }); return; }

    const planType: string = plan.type ?? "teacher";
    const userRole: string = req.role ?? "";
    const studentRoles = ["student"];
    const teacherRoles = ["teacher", "admin", "super_admin"];
    const parentRoles = ["parent", "admin", "super_admin"];
    const adminRoles = ["admin", "super_admin"];
    const planAllowed =
      (planType === "student" && studentRoles.includes(userRole)) ||
      (planType === "teacher" && teacherRoles.includes(userRole)) ||
      (planType === "parent" && parentRoles.includes(userRole)) ||
      adminRoles.includes(userRole);
    if (!planAllowed) {
      res.status(403).json({ error: "This plan is not available for your account type.", code: "PLAN_TYPE_MISMATCH" });
      return;
    }

    const { rows: existing } = await pool.query(
      `SELECT id, status FROM subscriptions
       WHERE account_id = $1 AND status IN ('pending_payment','pending_confirmation','active')
       ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    if (existing.length > 0) {
      const s = existing[0];
      if (s.status === "active") {
        res.status(409).json({ error: "You already have an active subscription.", code: "ALREADY_ACTIVE" });
        return;
      }
      if (s.status === "pending_payment" || s.status === "pending_confirmation") {
        res.status(409).json({
          error: "You have a pending payment. Complete or cancel it before starting a new one.",
          code: "PENDING_EXISTS",
          subscription_id: s.id,
        });
        return;
      }
    }

    let finalAmount = parseFloat(plan.price_egp);
    let appliedDiscount: { code: string; pct: number } | null = null;

    if (discountCode) {
      const trimmed = discountCode.trim().toUpperCase();

      // ── SECURITY: Atomic coupon claim — check and increment in one statement.
      // A separate SELECT then UPDATE creates a TOCTOU race: two concurrent
      // requests can both pass the max_uses check before either increments
      // used_count. The UPDATE ... WHERE ... RETURNING is atomic at the DB level.
      const { rows: [coupon] } = await pool.query(
        `UPDATE coupons
         SET used_count = used_count + 1
         WHERE code = $1
           AND is_active = TRUE
           AND (scope = 'platform' OR scope = 'subscription')
           AND scope != 'teacher'
           AND (expires_at IS NULL OR expires_at > NOW())
           AND (max_uses IS NULL OR used_count < max_uses)
         RETURNING *`,
        [trimmed],
      ).catch(() => ({ rows: [] }));

      if (!coupon) {
        res.status(400).json({ error: "Discount code invalid, expired, or not applicable to subscriptions.", code: "INVALID_COUPON" });
        return;
      }
      const discount = parseFloat(coupon.discount_pct ?? "0");
      finalAmount = Math.round(finalAmount * (1 - discount / 100) * 100) / 100;
      appliedDiscount = { code: coupon.code, pct: discount };
    }

    const ref = genRef();
    const instructions = `Send EGP ${finalAmount} to ${INSTAPAY_PHONE} (${INSTAPAY_NAME}) via InstaPay. Reference: ${ref}`;

    const { rows: [invoice] } = await pool.query(
      `INSERT INTO billing_invoices (user_id, amount, plan_name, due_at, status, invoice_number, items, discount)
       VALUES ($1,$2,$3,NOW() + INTERVAL '48 hours','pending',$4,$5,$6) RETURNING *`,
      [
        userId,
        finalAmount,
        plan.name,
        ref,
        JSON.stringify([{ name: plan.name, qty: 1, unit_price: finalAmount }]),
        appliedDiscount ? (parseFloat(plan.price_egp) - finalAmount) : 0,
      ],
    );

    const { rows: [sub] } = await pool.query(
      `INSERT INTO subscriptions
         (account_id, plan_id, status, payment_status, payment_reference, pending_invoice_id, start_date, created_at)
       VALUES ($1,$2,'pending_payment','pending',$3,$4,NOW(),NOW()) RETURNING *`,
      [userId, planId, ref, invoice.id],
    );

    // Coupon already atomically incremented above — no second update needed.
    // If subscription insertion fails, roll back the coupon claim.
    if (appliedDiscount && !sub) {
      await pool.query(
        `UPDATE coupons SET used_count = GREATEST(used_count - 1, 0) WHERE code = $1`,
        [appliedDiscount.code],
      ).catch(() => {});
    }

    await pool.query(
      `INSERT INTO subscription_audit_log
         (subscription_id, user_id, previous_status, new_status, reason, triggered_by, actor_id, metadata, created_at)
       VALUES ($1,$2,'inactive','pending_payment','User initiated subscription checkout','user',$2,$3,NOW())`,
      [sub.id, userId, JSON.stringify({ planId, ref, finalAmount, discount: appliedDiscount })],
    );

    auditLog({ actorId: userId, actorRole: req.role ?? "teacher", action: "SUBSCRIPTION_INITIATED", targetId: sub.id, targetType: "subscription", ip, result: "success" });

    res.status(201).json({
      subscription_id: sub.id,
      invoice_id: invoice.id,
      reference: ref,
      amount: finalAmount,
      discount_applied: appliedDiscount,
      instapay: { phone: INSTAPAY_PHONE, name: INSTAPAY_NAME, amount: finalAmount, reference: ref },
      instructions,
      state: "pending_payment",
      next_step: "Submit your Instapay reference code and proof of payment",
    });
  } catch (err) {
    await logError(err, { route: "POST /api/sub-engine/initiate" });
    res.status(500).json({ error: "Failed to initiate subscription" });
  }
});

/* ── POST /api/sub-engine/submit-payment ───────────────────────────────── */
subscriptionEngineRouter.post("/submit-payment", paymentAttemptLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  const ip = getClientIp(req as unknown as { ip?: string; headers: Record<string, string | string[] | undefined> });
  try {
    const userId = req.userId!;
    const { subscriptionId, instapayCode, proofUrl } = req.body as {
      subscriptionId: number;
      instapayCode: string;
      proofUrl?: string;
    };

    if (!subscriptionId || !instapayCode?.trim()) {
      res.status(400).json({ error: "subscriptionId and instapayCode are required" });
      return;
    }

    const trimCode = instapayCode.trim();

    const { rows: [sub] } = await pool.query(
      `SELECT * FROM subscriptions WHERE id = $1 AND account_id = $2 FOR UPDATE`,
      [subscriptionId, userId],
    ).catch(() => ({ rows: [] }));

    if (!sub) { res.status(404).json({ error: "Subscription not found" }); return; }

    if (sub.status !== "pending_payment") {
      res.status(409).json({
        error: `Cannot submit payment from state: ${sub.status}`,
        code: "INVALID_STATE",
        current_status: sub.status,
      });
      return;
    }

    const { rows: dupeCode } = await pool.query(
      `SELECT id FROM subscriptions WHERE instapay_code = $1 AND id != $2 LIMIT 1`,
      [trimCode, subscriptionId],
    );
    if (dupeCode.length > 0) {
      res.status(409).json({ error: "This Instapay reference code has already been used.", code: "DUPLICATE_CODE" });
      return;
    }

    const { rows: dupePr } = await pool.query(
      `SELECT id FROM payment_requests WHERE reference_code = $1 AND status IN ('verified','paid') LIMIT 1`,
      [trimCode],
    );
    if (dupePr.length > 0) {
      res.status(409).json({ error: "This Instapay code is already confirmed on another payment.", code: "CODE_ALREADY_CONFIRMED" });
      return;
    }

    const result = await transitionSubscription({
      subscriptionId,
      to: "pending_confirmation",
      reason: `User submitted Instapay code: ${trimCode}`,
      triggeredBy: "payment",
      actorId: userId,
      metadata: { instapayCode: trimCode, proofUrl },
      extraUpdates: {
        instapay_code: trimCode,
        screenshot_url: proofUrl ?? null,
        payment_attempt_count: (sub.payment_attempt_count ?? 0) + 1,
      },
    });

    if (!result.success) {
      res.status(422).json({ error: result.error, code: "FSM_TRANSITION_FAILED" });
      return;
    }

    await pool.query(
      `INSERT INTO payment_requests (user_id, plan_id, amount, reference_code, instructions, status, proof_url)
       VALUES ($1,$2,$3,$4,'Instapay payment submitted','paid',$5)
       ON CONFLICT (reference_code) DO UPDATE SET status = 'paid', proof_url = $5`,
      [userId, sub.plan_id, sub.amount ?? 0, trimCode, proofUrl ?? null],
    ).catch(() => {});

    const { flagged, reasons } = await checkFraudFlags(userId, subscriptionId);
    if (flagged) {
      await pool.query(
        `UPDATE subscriptions SET fraud_flags = $1::jsonb WHERE id = $2`,
        [JSON.stringify(reasons), subscriptionId],
      );
    }

    auditLog({ actorId: userId, actorRole: req.role ?? "teacher", action: "PAYMENT_SUBMITTED", targetId: subscriptionId, targetType: "subscription", ip, result: "success" });

    res.json({
      success: true,
      state: "pending_confirmation",
      fraud_flagged: flagged,
      message: "Payment submitted. An admin will verify your payment shortly.",
    });
  } catch (err) {
    await logError(err, { route: "POST /api/sub-engine/submit-payment" });
    res.status(500).json({ error: "Failed to submit payment" });
  }
});

/* ── GET /api/sub-engine/my-status ─────────────────────────────────────── */
subscriptionEngineRouter.get("/my-status", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*, sp.name AS plan_name, sp.price_egp, sp.features, sp.limits, sp.type AS plan_type,
              EXTRACT(EPOCH FROM (s.end_date - NOW())) / 86400 AS days_remaining,
              bi.invoice_number, bi.status AS invoice_status
       FROM subscriptions s
       LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
       LEFT JOIN billing_invoices bi ON bi.id = s.pending_invoice_id
       WHERE s.account_id = $1
       ORDER BY s.created_at DESC LIMIT 1`,
      [req.userId],
    );

    if (rows.length === 0) {
      res.json({ subscription: null, access_granted: false, state: "inactive" });
      return;
    }

    const sub = rows[0];
    const daysRemaining = Math.max(0, Math.round(parseFloat(sub.days_remaining ?? "0")));
    const status = sub.status as SubscriptionStatus;

    res.json({
      subscription: {
        ...sub,
        days_remaining: daysRemaining,
        access_granted: status === "active" || status === "grace_period",
        is_grace: status === "grace_period",
        fraud_flagged: Array.isArray(sub.fraud_flags) ? sub.fraud_flags.length > 0 : false,
      },
      state: status,
      access_granted: status === "active" || status === "grace_period",
    });
  } catch (err) {
    await logError(err, { route: "GET /api/sub-engine/my-status" });
    res.status(500).json({ error: "Failed" });
  }
});

/* ── POST /api/sub-engine/cancel ───────────────────────────────────────── */
subscriptionEngineRouter.post("/cancel", async (req: AuthRequest, res: Response): Promise<void> => {
  const ip = getClientIp(req as unknown as { ip?: string; headers: Record<string, string | string[] | undefined> });
  try {
    const { subscriptionId } = req.body as { subscriptionId: number };
    const { rows: [sub] } = await pool.query(
      `SELECT id, status FROM subscriptions WHERE id = $1 AND account_id = $2`,
      [subscriptionId, req.userId],
    );
    if (!sub) { res.status(404).json({ error: "Not found" }); return; }

    if (!canTransition(sub.status as SubscriptionStatus, "expired")) {
      res.status(400).json({ error: `Cannot cancel from state: ${sub.status}` });
      return;
    }

    await transitionSubscription({
      subscriptionId,
      to: "expired",
      reason: "User requested cancellation",
      triggeredBy: "user",
      actorId: req.userId,
    });

    auditLog({ actorId: req.userId!, actorRole: req.role ?? "teacher", action: "SUBSCRIPTION_CANCELLED_USER", targetId: subscriptionId, targetType: "subscription", ip, result: "success" });
    res.json({ success: true, new_state: "expired" });
  } catch (err) {
    await logError(err, { route: "POST /api/sub-engine/cancel" });
    res.status(500).json({ error: "Failed" });
  }
});

/* ── ADMIN ─────────────────────────────────────────────────────────────── */

/* ── GET /api/sub-engine/admin/all ─────────────────────────────────────── */
subscriptionEngineRouter.get("/admin/all", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, flagged } = req.query as Record<string, string>;
    let q = `
      SELECT s.*, a.display_name, a.username, a.email,
             sp.name AS plan_name, sp.price_egp,
             EXTRACT(EPOCH FROM (s.end_date - NOW())) / 86400 AS days_remaining,
             CASE WHEN jsonb_array_length(s.fraud_flags) > 0 THEN TRUE ELSE FALSE END AS fraud_flagged
      FROM subscriptions s
      JOIN accounts a ON a.id = s.account_id
      LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
      WHERE 1=1`;
    const params: unknown[] = [];
    let idx = 1;
    if (status) { q += ` AND s.status = $${idx++}`; params.push(status); }
    if (flagged === "true") { q += ` AND jsonb_array_length(s.fraud_flags) > 0`; }
    q += ` ORDER BY s.created_at DESC LIMIT 200`;
    const { rows } = await pool.query(q, params);

    const { rows: counts } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status='active')::int              AS active,
        COUNT(*) FILTER (WHERE status='pending_payment')::int     AS pending_payment,
        COUNT(*) FILTER (WHERE status='pending_confirmation')::int AS pending_confirmation,
        COUNT(*) FILTER (WHERE status='grace_period')::int        AS grace_period,
        COUNT(*) FILTER (WHERE status='suspended')::int           AS suspended,
        COUNT(*) FILTER (WHERE status='expired')::int             AS expired,
        COUNT(*) FILTER (WHERE jsonb_array_length(fraud_flags) > 0)::int AS fraud_flagged
      FROM subscriptions
    `);

    res.json({ subscriptions: rows, counts: counts[0] });
  } catch (err) {
    await logError(err, { route: "GET /api/sub-engine/admin/all" });
    res.status(500).json({ error: "Failed" });
  }
});

/* ── GET /api/sub-engine/admin/pending-payments ────────────────────────── */
subscriptionEngineRouter.get("/admin/pending-payments", requireRole("admin", "super_admin"), async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(`
      SELECT s.id, s.account_id, s.status, s.instapay_code, s.screenshot_url,
             s.payment_reference, s.payment_attempt_count, s.fraud_flags, s.created_at,
             a.display_name, a.username, a.email,
             sp.name AS plan_name, sp.price_egp,
             bi.id AS invoice_id, bi.amount, bi.invoice_number,
             CASE WHEN jsonb_array_length(s.fraud_flags) > 0 THEN TRUE ELSE FALSE END AS fraud_flagged
      FROM subscriptions s
      JOIN accounts a ON a.id = s.account_id
      LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
      LEFT JOIN billing_invoices bi ON bi.id = s.pending_invoice_id
      WHERE s.status = 'pending_confirmation'
      ORDER BY s.created_at ASC
    `);
    res.json({ pending: rows });
  } catch (err) {
    await logError(err, { route: "GET /api/sub-engine/admin/pending-payments" });
    res.status(500).json({ error: "Failed" });
  }
});

/* ── POST /api/sub-engine/admin/confirm/:id ─────────────────────────────*/
subscriptionEngineRouter.post("/admin/confirm/:id", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  const ip = getClientIp(req as unknown as { ip?: string; headers: Record<string, string | string[] | undefined> });
  try {
    const subscriptionId = parseInt(req.params.id);
    const adminId = req.userId!;

    const { rows: [sub] } = await pool.query(
      `SELECT s.*, sp.name AS plan_name, sp.price_egp, bi.id AS invoice_id
       FROM subscriptions s
       LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
       LEFT JOIN billing_invoices bi ON bi.id = s.pending_invoice_id
       WHERE s.id = $1`,
      [subscriptionId],
    );
    if (!sub) { res.status(404).json({ error: "Subscription not found" }); return; }

    const result = await activateWithLedger({
      subscriptionId,
      userId: sub.account_id,
      amount: parseFloat(sub.price_egp ?? "0"),
      planName: sub.plan_name ?? "Plan",
      adminId,
      paymentReference: sub.payment_reference ?? sub.instapay_code ?? "N/A",
      invoiceId: sub.invoice_id ?? undefined,
    });

    if (!result.success) {
      res.status(422).json({ error: result.error, code: "ACTIVATION_FAILED" });
      return;
    }

    sendPushToUser(sub.account_id, {
      title: "Subscription Activated",
      body: `Your ${sub.plan_name ?? "plan"} subscription is now active. Welcome to Aperti!`,
      url: "/account/subscription",
    }).catch(() => {});

    auditLog({ actorId: adminId, actorRole: "admin", action: "SUBSCRIPTION_CONFIRMED_ADMIN", targetId: subscriptionId, targetType: "subscription", ip, result: "success" });
    res.json({ success: true, message: "Subscription activated. Ledger entry created." });
  } catch (err) {
    await logError(err, { route: `POST /api/sub-engine/admin/confirm/${req.params.id}` });
    res.status(500).json({ error: "Failed to confirm" });
  }
});

/* ── POST /api/sub-engine/admin/reject/:id ──────────────────────────────*/
subscriptionEngineRouter.post("/admin/reject/:id", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  const ip = getClientIp(req as unknown as { ip?: string; headers: Record<string, string | string[] | undefined> });
  try {
    const subscriptionId = parseInt(req.params.id);
    const { reason } = req.body as { reason?: string };

    const result = await transitionSubscription({
      subscriptionId,
      to: "pending_payment",
      reason: `Admin rejected payment: ${reason ?? "No reason given"}`,
      triggeredBy: "admin",
      actorId: req.userId,
      metadata: { admin_reason: reason },
      extraUpdates: { instapay_code: null, screenshot_url: null },
    });

    if (!result.success) {
      res.status(422).json({ error: result.error });
      return;
    }

    auditLog({ actorId: req.userId!, actorRole: "admin", action: "PAYMENT_REJECTED_ADMIN", targetId: subscriptionId, targetType: "subscription", ip, result: "success" });
    res.json({ success: true, new_state: "pending_payment" });
  } catch (err) {
    await logError(err, { route: `POST /api/sub-engine/admin/reject/${req.params.id}` });
    res.status(500).json({ error: "Failed" });
  }
});

/* ── POST /api/sub-engine/admin/suspend/:id ─────────────────────────────*/
subscriptionEngineRouter.post("/admin/suspend/:id", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  const ip = getClientIp(req as unknown as { ip?: string; headers: Record<string, string | string[] | undefined> });
  try {
    const subscriptionId = parseInt(req.params.id);
    const { reason } = req.body as { reason: string };
    if (!reason?.trim()) { res.status(400).json({ error: "reason is required" }); return; }

    const result = await transitionSubscription({
      subscriptionId,
      to: "suspended",
      reason: `Admin suspended: ${reason}`,
      triggeredBy: "admin",
      actorId: req.userId,
      extraUpdates: { suspended_at: new Date().toISOString(), suspended_by: req.userId, suspended_reason: reason },
    });

    if (!result.success) { res.status(422).json({ error: result.error }); return; }
    auditLog({ actorId: req.userId!, actorRole: "admin", action: "SUBSCRIPTION_SUSPENDED", targetId: subscriptionId, targetType: "subscription", ip, result: "success" });
    res.json({ success: true, new_state: "suspended" });
  } catch (err) {
    await logError(err, { route: `POST /api/sub-engine/admin/suspend/${req.params.id}` });
    res.status(500).json({ error: "Failed" });
  }
});

/* ── POST /api/sub-engine/admin/restore/:id ─────────────────────────────*/
subscriptionEngineRouter.post("/admin/restore/:id", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  const ip = getClientIp(req as unknown as { ip?: string; headers: Record<string, string | string[] | undefined> });
  try {
    const subscriptionId = parseInt(req.params.id);
    const { newEndDate } = req.body as { newEndDate?: string };
    const endDate = newEndDate ? new Date(newEndDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const result = await transitionSubscription({
      subscriptionId,
      to: "active",
      reason: "Admin restored subscription",
      triggeredBy: "admin",
      actorId: req.userId,
      extraUpdates: { end_date: endDate.toISOString(), suspended_at: null, suspended_by: null, suspended_reason: null, grace_period_ends_at: null },
    });

    if (!result.success) { res.status(422).json({ error: result.error }); return; }
    auditLog({ actorId: req.userId!, actorRole: "admin", action: "SUBSCRIPTION_RESTORED", targetId: subscriptionId, targetType: "subscription", ip, result: "success" });
    res.json({ success: true, new_state: "active", end_date: endDate });
  } catch (err) {
    await logError(err, { route: `POST /api/sub-engine/admin/restore/${req.params.id}` });
    res.status(500).json({ error: "Failed" });
  }
});

/* ── POST /api/sub-engine/admin/run-expiry ──────────────────────────────*/
subscriptionEngineRouter.post("/admin/run-expiry", requireRole("admin", "super_admin"), async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await runGraceAndExpiryCheck();
    res.json(result);
  } catch (err) {
    await logError(err, { route: "POST /api/sub-engine/admin/run-expiry" });
    res.status(500).json({ error: "Failed" });
  }
});

/* ── GET /api/sub-engine/admin/audit-log ────────────────────────────────*/
subscriptionEngineRouter.get("/admin/audit-log", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, subscriptionId, limit: lim } = req.query as Record<string, string>;
    const safeLimit = Math.min(parseInt(lim ?? "100", 10), 500);

    let q = `
      SELECT sal.*, a.display_name AS user_name, adm.display_name AS actor_name
      FROM subscription_audit_log sal
      LEFT JOIN accounts a ON a.id = sal.user_id
      LEFT JOIN accounts adm ON adm.id = sal.actor_id
      WHERE 1=1`;
    const params: unknown[] = [];
    let idx = 1;
    if (userId) { q += ` AND sal.user_id = $${idx++}`; params.push(parseInt(userId)); }
    if (subscriptionId) { q += ` AND sal.subscription_id = $${idx++}`; params.push(parseInt(subscriptionId)); }
    q += ` ORDER BY sal.created_at DESC LIMIT $${idx}`;
    params.push(safeLimit);

    const { rows } = await pool.query(q, params);
    res.json({ audit_log: rows, total: rows.length });
  } catch (err) {
    await logError(err, { route: "GET /api/sub-engine/admin/audit-log" });
    res.status(500).json({ error: "Failed" });
  }
});

/* ── GET /api/sub-engine/admin/overview ─────────────────────────────────*/
subscriptionEngineRouter.get("/admin/overview", requireRole("admin", "super_admin"), async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows: [counts] } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status='active')::int              AS active,
        COUNT(*) FILTER (WHERE status='pending_payment')::int     AS pending_payment,
        COUNT(*) FILTER (WHERE status='pending_confirmation')::int AS pending_confirmation,
        COUNT(*) FILTER (WHERE status='grace_period')::int        AS grace_period,
        COUNT(*) FILTER (WHERE status='suspended')::int           AS suspended,
        COUNT(*) FILTER (WHERE status='expired')::int             AS expired,
        COUNT(*) FILTER (WHERE status='inactive')::int            AS inactive,
        COUNT(*) FILTER (WHERE jsonb_array_length(fraud_flags)>0)::int AS fraud_flagged,
        COUNT(*) FILTER (WHERE auto_renew=TRUE AND status='active')::int AS auto_renew_on,
        ROUND(AVG(CASE WHEN status='active' THEN EXTRACT(EPOCH FROM (end_date-NOW()))/86400 END))::int AS avg_days_remaining
      FROM subscriptions
    `);

    const { rows: [revenue] } = await pool.query(`
      SELECT
        COALESCE(SUM(amount),'0')::numeric(12,2) AS total_confirmed,
        COUNT(*)::int AS confirmed_count
      FROM ledger_entries
      WHERE reference_type='subscription' AND entry_type='credit'
        AND created_at > NOW() - INTERVAL '30 days'
    `).catch(() => ({ rows: [{ total_confirmed: "0", confirmed_count: 0 }] }));

    const { rows: recentAudit } = await pool.query(`
      SELECT sal.*, a.display_name AS user_name
      FROM subscription_audit_log sal
      LEFT JOIN accounts a ON a.id = sal.user_id
      ORDER BY sal.created_at DESC LIMIT 10
    `);

    res.json({ counts, revenue, recent_audit: recentAudit });
  } catch (err) {
    await logError(err, { route: "GET /api/sub-engine/admin/overview" });
    res.status(500).json({ error: "Failed" });
  }
});
