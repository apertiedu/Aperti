import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { pool } from "@workspace/db";

export const classforgeRouter = Router();

/* ── Engagement overview for a live session ───────────────────────────── */
classforgeRouter.get("/classforge/session/:sessionId", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT er.*, s.student_name, s.student_code
         FROM engagement_records er
         JOIN students s ON er.student_id = s.id
        WHERE er.live_class_id = $1
        ORDER BY er.participation_score DESC`,
      [req.params.sessionId],
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── List recent live sessions with engagement summaries ──────────────── */
classforgeRouter.get("/classforge/sessions", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT lcr.*,
              l.lesson_number, l.day_of_week, l.start_time,
              s.name AS subject_name,
              COUNT(er.id) AS participant_count,
              ROUND(AVG(er.participation_score)::numeric, 1) AS avg_participation,
              ROUND(AVG(er.attention_percentage)::numeric, 1) AS avg_attention
         FROM live_class_rooms lcr
         LEFT JOIN lessons l ON lcr.lesson_id = l.id
         LEFT JOIN subjects s ON l.subject_id = s.id
         LEFT JOIN engagement_records er ON er.live_class_id = lcr.id
        WHERE l.teacher_account_id = $1
        GROUP BY lcr.id, l.lesson_number, l.day_of_week, l.start_time, s.name
        ORDER BY lcr.started_at DESC NULLS LAST
        LIMIT 20`,
      [req.userId!],
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── Update engagement record (from live class events) ────────────────── */
classforgeRouter.post("/classforge/engagement", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { live_class_id, student_id, hand_raises, chat_messages, poll_responses, attention_percentage } = req.body;
    await pool.query(
      `INSERT INTO engagement_records (live_class_id, student_id, hand_raises, chat_messages, poll_responses, attention_percentage, participation_score, joined_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
       ON CONFLICT DO NOTHING`,
      [live_class_id, student_id, hand_raises || 0, chat_messages || 0, poll_responses || 0, attention_percentage || 100,
        (hand_raises || 0) * 3 + (chat_messages || 0) * 2 + (poll_responses || 0) * 5],
    );
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── Heatmap data: participation by student per week ──────────────────── */
classforgeRouter.get("/classforge/heatmap", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.student_name,
              DATE_TRUNC('week', lcr.started_at) AS week,
              ROUND(AVG(er.participation_score)::numeric, 1) AS score
         FROM engagement_records er
         JOIN students s ON er.student_id = s.id
         JOIN live_class_rooms lcr ON er.live_class_id = lcr.id
         JOIN lessons l ON lcr.lesson_id = l.id
        WHERE l.teacher_account_id = $1
          AND lcr.started_at >= NOW() - INTERVAL '8 weeks'
        GROUP BY s.student_name, DATE_TRUNC('week', lcr.started_at)
        ORDER BY week, s.student_name`,
      [req.userId!],
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
