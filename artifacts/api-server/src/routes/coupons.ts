import { Router, Response } from "express";
import { db, pool } from "@workspace/db";
import { couponsTable } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { eq } from "drizzle-orm";

export const couponsRouter = Router();

couponsRouter.post("/validate", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.body as { code: string };
    const userId = req.userId!;
    if (!code) { res.status(400).json({ error: "Code required" }); return; }

    const [coupon] = await db.select().from(couponsTable)
      .where(eq(couponsTable.code, code.toUpperCase().trim()));

    if (!coupon) { res.status(404).json({ error: "Invalid coupon code" }); return; }
    if (!coupon.isActive) { res.status(400).json({ error: "Coupon is no longer active" }); return; }
    if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
      res.status(400).json({ error: "Coupon has expired" }); return;
    }
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      res.status(400).json({ error: "Coupon has reached its usage limit" }); return;
    }

    const { rows: used } = await pool.query(
      `SELECT id FROM coupon_redemptions WHERE coupon_id=$1 AND account_id=$2 LIMIT 1`,
      [coupon.id, userId]
    );
    if (used.length > 0) {
      res.status(400).json({ error: "You have already used this coupon" }); return;
    }

    res.json({
      id: coupon.id,
      code: coupon.code,
      discountPercent: Number(coupon.discountPercent),
      expiryDate: coupon.expiryDate,
    });
  } catch {
    res.status(500).json({ error: "Failed to validate coupon" });
  }
});

const adminOnly = [authenticate, requireRole("admin")];

couponsRouter.get("/", ...adminOnly, async (_req, res: Response) => {
  try {
    const coupons = await db.select().from(couponsTable).orderBy(couponsTable.createdAt);
    res.json(coupons);
  } catch {
    res.status(500).json({ error: "Failed to load coupons" });
  }
});

couponsRouter.post("/", ...adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { code, discountPercent, maxUses, expiryDate } = req.body;
    if (!code || !discountPercent) {
      res.status(400).json({ error: "Code and discount percent are required" }); return;
    }
    const [coupon] = await db.insert(couponsTable).values({
      code: (code as string).toUpperCase().trim(),
      discountPercent: String(discountPercent),
      maxUses: maxUses ?? null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      isActive: true,
      createdBy: req.userId,
    }).returning();
    res.status(201).json(coupon);
  } catch {
    res.status(500).json({ error: "Failed to create coupon" });
  }
});

couponsRouter.put("/:id", ...adminOnly, async (req, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { discountPercent, maxUses, expiryDate, isActive } = req.body;
    const updates: Record<string, unknown> = {};
    if (discountPercent !== undefined) updates.discountPercent = String(discountPercent);
    if (maxUses !== undefined) updates.maxUses = maxUses;
    if (expiryDate !== undefined) updates.expiryDate = expiryDate ? new Date(expiryDate) : null;
    if (isActive !== undefined) updates.isActive = isActive;

    await db.update(couponsTable).set(updates).where(eq(couponsTable.id, id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to update coupon" });
  }
});

couponsRouter.delete("/:id", ...adminOnly, async (req, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(couponsTable).where(eq(couponsTable.id, id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete coupon" });
  }
});
