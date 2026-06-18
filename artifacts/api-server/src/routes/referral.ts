import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";

export const referralRouter = Router();
referralRouter.use(authenticate);

function generateCode(len = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < len; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

referralRouter.get("/my-code", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query("SELECT referral_code FROM accounts WHERE id = $1", [req.userId]);
    let code: string = rows[0]?.referral_code;
    if (!code) {
      let attempts = 0;
      while (attempts < 10) {
        const candidate = generateCode();
        try {
          const { rowCount } = await pool.query(
            "UPDATE accounts SET referral_code = $1 WHERE id = $2 AND referral_code IS NULL",
            [candidate, req.userId],
          );
          if (rowCount && rowCount > 0) { code = candidate; break; }
        } catch {}
        attempts++;
      }
    }
    const publicBase = process.env.PUBLIC_URL ?? "";
    res.json({ code, link: `${publicBase}/register?ref=${code}` });
  } catch {
    res.status(500).json({ error: "Failed to get referral code" });
  }
});

referralRouter.get("/stats", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.code, r.status, r.reward_type, r.reward_value, r.created_at, r.activated_at,
              a.display_name AS referred_name, a.created_at AS referred_joined
       FROM referrals r
       LEFT JOIN accounts a ON a.id = r.referred_id
       WHERE r.referrer_id = $1
       ORDER BY r.created_at DESC`,
      [req.userId],
    );
    const total = rows.length;
    const active = rows.filter((r: any) => r.status === "active" || r.status === "rewarded").length;
    const rewarded = rows.filter((r: any) => r.status === "rewarded").length;
    res.json({ referrals: rows, total, active, rewarded });
  } catch {
    res.status(500).json({ error: "Failed to get referral stats" });
  }
});

referralRouter.post("/apply", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { code } = req.body as { code: string };
    if (!code || typeof code !== "string") {
      res.status(400).json({ error: "code is required" });
      return;
    }

    const normalizedCode = code.toUpperCase().trim();

    const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

    const { rows: selfRows } = await pool.query(
      "SELECT created_at FROM accounts WHERE id = $1",
      [req.userId],
    );
    const accountAge = selfRows[0]?.created_at ? Date.now() - new Date(selfRows[0].created_at).getTime() : Infinity;
    if (accountAge > FORTY_EIGHT_HOURS) {
      res.status(400).json({ error: "Referral codes can only be applied within 48 hours of account creation" });
      return;
    }

    const { rows: codeRows } = await pool.query(
      "SELECT id, created_at FROM accounts WHERE referral_code = $1 AND id != $2 LIMIT 1",
      [normalizedCode, req.userId],
    );
    if (codeRows.length === 0) {
      res.status(404).json({ error: "Invalid referral code" });
      return;
    }

    const referrerId = codeRows[0].id;
    const referrerAge = codeRows[0].created_at ? Date.now() - new Date(codeRows[0].created_at).getTime() : 0;
    if (referrerAge < SEVEN_DAYS) {
      res.status(400).json({ error: "Referral code is not yet active" });
      return;
    }

    const { rows: existing } = await pool.query(
      "SELECT id FROM referrals WHERE referred_id = $1 LIMIT 1",
      [req.userId],
    );
    if (existing.length > 0) {
      res.status(409).json({ error: "You have already used a referral code" });
      return;
    }

    await pool.query(
      "INSERT INTO referrals (referrer_id, referred_id, code, status, activated_at) VALUES ($1, $2, $3, 'active', NOW())",
      [referrerId, req.userId, normalizedCode],
    );

    res.json({ success: true, message: "Referral applied! Your referrer will be rewarded when you subscribe." });
  } catch {
    res.status(500).json({ error: "Failed to apply referral code" });
  }
});

referralRouter.get("/leaderboard", async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(`
      SELECT a.display_name, a.avatar_url, COUNT(r.id)::int AS referral_count
      FROM referrals r
      JOIN accounts a ON a.id = r.referrer_id
      WHERE r.status IN ('active', 'rewarded')
      GROUP BY a.id, a.display_name, a.avatar_url
      ORDER BY referral_count DESC
      LIMIT 20
    `);
    res.json({ leaderboard: rows });
  } catch {
    res.status(500).json({ error: "Failed to get leaderboard" });
  }
});
