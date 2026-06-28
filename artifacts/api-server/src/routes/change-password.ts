import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, accountsTable, pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { auditFromReq } from "../lib/audit";

const router: IRouter = Router();

const PASSWORD_HISTORY_DEPTH = 5;

async function checkPasswordHistory(accountId: number, newPassword: string): Promise<boolean> {
  try {
    const { rows } = await pool.query(
      `SELECT password_hash FROM password_history
       WHERE account_id=$1 ORDER BY created_at DESC LIMIT $2`,
      [accountId, PASSWORD_HISTORY_DEPTH],
    );
    for (const row of rows) {
      if (await bcrypt.compare(newPassword, row.password_hash)) return true;
    }
  } catch { }
  return false;
}

async function recordPasswordHistory(accountId: number, hash: string): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO password_history (account_id, password_hash, created_at) VALUES ($1,$2,NOW())`,
      [accountId, hash],
    );
    await pool.query(
      `DELETE FROM password_history WHERE id IN (
         SELECT id FROM password_history WHERE account_id=$1
         ORDER BY created_at DESC OFFSET $2
       )`,
      [accountId, PASSWORD_HISTORY_DEPTH],
    );
  } catch { }
}

router.post("/auth/change-password", authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    const accountId = req.userId!;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ message: "Both current and new password are required" }); return;
    }
    if (newPassword.length < 12) {
      res.status(400).json({ message: "New password must be at least 12 characters" }); return;
    }
    if (currentPassword === newPassword) {
      res.status(400).json({ message: "New password must be different from current password" }); return;
    }

    const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, accountId));
    if (!account) { res.status(404).json({ message: "Account not found" }); return; }

    const valid = await bcrypt.compare(currentPassword, account.passwordHash);
    if (!valid) {
      auditFromReq(req, "AUTH_PASSWORD_CHANGE", "account", { resourceId: accountId, result: "blocked", metadata: { reason: "wrong_current_password" } });
      res.status(400).json({ message: "Current password is incorrect" }); return;
    }

    const reusingOld = await checkPasswordHistory(accountId, newPassword);
    if (reusingOld) {
      res.status(400).json({ message: `You cannot reuse any of your last ${PASSWORD_HISTORY_DEPTH} passwords` }); return;
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await db.update(accountsTable)
      .set({ passwordHash: newHash, mustChangePassword: false })
      .where(eq(accountsTable.id, accountId));

    await recordPasswordHistory(accountId, newHash);
    auditFromReq(req, "AUTH_PASSWORD_CHANGE", "account", { resourceId: accountId, result: "success" });
    res.json({ message: "Password changed successfully" });
  } catch {
    res.status(500).json({ error: "Failed to change password" });
  }
});

router.post("/accounts/:id/reset-password", authenticate, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 12) {
      res.status(400).json({ message: "Password must be at least 12 characters" }); return;
    }

    const hash = await bcrypt.hash(newPassword, 12);
    const [updated] = await db.update(accountsTable)
      .set({ passwordHash: hash, mustChangePassword: true })
      .where(eq(accountsTable.id, id)).returning({ id: accountsTable.id });
    if (!updated) { res.status(404).json({ message: "Account not found" }); return; }

    await recordPasswordHistory(id, hash);
    auditFromReq(req, "AUTH_PASSWORD_CHANGE", "account", { resourceId: id, result: "success", severity: "warn", metadata: { admin_reset: true } });
    res.json({ message: "Password reset successfully" });
  } catch {
    res.status(500).json({ error: "Failed to reset password" });
  }
});

export default router;
