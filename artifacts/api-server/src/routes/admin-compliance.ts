import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { complianceRequestsTable, backupLogsTable, accountsTable, platformSettingsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireRole } from "../middleware/auth";

export const adminComplianceRouter = Router();
adminComplianceRouter.use(requireRole("admin", "super_admin"));

adminComplianceRouter.get("/requests", async (_req, res) => {
  try {
    const requests = await db
      .select({
        id: complianceRequestsTable.id,
        userId: complianceRequestsTable.userId,
        type: complianceRequestsTable.type,
        status: complianceRequestsTable.status,
        requestedAt: complianceRequestsTable.requestedAt,
        completedAt: complianceRequestsTable.completedAt,
        notes: complianceRequestsTable.notes,
        username: accountsTable.username,
        displayName: accountsTable.displayName,
        email: accountsTable.email,
      })
      .from(complianceRequestsTable)
      .leftJoin(accountsTable, eq(complianceRequestsTable.userId, accountsTable.id))
      .orderBy(desc(complianceRequestsTable.requestedAt));
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch compliance requests" });
  }
});

adminComplianceRouter.put("/requests/:id", async (req: Request, res: Response) => {
  try {
    const { status, notes } = req.body;
    const [r] = await db.update(complianceRequestsTable).set({ status, notes, completedAt: status === "completed" ? new Date() : undefined }).where(eq(complianceRequestsTable.id, parseInt(req.params.id))).returning();
    res.json(r);
  } catch (err) {
    res.status(500).json({ error: "Failed to update request" });
  }
});

adminComplianceRouter.get("/backups", async (_req, res) => {
  try {
    const backups = await db.select().from(backupLogsTable).orderBy(desc(backupLogsTable.createdAt)).limit(50);
    res.json(backups);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch backups" });
  }
});

adminComplianceRouter.post("/backups", async (req: Request, res: Response) => {
  try {
    const [backup] = await db.insert(backupLogsTable).values({ type: "manual", status: "pending" }).returning();
    setTimeout(async () => {
      await db.update(backupLogsTable).set({ status: "completed", fileUrl: `/backups/backup-${backup.id}.sql` }).where(eq(backupLogsTable.id, backup.id)).catch(() => {});
    }, 3000);
    res.status(201).json(backup);
  } catch (err) {
    res.status(500).json({ error: "Failed to trigger backup" });
  }
});

adminComplianceRouter.get("/platform-settings", async (_req, res) => {
  try {
    const settings = await db.select().from(platformSettingsTable);
    const map: Record<string, any> = {};
    for (const s of settings) map[s.key] = s.value;
    res.json(map);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

adminComplianceRouter.put("/platform-settings", async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).userId;
    for (const [key, value] of Object.entries(req.body)) {
      const existing = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, key));
      if (existing.length > 0) {
        await db.update(platformSettingsTable).set({ value: value as any, updatedBy: adminId, updatedAt: new Date() }).where(eq(platformSettingsTable.key, key));
      } else {
        await db.insert(platformSettingsTable).values({ key, value: value as any, updatedBy: adminId });
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update settings" });
  }
});
