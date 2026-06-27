import { Router, Response } from "express";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { pool } from "@workspace/db";
import { generateAIResponse, AI_AVAILABLE } from "../services/ai";

export const gradePredictionRouter = Router();

const studentGuard = [authenticate, requireRole("student")];
const teacherGuard = [authenticate, requireRole("teacher", "admin")];

gradePredictionRouter.post("/predict", ...studentGuard, async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.userId!;
    const { subjectId, targetExamId } = req.body;

    const [historyRes, echoRes, attendanceRes] = await Promise.all([
      pool.query(
        `SELECT sm.marks_scored, e.total_marks, e.title,
                ROUND((sm.marks_scored::float / NULLIF(e.total_marks, 0)) * 100, 1) AS pct,
                e.created_at
         FROM student_marks sm
         JOIN exams e ON e.id = sm.exam_id
         WHERE sm.student_id = (SELECT id FROM students WHERE account_id = $1 LIMIT 1)
           AND ($2::int IS NULL OR e.subject_id = $2)
           AND sm.approved_at IS NOT NULL
         ORDER BY e.created_at DESC LIMIT 12`,
        [studentId, subjectId ?? null]
      ),
      pool.query(
        `SELECT weak_topics, strong_topics, retention_scores, learning_pace
         FROM echo_memory WHERE student_id = (SELECT id FROM students WHERE account_id = $1 LIMIT 1)`,
        [studentId]
      ),
      pool.query(
        `SELECT ROUND(
           COUNT(CASE WHEN status = 'Present' OR status = 'present' THEN 1 END)::numeric
           / NULLIF(COUNT(*), 0) * 100, 1
         ) AS att_pct
         FROM attendance
         WHERE student_id = (SELECT id FROM students WHERE account_id = $1 LIMIT 1)`,
        [studentId]
      ),
    ]);

    const marks = historyRes.rows;
    const echo = echoRes.rows[0] ?? {};
    const attPct = parseFloat(attendanceRes.rows[0]?.att_pct ?? "0");

    if (marks.length === 0) {
      return res.json({
        prediction: null,
        confidence: "low",
        message: "Not enough assessment history to generate a prediction. Complete at least one graded assessment.",
        ai_available: AI_AVAILABLE,
      });
    }

    const scores = marks.map((m: any) => parseFloat(m.pct ?? "0"));
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const trend = scores.length >= 3
      ? scores.slice(-3).reduce((a, b) => a + b, 0) / 3 - scores.slice(0, 3).reduce((a, b) => a + b, 0) / 3
      : 0;

    const statisticalPrediction = Math.min(100, Math.max(0, Math.round(avg + trend * 0.5)));
    const attendanceBonus = attPct >= 90 ? 3 : attPct >= 75 ? 0 : -5;
    const adjustedPrediction = Math.min(100, Math.max(0, statisticalPrediction + attendanceBonus));

    const confidenceLevel = marks.length >= 6 ? "high" : marks.length >= 3 ? "medium" : "low";

    if (!AI_AVAILABLE) {
      return res.json({
        prediction: {
          predicted_score_pct: adjustedPrediction,
          statistical_base: statisticalPrediction,
          trend_direction: trend > 2 ? "improving" : trend < -2 ? "declining" : "stable",
          attendance_factor: attendanceBonus,
          confidence: confidenceLevel,
          weak_topics: echo.weak_topics ?? [],
          strong_topics: echo.strong_topics ?? [],
          recommendations: buildFallbackRecommendations(adjustedPrediction, echo, attPct),
        },
        source: "statistical",
        ai_available: false,
        assessment_count: marks.length,
      });
    }

    const prompt = `A student has the following academic profile. Predict their likely grade on their next exam.

ASSESSMENT HISTORY (most recent first):
${marks.map((m: any) => `- ${m.title}: ${m.pct}%`).join("\n")}

STATISTICAL SUMMARY:
- Average score: ${Math.round(avg)}%
- Recent trend: ${trend > 0 ? "+" : ""}${Math.round(trend)}% (last 3 vs first 3)
- Attendance rate: ${attPct}%
- Weak topics: ${(echo.weak_topics ?? []).join(", ") || "none"}
- Strong topics: ${(echo.strong_topics ?? []).join(", ") || "none"}
- Learning pace: ${echo.learning_pace ?? "medium"}

Return ONLY JSON:
{
  "predicted_score_pct": 72,
  "grade_band": "B",
  "confidence": "medium",
  "trend_direction": "improving",
  "key_risks": ["risk1", "risk2"],
  "recommendations": ["action1", "action2", "action3"],
  "reasoning": "Two-sentence explanation"
}`;

    const aiText = await generateAIResponse(
      [
        { role: "system", content: "You are an educational data analyst. Output structured JSON predictions only." },
        { role: "user", content: prompt },
      ],
      { maxTokens: 600, module: "grade_prediction", userId: studentId }
    );

    let aiPrediction: any;
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      aiPrediction = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      aiPrediction = null;
    }

    await pool.query(
      `INSERT INTO ai_learning_events
         (student_id, event_type, module, action, outcome, confidence, tokens_used, accepted, created_at)
       VALUES (
         (SELECT id FROM students WHERE account_id = $1 LIMIT 1),
         'grade_prediction', 'grade_prediction', 'predict',
         $2, $3, 0, false, NOW()
       )`,
      [studentId, aiPrediction ? "structured" : "fallback", confidenceLevel === "high" ? 0.85 : confidenceLevel === "medium" ? 0.7 : 0.55]
    ).catch(() => {});

    return res.json({
      prediction: aiPrediction ?? {
        predicted_score_pct: adjustedPrediction,
        grade_band: scoreToBand(adjustedPrediction),
        confidence: confidenceLevel,
        trend_direction: trend > 2 ? "improving" : trend < -2 ? "declining" : "stable",
        recommendations: buildFallbackRecommendations(adjustedPrediction, echo, attPct),
        reasoning: `Based on ${marks.length} assessments with an average of ${Math.round(avg)}%.`,
      },
      source: aiPrediction ? "ai" : "statistical",
      ai_available: true,
      assessment_count: marks.length,
    });
  } catch (err: any) {
    console.error("[grade-prediction] error:", err.message);
    return res.status(500).json({ error: "Failed to generate grade prediction" });
  }
});

gradePredictionRouter.get("/class-summary/:subjectId", ...teacherGuard, async (req: AuthRequest, res: Response) => {
  try {
    const subjectId = parseInt(req.params.subjectId);
    if (isNaN(subjectId)) return res.status(400).json({ error: "Invalid subject ID" });

    const { rows } = await pool.query(
      `SELECT
         s.id AS student_id,
         s.student_name,
         COUNT(sm.id) AS assessments_taken,
         ROUND(AVG(sm.marks_scored::float / NULLIF(e.total_marks, 0) * 100), 1) AS avg_pct,
         ROUND(
           AVG(CASE WHEN e.created_at >= NOW() - INTERVAL '60 days'
               THEN sm.marks_scored::float / NULLIF(e.total_marks, 0) * 100 END) -
           AVG(CASE WHEN e.created_at < NOW() - INTERVAL '60 days'
               THEN sm.marks_scored::float / NULLIF(e.total_marks, 0) * 100 END),
           1
         ) AS trend_pct
       FROM students s
       JOIN student_marks sm ON sm.student_id = s.id
       JOIN exams e ON e.id = sm.exam_id
       WHERE s.teacher_account_id = $1
         AND e.subject_id = $2
         AND sm.approved_at IS NOT NULL
       GROUP BY s.id, s.student_name
       ORDER BY avg_pct DESC NULLS LAST`,
      [req.userId!, subjectId]
    );

    return res.json({
      students: rows.map((r: any) => ({
        ...r,
        risk_level: parseFloat(r.avg_pct) < 50 ? "high" : parseFloat(r.avg_pct) < 65 ? "medium" : "low",
        predicted_band: scoreToBand(parseFloat(r.avg_pct)),
      })),
    });
  } catch (err: any) {
    console.error("[grade-prediction] class-summary error:", err.message);
    return res.status(500).json({ error: "Failed to load class summary" });
  }
});

function scoreToBand(pct: number): string {
  if (pct >= 90) return "A*";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  if (pct >= 40) return "E";
  return "U";
}

function buildFallbackRecommendations(pct: number, echo: any, att: number): string[] {
  const recs: string[] = [];
  if (att < 80) recs.push("Improve attendance — missing sessions directly impacts predicted grade.");
  if (pct < 50) recs.push("Focus on foundational concepts before attempting harder problems.");
  else if (pct < 70) recs.push("Work through past paper questions under timed conditions.");
  else recs.push("Challenge yourself with A/A* level questions to push past your current ceiling.");
  const weak = (echo.weak_topics ?? []).slice(0, 2);
  if (weak.length) recs.push(`Prioritise revision of: ${weak.join(", ")}.`);
  recs.push("Review your Echo profile after each assessment to track weak-area progress.");
  return recs;
}
