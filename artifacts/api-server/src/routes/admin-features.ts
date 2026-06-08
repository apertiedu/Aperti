import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { featureFlagsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireRole } from "../middleware/auth";

export const adminFeaturesRouter = Router();
adminFeaturesRouter.use(requireRole("admin", "super_admin"));

adminFeaturesRouter.get("/", async (_req, res) => {
  try {
    const flags = await db.select().from(featureFlagsTable).orderBy(featureFlagsTable.name);
    res.json(flags);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch feature flags" });
  }
});

adminFeaturesRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { name, description, enabled, targetRoles, targetPlans, targetOrgs, status } = req.body;
    const [flag] = await db.insert(featureFlagsTable).values({ name, description, enabled: enabled ?? false, targetRoles, targetPlans, targetOrgs, status: status || "enabled" }).returning();
    res.status(201).json(flag);
  } catch (err: any) {
    if (err.code === "23505") return res.status(409).json({ error: "Flag name already exists" });
    res.status(500).json({ error: "Failed to create feature flag" });
  }
});

adminFeaturesRouter.put("/:id", async (req: Request, res: Response) => {
  try {
    const { name, description, enabled, targetRoles, targetPlans, targetOrgs, status } = req.body;
    const [flag] = await db.update(featureFlagsTable).set({ name, description, enabled, targetRoles, targetPlans, targetOrgs, status, updatedAt: new Date() }).where(eq(featureFlagsTable.id, parseInt(req.params.id))).returning();
    res.json(flag);
  } catch (err) {
    res.status(500).json({ error: "Failed to update feature flag" });
  }
});

adminFeaturesRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    await db.update(featureFlagsTable).set({ status: "archived" }).where(eq(featureFlagsTable.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to archive flag" });
  }
});
