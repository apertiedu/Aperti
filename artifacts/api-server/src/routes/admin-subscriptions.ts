import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { subscriptionPlansTable, subscriptionsTable, accountsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { requireRole } from "../middleware/auth";

export const adminSubscriptionsRouter = Router();
adminSubscriptionsRouter.use(requireRole("admin", "super_admin"));

/* ── Plans ───────────────────────────────────────────────────────────────── */
adminSubscriptionsRouter.get("/plans", async (_req, res) => {
  try {
    const plans = await db.select().from(subscriptionPlansTable).orderBy(subscriptionPlansTable.sortOrder);
    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch plans" });
  }
});

adminSubscriptionsRouter.post("/plans", async (req: Request, res: Response) => {
  try {
    const { name, type, priceEgp, features, studentLimit, flexSeatPriceEgp, sortOrder } = req.body;
    const [plan] = await db.insert(subscriptionPlansTable).values({ name, type: type || "teacher", priceEgp, features, studentLimit, flexSeatPriceEgp, sortOrder: sortOrder || 0 }).returning();
    res.status(201).json(plan);
  } catch (err) {
    res.status(500).json({ error: "Failed to create plan" });
  }
});

adminSubscriptionsRouter.put("/plans/:id", async (req: Request, res: Response) => {
  try {
    const { name, type, priceEgp, features, studentLimit, flexSeatPriceEgp, isActive, sortOrder } = req.body;
    const [plan] = await db.update(subscriptionPlansTable).set({ name, type, priceEgp, features, studentLimit, flexSeatPriceEgp, isActive, sortOrder }).where(eq(subscriptionPlansTable.id, parseInt(req.params.id))).returning();
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: "Failed to update plan" });
  }
});

adminSubscriptionsRouter.delete("/plans/:id", async (req: Request, res: Response) => {
  try {
    await db.update(subscriptionPlansTable).set({ isActive: false }).where(eq(subscriptionPlansTable.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to archive plan" });
  }
});

/* ── Subscriptions ───────────────────────────────────────────────────────── */
adminSubscriptionsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const { page = "1", limit = "50", status, planId } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const rows = await db
      .select({
        id: subscriptionsTable.id,
        accountId: subscriptionsTable.accountId,
        planId: subscriptionsTable.planId,
        status: subscriptionsTable.status,
        startDate: subscriptionsTable.startDate,
        endDate: subscriptionsTable.endDate,
        paymentStatus: subscriptionsTable.paymentStatus,
        createdAt: subscriptionsTable.createdAt,
        username: accountsTable.username,
        displayName: accountsTable.displayName,
        email: accountsTable.email,
        role: accountsTable.role,
        planName: subscriptionPlansTable.name,
        planPrice: subscriptionPlansTable.priceEgp,
      })
      .from(subscriptionsTable)
      .leftJoin(accountsTable, eq(subscriptionsTable.accountId, accountsTable.id))
      .leftJoin(subscriptionPlansTable, eq(subscriptionsTable.planId, subscriptionPlansTable.id))
      .orderBy(desc(subscriptionsTable.createdAt))
      .limit(parseInt(limit))
      .offset(offset);
    const [cnt] = await db.select({ c: sql<number>`count(*)::int` }).from(subscriptionsTable);
    res.json({ subscriptions: rows, total: cnt.c });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch subscriptions" });
  }
});

adminSubscriptionsRouter.put("/:id", async (req: Request, res: Response) => {
  try {
    const { status, endDate } = req.body;
    const [sub] = await db.update(subscriptionsTable).set({ status, endDate: endDate ? new Date(endDate) : undefined }).where(eq(subscriptionsTable.id, parseInt(req.params.id))).returning();
    res.json(sub);
  } catch (err) {
    res.status(500).json({ error: "Failed to update subscription" });
  }
});

/* ── Overview ────────────────────────────────────────────────────────────── */
adminSubscriptionsRouter.get("/stats/overview", async (_req, res) => {
  try {
    const [active, trial, expired, total] = await Promise.all([
      db.select({ c: sql<number>`count(*)::int` }).from(subscriptionsTable).where(eq(subscriptionsTable.status, "active")),
      db.select({ c: sql<number>`count(*)::int` }).from(subscriptionsTable).where(eq(subscriptionsTable.status, "trial")),
      db.select({ c: sql<number>`count(*)::int` }).from(subscriptionsTable).where(eq(subscriptionsTable.status, "expired")),
      db.select({ c: sql<number>`count(*)::int` }).from(subscriptionsTable),
    ]);
    res.json({ active: active[0].c, trial: trial[0].c, expired: expired[0].c, total: total[0].c });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});
