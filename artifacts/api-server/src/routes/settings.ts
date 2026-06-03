import { Router, Request, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import bcrypt from "bcryptjs";

export const settingsRouter = Router();

(async () => {
  const migrations = [
    `CREATE TABLE IF NOT EXISTS user_settings (
      id         serial PRIMARY KEY,
      account_id integer NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      key        text NOT NULL,
      value      text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT NOW(),
      UNIQUE(account_id, key)
    )`,
    `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS avatar_url text`,
    `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS bio text`,
    `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS phone text`,
    `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS country text`,
    `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS first_name text`,
    `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_name text`,
  ];
  for (const m of migrations) await pool.query(m).catch(() => {});
})();

settingsRouter.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const [accountRes, settingsRes] = await Promise.all([
      pool.query(
        `SELECT id, username, display_name, email, role, avatar_url, bio, phone, country,
                first_name, last_name, email_verified, created_at, status
         FROM accounts WHERE id=$1`,
        [req.userId]
      ),
      pool.query(`SELECT key, value FROM user_settings WHERE account_id=$1`, [req.userId]),
    ]);
    const settings: Record<string, string> = {};
    for (const row of settingsRes.rows) settings[row.key] = row.value;
    res.json({ account: accountRes.rows[0], settings });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

settingsRouter.put("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: "Setting key is required" });
    await pool.query(
      `INSERT INTO user_settings (account_id, key, value, updated_at) VALUES ($1, $2, $3, NOW())
       ON CONFLICT (account_id, key) DO UPDATE SET value=$3, updated_at=NOW()`,
      [req.userId, key, String(value ?? "")]
    );
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

settingsRouter.put("/profile", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { displayName, firstName, lastName, bio, phone, country, avatarUrl } = req.body;
    await pool.query(
      `UPDATE accounts SET
         display_name = COALESCE(NULLIF($1,''), display_name),
         first_name   = COALESCE(NULLIF($2,''), first_name),
         last_name    = COALESCE(NULLIF($3,''), last_name),
         bio          = COALESCE($4, bio),
         phone        = COALESCE(NULLIF($5,''), phone),
         country      = COALESCE(NULLIF($6,''), country),
         avatar_url   = COALESCE(NULLIF($7,''), avatar_url)
       WHERE id=$8`,
      [displayName, firstName, lastName, bio, phone, country, avatarUrl, req.userId]
    );
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

settingsRouter.put("/password", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "Both passwords are required" });
    if (newPassword.length < 8) return res.status(400).json({ error: "New password must be at least 8 characters" });
    const { rows } = await pool.query(`SELECT password_hash FROM accounts WHERE id=$1`, [req.userId]);
    if (!rows.length) return res.status(404).json({ error: "Account not found" });
    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: "Current password is incorrect" });
    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query(`UPDATE accounts SET password_hash=$1 WHERE id=$2`, [hash, req.userId]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

settingsRouter.get("/profile/:id", async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, display_name, first_name, last_name, role, avatar_url, bio, country, created_at
       FROM accounts WHERE id=$1 AND status='active'`,
      [parseInt(req.params.id)]
    );
    if (!rows.length) return res.status(404).json({ error: "Profile not found" });
    res.json(rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

settingsRouter.get("/sessions", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, device_id, ip, user_agent, last_active_at, created_at
       FROM device_sessions WHERE account_id=$1 ORDER BY last_active_at DESC`,
      [req.userId]
    );
    res.json(rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});
