import { Router, Request, Response } from "express";
import { db, pool } from "@workspace/db";
import { accountsTable, deviceSessionsTable } from "@workspace/db";
import { eq, ilike, or, and, desc, sql } from "drizzle-orm";
import { requireRole } from "../middleware/auth";
import bcrypt from "bcryptjs";
import { validateBody } from "../middleware/validate-body";
import { z } from "zod";

const createUserSchema = z.object({
  username:    z.string().min(2).max(80),
  password:    z.string().min(6, "Password must be at least 6 characters"),
  displayName: z.string().max(100).optional(),
  email:       z.string().email().optional().or(z.literal("")),
  role:        z.enum(["admin","teacher","assistant","student","parent","super_admin"]).default("teacher"),
  status:      z.enum(["active","suspended"]).default("active"),
  phone:       z.string().max(30).optional(),
  country:     z.string().max(60).optional(),
});

const updateUserSchema = z.object({
  displayName: z.string().max(100).optional(),
  email:       z.string().email().optional().or(z.literal("")),
  role:        z.enum(["admin","teacher","assistant","student","parent","super_admin"]).optional(),
  status:      z.enum(["active","suspended"]).optional(),
  phone:       z.string().max(30).optional(),
  country:     z.string().max(60).optional(),
  bio:         z.string().max(2000).optional(),
  avatarUrl:   z.string().url().optional().or(z.literal("")),
  firstName:   z.string().max(60).optional(),
  lastName:    z.string().max(60).optional(),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

export const adminUsersRouter = Router();
adminUsersRouter.use(requireRole("admin", "super_admin"));

/* ── List Users ──────────────────────────────────────────────────────────── */
adminUsersRouter.get("/", async (req: Request, res: Response) => {
  try {
    const { search, role, status, page = "1", limit = "50" } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const conditions: any[] = [];
    if (search) {
      conditions.push(
        or(
          ilike(accountsTable.username, `%${search}%`),
          ilike(accountsTable.displayName, `%${search}%`),
          ilike(accountsTable.email ?? accountsTable.username, `%${search}%`)
        )
      );
    }
    if (role) conditions.push(eq(accountsTable.role, role));
    if (status) conditions.push(eq(accountsTable.status, status));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [users, countResult] = await Promise.all([
      db.select({
        id: accountsTable.id,
        username: accountsTable.username,
        displayName: accountsTable.displayName,
        email: accountsTable.email,
        role: accountsTable.role,
        status: accountsTable.status,
        isVerified: accountsTable.isVerified,
        lastLoginAt: accountsTable.lastLoginAt,
        createdAt: accountsTable.createdAt,
        avatarUrl: accountsTable.avatarUrl,
        phone: accountsTable.phone,
        country: accountsTable.country,
      })
        .from(accountsTable)
        .where(where)
        .orderBy(desc(accountsTable.createdAt))
        .limit(parseInt(limit))
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(accountsTable).where(where),
    ]);

    res.json({ users, total: countResult[0]?.count ?? 0, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

/* ── Export Users ────────────────────────────────────────────────────────── */
adminUsersRouter.get("/export/csv", async (req: Request, res: Response) => {
  try {
    const users = await db.select({ id: accountsTable.id, username: accountsTable.username, displayName: accountsTable.displayName, email: accountsTable.email, role: accountsTable.role, status: accountsTable.status, createdAt: accountsTable.createdAt }).from(accountsTable).orderBy(desc(accountsTable.createdAt));
    const header = "id,username,displayName,email,role,status,createdAt\n";
    const rows = users.map(u => `${u.id},"${u.username}","${u.displayName}","${u.email || ""}",${u.role},${u.status},${u.createdAt}`).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=users.csv");
    res.send(header + rows);
  } catch (err) {
    res.status(500).json({ error: "Export failed" });
  }
});

/* ── Stats ───────────────────────────────────────────────────────────────── */
adminUsersRouter.get("/stats/overview", async (req: Request, res: Response) => {
  try {
    const [total, teachers, students, admins, active, suspended] = await Promise.all([
      db.select({ c: sql<number>`count(*)::int` }).from(accountsTable),
      db.select({ c: sql<number>`count(*)::int` }).from(accountsTable).where(eq(accountsTable.role, "teacher")),
      db.select({ c: sql<number>`count(*)::int` }).from(accountsTable).where(eq(accountsTable.role, "student")),
      db.select({ c: sql<number>`count(*)::int` }).from(accountsTable).where(eq(accountsTable.role, "admin")),
      db.select({ c: sql<number>`count(*)::int` }).from(accountsTable).where(eq(accountsTable.status, "active")),
      db.select({ c: sql<number>`count(*)::int` }).from(accountsTable).where(eq(accountsTable.status, "suspended")),
    ]);
    res.json({ total: total[0].c, teachers: teachers[0].c, students: students[0].c, admins: admins[0].c, active: active[0].c, suspended: suspended[0].c });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

/* ── Get Single User ─────────────────────────────────────────────────────── */
adminUsersRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const [user] = await db.select().from(accountsTable).where(eq(accountsTable.id, parseInt(req.params.id)));
    if (!user) return res.status(404).json({ error: "User not found" });
    const sessions = await db.select().from(deviceSessionsTable).where(eq(deviceSessionsTable.accountId, user.id)).orderBy(desc(deviceSessionsTable.lastActiveAt)).limit(10);
    res.json({ ...user, sessions });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

/* ── Create User ─────────────────────────────────────────────────────────── */
adminUsersRouter.post("/", validateBody(createUserSchema), async (req: Request, res: Response) => {
  try {
    const { username, password, displayName, email, role, status = "active", phone, country } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(accountsTable).values({ username, passwordHash, displayName: displayName || username, email, role: role || "teacher", status, phone, country }).returning();
    res.status(201).json(user);
  } catch (err: any) {
    if (err.code === "23505") return res.status(409).json({ error: "Username already exists" });
    res.status(500).json({ error: "Failed to create user" });
  }
});

/* ── Update User ─────────────────────────────────────────────────────────── */
adminUsersRouter.put("/:id", validateBody(updateUserSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const actorId: number = (req as any).userId;
    const actorRole: string = (req as any).role ?? "";
    const targetId = parseInt(req.params.id);
    const { displayName, email, role, status, phone, country, bio, avatarUrl, firstName, lastName } = req.body;

    if (role === "super_admin" && actorRole !== "super_admin") {
      res.status(403).json({ error: "Only super admins can assign the super_admin role" });
      return;
    }
    if (role && actorId === targetId) {
      res.status(403).json({ error: "You cannot change your own role" });
      return;
    }

    const [user] = await db.update(accountsTable)
      .set({ displayName, email, role, status, phone, country, bio, avatarUrl, firstName, lastName })
      .where(eq(accountsTable.id, targetId))
      .returning();
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Failed to update user" });
  }
});

/* ── Suspend User ────────────────────────────────────────────────────────── */
adminUsersRouter.put("/:id/suspend", async (req: Request, res: Response) => {
  try {
    await db.update(accountsTable).set({ status: "suspended" }).where(eq(accountsTable.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to suspend user" });
  }
});

/* ── Restore User ────────────────────────────────────────────────────────── */
adminUsersRouter.put("/:id/restore", async (req: Request, res: Response) => {
  try {
    await db.update(accountsTable).set({ status: "active" }).where(eq(accountsTable.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to restore user" });
  }
});

/* ── Reset Password ──────────────────────────────────────────────────────── */
adminUsersRouter.post("/:id/reset-password", validateBody(resetPasswordSchema), async (req: Request, res: Response) => {
  try {
    const { newPassword } = req.body;
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.update(accountsTable).set({ passwordHash }).where(eq(accountsTable.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to reset password" });
  }
});

/* ── Force Logout ────────────────────────────────────────────────────────── */
adminUsersRouter.post("/:id/force-logout", async (req: Request, res: Response) => {
  try {
    await db.delete(deviceSessionsTable).where(eq(deviceSessionsTable.accountId, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to force logout" });
  }
});

/* ── Impersonate ─────────────────────────────────────────────────────────── */
adminUsersRouter.post("/:id/impersonate", async (req: Request, res: Response) => {
  try {
    const targetId = parseInt(req.params.id);
    const [target] = await db.select().from(accountsTable).where(eq(accountsTable.id, targetId));
    if (!target) return res.status(404).json({ error: "User not found" });
    const jwt = await import("jsonwebtoken");
    const secret = process.env["JWT_SECRET"];
    if (!secret) return res.status(500).json({ error: "JWT_SECRET is not configured" });
    const token = jwt.default.sign(
      { id: target.id, role: target.role, impersonatedBy: (req as any).userId },
      secret,
      { expiresIn: "1h" }
    );
    await pool.query(
      "INSERT INTO audit_logs (account_id, action, resource, details, ip_address) VALUES ($1, $2, $3, $4, $5)",
      [(req as any).userId, "impersonate", "accounts", JSON.stringify({ targetId }), req.ip]
    );
    res.json({ token, user: { id: target.id, username: target.username, role: target.role, displayName: target.displayName } });
  } catch (err) {
    res.status(500).json({ error: "Failed to impersonate user" });
  }
});

/* ── Bulk Import ─────────────────────────────────────────────────────────── */
adminUsersRouter.post("/bulk-import", async (req: Request, res: Response) => {
  try {
    const { users } = req.body as { users: any[] };
    if (!Array.isArray(users)) return res.status(400).json({ error: "users must be array" });
    const results = { created: 0, failed: 0, errors: [] as string[] };
    for (const u of users) {
      try {
        if (!u.password || u.password.length < 8) throw new Error("password required (min 8 chars)");
        const passwordHash = await bcrypt.hash(u.password, 10);
        await db.insert(accountsTable).values({ username: u.username, passwordHash, displayName: u.displayName || u.username, email: u.email, role: u.role || "student", status: "active" });
        results.created++;
      } catch (e: any) {
        results.failed++;
        results.errors.push(`${u.username}: ${e.message}`);
      }
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Bulk import failed" });
  }
});
