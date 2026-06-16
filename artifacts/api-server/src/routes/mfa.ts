import { Router, Request, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { pool } from "@workspace/db";
import { generateSecret, generateTotpUri, verifyTotp, encryptField, decryptField } from "../lib/mfa";

export const mfaRouter = Router();

// POST /api/auth/mfa/setup — generate MFA secret and QR URI
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

    await pool.query(
      "UPDATE accounts SET mfa_secret=$1 WHERE id=$2",
      [encrypted, userId],
    );

    const label = user.email || user.username;
    const uri = generateTotpUri(secret, label);

    res.json({ secret, uri, message: "Scan this QR with your authenticator app, then verify with /mfa/verify" });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// POST /api/auth/mfa/verify — verify code and enable MFA
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
    res.json({ success: true, message: "MFA enabled successfully" });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// POST /api/auth/mfa/disable — disable MFA
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
      return res.status(401).json({ error: "Invalid token" });
    }

    await pool.query("UPDATE accounts SET mfa_enabled=false, mfa_secret=NULL WHERE id=$1", [req.userId]);
    res.json({ success: true, message: "MFA disabled" });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// GET /api/auth/mfa/status
mfaRouter.get("/status", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      "SELECT mfa_enabled FROM accounts WHERE id=$1",
      [req.userId],
    );
    res.json({ mfaEnabled: rows[0]?.mfa_enabled ?? false });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});
