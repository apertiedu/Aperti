import { Router, Response } from "express";
import { db } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { subscriptionsTable, subscriptionPlansTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const subscriptionsRouter = Router();

// GET /subscriptions/plans — available plans
subscriptionsRouter.get("/plans", authenticate, async (_req: AuthRequest, res: Response) => {
  const plans = await db.select().from(subscriptionPlansTable).orderBy(subscriptionPlansTable.sortOrder);
  res.json(plans);
});

// GET /subscriptions/mine — teacher's active subscription
subscriptionsRouter.get("/mine", authenticate, async (req: AuthRequest, res: Response) => {
  const accountId = req.userId!;
  const subs = await db.select().from(subscriptionsTable)
    .where(eq(subscriptionsTable.accountId, accountId))
    .limit(1);
  const sub = subs[0] ?? null;

  let plan = null;
  if (sub) {
    const plans = await db.select().from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.id, sub.planId)).limit(1);
    plan = plans[0] ?? null;
  }

  res.json({ subscription: sub ? { ...sub, plan } : null, payments: [] });
});

// POST /subscriptions/checkout — initiate a new subscription
subscriptionsRouter.post("/checkout", authenticate, async (req: AuthRequest, res: Response) => {
  const accountId = req.userId!;
  const { planId, paymentMethod, instapayCode } = req.body;
  const plans = await db.select().from(subscriptionPlansTable)
    .where(eq(subscriptionPlansTable.id, planId)).limit(1);
  if (!plans[0]) return res.status(400).json({ error: "Invalid plan" });

  // Duplicate InstaPay reference code check
  if (paymentMethod === "instapay" && instapayCode) {
    const trimmedCode = String(instapayCode).trim();
    if (!trimmedCode) return res.status(400).json({ error: "InstaPay reference code is required" });
    const existing = await db.select({ id: subscriptionsTable.id })
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.instaPayCode, trimmedCode))
      .limit(1).catch(() => []);
    if (existing.length > 0) {
      return res.status(409).json({
        error: "This InstaPay reference code has already been used. Please check your code or contact support.",
        code: "DUPLICATE_INSTAPAY"
      });
    }
  }

  const status = paymentMethod === "stripe" ? "active" : "pending_review";
  const [subscription] = await db.insert(subscriptionsTable).values({
    accountId,
    planId,
    status,
    startDate: new Date(),
    endDate: null,
    instaPayCode: paymentMethod === "instapay" ? String(instapayCode || "").trim() : null,
    paymentStatus: paymentMethod === "stripe" ? "paid" : "pending",
  }).returning();

  res.status(201).json({ subscription });
});

// ─── ADMIN ROUTES ───

// GET /subscriptions/admin/all — all subscriptions with joined plan
subscriptionsRouter.get("/admin/all", authenticate, requireRole("admin"), async (_req: AuthRequest, res: Response) => {
  const subs = await db.select().from(subscriptionsTable);
  const plans = await db.select().from(subscriptionPlansTable);
  const planMap = Object.fromEntries(plans.map(p => [p.id, p]));
  const result = subs.map(s => ({ ...s, plan: planMap[s.planId] ?? null }));
  res.json(result);
});

// PUT /subscriptions/admin/:id/approve
subscriptionsRouter.put("/admin/:id/approve", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  await db.update(subscriptionsTable)
    .set({ status: "active", paymentStatus: "paid" })
    .where(eq(subscriptionsTable.id, id));
  res.json({ success: true });
});

// PUT /subscriptions/admin/:id/reject
subscriptionsRouter.put("/admin/:id/reject", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  await db.update(subscriptionsTable)
    .set({ status: "cancelled", paymentStatus: "failed" })
    .where(eq(subscriptionsTable.id, id));
  res.json({ success: true });
});

// POST /subscriptions/admin/plans — create a plan
subscriptionsRouter.post("/admin/plans", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const { name, type, priceEgp, features, studentLimit } = req.body;
  if (!name || !priceEgp) { res.status(400).json({ error: "name and priceEgp required" }); return; }
  const [plan] = await db.insert(subscriptionPlansTable).values({
    name,
    type: type ?? "teacher",
    priceEgp: String(priceEgp),
    features: features ?? [],
    studentLimit: studentLimit ?? null,
  }).returning();
  res.status(201).json(plan);
});

// PUT /subscriptions/admin/plans/:id — update plan
subscriptionsRouter.put("/admin/plans/:id", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const allowed = ["name", "type", "priceEgp", "features", "studentLimit", "isActive", "sortOrder"];
  const updates: Record<string, unknown> = {};
  for (const k of allowed) {
    if (req.body[k] !== undefined) updates[k] = req.body[k];
  }
  if (updates.priceEgp) updates.priceEgp = String(updates.priceEgp);
  await db.update(subscriptionPlansTable).set(updates).where(eq(subscriptionPlansTable.id, id));
  res.json({ success: true });
});

// DELETE /subscriptions/admin/plans/:id
subscriptionsRouter.delete("/admin/plans/:id", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  await db.delete(subscriptionPlansTable).where(eq(subscriptionPlansTable.id, id));
  res.json({ success: true });
});
