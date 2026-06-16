import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { logError } from "../lib/log-error";
import { safeHandler } from "../lib/safe-handler";

export const gradePredictionRouter = Router();
gradePredictionRouter.use(authenticate);

const REPLIT_KEY = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const REPLIT_BASE = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const NVIDIA_KEY = process.env.NVIDIA_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE = process.env.OPENAI_BASE_URL;

const API_KEY: string | null =
  NVIDIA_KEY ?? (REPLIT_KEY && REPLIT_BASE ? REPLIT_KEY : null) ?? OPENAI_KEY ?? null;

const BASE_URL: string =
  (NVIDIA_KEY ? "https://integrate.api.nvidia.com/v1" : null) ??
  (REPLIT_KEY && REPLIT_BASE ? REPLIT_BASE : null) ??
  OPENAI_BASE ?? "https://api.openai.com/v1";

const MODEL = process.env.OPENAI_MODEL ?? (NVIDIA_KEY ? "openai/gpt-oss-20b" : "gpt-4o-mini");

async function callAI(systemPrompt: string, userPrompt: string): Promise<string | null> {
  if (!API_KEY) return null;
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 25_000);
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        max_tokens: 1000,
        temperature: 0.4,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json() as any;
    return data?.choices?.[0]?.message?.content ?? null;
  } catch { return null; }
}

function parseJSON(text: string | null): any | null {
  if (!text) return null;
  try {
    const match = text.match(/```json\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
    return JSON.parse(match ? match[1] : text);
  } catch { return null; }
}

function buildDataFallback(
  studentId: number,
  recentAvg: number,
  overallAvg: number,
  weakTopics: string[],
  overrideFreq: number,
  examCount: number,
): any {
  const trendFactor = recentAvg >= overallAvg ? 1.03 : 0.97;
  const weakPenalty = Math.min(weakTopics.length * 2.5, 20);
  const overridePenalty = Math.min(overrideFreq * 1.5, 10);
  const basePrediction = Math.max(0, Math.min(100,
    recentAvg * trendFactor - weakPenalty - overridePenalty
  ));
  const range: [number, number] = [
    Math.round(Math.max(0, basePrediction - 8)),
    Math.round(Math.min(100, basePrediction + 6)),
  ];
  const passProb = Math.round(Math.min(99, Math.max(1, (basePrediction - 45) * 2 + 50)));
  const risk = basePrediction < 45 ? "high" : basePrediction < 60 ? "medium" : "low";

  return {
    student_id: studentId,
    predicted_score_range: range,
    pass_probability: passProb / 100,
    risk_level: risk,
    key_factors: [
      `Recent performance average: ${Math.round(recentAvg)}%`,
      weakTopics.length > 0 ? `Weak in ${weakTopics.slice(0, 3).join(", ")}` : "No major weak topics",
      overrideFreq > 2 ? "Frequent teacher overrides reduce confidence" : "Consistent AI-teacher agreement",
      examCount < 3 ? "Limited exam history — prediction confidence is lower" : "Good exam history available",
    ].filter(Boolean),
    improvement_suggestions: [
      weakTopics.length > 0 ? `Focus on ${weakTopics[0]} — it has the highest impact on your score` : "Maintain current study pace",
      "Practice under timed exam conditions using past papers",
      "Review and reattempt questions you lost marks on",
    ],
    what_if_simulations: weakTopics.slice(0, 2).map((topic, i) => ({
      scenario: `If student improves ${topic} by 20%`,
      predicted_score_increase: `+${3 + i * 2} points`,
      new_predicted_range: [range[0] + 3 + i * 2, range[1] + 3 + i * 2] as [number, number],
    })),
    disclaimer: "This is a statistical prediction only — not a final grade. Actual results depend on exam-day performance.",
    ai_generated: false,
    data_points_used: examCount,
  };
}

/* ── GET /api/grade-prediction/student/:studentId ────────────────────────── */
gradePredictionRouter.get(
  "/student/:studentId",
  requireRole("student", "teacher", "admin", "super_admin", "parent"),
  safeHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const studentId = parseInt(req.params.studentId);
      if (isNaN(studentId)) { res.status(400).json({ error: "Invalid student ID" }); return; }

      const { rows: marks } = await pool.query(`
        SELECT sm.marks_scored, eq.max_marks, eq.topic,
               e.exam_date, e.name AS exam_name,
               sm.ai_marks, sm.teacher_override_marks,
               sm.mistakes
        FROM student_marks sm
        JOIN exam_questions eq ON eq.id = sm.question_id
        JOIN exams e ON e.id = eq.exam_id
        WHERE sm.student_id = $1
        ORDER BY e.exam_date DESC NULLS LAST, sm.id DESC
        LIMIT 100
      `, [studentId]);

      if (marks.length === 0) {
        res.json({
          student_id: studentId,
          predicted_score_range: [0, 0],
          pass_probability: 0,
          risk_level: "high",
          key_factors: ["No exam data available yet"],
          improvement_suggestions: ["Complete at least one exam to generate a prediction"],
          what_if_simulations: [],
          disclaimer: "Insufficient data to generate prediction.",
          ai_generated: false,
          data_points_used: 0,
        });
        return;
      }

      const recent = marks.slice(0, Math.ceil(marks.length * 0.4));
      const calcAvg = (arr: any[]) => {
        const valid = arr.filter(r => parseFloat(r.max_marks) > 0);
        if (!valid.length) return 0;
        return valid.reduce((s, r) => s + (parseFloat(r.marks_scored) / parseFloat(r.max_marks)) * 100, 0) / valid.length;
      };

      const recentAvg = calcAvg(recent);
      const overallAvg = calcAvg(marks);

      const topicMap: Record<string, { scored: number; total: number }> = {};
      for (const r of marks) {
        if (!r.topic) continue;
        if (!topicMap[r.topic]) topicMap[r.topic] = { scored: 0, total: 0 };
        topicMap[r.topic].scored += parseFloat(r.marks_scored) || 0;
        topicMap[r.topic].total += parseFloat(r.max_marks) || 0;
      }

      const weakTopics = Object.entries(topicMap)
        .map(([t, d]) => ({ topic: t, pct: d.total > 0 ? (d.scored / d.total) * 100 : 0 }))
        .filter(t => t.pct < 55)
        .sort((a, b) => a.pct - b.pct)
        .map(t => t.topic);

      const overrideCount = marks.filter(r => r.teacher_override_marks != null).length;
      const overrideFreq = marks.length > 0 ? (overrideCount / marks.length) * 10 : 0;

      if (!API_KEY) {
        res.json(buildDataFallback(studentId, recentAvg, overallAvg, weakTopics, overrideFreq, marks.length));
        return;
      }

      const systemPrompt = `You are a predictive education analytics AI. Forecast a student's final exam performance.
IMPORTANT: This is NOT a final grade — always frame as a prediction/estimate only.
Weight recent performance (last 40% of data) 2x more than older results.
Respond ONLY with valid JSON:
{
  "predicted_score_range": [min_number, max_number],
  "pass_probability": number between 0 and 1,
  "risk_level": "low" | "medium" | "high",
  "key_factors": ["factor1", "factor2", "factor3"],
  "improvement_suggestions": ["suggestion1", "suggestion2", "suggestion3"],
  "what_if_simulations": [
    {
      "scenario": "If student improves [topic] by 20%",
      "predicted_score_increase": "+X points",
      "new_predicted_range": [min, max]
    }
  ],
  "confidence_level": "low" | "medium" | "high",
  "trend": "improving" | "stable" | "declining"
}`;

      const userPrompt = `Student ${studentId} performance data:
Overall average: ${Math.round(overallAvg)}%
Recent average (last ${recent.length} questions): ${Math.round(recentAvg)}%
Total questions answered: ${marks.length}
Trend: ${recentAvg >= overallAvg ? "improving" : "declining"}
Weak topics (< 55%): ${weakTopics.slice(0, 6).join(", ") || "None"}
Teacher override frequency: ${Math.round(overrideFreq * 10)}% of marks (higher = AI confidence reduced)
Exam history: ${[...new Set(marks.map(m => m.exam_name))].slice(0, 5).join(", ")}

Generate a realistic, data-backed grade prediction. Pass mark is typically 50%. Score range 0-100.
Include 2 what-if simulations on the top weak topics.`;

      const raw = await callAI(systemPrompt, userPrompt);
      const parsed = parseJSON(raw);

      if (!parsed) {
        res.json(buildDataFallback(studentId, recentAvg, overallAvg, weakTopics, overrideFreq, marks.length));
        return;
      }

      res.json({
        student_id: studentId,
        predicted_score_range: parsed.predicted_score_range ?? [Math.round(recentAvg - 8), Math.round(recentAvg + 5)],
        pass_probability: parsed.pass_probability ?? 0.5,
        risk_level: parsed.risk_level ?? "medium",
        key_factors: Array.isArray(parsed.key_factors) ? parsed.key_factors : [],
        improvement_suggestions: Array.isArray(parsed.improvement_suggestions) ? parsed.improvement_suggestions : [],
        what_if_simulations: Array.isArray(parsed.what_if_simulations) ? parsed.what_if_simulations : [],
        confidence_level: parsed.confidence_level ?? "medium",
        trend: parsed.trend ?? "stable",
        disclaimer: "This is a statistical prediction only — not a final grade. Actual results depend on exam-day performance.",
        ai_generated: true,
        data_points_used: marks.length,
        recent_avg: Math.round(recentAvg),
        overall_avg: Math.round(overallAvg),
      });

      pool.query(
        `INSERT INTO ai_interactions (account_id, interaction_type, model, prompt_tokens, completion_tokens, tokens_used, estimated_cost_usd, latency_ms, status, created_at)
         VALUES ($1, 'grade_prediction', $2, 200, 400, 600, '0.00006', 0, 'success', NOW())`,
        [req.userId, MODEL]
      ).catch(() => {});

    } catch (err) {
      logError(err, { route: "grade-prediction/student" });
      res.status(500).json({ error: "Failed to generate prediction" });
    }
  })
);

/* ── POST /api/grade-prediction/what-if ─────────────────────────────────── */
gradePredictionRouter.post(
  "/what-if",
  requireRole("student", "teacher", "admin", "super_admin"),
  safeHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { student_id, topic, improvement_pct, current_range } = req.body as {
        student_id: number;
        topic: string;
        improvement_pct: number;
        current_range: [number, number];
      };

      if (!student_id || !topic || !improvement_pct || !current_range) {
        res.status(400).json({ error: "student_id, topic, improvement_pct, and current_range are required" });
        return;
      }

      const { rows: topicData } = await pool.query(`
        SELECT COUNT(*) AS q_count,
               SUM(sm.marks_scored::numeric) AS scored,
               SUM(eq.max_marks::numeric) AS total
        FROM student_marks sm
        JOIN exam_questions eq ON eq.id = sm.question_id
        WHERE sm.student_id = $1 AND LOWER(eq.topic) = LOWER($2)
      `, [student_id, topic]);

      const td = topicData[0];
      const currentTopicPct = td.total > 0 ? (td.scored / td.total) * 100 : 0;
      const topicWeight = Math.min(td.q_count * 2, 20);

      const newTopicPct = Math.min(100, currentTopicPct + improvement_pct);
      const scoreGain = ((newTopicPct - currentTopicPct) / 100) * topicWeight;

      const newRange: [number, number] = [
        Math.round(Math.min(100, current_range[0] + scoreGain)),
        Math.round(Math.min(100, current_range[1] + scoreGain)),
      ];

      res.json({
        student_id,
        topic,
        improvement_pct,
        current_topic_score: Math.round(currentTopicPct),
        simulated_topic_score: Math.round(newTopicPct),
        estimated_score_gain: Math.round(scoreGain * 10) / 10,
        new_predicted_range: newRange,
        original_range: current_range,
        confidence: td.q_count >= 3 ? "medium" : "low",
        note: td.q_count < 2 ? "Limited data for this topic — estimate may be imprecise" : undefined,
      });
    } catch (err) {
      logError(err, { route: "grade-prediction/what-if" });
      res.status(500).json({ error: "Failed to run simulation" });
    }
  })
);
