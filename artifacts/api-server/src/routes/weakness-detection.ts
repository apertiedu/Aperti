/**
 * Student Weakness Detection Engine — Phase 48
 *
 * GET  /weakness/student/:studentId   — Full weakness profile for one student
 * GET  /weakness/class/:subjectId     — Class-wide weak topic heatmap
 * POST /weakness/analyze/:studentId   — Trigger AI deep-analysis & persist to echo_memory
 */

import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { generateAIResponse, AI_AVAILABLE } from "../services/ai";

export const weaknessDetectionRouter = Router();
weaknessDetectionRouter.use(authenticate, requireRole("teacher", "admin"));

// ── Types ─────────────────────────────────────────────────────────────────────

interface WeakTopic {
  topic: string;
  weakness_score: number;
  evidence: string[];
  trend: "improving" | "stable" | "declining";
  mastery_score: number;
}

interface WeaknessProfile {
  student_id: number;
  student_name: string;
  weak_topics: WeakTopic[];
  strength_topics: string[];
  risk_level: "low" | "medium" | "high";
  overall_mastery: number;
  ai_insight: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeRiskLevel(score: number): "low" | "medium" | "high" {
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  return "low";
}

function computeTrend(recentScores: number[]): "improving" | "stable" | "declining" {
  if (recentScores.length < 2) return "stable";
  const first = recentScores.slice(0, Math.ceil(recentScores.length / 2));
  const last  = recentScores.slice(Math.ceil(recentScores.length / 2));
  const avgFirst = first.reduce((a, b) => a + b, 0) / first.length;
  const avgLast  = last.reduce((a, b) => a + b, 0) / last.length;
  const delta = avgLast - avgFirst;
  if (delta > 5) return "improving";
  if (delta < -5) return "declining";
  return "stable";
}

// ── GET /weakness/student/:studentId ─────────────────────────────────────────

weaknessDetectionRouter.get("/weakness/student/:studentId", async (req: AuthRequest, res: Response): Promise<void> => {
  const studentId = parseInt(req.params.studentId, 10);
  if (isNaN(studentId)) { res.status(400).json({ message: "Invalid student ID" }); return; }

  const [studentRow, echoRow, marksRows, overridesRows, submissionsRows] = await Promise.all([
    pool.query(`SELECT s.id, a.name FROM students s JOIN accounts a ON a.id = s.account_id WHERE s.id = $1 AND s.teacher_account_id = $2 LIMIT 1`, [studentId, req.userId]),
    pool.query(`SELECT weak_topics, strong_topics, mistake_history FROM echo_memory WHERE student_id = $1 LIMIT 1`, [studentId]),
    pool.query(`
      SELECT eq.topic,
             sm.marks_scored::numeric     AS scored,
             eq.max_marks::numeric        AS max,
             sm.created_at
      FROM student_marks sm
      JOIN exam_questions eq ON eq.id = sm.question_id
      WHERE sm.student_id = $1
        AND eq.topic IS NOT NULL
      ORDER BY sm.created_at`, [studentId]),
    pool.query(`
      SELECT eq.topic, COUNT(*) AS override_count
      FROM ai_grade_reviews agr
      JOIN exam_questions eq ON eq.id = agr.question_id
      WHERE agr.student_id = $1 AND agr.overridden = true AND eq.topic IS NOT NULL
      GROUP BY eq.topic`, [studentId]),
    pool.query(`
      SELECT a.topic,
             sa.score::numeric / NULLIF(a.max_score,0) AS ratio,
             sa.submitted_at
      FROM submission_answers sa
      JOIN assessment_questions a ON a.id = sa.question_id
      WHERE sa.student_id = $1 AND a.topic IS NOT NULL
      ORDER BY sa.submitted_at`, [studentId]),
  ]);

  if (!studentRow.rows[0]) {
    res.status(404).json({ message: "Student not found or not authorised" });
    return;
  }

  // ── Aggregate per-topic stats ────────────────────────────────────────────
  const topicStats: Record<string, {
    scores: number[];
    attempts: number;
    overrides: number;
    timestamps: Date[];
  }> = {};

  for (const r of marksRows.rows) {
    const t = r.topic as string;
    if (!topicStats[t]) topicStats[t] = { scores: [], attempts: 0, overrides: 0, timestamps: [] };
    const pct = r.max > 0 ? Math.round((r.scored / r.max) * 100) : 0;
    topicStats[t].scores.push(pct);
    topicStats[t].attempts++;
    topicStats[t].timestamps.push(new Date(r.created_at));
  }

  for (const r of submissionsRows.rows) {
    const t = r.topic as string;
    if (!topicStats[t]) topicStats[t] = { scores: [], attempts: 0, overrides: 0, timestamps: [] };
    const pct = Math.round((r.ratio ?? 0) * 100);
    topicStats[t].scores.push(pct);
    topicStats[t].attempts++;
  }

  const overrideMap: Record<string, number> = {};
  for (const r of overridesRows.rows) {
    overrideMap[r.topic as string] = parseInt(r.override_count, 10);
  }

  // ── Echo memory baseline ─────────────────────────────────────────────────
  const echo = echoRow.rows[0];
  const echoWeak: string[]   = echo?.weak_topics ?? [];
  const echoStrong: string[] = echo?.strong_topics ?? [];

  // ── Build weakness profiles ──────────────────────────────────────────────
  const weakTopicProfiles: WeakTopic[] = [];
  const strongTopicNames: string[] = [...echoStrong];

  for (const [topic, stats] of Object.entries(topicStats)) {
    const avgScore = stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length;
    const masteryScore = Math.round(avgScore);

    // Weakness score formula:
    //   base = (100 - avgScore)
    //   + repeated mistakes bonus (more attempts → more weight if avg low)
    //   + teacher override penalty (each override = +5)
    //   + echo_memory weak flag (+10)
    //   capped at 100
    const repeatBonus = stats.attempts > 2 && avgScore < 60 ? Math.min(stats.attempts * 3, 15) : 0;
    const overridePenalty = (overrideMap[topic] ?? 0) * 5;
    const echoBonus = echoWeak.includes(topic) ? 10 : 0;
    const weaknessScore = Math.min(100, Math.round((100 - avgScore) + repeatBonus + overridePenalty + echoBonus));

    const evidence: string[] = [];
    if (avgScore < 50) evidence.push(`Average score only ${avgScore}% across ${stats.attempts} attempt(s)`);
    if (overrideMap[topic]) evidence.push(`Teacher corrected AI grade ${overrideMap[topic]} time(s) — suggests misconception`);
    if (repeatBonus > 0) evidence.push(`Repeated failures across ${stats.attempts} assessments`);
    if (echoWeak.includes(topic)) evidence.push("Flagged in AI memory as a persistent weak area");

    const trend = computeTrend(stats.scores);

    if (weaknessScore > 25) {
      weakTopicProfiles.push({ topic, weakness_score: weaknessScore, evidence, trend, mastery_score: masteryScore });
    } else if (masteryScore >= 70 && !echoWeak.includes(topic)) {
      if (!strongTopicNames.includes(topic)) strongTopicNames.push(topic);
    }
  }

  // Merge echo weak topics that might not have exam data yet
  for (const t of echoWeak) {
    if (!weakTopicProfiles.find(w => w.topic === t)) {
      weakTopicProfiles.push({
        topic: t,
        weakness_score: 40,
        evidence: ["Flagged by AI learning memory — no recent exam data to quantify"],
        trend: "stable",
        mastery_score: 50,
      });
    }
  }

  weakTopicProfiles.sort((a, b) => b.weakness_score - a.weakness_score);

  const overallMastery = weakTopicProfiles.length > 0
    ? Math.round(weakTopicProfiles.reduce((s, t) => s + t.mastery_score, 0) / weakTopicProfiles.length)
    : 75;

  const avgWeakness = weakTopicProfiles.length > 0
    ? weakTopicProfiles.reduce((s, t) => s + t.weakness_score, 0) / weakTopicProfiles.length
    : 0;

  const riskLevel = computeRiskLevel(avgWeakness);

  const profile: WeaknessProfile = {
    student_id: studentId,
    student_name: studentRow.rows[0].name,
    weak_topics: weakTopicProfiles,
    strength_topics: [...new Set(strongTopicNames)].slice(0, 10),
    risk_level: riskLevel,
    overall_mastery: overallMastery,
    ai_insight: null,
  };

  res.json(profile);
});

// ── POST /weakness/analyze/:studentId ─────────────────────────────────────────

weaknessDetectionRouter.post("/weakness/analyze/:studentId", async (req: AuthRequest, res: Response): Promise<void> => {
  const studentId = parseInt(req.params.studentId, 10);
  if (isNaN(studentId)) { res.status(400).json({ message: "Invalid student ID" }); return; }

  // Verify ownership
  const { rows: studentRows } = await pool.query(
    `SELECT s.id, a.name FROM students s JOIN accounts a ON a.id = s.account_id WHERE s.id = $1 AND s.teacher_account_id = $2 LIMIT 1`,
    [studentId, req.userId],
  );
  if (!studentRows[0]) { res.status(404).json({ message: "Student not found" }); return; }

  // Pull performance summary
  const { rows: topicPerf } = await pool.query(`
    SELECT eq.topic,
           COUNT(*)::int                                              AS attempts,
           ROUND(AVG(sm.marks_scored::numeric / NULLIF(eq.max_marks,0) * 100))::int AS avg_pct
    FROM student_marks sm
    JOIN exam_questions eq ON eq.id = sm.question_id
    WHERE sm.student_id = $1 AND eq.topic IS NOT NULL
    GROUP BY eq.topic
    ORDER BY avg_pct ASC
    LIMIT 20`, [studentId]);

  const { rows: [echo] } = await pool.query(
    `SELECT weak_topics, strong_topics FROM echo_memory WHERE student_id = $1 LIMIT 1`,
    [studentId],
  );

  if (!AI_AVAILABLE) {
    res.json({ message: "AI unavailable — weakness profile computed from data only", studentId });
    return;
  }

  const perfSummary = topicPerf
    .map((r: any) => `${r.topic}: ${r.avg_pct}% avg (${r.attempts} attempts)`)
    .join("\n");

  const aiRes = await generateAIResponse(
    `You are a learning analytics expert. A student named "${studentRows[0].name}" has the following topic performance:

${perfSummary || "No exam data yet."}

Previous weak topics from memory: ${(echo?.weak_topics ?? []).join(", ") || "none"}
Previous strong topics from memory: ${(echo?.strong_topics ?? []).join(", ") || "none"}

Provide a concise diagnostic (3-5 sentences) covering:
1. The most critical knowledge gaps
2. Likely root causes (e.g. conceptual vs procedural confusion)
3. One specific study recommendation

Be direct and actionable. No bullet points, plain prose.`,
    {
      systemPrompt: "You are an expert educational diagnostician. Be concise, specific, and evidence-based.",
      maxTokens: 350,
      module: "weakness-detection",
      userId: req.userId,
    },
  );

  const aiInsight = aiRes.text;

  // Update echo_memory with AI insight
  if (aiInsight) {
    const weakTopicNames = topicPerf.filter((r: any) => r.avg_pct < 55).map((r: any) => r.topic as string);
    const strongTopicNames = topicPerf.filter((r: any) => r.avg_pct >= 75).map((r: any) => r.topic as string);

    await pool.query(
      `INSERT INTO echo_memory (student_id, weak_topics, strong_topics, last_analyzed)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (student_id) DO UPDATE
         SET weak_topics   = $2,
             strong_topics = $3,
             last_analyzed = NOW()`,
      [studentId, JSON.stringify(weakTopicNames), JSON.stringify(strongTopicNames)],
    );
  }

  res.json({
    studentId,
    studentName: studentRows[0].name,
    ai_insight: aiInsight,
    topicSummary: topicPerf,
    analysisComplete: true,
  });
});

// ── GET /weakness/class/:subjectId ────────────────────────────────────────────

weaknessDetectionRouter.get("/weakness/class/:subjectId", async (req: AuthRequest, res: Response): Promise<void> => {
  const subjectId = parseInt(req.params.subjectId, 10);
  if (isNaN(subjectId)) { res.status(400).json({ message: "Invalid subject ID" }); return; }

  const { rows } = await pool.query(`
    SELECT
      eq.topic,
      COUNT(DISTINCT sm.student_id)::int                                      AS student_count,
      ROUND(AVG(sm.marks_scored::numeric / NULLIF(eq.max_marks,0) * 100))::int AS avg_pct,
      COUNT(*) FILTER (WHERE sm.marks_scored::numeric / NULLIF(eq.max_marks,0) < 0.5)::int AS fail_count
    FROM student_marks sm
    JOIN exam_questions eq ON eq.id = sm.question_id
    JOIN exams e ON e.id = sm.exam_id
    WHERE e.subject_id = $1
      AND e.teacher_account_id = $2
      AND eq.topic IS NOT NULL
    GROUP BY eq.topic
    ORDER BY avg_pct ASC
    LIMIT 30`,
    [subjectId, req.userId],
  );

  res.json({
    subjectId,
    classWeaknesses: rows.map((r: any) => ({
      topic: r.topic,
      avg_class_score: r.avg_pct,
      students_attempted: r.student_count,
      fail_count: r.fail_count,
      risk_level: computeRiskLevel(100 - r.avg_pct),
    })),
  });
});
