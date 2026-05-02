import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, accountsTable } from "@workspace/db";

const router: IRouter = Router();

router.post("/auth/change-password", async (req, res): Promise<void> => {
  const session = req.session as any;
  if (!session.accountId) { res.status(401).json({ message: "Not authenticated" }); return; }

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) { res.status(400).json({ message: "Both current and new password are required" }); return; }
  if (newPassword.length < 6) { res.status(400).json({ message: "New password must be at least 6 characters" }); return; }
  if (currentPassword === newPassword) { res.status(400).json({ message: "New password must be different from current password" }); return; }

  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, session.accountId));
  if (!account) { res.status(404).json({ message: "Account not found" }); return; }

  const valid = await bcrypt.compare(currentPassword, account.passwordHash);
  if (!valid) { res.status(400).json({ message: "Current password is incorrect" }); return; }

  const newHash = await bcrypt.hash(newPassword, 10);
  await db.update(accountsTable).set({ passwordHash: newHash }).where(eq(accountsTable.id, session.accountId));

  res.json({ message: "Password changed successfully" });
});

// Admin: reset any account's password
router.post("/accounts/:id/reset-password", async (req, res): Promise<void> => {
  const session = req.session as any;
  if (!session.accountId || session.role !== "admin") { res.status(403).json({ message: "Admin access required" }); return; }

  const id = parseInt(req.params.id, 10);
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) { res.status(400).json({ message: "Password must be at least 6 characters" }); return; }

  const newHash = await bcrypt.hash(newPassword, 10);
  const [updated] = await db.update(accountsTable).set({ passwordHash: newHash }).where(eq(accountsTable.id, id)).returning({ id: accountsTable.id });
  if (!updated) { res.status(404).json({ message: "Account not found" }); return; }

  res.json({ message: "Password reset successfully" });
});

export default router;
