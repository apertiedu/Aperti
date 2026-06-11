import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { accountsTable, deviceSessionsTable } from "@workspace/db";

const JWT_SECRET = process.env.JWT_SECRET || "aperti-dev-secret-change-in-prod";
const TOKEN_EXPIRY = "7d";

export const authRouter = Router();

// ── Login rate limiter: 10 attempts per minute per IP ─────────────────────────
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts — please wait a minute" },
});

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
  try {
    const { username, password, deviceId, ip, userAgent } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }
    const identifier = username.trim().toLowerCase();
    const { pool: dbPool } = await import("@workspace/db");
    const { rows: acctRows } = await dbPool.query(
      "SELECT * FROM accounts WHERE (username=$1 OR LOWER(email)=$1) LIMIT 1",
      [identifier]
    );
    const account = acctRows[0] as any;
    if (!account || account.status !== "active") {
      await recordLoginHistory(null, identifier, req, false, "Account not found or inactive");
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const valid = await bcrypt.compare(password, account.password_hash);
    if (!valid) {
      await recordLoginHistory(account.id, identifier, req, false, "Wrong password");
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Update last login
    await dbPool.query("UPDATE accounts SET last_login_at=NOW() WHERE id=$1", [account.id]).catch(() => {});

    await recordLoginHistory(account.id, identifier, req, true);

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
        displayName: account.display_name,
        email: account.email,
        role: account.role,
        mfaEnabled: account.mfa_enabled ?? false,
        mustChangePassword: account.must_change_password ?? false,
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
  } catch {
    // ignore logout errors
  }
  res.json({ success: true });
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
    res.status(500).json({ error: err.message });
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
authRouter.post("/student-register", async (req: Request, res: Response) => {
  try {
    const { username, password, displayName, email, teacherId } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password are required" });
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
authRouter.post("/register", async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, username: rawUsername, email, password, role, country, phone } = req.body;
    if (!email?.trim() || !password) return res.status(400).json({ error: "Email and password are required" });
    const validRoles = ["teacher", "student", "parent"];
    if (!validRoles.includes(role || "")) return res.status(400).json({ error: "Role must be teacher, student, or parent" });
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

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

// POST /auth/forgot-password
authRouter.post("/forgot-password", async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email?.trim()) return res.status(400).json({ error: "Email is required" });
  const SAFE = { message: "If an account with that email exists, a password reset link has been sent." };
  try {
    const { pool: dbPool } = await import("@workspace/db");
    const { rows } = await dbPool.query(
      "SELECT id, email, display_name FROM accounts WHERE LOWER(email)=$1 AND status='active' LIMIT 1",
      [email.toLowerCase().trim()]
    );
    if (!rows.length) return res.json(SAFE);
    const account = rows[0] as any;

    const crypto = await import("crypto");
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await dbPool.query(
      `INSERT INTO password_reset_tokens (account_id, token, expires_at) VALUES ($1, $2, $3)`,
      [account.id, token, expires]
    );

    const appUrl = process.env.APP_URL || `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
    const resetLink = `${appUrl}/reset-password?token=${token}`;

    try {
      const { sendEmail } = await import("../lib/email");
      await sendEmail({
        to: account.email,
        subject: "Reset your Aperti password",
        html: `
          <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1e293b">
            <h1 style="font-size:22px;font-weight:800;margin:0 0 8px">Aperti<span style="color:#00796B">.</span></h1>
            <p style="color:#64748b;margin:0 0 24px;font-size:14px">Where every mind finds its rhythm.</p>
            <h2 style="font-size:18px;font-weight:700;margin:0 0 12px">Reset your password</h2>
            <p style="font-size:15px;margin:0 0 24px">Hi ${account.display_name || "there"},<br><br>
            We received a request to reset the password for your Aperti account. Click the button below to choose a new password. This link expires in <strong>1 hour</strong>.</p>
            <a href="${resetLink}" style="display:inline-block;background:#00796B;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 28px;border-radius:10px">Reset Password</a>
            <p style="font-size:13px;color:#94a3b8;margin:24px 0 0">If you didn't request this, you can safely ignore this email — your password won't change.<br><br>
            Or copy this link: <a href="${resetLink}" style="color:#00796B;word-break:break-all">${resetLink}</a></p>
          </div>`,
      });
    } catch {
      // Email send failed (not configured) — still return success to avoid leaking info
    }

    res.json(SAFE);
  } catch (err) {
    console.error("Forgot password error:", err);
    res.json(SAFE); // always return safe message
  }
});

// POST /auth/reset-password
authRouter.post("/reset-password", async (req: Request, res: Response) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: "Token and new password are required" });
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
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
    res.status(500).json({ error: err.message });
  }
});
