import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, accountsTable } from "@workspace/db";

declare module "express-session" {
  interface SessionData {
    accountId: number;
    username: string;
    displayName: string;
  }
}

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ message: "Username and password are required" });
    return;
  }

  const [account] = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.username, username.trim().toLowerCase()));

  if (!account) {
    res.status(401).json({ message: "Invalid username or password" });
    return;
  }

  const valid = await bcrypt.compare(password, account.passwordHash);
  if (!valid) {
    res.status(401).json({ message: "Invalid username or password" });
    return;
  }

  req.session.accountId = account.id;
  req.session.username = account.username;
  req.session.displayName = account.displayName || account.username;

  res.json({ username: account.username, displayName: account.displayName || account.username });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.json({ message: "Logged out" });
  });
});

router.get("/auth/me", (req, res): void => {
  if (!req.session.accountId) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  res.json({ username: req.session.username, displayName: req.session.displayName });
});

router.get("/accounts", async (req, res): Promise<void> => {
  if (!req.session.accountId) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  const accounts = await db
    .select({ id: accountsTable.id, username: accountsTable.username, displayName: accountsTable.displayName, createdAt: accountsTable.createdAt })
    .from(accountsTable)
    .orderBy(accountsTable.createdAt);
  res.json(accounts);
});

router.post("/accounts", async (req, res): Promise<void> => {
  if (!req.session.accountId) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  const { username, password, displayName } = req.body;
  if (!username || !password) {
    res.status(400).json({ message: "Username and password are required" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const [created] = await db
    .insert(accountsTable)
    .values({ username: username.trim().toLowerCase(), passwordHash, displayName: displayName?.trim() || username.trim() })
    .returning({ id: accountsTable.id, username: accountsTable.username, displayName: accountsTable.displayName });
  res.status(201).json(created);
});

router.delete("/accounts/:id", async (req, res): Promise<void> => {
  if (!req.session.accountId) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  const id = parseInt(req.params.id, 10);
  if (id === req.session.accountId) {
    res.status(400).json({ message: "Cannot delete your own account" });
    return;
  }
  await db.delete(accountsTable).where(eq(accountsTable.id, id));
  res.json({ message: "Account deleted" });
});

export default router;
export { };
