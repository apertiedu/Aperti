import { Router, Response } from "express";
import { db } from "../lib/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { subscriptionsTable, subscriptionPlansTable, flexSeatsTable } from "@lib/db/schema/subscriptions";
import { eq } from "drizzle-orm";

export const subscriptionsRouter = Router();

// GET current subscription for teacher
subscriptionsRouter.get("/mine", authenticate, async (req: AuthRequest, res: Response) => {
  const sub = await db.query.subscriptions.findFirst({
    where: (s, { eq }) => eq(s.accountId, req.userId!),
    with: { plan: true },
  });
  const flexSeats = sub ? await db.query.flexSeats.findMany({ where: (f, { eq }) => eq(f.subscriptionId, sub.id) }) : [];
  res.json({ subscription: sub, flexSeats });
});

// Admin: update plan (later)
subscriptionsRouter.put("/plans/:id", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  await db.update(subscriptionPlansTable).set(req.body).where(eq(subscriptionPlansTable.id, id));
  res.json({ success: true });
});
