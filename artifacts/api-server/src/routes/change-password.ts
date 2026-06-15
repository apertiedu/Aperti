import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, accountsTable } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";

const router: IRouter = Router();

router.post("/auth/change-password", authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    const accountId = req.userId!;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) { res.status(400).json({ message: "Both current and new password are required" }); return; }
    if (newPassword.length < 6) { res.status(400).json({ message: "New password must be at least 6 characters" }); return; }
    if (currentPassword === newPassword) { res.status(400).json({ message: "New password must be different from current password" }); return; }

    const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, accountId));
    if (!account) { res.status(404).json({ message: "Account not found" }); return; }

    const valid = await bcrypt.compare(currentPassword, account.passwordHash);
    if (!valid) { res.status(400).json({ message: "Current password is incorrect" }); return; }

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.update(accountsTable).set({ passwordHash: newHash, mustChangePassword: false }).where(eq(accountsTable.id, accountId));
    res.json({ message: "Password changed successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to change password" });
  }
});

router.post("/accounts/:id/reset-password", authenticate, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) { res.status(400).json({ message: "Password must be at least 6 characters" }); return; }

    const [updated] = await db.update(accountsTable)
      .set({ passwordHash: await bcrypt.hash(newPassword, 10), mustChangePassword: true })
      .where(eq(accountsTable.id, id)).returning({ id: accountsTable.id });
    if (!updated) { res.status(404).json({ message: "Account not found" }); return; }
    res.json({ message: "Password reset successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to reset password" });
  }
});

export default router;
