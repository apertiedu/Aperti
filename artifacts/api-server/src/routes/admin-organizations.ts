import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { organizationsTable, organizationSettingsTable } from "@workspace/db";
import { eq, ilike, desc, sql } from "drizzle-orm";
import { requireRole } from "../middleware/auth";

export const adminOrgsRouter = Router();
adminOrgsRouter.use(requireRole("admin", "super_admin"));

adminOrgsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const { search, status, page = "1", limit = "50" } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let query = db.select().from(organizationsTable).$dynamic();
    if (search) query = query.where(ilike(organizationsTable.name, `%${search}%`));
    const orgs = await query.orderBy(desc(organizationsTable.createdAt)).limit(parseInt(limit)).offset(offset);
    const [cnt] = await db.select({ c: sql<number>`count(*)::int` }).from(organizationsTable);
    res.json({ organizations: orgs, total: cnt.c });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch organizations" });
  }
});

adminOrgsRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, parseInt(req.params.id)));
    if (!org) return res.status(404).json({ error: "Not found" });
    const [settings] = await db.select().from(organizationSettingsTable).where(eq(organizationSettingsTable.organizationId, org.id));
    res.json({ ...org, settings: settings || null });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch organization" });
  }
});

adminOrgsRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { name, slug, type, country, language, timezone, logoUrl, address, contactInfo, branding } = req.body;
    if (!name || !slug) return res.status(400).json({ error: "name and slug required" });
    const [org] = await db.insert(organizationsTable).values({ name, slug, type: type || "tutoring_center", country: country || "EG", language: language || "en", timezone: timezone || "Africa/Cairo", logoUrl, address, contactInfo, branding }).returning();
    await db.insert(organizationSettingsTable).values({ organizationId: org.id, defaultCurrency: "EGP" });
    res.status(201).json(org);
  } catch (err: any) {
    if (err.code === "23505") return res.status(409).json({ error: "Slug already exists" });
    res.status(500).json({ error: "Failed to create organization" });
  }
});

adminOrgsRouter.put("/:id", async (req: Request, res: Response) => {
  try {
    const { name, type, country, language, timezone, logoUrl, address, contactInfo, branding, status } = req.body;
    const [org] = await db.update(organizationsTable).set({ name, type, country, language, timezone, logoUrl, address, contactInfo, branding, status }).where(eq(organizationsTable.id, parseInt(req.params.id))).returning();
    res.json(org);
  } catch (err) {
    res.status(500).json({ error: "Failed to update organization" });
  }
});

adminOrgsRouter.put("/:id/settings", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { workingHours, academicYearStart, academicYearEnd, defaultCurrency, paymentMethods, featureAccess } = req.body;
    const [existing] = await db.select().from(organizationSettingsTable).where(eq(organizationSettingsTable.organizationId, id));
    if (existing) {
      const [s] = await db.update(organizationSettingsTable).set({ workingHours, academicYearStart, academicYearEnd, defaultCurrency, paymentMethods, featureAccess, updatedAt: new Date() }).where(eq(organizationSettingsTable.organizationId, id)).returning();
      res.json(s);
    } else {
      const [s] = await db.insert(organizationSettingsTable).values({ organizationId: id, workingHours, academicYearStart, academicYearEnd, defaultCurrency: defaultCurrency || "EGP", paymentMethods, featureAccess }).returning();
      res.json(s);
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

adminOrgsRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    await db.update(organizationsTable).set({ status: "archived" } as any).where(eq(organizationsTable.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to archive organization" });
  }
});
