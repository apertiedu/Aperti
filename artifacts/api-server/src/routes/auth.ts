import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";          // your drizzle client
import { accountsTable, deviceSessionsTable } from "@workspace/db";

const JWT_SECRET = process.env.JWT_SECRET || "aperti-dev-secret";
const TOKEN_EXPIRY = "7d";

export const authRouter = Router();

// POST /auth/login
authRouter.post("/login", async (req: Request, res: Response) => {
  const { username, password, deviceId, ip, userAgent } = req.body;
  const account = await db.query.accounts.findFirst({ where: (a, { eq }) => eq(a.username, username) });
  if (!account || account.status !== "active") return res.status(401).json({ error: "Invalid credentials" });

  const valid = await bcrypt.compare(password, account.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ id: account.id, role: account.role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

  if (deviceId) {
    await db.insert(deviceSessionsTable).values({
      accountId: account.id, deviceId, ip, userAgent,
      lastActiveAt: new Date(),
    });
  }

  res.json({ token, user: { id: account.id, username: account.username, displayName: account.displayName, role: account.role } });
});

// POST /auth/signup (admin only for now, or allow teacher signup)
authRouter.post("/signup", async (req: Request, res: Response) => {
  const { username, password, displayName, role } = req.body;
  const hash = await bcrypt.hash(password, 12);
  const [newUser] = await db.insert(accountsTable).values({ username, passwordHash: hash, displayName, role }).returning();
  res.status(201).json({ user: { id: newUser.id, username: newUser.username, role: newUser.role } });
});

// GET /auth/me – validate token
authRouter.get("/me", async (req: Request, res: Response) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as any;
    const account = await db.query.accounts.findFirst({ where: (a, { eq }) => eq(a.id, payload.id) });
    if (!account) return res.status(401).json({ error: "User not found" });
    res.json({ user: { id: account.id, username: account.username, displayName: account.displayName, role: account.role } });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

// POST /auth/logout – delete device session
authRouter.post("/logout", async (req: Request, res: Response) => {
  const { deviceId } = req.body;
  if (deviceId) {
    await db.delete(deviceSessionsTable).where(eq(deviceSessionsTable.deviceId, deviceId));
  }
  res.json({ success: true });
});
