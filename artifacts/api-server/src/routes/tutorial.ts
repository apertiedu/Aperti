import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";

const router: IRouter = Router();

router.get("/tutorial/progress", authenticate, async (req: AuthRequest, res): Promise<void> => {
  const accountId = req.userId!;
  const { rows } = await pool.query(`SELECT * FROM tutorial_progress WHERE account_id=$1`, [accountId]);
  if (!rows[0]) { res.json({ completed: false, lastStep: 0, exists: false }); return; }
  res.json({ completed: rows[0].completed, lastStep: rows[0].last_step, exists: true });
});

router.post("/tutorial/progress", authenticate, async (req: AuthRequest, res): Promise<void> => {
  const accountId = req.userId!;
  const { completed, lastStep } = req.body;
  await pool.query(`
    INSERT INTO tutorial_progress (account_id, completed, last_step, completed_at, updated_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (account_id) DO UPDATE
      SET completed=$2, last_step=$3, completed_at=$4, updated_at=NOW()
  `, [accountId, !!completed, lastStep ?? 0, completed ? new Date() : null]);
  res.json({ saved: true });
});

router.delete("/tutorial/progress", authenticate, async (req: AuthRequest, res): Promise<void> => {
  const accountId = req.userId!;
  await pool.query(`DELETE FROM tutorial_progress WHERE account_id=$1`, [accountId]);
  res.json({ reset: true });
});

export default router;
