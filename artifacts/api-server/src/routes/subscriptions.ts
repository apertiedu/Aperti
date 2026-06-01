import { Router, Response } from "express";
import { db } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { subscriptionsTable, subscriptionPlansTable, flexSeatsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export const subscriptionsRouter = Router();

// ─── PUBLIC / TEACHER ROUTES ───

// GET /subscriptions/plans — available plans
subscriptionsRouter.get("/plans", authenticate, async (req: AuthRequest, res: Response) => {
  const plans = await db.query.subscriptionPlans.findMany();
  res.json(plans);
});

// GET /subscriptions/mine — teacher's active subscription
subscriptionsRouter.get("/mine", authenticate, async (req: AuthRequest, res: Response) => {
  const accountId = req.userId!;
  const sub = await db.query.subscriptions.findFirst({
    where: (s, { eq }) => eq(s.accountId, accountId),
    with: { plan: true },
  });
  const flexSeats = sub
    ? await db.query.flexSeats.findMany({ where: (f, { eq }) => eq(f.subscriptionId, sub.id) })
    : [];
  const payments = []; // placeholder – payment history table to be added
  res.json({ subscription: sub, flexSeats, payments });
});

// POST /subscriptions/checkout — initiate a new subscription (Stripe or InstaPay)
subscriptionsRouter.post("/checkout", authenticate, async (req: AuthRequest, res: Response) => {
  const accountId = req.userId!;
  const { planId, paymentMethod, instapayCode } = req.body;
  const plan = await db.query.subscriptionPlans.findFirst({ where: (p, { eq }) => eq(p.id, planId) });
  if (!plan) return res.status(400).json({ error: "Invalid plan" });

  const status = paymentMethod === "stripe" ? "active" : "pending_review";
  const [subscription] = await db.insert(subscriptionsTable).values({
    accountId,
    planId,
    status,
    startDate: new Date(),
    endDate: null, // will be set after payment confirmation
    instaPayCode: paymentMethod === "instapay" ? instapayCode : null,
    paymentStatus: paymentMethod === "stripe" ? "paid" : "pending",
  }).returning();

  // Stripe integration would create a checkout session here
  // For InstaPay, just return the subscription for admin review

  res.status(201).json({ subscription });
});

// POST /subscriptions/flex-seats — add flex seats
subscriptionsRouter.post("/flex-seats", authenticate, async (req: AuthRequest, res: Response) => {
  const accountId = req.userId!;
  const { quantity } = req.body;
  const sub = await db.query.subscriptions.findFirst({
    where: (s, { eq }) => eq(s.accountId, accountId),
  });
  if (!sub) return res.status(400).json({ error: "No active subscription" });
  const plan = await db.query.subscriptionPlans.findFirst({ where: (p, { eq }) => eq(p.id, sub.planId) });
  if (!plan?.flexSeatPriceEgp) return res.status(400).json({ error: "Flex seats not available on this plan" });

  const priceEgp = Number(plan.flexSeatPriceEgp) * quantity;
  await db.insert(flexSeatsTable).values({
    subscriptionId: sub.id,
    quantity,
    priceEgp: priceEgp.toString(),
    active: "active",
  });
  // In production, charge the teacher via saved payment method
  res.json({ success: true, totalEgp: priceEgp });
});

// ─── ADMIN ROUTES ───

// GET /subscriptions/admin/all — all subscriptions (admin)
subscriptionsRouter.get("/admin/all", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const subs = await db.query.subscriptions.findMany({ with: { plan: true } });
  res.json(subs);
});

// PUT /subscriptions/admin/:id/approve — approve InstaPay
subscriptionsRouter.put("/admin/:id/approve", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  await db.update(subscriptionsTable)
    .set({ status: "active", paymentStatus: "paid" })
    .where(eq(subscriptionsTable.id, id));
  res.json({ success: true });
});

// PUT /subscriptions/admin/:id/reject — reject InstaPay
subscriptionsRouter.put("/admin/:id/reject", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  await db.update(subscriptionsTable)
    .set({ status: "cancelled", paymentStatus: "failed" })
    .where(eq(subscriptionsTable.id, id));
  res.json({ success: true });
});

// PUT /subscriptions/admin/plans/:id — update plan (price, features, etc.)
subscriptionsRouter.put("/admin/plans/:id", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  await db.update(subscriptionPlansTable).set(req.body).where(eq(subscriptionPlansTable.id, id));
  res.json({ success: true });
});
