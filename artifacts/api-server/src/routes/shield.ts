import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, AuthRequest, requireRole } from "../middleware/auth";

export const shieldRouter = Router();
shieldRouter.use(authenticate, requireRole("teacher", "admin", "assistant"));

// GET /shield/violations — sessions with integrity violations
shieldRouter.get("/violations", async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.schoolId;
    const { rows } = await pool.query(
      `SELECT
         es.id,
         a.name AS student,
         asmnt.name AS exam,
         asmnt.id AS exam_id,
         COALESCE(es.tab_switches, 0)    AS tab_switch_count,
         COALESCE(es.paste_attempts, 0)  AS paste_attempts,
         COALESCE(es.copy_attempts, 0)   AS copy_attempts,
         COALESCE(es.risk_score, 0)      AS risk_score,
         es.started_at                   AS created_at,
         CASE
           WHEN COALESCE(es.risk_score, 0) >= 60 THEN 'flagged'
           WHEN COALESCE(es.tab_switches, 0) > 0
             OR COALESCE(es.paste_attempts, 0) > 0
             OR COALESCE(es.copy_attempts, 0) > 0 THEN 'reviewed'
           ELSE 'clean'
         END AS status
       FROM exam_sessions es
       LEFT JOIN accounts a ON a.id = es.student_id
       LEFT JOIN assessments asmnt ON asmnt.id = es.assessment_id
       WHERE (
         COALESCE(es.tab_switches, 0) > 0
         OR COALESCE(es.paste_attempts, 0) > 0
         OR COALESCE(es.copy_attempts, 0) > 0
         OR COALESCE(es.risk_score, 0) > 0
       )
       ${schoolId ? "AND a.school_id = $1" : ""}
       ORDER BY COALESCE(es.risk_score, 0) DESC, es.started_at DESC
       LIMIT 200`,
      schoolId ? [schoolId] : []
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// GET /shield/stats — aggregate integrity stats
shieldRouter.get("/stats", async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.schoolId;
    const { rows } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE COALESCE(risk_score,0) >= 60)  AS high_risk,
         COUNT(*) FILTER (WHERE COALESCE(risk_score,0) >= 25 AND COALESCE(risk_score,0) < 60) AS medium_risk,
         COUNT(*) FILTER (WHERE COALESCE(paste_attempts,0) > 0) AS paste_flagged,
         COUNT(*) FILTER (WHERE COALESCE(copy_attempts,0) > 0)  AS copy_flagged,
         COUNT(*) FILTER (WHERE COALESCE(tab_switches,0) > 0)   AS tab_flagged,
         AVG(COALESCE(risk_score,0))::numeric(5,1) AS avg_risk_score
       FROM exam_sessions es
       ${schoolId ? "LEFT JOIN accounts a ON a.id = es.student_id WHERE a.school_id = $1" : "WHERE 1=1"}`,
      schoolId ? [schoolId] : []
    );
    res.json(rows[0] ?? {});
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});
