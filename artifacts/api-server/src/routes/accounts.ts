import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, accountsTable } from "@workspace/db";

const router: IRouter = Router();

function requireAdmin(req: any, res: any, next: any) {
  if (req.session.role !== "admin") {
    res.status(403).json({ message: "Admin access required" });
    return;
  }
  next();
}

router.get("/accounts", requireAdmin, async (req, res): Promise<void> => {
  const accounts = await db.select({
    id: accountsTable.id,
    username: accountsTable.username,
    displayName: accountsTable.displayName,
    role: accountsTable.role,
    status: accountsTable.status,
    teacherAccountId: accountsTable.teacherAccountId,
    createdAt: accountsTable.createdAt,
  }).from(accountsTable).orderBy(accountsTable.createdAt);
  res.json(accounts);
});

router.post("/accounts", requireAdmin, async (req, res): Promise<void> => {
  const { username, password, displayName, role, teacherAccountId } = req.body;
  if (!username || !password) { res.status(400).json({ message: "Username and password are required" }); return; }
  if (!["admin", "teacher", "assistant"].includes(role || "assistant")) { res.status(400).json({ message: "Invalid role" }); return; }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const [created] = await db.insert(accountsTable).values({
      username: username.trim().toLowerCase(),
      passwordHash,
      displayName: displayName?.trim() || username.trim(),
      role: role || "assistant",
      status: "active",
      teacherAccountId: teacherAccountId ? parseInt(teacherAccountId, 10) : null,
    }).returning({ id: accountsTable.id, username: accountsTable.username, displayName: accountsTable.displayName, role: accountsTable.role, status: accountsTable.status, teacherAccountId: accountsTable.teacherAccountId });
    res.status(201).json(created);
  } catch (err: any) {
    if (err.code === "23505") { res.status(409).json({ message: "Username already taken" }); return; }
    throw err;
  }
});

router.patch("/accounts/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid ID" }); return; }

  const { displayName, role, status, password, teacherAccountId } = req.body;
  const updates: Record<string, unknown> = {};

  if (displayName !== undefined) updates.displayName = String(displayName).trim();
  if (role !== undefined) {
    if (!["admin", "teacher", "assistant"].includes(role)) { res.status(400).json({ message: "Invalid role" }); return; }
    updates.role = role;
  }
  if (status !== undefined) {
    if (!["active", "suspended"].includes(status)) { res.status(400).json({ message: "Invalid status" }); return; }
    if (id === req.session.accountId && status === "suspended") { res.status(400).json({ message: "Cannot suspend your own account" }); return; }
    updates.status = status;
  }
  if (password) {
    updates.passwordHash = await bcrypt.hash(password, 10);
  }
  if ("teacherAccountId" in req.body) {
    updates.teacherAccountId = teacherAccountId ? parseInt(teacherAccountId, 10) : null;
  }

  if (Object.keys(updates).length === 0) { res.status(400).json({ message: "Nothing to update" }); return; }

  const [updated] = await db.update(accountsTable).set(updates).where(eq(accountsTable.id, id)).returning({
    id: accountsTable.id, username: accountsTable.username, displayName: accountsTable.displayName,
    role: accountsTable.role, status: accountsTable.status, teacherAccountId: accountsTable.teacherAccountId,
  });
  if (!updated) { res.status(404).json({ message: "Account not found" }); return; }
  res.json(updated);
});

router.delete("/accounts/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (id === req.session.accountId) { res.status(400).json({ message: "Cannot delete your own account" }); return; }
  await db.delete(accountsTable).where(eq(accountsTable.id, id));
  res.json({ message: "Account deleted" });
});

export default router;
