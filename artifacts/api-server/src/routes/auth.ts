import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db, pool } from "@workspace/db";
import { accountsTable, deviceSessionsTable, auditLogsTable } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import { eventBus } from "../lib/event-bus";
import { audit } from "../lib/audit";
import { sendEmail, buildPasswordResetEmail, SMTP_CONFIGURED } from "../lib/email";

/**
 * Validate password complexity.
 * Enforces: min 8 chars, ≥1 uppercase, ≥1 lowercase, ≥1 digit, ≥1 special char.
 * Returns null on success, error message string on failure.
 */
function validatePasswordComplexity(password: string): string | null {
  if (typeof password !== "string") return "Password must be a string";
  if (password.length < 12) return "Password must be at least 12 characters";
  if (password.length > 500) return "Password is too long";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter";
  if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must contain at least one special character (!@#$% etc.)";
  return null;
}

// Fire-and-forget audit log helper — never throws
function writeAudit(entry: {
  accountId?: number | null;
  action: string;
  resource: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  severity?: "info" | "warning" | "error" | "critical";
}) {
  db.insert(auditLogsTable).values({
    accountId: entry.accountId ?? null,
    action: entry.action,
    resource: entry.resource,
    details: entry.details ?? null,
    ipAddress: entry.ipAddress ?? null,
    userAgent: entry.userAgent ?? null,
    severity: entry.severity ?? "info",
  }).catch(() => {});
}

const JWT_SECRET = process.env.JWT_SECRET!;
const TOKEN_EXPIRY = "7d";

export const authRouter = Router();

function safeUser(account: Record<string, unknown>): {
  id: number;
  username: string;
  displayName: string;
  email: string | null;
  role: string;
  status: string;
  mfaEnabled: boolean;
  mustChangePassword: boolean;
} {
  return {
    id: (account.id as number) ?? 0,
    username: (account.username as string) ?? "",
    displayName: (account.display_name as string) ?? (account.displayName as string) ?? "",
    email: (account.email as string | null) ?? null,
    role: (account.role as string) ?? "guest",
    status: (account.status as string) ?? "active",
    mfaEnabled: Boolean(account.mfa_enabled ?? account.mfaEnabled ?? false),
    mustChangePassword: Boolean(account.must_change_password ?? account.mustChangePassword ?? false),
  };
}

// ── Register rate limiter: 10 new accounts per hour per IP ───────────────────
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");
    res.status(429).json({ error: "Too many registration attempts. Please try again in 1 hour." });
  },
});

// ── Login rate limiter: 5 failed attempts per 10 minutes per IP ───────────────
// skipSuccessfulRequests=true means only 4xx/5xx responses count toward the limit
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.status(429).json({ error: "Too many failed login attempts. Please try again in 10 minutes.", rateLimited: true });
  },
});

// ── Per-IP brute-force tracker → email admin when threshold is hit ────────────
const ipFailTimes = new Map<string, number[]>();
const alertCooldown = new Map<string, number>();
const ALERT_THRESHOLD = 5;
const ALERT_WINDOW_MS = 10 * 60 * 1000;

async function checkAndMaybeAlert(ip: string): Promise<void> {
  const now = Date.now();
  const recent = (ipFailTimes.get(ip) || []).filter(t => now - t < ALERT_WINDOW_MS);
  recent.push(now);
  ipFailTimes.set(ip, recent);
  if (recent.length < ALERT_THRESHOLD) return;
  const lastAlert = alertCooldown.get(ip) || 0;
  if (now - lastAlert < ALERT_WINDOW_MS) return; // already alerted this window
  alertCooldown.set(ip, now);
  writeAudit({ action: "security_alert", resource: "auth", details: { ip, count: recent.length, window: "10min" }, ipAddress: ip, severity: "critical" });
  try {
    const { pool: p } = await import("@workspace/db");
    const { rows } = await p.query(`SELECT email, display_name FROM accounts WHERE role='admin' AND status='active' AND email IS NOT NULL LIMIT 1`);
    if (!rows.length) return;
    const admin = rows[0] as any;
    const { sendEmail } = await import("../lib/email");
    await sendEmail({
      to: admin.email,
      subject: "⚠️ Aperti Security Alert — Brute-force login detected",
      html: `
        <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1e293b">
          <h1 style="font-size:22px;font-weight:800;margin:0 0 4px">Aperti<span style="color:#dc2626">.</span></h1>
          <p style="color:#64748b;font-size:13px;margin:0 0 28px">Security Notification</p>
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:20px 24px;margin:0 0 24px">
            <p style="font-size:15px;font-weight:700;color:#dc2626;margin:0 0 8px">🚨 Brute-force attempt detected</p>
            <p style="font-size:14px;margin:0 0 12px;color:#374151">
              <strong>${recent.length} failed login attempts</strong> from the same IP address have been recorded within the last 10 minutes.
            </p>
            <table style="font-size:13px;width:100%;border-collapse:collapse">
              <tr><td style="color:#6b7280;padding:3px 0">IP Address</td><td style="font-weight:600;color:#111827">${ip}</td></tr>
              <tr><td style="color:#6b7280;padding:3px 0">Attempt count</td><td style="font-weight:600;color:#dc2626">${recent.length} in 10 min</td></tr>
              <tr><td style="color:#6b7280;padding:3px 0">Detected at</td><td style="font-weight:600;color:#111827">${new Date().toUTCString()}</td></tr>
            </table>
          </div>
          <p style="font-size:13px;color:#6b7280">Further attempts from this IP have been blocked for the next 10 minutes. Review the audit log in your admin panel for details.</p>
          <p style="font-size:12px;color:#94a3b8;margin-top:24px">Aperti Security System · This is an automated alert</p>
        </div>`,
    });
  } catch { /* email not configured — alert is in audit log */ }
}

async function recordLoginHistory(
  accountId: number | null,
  username: string,
  req: Request,
  success: boolean,
  failureReason?: string,
) {
  try {
    const { pool } = await import("@workspace/db");
    await pool.query(
      `INSERT INTO login_history (account_id, username, ip, user_agent, success, failure_reason, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
      [accountId, username, req.ip, req.headers["user-agent"] ?? null, success, failureReason ?? null],
    );
  } catch {
    // non-critical
  }
}

// POST /auth/login
authRouter.post("/login", loginLimiter, async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/json");
  try {
    const { username, password, deviceId, ip, userAgent } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }
    if (typeof username !== "string" || username.length > 200) {
      return res.status(400).json({ error: "Invalid username" });
    }
    if (typeof password !== "string" || password.length > 500) {
      return res.status(400).json({ error: "Invalid password" });
    }
    const identifier = username.trim().toLowerCase();
    const { pool: dbPool } = await import("@workspace/db");
    const { rows: acctRows } = await dbPool.query(
      "SELECT * FROM accounts WHERE (username=$1 OR LOWER(email)=$1) LIMIT 1",
      [identifier]
    );
    const account = acctRows[0] as any;

    // Suspended accounts get a clear, specific error — not a generic 401
    if (account && account.status === "suspended") {
      await recordLoginHistory(account.id, identifier, req, false, "Account suspended");
      writeAudit({ accountId: account.id, action: "login_failed", resource: "auth", details: { reason: "Account suspended" }, ipAddress: req.ip, userAgent: req.headers["user-agent"] as string, severity: "warning" });
      checkAndMaybeAlert(req.ip || "unknown").catch(() => {});
      return res.status(403).json({ error: "Your account has been suspended. Please contact your administrator.", suspended: true });
    }

    if (!account || account.status !== "active") {
      await recordLoginHistory(null, identifier, req, false, "Account not found or inactive");
      writeAudit({ action: "login_failed", resource: "auth", details: { identifier, reason: "Account not found or inactive" }, ipAddress: req.ip, userAgent: req.headers["user-agent"] as string, severity: "warning" });
      checkAndMaybeAlert(req.ip || "unknown").catch(() => {});
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const valid = await bcrypt.compare(password, account.password_hash);
    if (!valid) {
      await recordLoginHistory(account.id, identifier, req, false, "Wrong password");
      writeAudit({ accountId: account.id, action: "login_failed", resource: "auth", details: { reason: "Wrong password" }, ipAddress: req.ip, userAgent: req.headers["user-agent"] as string, severity: "warning" });
      checkAndMaybeAlert(req.ip || "unknown").catch(() => {});
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // ── MFA mandatory for admin and teacher: block login if not configured ───
    const MFA_ENFORCED_ROLES = ["admin", "teacher"];
    if (MFA_ENFORCED_ROLES.includes(account.role) && (!account.mfa_enabled || !account.mfa_secret)) {
      const setupToken = jwt.sign(
        { id: account.id, role: account.role, stage: "mfa_setup" },
        JWT_SECRET,
        { expiresIn: "15m" },
      );
      writeAudit({ accountId: account.id, action: "mfa_setup_required", resource: "auth", details: { role: account.role }, ipAddress: req.ip, userAgent: req.headers["user-agent"] as string, severity: "warning" });
      return res.status(403).json({
        mfa_setup_required: true,
        setup_token: setupToken,
        message: "Multi-factor authentication is required for your role. Please set up MFA to continue.",
      });
    }

    // ── MFA gate: if MFA is enabled, do NOT issue a full JWT yet ─────────────
    if (account.mfa_enabled && account.mfa_secret) {
      const preAuthToken = jwt.sign(
        { id: account.id, role: account.role, stage: "mfa_pending" },
        JWT_SECRET,
        { expiresIn: "5m" },
      );
      return res.json({ mfa_required: true, pre_auth_token: preAuthToken });
    }

    // ── Device session limit: max 2 concurrent devices per account ────────────
    if (deviceId) {
      const existing = await db
        .select({ deviceId: deviceSessionsTable.deviceId })
        .from(deviceSessionsTable)
        .where(eq(deviceSessionsTable.accountId, account.id));
      const alreadyRegistered = existing.some((s) => s.deviceId === deviceId);
      if (!alreadyRegistered && existing.length >= 2) {
        return res.status(403).json({
          error: "You're already signed in on 2 devices. Please sign out from another device first.",
          deviceLimitReached: true,
        });
      }
    }

    // Update last login
    await dbPool.query("UPDATE accounts SET last_login_at=NOW() WHERE id=$1", [account.id]).catch(() => {});

    await recordLoginHistory(account.id, identifier, req, true);

    const isProduction = process.env.NODE_ENV === "production";
    const token = jwt.sign({ id: account.id, role: account.role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    res.cookie("aperti_token", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });
    if (deviceId) {
      await db.insert(deviceSessionsTable).values({
        accountId: account.id,
        deviceId,
        ip: ip || req.ip,
        userAgent: userAgent || req.headers["user-agent"],
        lastActiveAt: new Date(),
      }).onConflictDoNothing();
    }
    audit({ actorId: account.id, actorRole: account.role, action: "AUTH_LOGIN", resource: "auth", ip: req.ip, userAgent: req.headers["user-agent"] as string }).catch(() => {});
    eventBus.emit_event("auth.login", { userId: account.id, role: account.role, ip: req.ip ?? null }, { actorId: account.id, actorRole: account.role }).catch(() => {});
    dbPool.query(
      `INSERT INTO device_login_log (account_id, device, browser, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        account.id,
        userAgent ? userAgent.substring(0, 120) : (req.headers["user-agent"] || "").substring(0, 120),
        null,
        ip || req.ip,
        (req.headers["user-agent"] || "").substring(0, 255),
      ]
    ).catch(() => {});
    res.json({
      token,
      user: safeUser(account as unknown as Record<string, unknown>),
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /auth/mfa-challenge – verify TOTP and exchange pre-auth token for full JWT
authRouter.post("/mfa-challenge", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/json");
  try {
    const { pre_auth_token, token } = req.body;
    if (!pre_auth_token || !token) {
      return res.status(400).json({ error: "pre_auth_token and token are required" });
    }

    let payload: any;
    try {
      payload = jwt.verify(pre_auth_token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: "Invalid or expired pre-auth token" });
    }

    if (!payload || payload.stage !== "mfa_pending" || !payload.id) {
      return res.status(401).json({ error: "Invalid pre-auth token" });
    }

    const { pool: dbPool } = await import("@workspace/db");
    const { rows } = await dbPool.query(
      "SELECT * FROM accounts WHERE id=$1 AND status='active' LIMIT 1",
      [payload.id],
    );
    if (!rows.length) {
      return res.status(401).json({ error: "Account not found or inactive" });
    }
    const account = rows[0] as any;

    if (!account.mfa_enabled || !account.mfa_secret) {
      return res.status(400).json({ error: "MFA not configured for this account" });
    }

    const { decryptField, verifyTotp } = await import("../lib/mfa");
    const secret = decryptField(account.mfa_secret);
    if (!verifyTotp(secret, String(token))) {
      writeAudit({ accountId: account.id, action: "mfa_failed", resource: "auth", ipAddress: req.ip, userAgent: req.headers["user-agent"] as string, severity: "warning" });
      return res.status(401).json({ error: "Invalid or expired MFA code" });
    }

    const isProduction = process.env.NODE_ENV === "production";
    const fullToken = jwt.sign({ id: account.id, role: account.role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    res.cookie("aperti_token", fullToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    await dbPool.query("UPDATE accounts SET last_login_at=NOW() WHERE id=$1", [account.id]).catch(() => {});
    audit({ actorId: account.id, actorRole: account.role, action: "AUTH_MFA_SUCCESS", resource: "auth", ip: req.ip, userAgent: req.headers["user-agent"] as string }).catch(() => {});
    eventBus.emit_event("auth.mfa_success", { userId: account.id, role: account.role, ip: req.ip ?? null }, { actorId: account.id, actorRole: account.role }).catch(() => {});

    res.json({ token: fullToken, user: safeUser(account as unknown as Record<string, unknown>) });
  } catch (err) {
    console.error("MFA challenge error:", err);
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

// GET /auth/me – validate token (accepts cookie or Authorization header)
authRouter.get("/me", async (req: Request, res: Response) => {
  const cookieToken = (req as any).cookies?.aperti_token as string | undefined;
  const header = req.headers.authorization;
  const raw = cookieToken || (header?.startsWith("Bearer ") ? header.slice(7) : null);
  if (!raw) return res.status(401).json({ error: "Unauthorized" });
  try {
    const payload = jwt.verify(raw, JWT_SECRET) as any;
    const { pool: dbPool } = await import("@workspace/db");
    const { rows } = await dbPool.query(
      `SELECT id, username, display_name, email, role, avatar_url, bio, phone, country, first_name, last_name, status, mfa_enabled, must_change_password FROM accounts WHERE id=$1`,
      [payload.id]
    );
    if (!rows.length) return res.status(401).json({ error: "User not found" });
    const acct = rows[0] as any;
    res.json({
      user: {
        id: acct.id,
        username: acct.username,
        displayName: acct.display_name,
        email: acct.email,
        role: acct.role,
        avatarUrl: acct.avatar_url,
        bio: acct.bio,
        country: acct.country,
        mfaEnabled: acct.mfa_enabled ?? false,
        mustChangePassword: acct.must_change_password ?? false,
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
    const cookieToken = (req as any).cookies?.aperti_token as string | undefined;
    const header = req.headers.authorization;
    const raw = cookieToken || (header?.startsWith("Bearer ") ? header.slice(7) : null);
    if (raw) {
      try {
        const payload = jwt.verify(raw, JWT_SECRET) as any;
        audit({ actorId: payload.id, actorRole: payload.role ?? "unknown", action: "AUTH_LOGOUT", resource: "auth", ip: req.ip, userAgent: req.headers["user-agent"] as string }).catch(() => {});
        eventBus.emit_event("auth.logout", { userId: payload.id, role: payload.role ?? null, ip: req.ip ?? null }, { actorId: payload.id, actorRole: payload.role }).catch(() => {});
      } catch { /* token already expired — still allow logout */ }
    }
  } catch {
    // ignore logout errors
  }
  const isProduction = process.env.NODE_ENV === "production";
  res.clearCookie("aperti_token", { httpOnly: true, secure: isProduction, sameSite: isProduction ? "none" : "lax", path: "/" });
  res.json({ success: true });
});

// POST /auth/audit-event — any authenticated user can report a client-side security event
authRouter.post("/audit-event", authenticate as any, async (req: AuthRequest, res: Response) => {
  try {
    const { action, resource, details } = req.body;
    if (!action || !resource) { res.status(400).json({ error: "action and resource are required" }); return; }
    const allowed = ["access_denied", "logout"];
    if (!allowed.includes(action)) { res.status(400).json({ error: "Unknown audit action" }); return; }
    writeAudit({
      accountId: req.userId,
      action,
      resource: String(resource).slice(0, 200),
      details: details ?? null,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] as string,
      severity: action === "access_denied" ? "warning" : "info",
    });
    res.json({ ok: true });
  } catch {
    res.json({ ok: true }); // never surface errors for audit writes
  }
});

// GET /auth/stats — public platform statistics
authRouter.get("/stats", async (_req: Request, res: Response) => {
  try {
    const { pool } = await import("@workspace/db");
    const [students, teachers, courses, attendance] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM accounts WHERE role='student' AND status='active'`),
      pool.query(`SELECT COUNT(*) FROM accounts WHERE role IN ('teacher','admin','assistant') AND status='active'`),
      pool.query(`SELECT COUNT(*) FROM aperti_courses WHERE is_published=TRUE`),
      pool.query(`SELECT COUNT(*) FROM attendance`),
    ]);
    res.json({
      activeStudents: parseInt(students.rows[0].count),
      activeTeachers: parseInt(teachers.rows[0].count),
      publishedCourses: parseInt(courses.rows[0].count),
      attendanceRecords: parseInt(attendance.rows[0].count),
    });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// GET /auth/public-teachers — list teachers for student registration
authRouter.get("/public-teachers", async (_req: Request, res: Response) => {
  try {
    const { rows } = await (await import("@workspace/db")).pool.query(
      `SELECT id, display_name, username FROM accounts WHERE role IN ('teacher','assistant') AND status='active' ORDER BY display_name ASC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch teachers" });
  }
});

// POST /auth/student-register — student self-registration (requires teacher approval)
authRouter.post("/student-register", registerLimiter, async (req: Request, res: Response) => {
  try {
    const { username, password, displayName, email, teacherId } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password are required" });
    if (typeof username !== "string" || username.length > 200) return res.status(400).json({ error: "Invalid username" });
    if (typeof password !== "string" || password.length > 500) return res.status(400).json({ error: "Invalid password" });
    const pwErr = validatePasswordComplexity(password);
    if (pwErr) return res.status(400).json({ error: pwErr });
    if (!teacherId) return res.status(400).json({ error: "Please select a teacher" });

    const { rows: teacherRows } = await (await import("@workspace/db")).pool.query(
      "SELECT id FROM accounts WHERE id=$1 AND role IN ('teacher','admin','assistant') AND status='active'",
      [parseInt(teacherId)]
    );
    if (!teacherRows.length) return res.status(404).json({ error: "Teacher not found" });

    const [existing] = await db.select().from(accountsTable).where(eq(accountsTable.username, username.trim().toLowerCase())).limit(1);
    if (existing) return res.status(409).json({ error: "Username already taken — please choose another" });

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await (await import("@workspace/db")).pool.query(
      `INSERT INTO accounts (username, password_hash, display_name, email, role, status, teacher_account_id, created_at)
       VALUES ($1, $2, $3, $4, 'student', 'pending', $5, NOW()) RETURNING id, username, role, status`,
      [username.trim().toLowerCase(), hash, displayName || username, email || null, parseInt(teacherId)]
    );
    res.status(201).json({ message: "Registration submitted. Awaiting teacher approval.", user: rows[0] });
  } catch (err: any) {
    console.error("Student register error:", err);
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

// Seed admin email on startup
(async () => {
  const { pool: dbPool } = await import("@workspace/db");
  await dbPool.query(
    `UPDATE accounts SET email='admin@aperti.ai' WHERE username='admin' AND (email IS NULL OR email='')`
  ).catch(() => {});
})();

// POST /auth/register — unified registration for all public roles
authRouter.post("/register", registerLimiter, async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, username: rawUsername, email, password, role, country, phone } = req.body;
    if (!email?.trim() || !password) return res.status(400).json({ error: "Email and password are required" });
    const validRoles = ["teacher", "student", "parent"];
    if (!validRoles.includes(role || "")) return res.status(400).json({ error: "Role must be teacher, student, or parent" });
    const pwErr2 = validatePasswordComplexity(password);
    if (pwErr2) return res.status(400).json({ error: pwErr2 });

    const { pool: dbPool } = await import("@workspace/db");

    // Determine username: use provided one, or auto-generate from email
    let username: string;
    if (rawUsername?.trim()) {
      username = rawUsername.trim().toLowerCase();
      if (!/^[a-z0-9_]{3,20}$/.test(username)) {
        return res.status(400).json({ error: "Username must be 3–20 characters (letters, numbers, underscores only)" });
      }
      // Check username uniqueness
      const { rows: usernameCheck } = await dbPool.query(
        "SELECT id FROM accounts WHERE username=$1 LIMIT 1",
        [username]
      );
      if (usernameCheck.length) return res.status(409).json({ error: "Username already taken — please choose another" });
    } else {
      const base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 14) || "user";
      username = base + "_" + Date.now().toString(36);
    }

    const { rows: existing } = await dbPool.query(
      "SELECT id FROM accounts WHERE LOWER(email)=$1 LIMIT 1",
      [email.toLowerCase().trim()]
    );
    if (existing.length) return res.status(409).json({ error: "An account with this email already exists" });

    const displayName = `${(firstName || "").trim()} ${(lastName || "").trim()}`.trim() || email.split("@")[0];
    const hash = await bcrypt.hash(password, 12);

    const { rows } = await dbPool.query(
      `INSERT INTO accounts (username, password_hash, display_name, email, role, status, country, phone, first_name, last_name, created_at)
       VALUES ($1,$2,$3,$4,$5,'active',$6,$7,$8,$9,NOW())
       RETURNING id, username, email, role, status, display_name`,
      [username, hash, displayName, email.toLowerCase().trim(), role, country || null, phone || null, firstName?.trim() || null, lastName?.trim() || null]
    );

    await dbPool.query(
      `INSERT INTO onboarding_progress (account_id, current_step, completed) VALUES ($1,1,false) ON CONFLICT DO NOTHING`,
      [rows[0].id]
    ).catch(() => {});

    const { referralCode } = req.body;
    if (referralCode && typeof referralCode === "string") {
      const normalizedRef = referralCode.toUpperCase().trim();
      await dbPool.query(
        "SELECT id FROM accounts WHERE referral_code = $1 AND id != $2 LIMIT 1",
        [normalizedRef, rows[0].id]
      ).then(({ rows: refRows }) => {
        if (refRows.length > 0) {
          return dbPool.query(
            "INSERT INTO referrals (referrer_id, referred_id, code, status, activated_at) VALUES ($1,$2,$3,'active',NOW())",
            [refRows[0].id, rows[0].id, normalizedRef]
          );
        }
      }).catch(() => {});
    }

    const token = jwt.sign({ id: rows[0].id, role: rows[0].role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    res.status(201).json({
      token,
      user: { id: rows[0].id, username: rows[0].username, email: rows[0].email, displayName: rows[0].display_name, role: rows[0].role },
    });
  } catch (err: any) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({ error: "Too many reset requests. Please try again in 15 minutes." });
  },
});

// POST /auth/forgot-password — email-based reset when SMTP configured, else admin-assisted
authRouter.post("/forgot-password", forgotPasswordLimiter, async (req: Request, res: Response) => {
  const { email, username } = req.body;
  if (!email?.trim() && !username?.trim()) {
    return res.status(400).json({ error: "Email or username is required" });
  }
  // Always return the same message regardless of whether the account exists (timing-safe)
  const SAFE_EMAIL = { message: "If an account with that email exists, a password reset link has been sent." };
  const SAFE_ADMIN = { message: "Your request has been submitted. An administrator will reset your password and provide you with a temporary one shortly." };
  try {
    const { pool: dbPool } = await import("@workspace/db");
    let account: any = null;
    if (email?.trim()) {
      const { rows } = await dbPool.query(
        "SELECT id, email, username, display_name FROM accounts WHERE LOWER(email)=$1 AND status='active' LIMIT 1",
        [email.toLowerCase().trim()]
      );
      account = rows[0] ?? null;
    }
    if (!account && username?.trim()) {
      const { rows } = await dbPool.query(
        "SELECT id, email, username, display_name FROM accounts WHERE LOWER(username)=$1 AND status='active' LIMIT 1",
        [username.toLowerCase().trim()]
      );
      account = rows[0] ?? null;
    }

    if (account) {
      if (SMTP_CONFIGURED && account.email) {
        // Email-based flow: generate a secure token, store it, send email
        const resetToken = randomBytes(32).toString("hex");
        const expiryMinutes = 120;
        await dbPool.query(
          `INSERT INTO password_reset_tokens (account_id, token, expires_at, created_at)
           VALUES ($1, $2, NOW() + INTERVAL '${expiryMinutes} minutes', NOW())
           ON CONFLICT DO NOTHING`,
          [account.id, resetToken]
        ).catch(async () => {
          // If token table doesn't exist yet, create it
          await dbPool.query(`
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
              id SERIAL PRIMARY KEY,
              account_id INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
              token TEXT NOT NULL UNIQUE,
              used_at TIMESTAMPTZ,
              expires_at TIMESTAMPTZ NOT NULL,
              created_at TIMESTAMPTZ DEFAULT NOW()
            )
          `);
          await dbPool.query(
            `INSERT INTO password_reset_tokens (account_id, token, expires_at, created_at)
             VALUES ($1, $2, NOW() + INTERVAL '${expiryMinutes} minutes', NOW())`,
            [account.id, resetToken]
          );
        });

        const publicUrl = process.env.PUBLIC_URL ?? "https://aperti.ai";
        const resetUrl = `${publicUrl}/reset-password?token=${resetToken}`;
        const { html, text } = buildPasswordResetEmail({
          displayName: account.display_name ?? account.username,
          resetUrl,
          expiryMinutes,
        });

        await sendEmail({
          to: account.email,
          subject: "Reset your Aperti password",
          html,
          text,
        }).catch(err => console.error("[forgot-password] Email send failed:", err));

        res.json(SAFE_EMAIL);
      } else {
        // Admin-assisted fallback when SMTP is not configured
        await dbPool.query(
          `INSERT INTO password_reset_requests (account_id, email, username, status, created_at)
           VALUES ($1, $2, $3, 'pending', NOW())`,
          [account.id, account.email ?? email?.trim() ?? null, account.username ?? username?.trim() ?? null]
        );
        res.json(SAFE_ADMIN);
      }
    } else {
      // Account not found — still return safe message
      res.json(SMTP_CONFIGURED ? SAFE_EMAIL : SAFE_ADMIN);
    }
  } catch (err) {
    console.error("Forgot password error:", err);
    res.json(SMTP_CONFIGURED ? SAFE_EMAIL : SAFE_ADMIN);
  }
});

// POST /auth/reset-password
authRouter.post("/reset-password", async (req: Request, res: Response) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: "Token and new password are required" });
  const pwResetErr = validatePasswordComplexity(password);
  if (pwResetErr) return res.status(400).json({ error: pwResetErr });
  try {
    const { pool: dbPool } = await import("@workspace/db");
    const { rows } = await dbPool.query(
      `SELECT * FROM password_reset_tokens WHERE token=$1 AND used_at IS NULL AND expires_at > NOW() LIMIT 1`,
      [token]
    );
    if (!rows.length) return res.status(400).json({ error: "This reset link is invalid or has expired. Please request a new one." });
    const record = rows[0] as any;
    const hash = await bcrypt.hash(password, 12);
    await dbPool.query("UPDATE accounts SET password_hash=$1 WHERE id=$2", [hash, record.account_id]);
    await dbPool.query("UPDATE password_reset_tokens SET used_at=NOW() WHERE id=$1", [record.id]);
    res.json({ message: "Password updated successfully. You can now sign in." });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Failed to reset password. Please try again." });
  }
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

// GET /auth/login-history (admin)
authRouter.get("/login-history", async (req: Request, res: Response) => {
  try {
    const { pool: dbPool } = await import("@workspace/db");
    const { rows } = await dbPool.query(
      `SELECT lh.*, a.display_name FROM login_history lh
       LEFT JOIN accounts a ON a.id = lh.account_id
       ORDER BY lh.created_at DESC LIMIT 100`
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// GET /auth/devices — list all active device sessions for the current user
authRouter.get("/devices", authenticate as any, async (req: AuthRequest, res: Response) => {
  try {
    const currentDeviceId = req.headers["x-device-id"] as string | undefined;
    const sessions = await db
      .select()
      .from(deviceSessionsTable)
      .where(eq(deviceSessionsTable.accountId, req.userId!));
    const result = sessions.map(s => ({
      id: s.id,
      deviceId: s.deviceId,
      ip: s.ip,
      userAgent: s.userAgent,
      lastActiveAt: s.lastActiveAt,
      createdAt: s.createdAt,
      isCurrent: currentDeviceId ? s.deviceId === currentDeviceId : false,
    }));
    res.json(result);
  } catch (err) {
    console.error("Devices list error:", err);
    res.status(500).json({ error: "Failed to fetch device sessions" });
  }
});

// DELETE /auth/devices/:deviceId — revoke a specific device session
authRouter.delete("/devices/:deviceId", authenticate as any, async (req: AuthRequest, res: Response) => {
  try {
    const { deviceId } = req.params;
    await db.delete(deviceSessionsTable).where(
      eq(deviceSessionsTable.deviceId, deviceId as string)
    );
    writeAudit({
      accountId: req.userId,
      action: "device_session_revoked",
      resource: "auth",
      details: { deviceId },
      ipAddress: req.ip,
      severity: "info",
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to revoke session" });
  }
});

// DELETE /auth/devices — revoke ALL device sessions except current
authRouter.delete("/devices", authenticate as any, async (req: AuthRequest, res: Response) => {
  try {
    const currentDeviceId = req.body?.currentDeviceId as string | undefined;
    if (currentDeviceId) {
      const { ne } = await import("drizzle-orm");
      await db.delete(deviceSessionsTable).where(
        ne(deviceSessionsTable.deviceId, currentDeviceId)
      );
    } else {
      await db.delete(deviceSessionsTable).where(
        eq(deviceSessionsTable.accountId, req.userId!)
      );
    }
    writeAudit({
      accountId: req.userId,
      action: "all_devices_revoked",
      resource: "auth",
      ipAddress: req.ip,
      severity: "warning",
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to revoke sessions" });
  }
});

const isProduction = process.env.NODE_ENV === "production";

authRouter.get("/google", (req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    const base = process.env.PUBLIC_URL ?? `${req.protocol}://${req.host}`;
    res.redirect(`${base}/login?error=google_not_configured`);
    return;
  }
  const state = crypto.randomUUID();
  res.cookie("oauth_state", state, { httpOnly: true, secure: isProduction, sameSite: "lax", maxAge: 10 * 60 * 1000 });
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? `${req.protocol}://${req.host}/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

authRouter.get("/google/callback", async (req: Request, res: Response) => {
  const { code, state, error: oauthError } = req.query as Record<string, string>;
  const cookieState = (req as any).cookies?.["oauth_state"];
  res.clearCookie("oauth_state");
  const frontendBase = process.env.PUBLIC_URL ?? `${req.protocol}://${req.host}`;
  if (oauthError || !code) {
    res.redirect(`${frontendBase}/login?error=google_cancelled`);
    return;
  }
  if (!state || state !== cookieState) {
    res.redirect(`${frontendBase}/login?error=invalid_state`);
    return;
  }
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? `${req.protocol}://${req.host}/auth/google/callback`;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });
    if (!tokenRes.ok) { res.redirect(`${frontendBase}/login?error=google_token_failed`); return; }
    const tokenData = await tokenRes.json() as { access_token: string };
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userInfoRes.ok) { res.redirect(`${frontendBase}/login?error=google_userinfo_failed`); return; }
    const googleUser = await userInfoRes.json() as { sub: string; email: string; name: string; picture?: string; email_verified: boolean };
    if (!googleUser.email_verified) { res.redirect(`${frontendBase}/login?error=google_email_unverified`); return; }
    const { rows } = await pool.query(
      `SELECT * FROM accounts WHERE google_id = $1 OR (email = $2 AND email IS NOT NULL) ORDER BY (google_id = $1) DESC LIMIT 1`,
      [googleUser.sub, googleUser.email],
    );
    let account = rows[0];
    let isNew = false;
    if (!account) {
      isNew = true;
      const base = googleUser.email.split("@")[0].replace(/[^a-z0-9_]/gi, "").toLowerCase().substring(0, 20) || "user";
      const { rows: existRows } = await pool.query(`SELECT username FROM accounts WHERE username LIKE $1`, [`${base}%`]);
      const taken = new Set(existRows.map((r: any) => r.username));
      let username = base;
      let n = 1;
      while (taken.has(username)) username = `${base}${n++}`;
      const { rows: newRows } = await pool.query(
        `INSERT INTO accounts (username, password_hash, display_name, email, role, status, google_id, avatar_url, email_verified, created_at)
         VALUES ($1,$2,$3,$4,'teacher','active',$5,$6,true,NOW()) RETURNING *`,
        [username, "oauth:google", googleUser.name, googleUser.email, googleUser.sub, googleUser.picture ?? null],
      );
      account = newRows[0];
    } else {
      await pool.query(
        `UPDATE accounts SET google_id = COALESCE(google_id, $2), avatar_url = COALESCE(avatar_url, $3), last_login_at = NOW() WHERE id = $1`,
        [account.id, googleUser.sub, googleUser.picture ?? null],
      );
    }
    if (account.status !== "active") { res.redirect(`${frontendBase}/login?error=account_suspended`); return; }
    const token = jwt.sign({ id: account.id, role: account.role, username: account.username }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    res.cookie("aperti_token", token, { httpOnly: true, secure: isProduction, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });
    writeAudit({ accountId: account.id, action: "LOGIN_GOOGLE", resource: "auth", ipAddress: req.ip, userAgent: req.headers["user-agent"] as string, severity: "info" });
    const dest = isNew ? "/onboarding" : (account.role === "admin" || account.role === "super_admin" ? "/admin/command" : "/");
    res.redirect(`${frontendBase}${dest}`);
  } catch (err) {
    console.error("[OAuth] Google error:", err);
    res.redirect(`${frontendBase}/login?error=google_error`);
  }
});
