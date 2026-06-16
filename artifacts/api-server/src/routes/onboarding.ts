import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";

export const onboardingRouter = Router();

(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS onboarding_progress (
      id           serial PRIMARY KEY,
      account_id   integer NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
      current_step integer NOT NULL DEFAULT 1,
      completed    boolean NOT NULL DEFAULT false,
      data         jsonb NOT NULL DEFAULT '{}',
      completed_at timestamptz,
      created_at   timestamptz NOT NULL DEFAULT NOW(),
      updated_at   timestamptz NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});
})();

async function ensureProgress(accountId: number) {
  const { rows } = await pool.query(
    `INSERT INTO onboarding_progress (account_id, current_step, completed)
     VALUES ($1, 1, false)
     ON CONFLICT (account_id) DO UPDATE SET account_id=$1
     RETURNING *`,
    [accountId]
  );
  return rows[0];
}

onboardingRouter.get("/progress", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const row = await ensureProgress(req.userId!);
    res.json(row);
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

onboardingRouter.post("/save-step", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { step, data } = req.body;
    await pool.query(
      `INSERT INTO onboarding_progress (account_id, current_step, data, updated_at)
       VALUES ($1, $2, $3::jsonb, NOW())
       ON CONFLICT (account_id) DO UPDATE
         SET current_step = GREATEST(onboarding_progress.current_step, $2),
             data = onboarding_progress.data || $3::jsonb,
             updated_at = NOW()`,
      [req.userId, step ?? 1, JSON.stringify(data ?? {})]
    );
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

onboardingRouter.post("/complete", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(
      `INSERT INTO onboarding_progress (account_id, current_step, completed, completed_at, updated_at)
       VALUES ($1, 99, true, NOW(), NOW())
       ON CONFLICT (account_id) DO UPDATE SET completed=true, completed_at=NOW(), updated_at=NOW()`,
      [req.userId]
    );
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});
