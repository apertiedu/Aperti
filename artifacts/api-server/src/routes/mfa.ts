import { Router, Request, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { pool } from "@workspace/db";
import { generateSecret, generateTotpUri, verifyTotp, encryptField, decryptField } from "../lib/mfa";
import { randomBytes, createHash } from "crypto";
import { auditFromReq } from "../lib/audit";

export const mfaRouter = Router();

function generateRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () => randomBytes(5).toString("hex").toUpperCase());
}

function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

mfaRouter.post("/setup", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { rows } = await pool.query(
      "SELECT username, email, mfa_enabled FROM accounts WHERE id=$1",
      [userId],
    );
    if (!rows.length) return res.status(404).json({ error: "User not found" });
    const user = rows[0];
    if (user.mfa_enabled) return res.status(400).json({ error: "MFA is already enabled" });

    const secret = generateSecret();
    const encrypted = encryptField(secret);

    await pool.query("UPDATE accounts SET mfa_secret=$1 WHERE id=$2", [encrypted, userId]);

    const label = user.email || user.username;
    const uri = generateTotpUri(secret, label);

    res.json({ secret, uri, message: "Scan this QR with your authenticator app, then verify with /mfa/verify" });
  } catch {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

mfaRouter.post("/verify", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "token is required" });

    const { rows } = await pool.query(
      "SELECT mfa_secret, mfa_enabled FROM accounts WHERE id=$1",
      [req.userId],
    );
    if (!rows.length) return res.status(404).json({ error: "User not found" });

    const { mfa_secret, mfa_enabled } = rows[0];
    if (!mfa_secret) return res.status(400).json({ error: "Run /mfa/setup first" });
    if (mfa_enabled) return res.status(400).json({ error: "MFA already enabled" });

    const secret = decryptField(mfa_secret);
    if (!verifyTotp(secret, String(token))) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    await pool.query("UPDATE accounts SET mfa_enabled=true WHERE id=$1", [req.userId]);
    auditFromReq(req, "AUTH_MFA_SUCCESS", "mfa", { resourceId: req.userId, metadata: { event: "mfa_enabled" } });
    res.json({ success: true, message: "MFA enabled successfully" });
  } catch {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

mfaRouter.post("/disable", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.body;
    const { rows } = await pool.query(
      "SELECT mfa_secret, mfa_enabled FROM accounts WHERE id=$1",
      [req.userId],
    );
    if (!rows.length) return res.status(404).json({ error: "User not found" });
    if (!rows[0].mfa_enabled) return res.status(400).json({ error: "MFA is not enabled" });

    const secret = decryptField(rows[0].mfa_secret);
    if (!verifyTotp(secret, String(token))) {
      auditFromReq(req, "AUTH_MFA_FAILED", "mfa", { resourceId: req.userId, result: "blocked" });
      return res.status(401).json({ error: "Invalid token" });
    }

    await pool.query("UPDATE accounts SET mfa_enabled=false, mfa_secret=NULL WHERE id=$1", [req.userId]);
    await pool.query("DELETE FROM mfa_recovery_codes WHERE account_id=$1", [req.userId]);
    auditFromReq(req, "AUTH_MFA_SUCCESS", "mfa", { resourceId: req.userId, severity: "warn", metadata: { event: "mfa_disabled" } });
    res.json({ success: true, message: "MFA disabled" });
  } catch {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

mfaRouter.get("/status", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      "SELECT mfa_enabled FROM accounts WHERE id=$1",
      [req.userId],
    );
    const { rows: rcRows } = await pool.query(
      "SELECT COUNT(*) FROM mfa_recovery_codes WHERE account_id=$1 AND used_at IS NULL",
      [req.userId],
    );
    res.json({
      mfaEnabled: rows[0]?.mfa_enabled ?? false,
      recoveryCodesRemaining: parseInt(rcRows[0]?.count ?? "0", 10),
    });
  } catch {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

mfaRouter.post("/recovery-codes/generate", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { rows } = await pool.query("SELECT mfa_enabled FROM accounts WHERE id=$1", [userId]);
    if (!rows.length) return res.status(404).json({ error: "User not found" });
    if (!rows[0].mfa_enabled) return res.status(400).json({ error: "MFA must be enabled before generating recovery codes" });

    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "TOTP token required to generate recovery codes" });

    const { rows: secretRows } = await pool.query("SELECT mfa_secret FROM accounts WHERE id=$1", [userId]);
    const secret = decryptField(secretRows[0].mfa_secret);
    if (!verifyTotp(secret, String(token))) {
      auditFromReq(req, "AUTH_MFA_FAILED", "mfa_recovery", { resourceId: userId, result: "blocked" });
      return res.status(401).json({ error: "Invalid TOTP token" });
    }

    const codes = generateRecoveryCodes(8);

    await pool.query("DELETE FROM mfa_recovery_codes WHERE account_id=$1", [userId]);
    for (const code of codes) {
      await pool.query(
        "INSERT INTO mfa_recovery_codes (account_id, code_hash, created_at) VALUES ($1,$2,NOW())",
        [userId, hashRecoveryCode(code)],
      );
    }

    auditFromReq(req, "AUTH_MFA_SUCCESS", "mfa_recovery", { resourceId: userId, severity: "warn", metadata: { event: "recovery_codes_generated" } });
    res.json({
      codes,
      message: "Store these codes securely. Each code can only be used once. They will not be shown again.",
    });
  } catch {
    res.status(500).json({ error: "Failed to generate recovery codes" });
  }
});

mfaRouter.post("/recovery-codes/use", async (req: Request, res: Response) => {
  try {
    const { username, password, recoveryCode } = req.body;
    if (!username || !password || !recoveryCode) {
      return res.status(400).json({ error: "username, password, and recoveryCode are required" });
    }

    const { rows: acctRows } = await pool.query(
      "SELECT id, password_hash, role, status, mfa_enabled FROM accounts WHERE (username=$1 OR LOWER(email)=$1) LIMIT 1",
      [String(username).trim().toLowerCase()],
    );
    const account = acctRows[0];
    if (!account || account.status !== "active") {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const validPwd = await (await import("bcryptjs")).compare(password, account.password_hash);
    if (!validPwd) return res.status(401).json({ error: "Invalid credentials" });

    if (!account.mfa_enabled) {
      return res.status(400).json({ error: "Account does not have MFA enabled" });
    }

    const codeHash = hashRecoveryCode(String(recoveryCode).trim().toUpperCase());
    const { rows: codeRows } = await pool.query(
      "SELECT id FROM mfa_recovery_codes WHERE account_id=$1 AND code_hash=$2 AND used_at IS NULL LIMIT 1",
      [account.id, codeHash],
    );
    if (!codeRows.length) {
      await pool.query(
        `INSERT INTO audit_logs (account_id, action, resource, details, severity, created_at)
         VALUES ($1,'AUTH_MFA_FAILED','mfa_recovery',$2,'critical',NOW())`,
        [account.id, JSON.stringify({ reason: "invalid_recovery_code" })],
      );
      return res.status(401).json({ error: "Invalid or already-used recovery code" });
    }

    await pool.query(
      "UPDATE mfa_recovery_codes SET used_at=NOW() WHERE id=$1",
      [codeRows[0].id],
    );

    const jwt = await import("jsonwebtoken");
    const JWT_SECRET = process.env.JWT_SECRET!;
    const token = jwt.default.sign({ id: account.id, role: account.role }, JWT_SECRET, { expiresIn: "7d" });

    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("aperti_token", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    await pool.query(
      `INSERT INTO audit_logs (account_id, action, resource, details, severity, created_at)
       VALUES ($1,'AUTH_MFA_SUCCESS','mfa_recovery',$2,'warn',NOW())`,
      [account.id, JSON.stringify({ event: "recovery_code_used", codeId: codeRows[0].id })],
    );

    const { rows: remaining } = await pool.query(
      "SELECT COUNT(*) FROM mfa_recovery_codes WHERE account_id=$1 AND used_at IS NULL",
      [account.id],
    );
    const codesLeft = parseInt(remaining[0]?.count ?? "0", 10);

    res.json({
      success: true,
      token,
      role: account.role,
      recoveryCodesRemaining: codesLeft,
      warning: codesLeft <= 2 ? `Only ${codesLeft} recovery code(s) left — generate new ones after login` : undefined,
    });
  } catch {
    res.status(500).json({ error: "Recovery login failed" });
  }
});
