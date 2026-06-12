import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import crypto from "crypto";

export const examSessionRouter = Router();
examSessionRouter.use(authenticate);

// ── POST /exam-session/start ───────────────────────────────────────────────────
examSessionRouter.post("/start", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { assessment_id, device_info = {} } = req.body;

    if (!assessment_id) return res.status(400).json({ error: "assessment_id required" });

    // Get student
    const stuRes = await pool.query("SELECT id FROM students WHERE account_id=$1 LIMIT 1", [userId]);
    if (!stuRes.rows.length) return res.status(403).json({ error: "Not a student" });
    const studentId = stuRes.rows[0].id;

    // Check assessment is available
    const assRes = await pool.query("SELECT * FROM assessments WHERE id=$1", [assessment_id]);
    if (!assRes.rows.length) return res.status(404).json({ error: "Assessment not found" });
    const assessment = assRes.rows[0];
    if (!["published", "active"].includes(assessment.status)) {
      return res.status(403).json({ error: "Assessment not currently available" });
    }

    // Check for existing active session
    const existing = await pool.query(
      "SELECT * FROM exam_sessions WHERE assessment_id=$1 AND student_id=$2 AND is_valid=TRUE",
      [assessment_id, studentId]
    );
    if (existing.rows.length) {
      return res.json({ session: existing.rows[0], resumed: true });
    }

    const sessionToken = crypto.randomUUID();
    const { rows } = await pool.query(
      `INSERT INTO exam_sessions (assessment_id, student_id, session_token, device_info)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [assessment_id, studentId, sessionToken, JSON.stringify(device_info)]
    );

    const expiresAt = assessment.time_limit_minutes
      ? new Date(Date.now() + assessment.time_limit_minutes * 60_000)
      : null;

    res.json({
      session: rows[0],
      session_token: sessionToken,
      time_limit_minutes: assessment.time_limit_minutes,
      expires_at: expiresAt,
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /exam-session/heartbeat ───────────────────────────────────────────────
examSessionRouter.post("/heartbeat", async (req: AuthRequest, res: Response) => {
  try {
    const {
      session_token,
      tab_switch = false,
      focus_loss = false,
      paste_attempt = false,
      copy_attempt = false,
    } = req.body;
    if (!session_token) return res.status(400).json({ error: "session_token required" });

    const { rows } = await pool.query(
      `UPDATE exam_sessions
       SET last_heartbeat  = NOW(),
           tab_switches    = tab_switches    + $2,
           focus_losses    = focus_losses    + $3,
           paste_attempts  = COALESCE(paste_attempts, 0) + $4,
           copy_attempts   = COALESCE(copy_attempts,  0) + $5
       WHERE session_token = $1 AND is_valid = TRUE
       RETURNING id, is_valid, tab_switches, focus_losses, paste_attempts, copy_attempts, started_at`,
      [session_token, tab_switch ? 1 : 0, focus_loss ? 1 : 0, paste_attempt ? 1 : 0, copy_attempt ? 1 : 0]
    );

    if (!rows.length) return res.status(404).json({ error: "Session not found or expired" });

    const session = rows[0];

    // Risk score: weighted formula (0–100)
    const riskScore = Math.min(100, Math.round(
      (session.tab_switches   * 8) +
      (session.focus_losses   * 4) +
      (session.paste_attempts * 12) +
      (session.copy_attempts  * 3)
    ));
    await pool.query(
      `UPDATE exam_sessions SET risk_score = $1 WHERE session_token = $2`,
      [riskScore, session_token]
    ).catch(() => {});

    const flagged = riskScore >= 40 || session.tab_switches > 5 || session.focus_losses > 10 || session.paste_attempts > 2;

    if (flagged) {
      await pool.query(
        `UPDATE assessment_submissions
         SET security_flags = security_flags || $1
         WHERE assessment_id = (SELECT assessment_id FROM exam_sessions WHERE session_token=$2)
           AND student_id = (SELECT student_id FROM exam_sessions WHERE session_token=$2)`,
        [JSON.stringify({ type: flagged ? "excessive_switching" : "focus_loss", at: new Date() }), session_token]
      ).catch(() => {});
    }

    res.json({
      ok: true,
      tab_switches:   session.tab_switches,
      focus_losses:   session.focus_losses,
      paste_attempts: session.paste_attempts,
      copy_attempts:  session.copy_attempts,
      risk_score:     riskScore,
      flagged,
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /exam-session/end ─────────────────────────────────────────────────────
examSessionRouter.post("/end", async (req: AuthRequest, res: Response) => {
  try {
    const { session_token } = req.body;
    if (!session_token) return res.status(400).json({ error: "session_token required" });

    const { rows } = await pool.query(
      "UPDATE exam_sessions SET ended_at=NOW(), is_valid=FALSE WHERE session_token=$1 RETURNING *",
      [session_token]
    );
    if (!rows.length) return res.status(404).json({ error: "Session not found" });
    res.json({ ok: true, session: rows[0] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── GET /exam-session/status?token=xxx ────────────────────────────────────────
examSessionRouter.get("/status", async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.query as { token: string };
    if (!token) return res.status(400).json({ error: "token required" });

    const { rows } = await pool.query(
      "SELECT *, NOW() AS server_time FROM exam_sessions WHERE session_token=$1",
      [token]
    );
    if (!rows.length) return res.status(404).json({ error: "Session not found" });

    const session = rows[0];

    // Check time limit
    let expired = false;
    if (session.is_valid) {
      const assRes = await pool.query("SELECT time_limit_minutes FROM assessments WHERE id=$1", [session.assessment_id]);
      const limit = assRes.rows[0]?.time_limit_minutes;
      if (limit) {
        const elapsed = (Date.now() - new Date(session.started_at).getTime()) / 60_000;
        if (elapsed >= limit) {
          expired = true;
          await pool.query("UPDATE exam_sessions SET is_valid=FALSE, ended_at=NOW() WHERE id=$1", [session.id]);
        }
      }
    }

    res.json({ session, expired, valid: session.is_valid && !expired });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});
