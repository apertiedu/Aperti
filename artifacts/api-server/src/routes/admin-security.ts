import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { deviceSessionsTable, accountsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireRole } from "../middleware/auth";
import bcrypt from "bcryptjs";

export const adminSecurityRouter = Router();
adminSecurityRouter.use(requireRole("admin", "super_admin"));

adminSecurityRouter.get("/sessions", async (req: Request, res: Response) => {
  try {
    const sessions = await db
      .select({
        id: deviceSessionsTable.id,
        accountId: deviceSessionsTable.accountId,
        deviceId: deviceSessionsTable.deviceId,
        ip: deviceSessionsTable.ip,
        userAgent: deviceSessionsTable.userAgent,
        lastActiveAt: deviceSessionsTable.lastActiveAt,
        createdAt: deviceSessionsTable.createdAt,
        username: accountsTable.username,
        displayName: accountsTable.displayName,
        role: accountsTable.role,
      })
      .from(deviceSessionsTable)
      .leftJoin(accountsTable, eq(deviceSessionsTable.accountId, accountsTable.id))
      .orderBy(desc(deviceSessionsTable.lastActiveAt))
      .limit(200);
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

adminSecurityRouter.delete("/sessions/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(deviceSessionsTable).where(eq(deviceSessionsTable.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to terminate session" });
  }
});

adminSecurityRouter.delete("/sessions/user/:userId", async (req: Request, res: Response) => {
  try {
    await db.delete(deviceSessionsTable).where(eq(deviceSessionsTable.accountId, parseInt(req.params.userId)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to terminate sessions" });
  }
});

adminSecurityRouter.post("/account-recovery", async (req: Request, res: Response) => {
  try {
    const { userId, newPassword } = req.body;
    if (!userId || !newPassword) return res.status(400).json({ error: "userId and newPassword required" });
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.update(accountsTable).set({ passwordHash, status: "active" }).where(eq(accountsTable.id, parseInt(userId)));
    await db.delete(deviceSessionsTable).where(eq(deviceSessionsTable.accountId, parseInt(userId)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Account recovery failed" });
  }
});
