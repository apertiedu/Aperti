import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { accountsTable, deviceSessionsTable } from "@workspace/db";

const JWT_SECRET = process.env.JWT_SECRET || "aperti-dev-secret-change-in-prod";
const TOKEN_EXPIRY = "7d";

export const authRouter = Router();

// POST /auth/login
authRouter.post("/login", async (req: Request, res: Response) => {
  try {
    const { username, password, deviceId, ip, userAgent } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }
    const [account] = await db.select().from(accountsTable).where(eq(accountsTable.username, username.trim().toLowerCase())).limit(1);
    if (!account || account.status !== "active") {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const valid = await bcrypt.compare(password, account.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ id: account.id, role: account.role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    if (deviceId) {
      await db.insert(deviceSessionsTable).values({
        accountId: account.id,
        deviceId,
        ip: ip || req.ip,
        userAgent: userAgent || req.headers["user-agent"],
        lastActiveAt: new Date(),
      }).onConflictDoNothing();
    }
    res.json({
      token,
      user: {
        id: account.id,
        username: account.username,
        displayName: account.displayName,
        role: account.role,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /auth/setup – create first admin if none exist
authRouter.post("/setup", async (req: Request, res: Response) => {
  try {
    const existing = await db.select().from(accountsTable).limit(1);
    if (existing.length > 0) {
      return res.status(403).json({ error: "Setup already completed" });
    }
    const { username, password, displayName } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }
    const hash = await bcrypt.hash(password, 12);
    const [newUser] = await db.insert(accountsTable).values({
      username: username.trim(),
      passwordHash: hash,
      displayName: displayName || "Admin",
      role: "admin",
      status: "active",
    }).returning();
    res.status(201).json({ message: "Admin account created", user: { id: newUser.id, username: newUser.username, role: newUser.role } });
  } catch (err) {
    console.error("Setup error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /auth/me – validate token
authRouter.get("/me", async (req: Request, res: Response) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as any;
    const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, payload.id)).limit(1);
    if (!account) return res.status(401).json({ error: "User not found" });
    res.json({
      user: {
        id: account.id,
        username: account.username,
        displayName: account.displayName,
        role: account.role,
      },
    });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

// POST /auth/logout
authRouter.post("/logout", async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.body;
    if (deviceId) {
      await db.delete(deviceSessionsTable).where(eq(deviceSessionsTable.deviceId, deviceId));
    }
  } catch {
    // ignore logout errors
  }
  res.json({ success: true });
});

// POST /auth/signup
authRouter.post("/signup", async (req: Request, res: Response) => {
  try {
    const { username, password, displayName, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });
    const [existing] = await db.select().from(accountsTable).where(eq(accountsTable.username, username)).limit(1);
    if (existing) return res.status(409).json({ error: "Username already taken" });
    const hash = await bcrypt.hash(password, 12);
    const [newUser] = await db.insert(accountsTable).values({
      username,
      passwordHash: hash,
      displayName: displayName || username,
      role: role || "teacher",
      status: "active",
    }).returning();
    res.status(201).json({ user: { id: newUser.id, username: newUser.username, role: newUser.role } });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
