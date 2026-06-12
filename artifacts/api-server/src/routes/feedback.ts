import { Router, Request, Response } from "express";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { pool } from "@workspace/db";

export const feedbackRouter = Router();

// Ensure feedback table exists
async function ensureFeedbackTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_feedback (
      id SERIAL PRIMARY KEY,
      account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
      feature TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT,
      context JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_feedback_feature ON user_feedback(feature)`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_feedback_account ON user_feedback(account_id)`).catch(() => {});
}
ensureFeedbackTable();

// POST /api/feedback — submit feedback
feedbackRouter.post("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { feature, rating, comment, context } = req.body;
    if (!feature || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Feature and rating (1-5) are required" });
    }
    await pool.query(
      `INSERT INTO user_feedback (account_id, feature, rating, comment, context)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.userId || null, feature, parseInt(rating), comment || null, context ? JSON.stringify(context) : null]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("feedback submit error:", err);
    res.status(500).json({ error: "Failed to save feedback" });
  }
});

// GET /api/feedback/summary — admin summary of all feedback
feedbackRouter.get("/summary", authenticate, requireRole(["admin"]), async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        feature,
        COUNT(*)::int AS total_responses,
        ROUND(AVG(rating)::numeric, 2) AS avg_rating,
        COUNT(CASE WHEN rating = 5 THEN 1 END)::int AS five_star,
        COUNT(CASE WHEN rating <= 2 THEN 1 END)::int AS low_ratings,
        MAX(created_at) AS last_submitted
      FROM user_feedback
      GROUP BY feature
      ORDER BY avg_rating ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error("feedback summary error:", err);
    res.status(500).json({ error: "Failed to load feedback summary" });
  }
});

// GET /api/feedback/feature/:feature — all feedback for a feature
feedbackRouter.get("/feature/:feature", authenticate, requireRole(["admin"]), async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT f.*, a.display_name, a.role
       FROM user_feedback f
       LEFT JOIN accounts a ON a.id = f.account_id
       WHERE f.feature = $1
       ORDER BY f.created_at DESC
       LIMIT 100`,
      [req.params.feature]
    );
    res.json(rows);
  } catch (err) {
    console.error("feedback feature error:", err);
    res.status(500).json({ error: "Failed to load feature feedback" });
  }
});
