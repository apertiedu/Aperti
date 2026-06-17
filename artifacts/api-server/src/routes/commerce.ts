import { Router, Response } from "express";
import rateLimit from "express-rate-limit";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { pool } from "@workspace/db";
import { openaiChat } from "../lib/ai-config";
import { sendPushToUser } from "../lib/push";
import crypto from "crypto";

export const commerceRouter = Router();

const subscribeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: "Too many subscription attempts. Please wait 15 minutes." });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────────────────────────────────────

function genRef(): string {
  return "APT-" + crypto.randomBytes(4).toString("hex").toUpperCase();
}

const INSTAPAY_PHONE = process.env.INSTAPAY_PHONE || "01XXXXXXXXXX";
const INSTAPAY_NAME  = process.env.INSTAPAY_NAME  || "Aperti Educational Platform";

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: PRICING
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/plans/public
commerceRouter.get("/plans/public", async (_req, res: Response) => {
  const { rows } = await pool.query(
    `SELECT id, name, type, price_egp, features, limits, visibility, sort_order,
            COALESCE(discount_pct, 0) AS discount_pct
     FROM subscription_plans WHERE visibility = true OR visibility IS NULL ORDER BY sort_order, type, price_egp`,
  );
  const plans = rows.map((p: any) => {
    const discountPct = Number(p.discount_pct) || 0;
    const priceEgp = Number(p.price_egp);
    return {
      ...p,
      discount_pct: discountPct,
      final_price_egp: discountPct > 0 ? Math.round(priceEgp * (1 - discountPct / 100)) : priceEgp,
    };
  });
  res.json(plans);
});

// ─────────────────────────────────────────────────────────────────────────────
// SUBSCRIPTIONS — USER FLOW
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/commerce/subscribe — initiate subscription, create payment_request
commerceRouter.post("/commerce/subscribe", authenticate, subscribeLimiter, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { planId } = req.body;
  if (!planId) { res.status(400).json({ error: "planId required" }); return; }

  const planRes = await pool.query(`SELECT * FROM subscription_plans WHERE id = $1`, [planId]);
  if (!planRes.rows[0]) { res.status(400).json({ error: "Plan not found" }); return; }
  const plan = planRes.rows[0];

  const existing = await pool.query(
    `SELECT id, reference_code, instructions, amount FROM payment_requests
     WHERE user_id=$1 AND plan_id=$2 AND status='pending' AND created_at > NOW()-INTERVAL '10 minutes'
     LIMIT 1`,
    [userId, planId],
  );
  if (existing.rows[0]) {
    const pr = existing.rows[0];
    res.json({
      paymentRequest: pr,
      instapay: { phone: INSTAPAY_PHONE, name: INSTAPAY_NAME, amount: parseFloat(pr.amount), reference: pr.reference_code },
      instructions: pr.instructions,
    });
    return;
  }

  const ref = genRef();
  const amount = parseFloat(plan.price_egp);
  const instructions = `Send EGP ${amount} to ${INSTAPAY_PHONE} (${INSTAPAY_NAME}) via InstaPay. Use reference code: ${ref}`;

  const { rows } = await pool.query(
    `INSERT INTO payment_requests (user_id, plan_id, amount, reference_code, instructions, status, webhook_url)
     VALUES ($1, $2, $3, $4, $5, 'pending', NULL) RETURNING *`,
    [userId, planId, amount, ref, instructions],
  );

  res.status(201).json({
    paymentRequest: rows[0],
    instapay: { phone: INSTAPAY_PHONE, name: INSTAPAY_NAME, amount, reference: ref },
    instructions,
  });
});

// POST /api/commerce/upload-proof — user uploads screenshot
commerceRouter.post("/commerce/upload-proof", authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { paymentRequestId, proofUrl } = req.body;
  if (!paymentRequestId || !proofUrl) { res.status(400).json({ error: "paymentRequestId and proofUrl required" }); return; }

  const { rows } = await pool.query(
    `UPDATE payment_requests SET proof_url = $1, status = 'paid'
     WHERE id = $2 AND user_id = $3 AND status = 'pending' RETURNING *`,
    [proofUrl, paymentRequestId, userId],
  );
  if (!rows[0]) { res.status(404).json({ error: "Payment request not found or already processed" }); return; }
  res.json({ success: true, paymentRequest: rows[0] });
});

// GET /api/commerce/my — current subscription + usage
commerceRouter.get("/commerce/my", authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  const subRes = await pool.query(
    `SELECT s.*, sp.name AS plan_name, sp.type AS plan_type, sp.price_egp, sp.features, sp.limits
     FROM subscriptions s JOIN subscription_plans sp ON sp.id = s.plan_id
     WHERE s.account_id = $1 AND s.status IN ('active','trial','pending_review')
     ORDER BY s.created_at DESC LIMIT 1`,
    [userId],
  );

  const prRes = await pool.query(
    `SELECT pr.*, sp.name AS plan_name FROM payment_requests pr
     JOIN subscription_plans sp ON sp.id = pr.plan_id
     WHERE pr.user_id = $1 ORDER BY pr.created_at DESC LIMIT 10`,
    [userId],
  );

  const usageRes = await pool.query(
    `SELECT resource, current_count FROM usage_tracking WHERE user_id = $1`,
    [userId],
  );

  const invoicesRes = await pool.query(
    `SELECT * FROM billing_invoices WHERE user_id = $1 ORDER BY issued_at DESC LIMIT 10`,
    [userId],
  );

  const usage: Record<string, number> = {};
  for (const row of usageRes.rows) usage[row.resource] = row.current_count;

  res.json({
    subscription: subRes.rows[0] ?? null,
    paymentRequests: prRes.rows,
    usage,
    invoices: invoicesRes.rows,
  });
});

// POST /api/commerce/cancel — cancel subscription
commerceRouter.post("/commerce/cancel", authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  await pool.query(
    `UPDATE subscriptions SET status = 'cancelled' WHERE account_id = $1 AND status = 'active'`,
    [userId],
  );
  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — PLANS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/commerce/plans
commerceRouter.get("/admin/commerce/plans", authenticate, requireRole("admin"), async (_req, res: Response) => {
  const { rows } = await pool.query(`SELECT * FROM subscription_plans ORDER BY sort_order, type, price_egp`);
  res.json(rows);
});

// POST /api/admin/commerce/plans
commerceRouter.post("/admin/commerce/plans", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const { name, type, priceEgp, features, limits, visibility, sortOrder, discountPct } = req.body;
  if (!name || priceEgp === undefined) { res.status(400).json({ error: "name and priceEgp required" }); return; }
  const { rows } = await pool.query(
    `INSERT INTO subscription_plans (name, type, price_egp, features, limits, visibility, sort_order, discount_pct)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [name, type ?? "teacher", String(priceEgp), JSON.stringify(features ?? []), JSON.stringify(limits ?? {}), visibility ?? true, sortOrder ?? 0, discountPct ?? 0],
  );
  res.status(201).json(rows[0]);
});

// PUT /api/admin/commerce/plans/:id
commerceRouter.put("/admin/commerce/plans/:id", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const { name, type, priceEgp, features, limits, visibility, sortOrder, studentLimit, is_visible_landing, badge, display_order, discountPct } = req.body;
  const { rows } = await pool.query(
    `UPDATE subscription_plans SET
       name               = COALESCE($1, name),
       type               = COALESCE($2, type),
       price_egp          = COALESCE($3, price_egp),
       features           = COALESCE($4, features),
       limits             = COALESCE($5, limits),
       visibility         = COALESCE($6, visibility),
       sort_order         = COALESCE($7, sort_order),
       student_limit      = COALESCE($8, student_limit),
       is_visible_landing = COALESCE($9, is_visible_landing),
       badge              = COALESCE($10, badge),
       display_order      = COALESCE($11, display_order),
       discount_pct       = COALESCE($12, discount_pct)
     WHERE id = $13 RETURNING *`,
    [name, type, priceEgp ? String(priceEgp) : null, features ? JSON.stringify(features) : null,
     limits ? JSON.stringify(limits) : null, visibility, sortOrder, studentLimit,
     is_visible_landing, badge, display_order, discountPct ?? null, id],
  );
  res.json(rows[0] ?? { success: true });
});

// DELETE /api/admin/commerce/plans/:id (archive = set visibility false)
commerceRouter.delete("/admin/commerce/plans/:id", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  await pool.query(`UPDATE subscription_plans SET visibility = false WHERE id = $1`, [req.params.id]);
  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — SUBSCRIPTIONS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/commerce/subscriptions
commerceRouter.get("/admin/commerce/subscriptions", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const { status } = req.query as Record<string, string>;
  let q = `SELECT s.*, a.username, a.display_name, sp.name AS plan_name, sp.price_egp
           FROM subscriptions s
           JOIN accounts a ON a.id = s.account_id
           JOIN subscription_plans sp ON sp.id = s.plan_id`;
  const params: unknown[] = [];
  if (status) { q += ` WHERE s.status = $1`; params.push(status); }
  q += ` ORDER BY s.created_at DESC`;
  const { rows } = await pool.query(q, params);
  res.json(rows);
});

// GET /api/admin/commerce/payment-requests
commerceRouter.get("/admin/commerce/payment-requests", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const { status } = req.query as Record<string, string>;
  let q = `SELECT pr.*, a.username, a.display_name, sp.name AS plan_name
           FROM payment_requests pr
           JOIN accounts a ON a.id = pr.user_id
           JOIN subscription_plans sp ON sp.id = pr.plan_id`;
  const params: unknown[] = [];
  if (status) { q += ` WHERE pr.status = $1`; params.push(status); }
  q += ` ORDER BY pr.created_at DESC`;
  const { rows } = await pool.query(q, params);
  res.json(rows);
});

// PUT /api/admin/commerce/payment-requests/:id/verify
commerceRouter.put("/admin/commerce/payment-requests/:id/verify", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const adminId = req.userId!;
  const prId = parseInt(req.params.id);

  const prRes = await pool.query(`SELECT * FROM payment_requests WHERE id = $1`, [prId]);
  if (!prRes.rows[0]) { res.status(404).json({ error: "Not found" }); return; }
  const pr = prRes.rows[0];

  // Mark request verified
  await pool.query(`UPDATE payment_requests SET status = 'verified', reviewed_by = $1 WHERE id = $2`, [adminId, prId]);

  // Activate / create subscription
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 1);

  const subRes = await pool.query(
    `INSERT INTO subscriptions (account_id, plan_id, status, start_date, end_date, payment_status, payment_reference, payment_proof_url, verified_by, verified_at)
     VALUES ($1, $2, 'active', NOW(), $3, 'paid', $4, $5, $6, NOW())
     ON CONFLICT (account_id) DO UPDATE SET
       plan_id = $2, status = 'active', start_date = NOW(), end_date = $3,
       payment_status = 'paid', payment_reference = $4, payment_proof_url = $5,
       verified_by = $6, verified_at = NOW()
     RETURNING *`,
    [pr.user_id, pr.plan_id, endDate.toISOString(), pr.reference_code, pr.proof_url, adminId],
  ).catch(async () => {
    // Try without ON CONFLICT if column constraint doesn't exist
    return pool.query(
      `INSERT INTO subscriptions (account_id, plan_id, status, start_date, end_date, payment_status, payment_reference, verified_by, verified_at)
       VALUES ($1, $2, 'active', NOW(), $3, 'paid', $4, $5, NOW()) RETURNING *`,
      [pr.user_id, pr.plan_id, endDate.toISOString(), pr.reference_code, adminId],
    );
  });

  // Issue invoice
  const planRes = await pool.query(`SELECT name FROM subscription_plans WHERE id = $1`, [pr.plan_id]);
  await pool.query(
    `INSERT INTO billing_invoices (user_id, subscription_id, amount, plan_name, due_at, status)
     VALUES ($1, $2, $3, $4, $5, 'paid')`,
    [pr.user_id, subRes.rows[0]?.id, pr.amount, planRes.rows[0]?.name ?? "Plan", endDate.toISOString()],
  ).catch(() => {});

  // Push notification to user
  sendPushToUser(pr.user_id, {
    title: "Subscription Activated 🎉",
    body: `Your ${planRes.rows[0]?.name ?? "plan"} subscription is now active. Welcome to Aperti!`,
    url: "/account/subscription",
  }).catch(() => {});

  res.json({ success: true, subscription: subRes.rows[0] });
});

// PUT /api/admin/commerce/payment-requests/:id/reject
commerceRouter.put("/admin/commerce/payment-requests/:id/reject", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const adminId = req.userId!;
  await pool.query(
    `UPDATE payment_requests SET status = 'rejected', reviewed_by = $1 WHERE id = $2`,
    [adminId, req.params.id],
  );
  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — BILLING & INVOICES
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/commerce/invoices
commerceRouter.get("/admin/commerce/invoices", authenticate, requireRole("admin"), async (_req, res: Response) => {
  const { rows } = await pool.query(
    `SELECT bi.*, a.username, a.display_name FROM billing_invoices bi
     JOIN accounts a ON a.id = bi.user_id ORDER BY bi.issued_at DESC LIMIT 200`,
  );
  res.json(rows);
});

// GET /api/billing/invoices — user's invoices
commerceRouter.get("/billing/invoices", authenticate, async (req: AuthRequest, res: Response) => {
  const { rows } = await pool.query(
    `SELECT * FROM billing_invoices WHERE user_id = $1 ORDER BY issued_at DESC`,
    [req.userId],
  );
  res.json(rows);
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/commerce/analytics/revenue
commerceRouter.get("/admin/commerce/analytics/revenue", authenticate, requireRole("admin"), async (_req, res: Response) => {
  const mrr = await pool.query(
    `SELECT COALESCE(SUM(sp.price_egp::numeric), 0) AS mrr
     FROM subscriptions s JOIN subscription_plans sp ON sp.id = s.plan_id
     WHERE s.status = 'active'`,
  );
  const monthly = await pool.query(
    `SELECT TO_CHAR(issued_at, 'YYYY-MM') AS month, SUM(amount) AS revenue, COUNT(*) AS count
     FROM billing_invoices WHERE status = 'paid' GROUP BY month ORDER BY month DESC LIMIT 12`,
  );
  const churn = await pool.query(
    `SELECT COUNT(*) AS cancelled FROM subscriptions WHERE status = 'cancelled'
     AND created_at > NOW() - INTERVAL '30 days'`,
  );
  const mrrVal = parseFloat(mrr.rows[0]?.mrr ?? 0);
  res.json({
    mrr: mrrVal,
    arr: mrrVal * 12,
    monthlyRevenue: monthly.rows.reverse(),
    churnLast30d: parseInt(churn.rows[0]?.cancelled ?? 0),
  });
});

// GET /api/admin/commerce/analytics/subscriptions
commerceRouter.get("/admin/commerce/analytics/subscriptions", authenticate, requireRole("admin"), async (_req, res: Response) => {
  const byPlan = await pool.query(
    `SELECT sp.name, sp.type, COUNT(s.id) AS count
     FROM subscription_plans sp
     LEFT JOIN subscriptions s ON s.plan_id = sp.id AND s.status = 'active'
     GROUP BY sp.id, sp.name, sp.type ORDER BY count DESC`,
  );
  const newSubs = await pool.query(
    `SELECT COUNT(*) AS count FROM subscriptions WHERE created_at > NOW() - INTERVAL '30 days'`,
  );
  const cancelled = await pool.query(
    `SELECT COUNT(*) AS count FROM subscriptions WHERE status = 'cancelled' AND created_at > NOW() - INTERVAL '30 days'`,
  );
  const pending = await pool.query(
    `SELECT COUNT(*) AS count FROM payment_requests WHERE status = 'paid'`,
  );
  res.json({
    byPlan: byPlan.rows,
    newThisMonth: parseInt(newSubs.rows[0]?.count ?? 0),
    cancelledThisMonth: parseInt(cancelled.rows[0]?.count ?? 0),
    pendingVerification: parseInt(pending.rows[0]?.count ?? 0),
  });
});

// GET /api/admin/commerce/analytics/executive
commerceRouter.get("/admin/commerce/analytics/executive", authenticate, requireRole("admin"), async (_req, res: Response) => {
  const [mrr, activeUsers, totalSubs, newSubs, churn, recentSubs, topPlans, usage] = await Promise.all([
    pool.query(`SELECT COALESCE(SUM(sp.price_egp::numeric), 0) AS mrr FROM subscriptions s JOIN subscription_plans sp ON sp.id = s.plan_id WHERE s.status = 'active'`),
    pool.query(`SELECT COUNT(*) AS count FROM accounts WHERE status = 'active'`),
    pool.query(`SELECT COUNT(*) AS count FROM subscriptions WHERE status = 'active'`),
    pool.query(`SELECT COUNT(*) AS count FROM subscriptions WHERE created_at > NOW() - INTERVAL '30 days'`),
    pool.query(`SELECT COUNT(*) AS count FROM subscriptions WHERE status = 'cancelled' AND created_at > NOW() - INTERVAL '30 days'`),
    pool.query(`SELECT s.*, a.display_name, a.username, sp.name AS plan_name FROM subscriptions s JOIN accounts a ON a.id = s.account_id JOIN subscription_plans sp ON sp.id = s.plan_id ORDER BY s.created_at DESC LIMIT 5`),
    pool.query(`SELECT sp.name, sp.type, sp.price_egp, COUNT(s.id) AS subscribers FROM subscription_plans sp LEFT JOIN subscriptions s ON s.plan_id = sp.id AND s.status = 'active' GROUP BY sp.id ORDER BY subscribers DESC LIMIT 5`),
    pool.query(`SELECT resource, SUM(current_count) AS total FROM usage_tracking GROUP BY resource ORDER BY total DESC LIMIT 10`),
  ]);
  const mrrVal = parseFloat(mrr.rows[0]?.mrr ?? 0);
  const activeCount = parseInt(activeUsers.rows[0]?.count ?? 0);
  const totalActive = parseInt(totalSubs.rows[0]?.count ?? 0);
  const churnCount = parseInt(churn.rows[0]?.count ?? 0);
  const churnRate = totalActive > 0 ? ((churnCount / totalActive) * 100).toFixed(1) : "0.0";

  res.json({
    mrr: mrrVal,
    arr: mrrVal * 12,
    activeUsers: activeCount,
    activeSubscriptions: totalActive,
    newSubscriptionsThisMonth: parseInt(newSubs.rows[0]?.count ?? 0),
    churnRate: parseFloat(churnRate),
    recentSubscriptions: recentSubs.rows,
    topPlans: topPlans.rows,
    platformUsage: usage.rows,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// COMING SOON
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/coming-soon
commerceRouter.get("/coming-soon", async (_req, res: Response) => {
  const { rows } = await pool.query(`SELECT * FROM coming_soon_items ORDER BY display_order, created_at`);
  res.json(rows);
});

// POST /api/admin/commerce/coming-soon
commerceRouter.post("/admin/commerce/coming-soon", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const { featureName, description, demoUrl, releaseWindow, waitlistEnabled, displayOrder } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO coming_soon_items (feature_name, description, demo_url, release_window, waitlist_enabled, display_order)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [featureName, description, demoUrl, releaseWindow, waitlistEnabled ?? true, displayOrder ?? 0],
  );
  res.status(201).json(rows[0]);
});

// PUT /api/admin/commerce/coming-soon/:id
commerceRouter.put("/admin/commerce/coming-soon/:id", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const { featureName, description, demoUrl, releaseWindow, waitlistEnabled, displayOrder } = req.body;
  const { rows } = await pool.query(
    `UPDATE coming_soon_items SET
       feature_name     = COALESCE($1, feature_name),
       description      = COALESCE($2, description),
       demo_url         = COALESCE($3, demo_url),
       release_window   = COALESCE($4, release_window),
       waitlist_enabled = COALESCE($5, waitlist_enabled),
       display_order    = COALESCE($6, display_order)
     WHERE id = $7 RETURNING *`,
    [featureName, description, demoUrl, releaseWindow, waitlistEnabled, displayOrder, req.params.id],
  );
  res.json(rows[0]);
});

// DELETE /api/admin/commerce/coming-soon/:id
commerceRouter.delete("/admin/commerce/coming-soon/:id", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  await pool.query(`DELETE FROM coming_soon_items WHERE id = $1`, [req.params.id]);
  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// FLASHCARD ENHANCEMENTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/flashcards/smart-stats
commerceRouter.get("/flashcards/smart-stats", authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const stats = await pool.query(
    `SELECT
       COUNT(fi.id) AS total_cards,
       COUNT(fp.id) FILTER (WHERE fp.last_confidence = 'hard') AS weak_cards,
       ROUND(
         COUNT(fp.id) FILTER (WHERE fp.last_confidence = 'easy') * 100.0
         / NULLIF(COUNT(fp.id), 0), 1
       ) AS mastery_pct,
       COUNT(fp.id) FILTER (WHERE fp.next_review <= NOW()) AS due_review
     FROM flashcard_items fi
     JOIN flashcard_decks fd ON fd.id = fi.deck_id
     LEFT JOIN flashcard_progress fp ON fp.card_id = fi.id AND fp.student_id = $1
     WHERE fd.account_id = $1 OR fd.is_public = true`,
    [userId],
  );
  const weak = await pool.query(
    `SELECT fi.front, fi.back, fp.last_confidence AS confidence FROM flashcard_items fi
     JOIN flashcard_decks fd ON fd.id = fi.deck_id
     JOIN flashcard_progress fp ON fp.card_id = fi.id AND fp.student_id = $1
     WHERE fp.last_confidence = 'hard' ORDER BY fp.last_review ASC LIMIT 10`,
    [userId],
  );
  res.json({ stats: stats.rows[0], weakCards: weak.rows });
});

// POST /api/flashcards/track — confidence/difficulty tracking
commerceRouter.post("/flashcards/track", authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { itemId, confidence } = req.body;
  const confidenceLabel: string = confidence === "easy" ? "easy" : confidence === "hard" ? "hard" : "okay";
  const nextReview = new Date();
  const days = confidenceLabel === "easy" ? 7 : confidenceLabel === "okay" ? 3 : 1;
  nextReview.setDate(nextReview.getDate() + days);

  await pool.query(
    `INSERT INTO flashcard_progress (student_id, card_id, last_confidence, next_review, last_review)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (student_id, card_id) DO UPDATE
     SET last_confidence = $3, next_review = $4, last_review = NOW()`,
    [userId, itemId, confidenceLabel, nextReview.toISOString()],
  ).catch(() => {});
  res.json({ success: true, nextReview, confidence: confidenceLabel });
});

// ─────────────────────────────────────────────────────────────────────────────
// PRACTICE CENTER 2.0
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/practice/modes
commerceRouter.get("/practice/modes", authenticate, async (_req, res: Response) => {
  res.json([
    { id: "study",     name: "Study Mode",           description: "Review questions at your own pace with hints enabled", icon: "BookOpen" },
    { id: "exam",      name: "Exam Mode",             description: "Timed exam simulation — no hints, strict conditions",  icon: "Clock" },
    { id: "challenge", name: "Challenge Mode",        description: "Progressively harder questions as you succeed",         icon: "Zap" },
    { id: "speed",     name: "Speed Round",           description: "Answer as many as possible in 60 seconds",             icon: "Timer" },
    { id: "revision",  name: "Revision Mode",         description: "Focus on topics you previously got wrong",             icon: "RefreshCw" },
    { id: "mistakes",  name: "Mistake Recovery",      description: "Revisit every question you have ever answered wrong",  icon: "AlertCircle" },
  ]);
});

// GET /api/practice/start
commerceRouter.get("/practice/start", authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { topic, difficulty, mode, command_word, paper, limit = "10" } = req.query as Record<string, string>;

  let q = `SELECT id, question_text, topic, difficulty, command_word, max_marks, model_answer, diagram_url
           FROM question_bank WHERE 1=1`;
  const params: unknown[] = [];
  let pi = 1;

  if (topic)        { q += ` AND topic ILIKE $${pi++}`;        params.push(`%${topic}%`); }
  if (difficulty)   { q += ` AND difficulty = $${pi++}`;        params.push(difficulty); }
  if (command_word) { q += ` AND command_word ILIKE $${pi++}`;  params.push(`%${command_word}%`); }
  if (paper)        { q += ` AND paper ILIKE $${pi++}`;         params.push(`%${paper}%`); }

  if (mode === "revision" || mode === "mistakes") {
    // Prioritise previously wrong answers
    q += ` AND id IN (
      SELECT ps2.questions::jsonb->>'id' FROM practice_sessions ps2
      WHERE ps2.student_id = $${pi++} AND ps2.answers @> '[{"correct":false}]'
    )`;
    params.push(userId);
  }

  q += ` ORDER BY RANDOM() LIMIT $${pi++}`;
  params.push(Math.min(parseInt(limit), 30));

  const { rows } = await pool.query(q, params);
  res.json({ questions: rows, mode: mode || "study", total: rows.length });
});

// POST /api/practice/submit
commerceRouter.post("/practice/submit", authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { answers, mode, timeSpent } = req.body as {
    answers: Array<{ questionId: number; userAnswer: string; correct: boolean }>;
    mode: string;
    timeSpent: number;
  };

  const correct = answers.filter(a => a.correct).length;
  const score = answers.length > 0 ? Math.round((correct / answers.length) * 100) : 0;

  // Persist session
  await pool.query(
    `INSERT INTO practice_sessions (student_id, subject, questions_answered, correct, time_spent, answers, started_at)
     VALUES ($1, 'general', $2, $3, $4, $5, NOW())`,
    [userId, answers.length, correct, timeSpent || 0, JSON.stringify(answers)],
  ).catch(() => {});

  // AI feedback for wrong answers
  const wrong = answers.filter(a => !a.correct);
  let feedback = "";
  if (wrong.length > 0 && wrong.length <= 5) {
    const wrongIds = wrong.map(a => a.questionId);
    const qRes = await pool.query(
      `SELECT question_text, model_answer FROM question_bank WHERE id = ANY($1)`,
      [wrongIds],
    );
    if (qRes.rows.length > 0) {
      const qText = qRes.rows.map(q => `Q: ${q.question_text}\nA: ${q.model_answer}`).join("\n\n");
      feedback = await openaiChat({
        systemPrompt: "You are a supportive tutor. Give brief, encouraging feedback on missed questions.",
        userMessage: `Student answered these incorrectly:\n${qText}\n\nGive 2-3 sentences of constructive feedback.`,
        maxTokens: 200,
      }) || "";
    }
  }

  res.json({ score, correct, total: answers.length, feedback, mode });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — SUBSCRIPTIONS (alias endpoints used by SubscriptionsPage admin UI)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/subscriptions/stats/overview
commerceRouter.get("/admin/subscriptions/stats/overview", authenticate, requireRole("admin"), async (_req, res: Response) => {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'active')   AS active,
      COUNT(*) FILTER (WHERE status = 'trial')    AS trial,
      COUNT(*) FILTER (WHERE status = 'expired' OR status = 'cancelled') AS expired,
      COUNT(*) AS total
    FROM subscriptions
  `);
  res.json(rows[0] ?? { active: 0, trial: 0, expired: 0, total: 0 });
});

// GET /api/admin/subscriptions/plans
commerceRouter.get("/admin/subscriptions/plans", authenticate, requireRole("admin"), async (_req, res: Response) => {
  const { rows } = await pool.query(
    `SELECT id, name, type, price_egp AS "priceEgp", features, limits, student_limit AS "studentLimit",
            visibility, sort_order AS "sortOrder", discount_pct AS "discountPct",
            is_active AS "isActive", badge, display_order AS "displayOrder"
     FROM subscription_plans ORDER BY sort_order, price_egp`
  );
  res.json(rows);
});

// POST /api/admin/subscriptions/plans
commerceRouter.post("/admin/subscriptions/plans", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const { name, type, priceEgp, features, limits, studentLimit } = req.body;
  if (!name || priceEgp === undefined) { res.status(400).json({ error: "name and priceEgp required" }); return; }
  const featureArr = Array.isArray(features) ? features : (typeof features === "string" ? features.split(",").map((s: string) => s.trim()).filter(Boolean) : []);
  const { rows } = await pool.query(
    `INSERT INTO subscription_plans (name, type, price_egp, features, limits, student_limit, visibility, sort_order, discount_pct)
     VALUES ($1, $2, $3, $4, $5, $6, true, 0, 0) RETURNING *`,
    [name, type ?? "teacher", String(priceEgp), JSON.stringify(featureArr), JSON.stringify(limits ?? {}), studentLimit || null]
  );
  res.status(201).json(rows[0]);
});

// PUT /api/admin/subscriptions/plans/:id
commerceRouter.put("/admin/subscriptions/plans/:id", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const { name, type, priceEgp, features, limits, studentLimit } = req.body;
  const featureArr = Array.isArray(features) ? features : (typeof features === "string" ? features.split(",").map((s: string) => s.trim()).filter(Boolean) : undefined);
  const { rows } = await pool.query(
    `UPDATE subscription_plans SET
       name          = COALESCE($1, name),
       type          = COALESCE($2, type),
       price_egp     = COALESCE($3, price_egp),
       features      = COALESCE($4, features),
       limits        = COALESCE($5, limits),
       student_limit = COALESCE($6, student_limit)
     WHERE id = $7 RETURNING *`,
    [name || null, type || null, priceEgp ? String(priceEgp) : null,
     featureArr ? JSON.stringify(featureArr) : null,
     limits ? JSON.stringify(limits) : null,
     studentLimit || null, id]
  );
  res.json(rows[0] ?? { success: true });
});

// DELETE /api/admin/subscriptions/plans/:id
commerceRouter.delete("/admin/subscriptions/plans/:id", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  await pool.query(`UPDATE subscription_plans SET visibility = false, is_active = false WHERE id = $1`, [req.params.id]);
  res.json({ success: true });
});

// GET /api/admin/subscriptions?page=N&limit=N
commerceRouter.get("/admin/subscriptions", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const page  = Math.max(1, parseInt(String(req.query.page  ?? "1")));
  const limit = Math.min(100, parseInt(String(req.query.limit ?? "20")));
  const offset = (page - 1) * limit;

  const { rows } = await pool.query(
    `SELECT s.*, a.username, a.display_name AS "displayName", a.email,
            sp.name AS "planName", sp.price_egp AS "planPrice"
     FROM subscriptions s
     JOIN accounts a  ON a.id  = s.account_id
     JOIN subscription_plans sp ON sp.id = s.plan_id
     ORDER BY s.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  const countRes = await pool.query(`SELECT COUNT(*) FROM subscriptions`);
  res.json({ subscriptions: rows, total: parseInt(countRes.rows[0].count) });
});
