/**
 * AI Cheating & Anomaly Detection System — Phase 48
 *
 * POST /shield/anomaly/analyze/:submissionId  — AI analysis of one submission
 * POST /shield/anomaly/batch/:examId          — Analyze all submissions for an exam
 * GET  /shield/anomaly/report/:examId         — Anomaly report for an exam
 *
 * IMPORTANT: This system NEVER auto-accuses. It flags for teacher review only.
 * Final integrity decisions are always made by humans.
 */

import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { generateAIResponse, AI_AVAILABLE } from "../services/ai";

export const anomalyDetectionRouter = Router();
anomalyDetectionRouter.use(authenticate, requireRole("teacher", "admin"));

// ── Types ─────────────────────────────────────────────────────────────────────

interface AnomalyReport {
  student_id: number;
  student_name: string;
  submission_id: number;
  risk_score: number;
  risk_level: "low" | "medium" | "high";
  flags: string[];
  evidence: string[];
  requires_review: boolean;
  ai_analysis: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function riskLevel(score: number): "low" | "medium" | "high" {
  if (score >= 0.75) return "high";
  if (score >= 0.40) return "medium";
  return "low";
}

/** Normalise text for similarity comparison */
function normalise(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9 ]/g, "").trim();
}

/** Rough cosine-style token overlap similarity [0-1] */
function tokenSimilarity(a: string, b: string): number {
  const tokA = new Set(normalise(a).split(" ").filter(t => t.length > 3));
  const tokB = new Set(normalise(b).split(" ").filter(t => t.length > 3));
  if (tokA.size === 0 || tokB.size === 0) return 0;
  let shared = 0;
  for (const t of tokA) if (tokB.has(t)) shared++;
  return shared / Math.sqrt(tokA.size * tokB.size);
}

/** Check for suspicious length/time ratio */
function timeLengthMismatch(wordCount: number, timeTakenSeconds: number | null): boolean {
  if (!timeTakenSeconds || timeTakenSeconds <= 0) return false;
  const wpm = (wordCount / timeTakenSeconds) * 60;
  // Avg human typing ≈ 40 wpm. >120 wpm for a long answer is suspicious.
  return wordCount > 80 && wpm > 120;
}

/** AI-text signals: overly generic, suspiciously fluent phrasing */
const AI_PHRASES = [
  "in conclusion", "it is important to note", "furthermore",
  "this essay will", "in today's world", "as we can see",
  "firstly", "secondly", "thirdly", "lastly", "in summary",
  "it is worth noting", "this clearly shows", "undeniably",
];
function aiTextSignalScore(text: string): number {
  const lower = text.toLowerCase();
  const hits = AI_PHRASES.filter(p => lower.includes(p)).length;
  return Math.min(hits / 4, 1); // 4+ phrases → score 1.0
}

// ── POST /shield/anomaly/analyze/:submissionId ────────────────────────────────

anomalyDetectionRouter.post("/shield/anomaly/analyze/:submissionId", async (req: AuthRequest, res: Response): Promise<void> => {
  const submissionId = parseInt(req.params.submissionId, 10);
  if (isNaN(submissionId)) { res.status(400).json({ message: "Invalid submission ID" }); return; }

  // Load submission
  const { rows: subRows } = await pool.query(`
    SELECT
      sa.id, sa.student_id, sa.answer_text, sa.submitted_at,
      a.name AS student_name,
      sm.time_taken_seconds,
      asmt.id AS assessment_id
    FROM assessment_submissions sm
    JOIN submission_answers sa ON sa.submission_id = sm.id
    JOIN accounts a ON a.id = sa.student_id
    LEFT JOIN assessments asmt ON asmt.id = sm.assessment_id
    WHERE sm.id = $1
    LIMIT 50`, [submissionId]);

  if (!subRows[0]) {
    res.status(404).json({ message: "Submission not found" });
    return;
  }

  const studentId   = subRows[0].student_id as number;
  const studentName = subRows[0].student_name as string;
  const answers     = subRows.map((r: any) => r.answer_text as string).filter(Boolean);
  const fullText    = answers.join("\n\n");
  const wordCount   = fullText.split(/\s+/).filter(Boolean).length;
  const timeTaken   = subRows[0].time_taken_seconds as number | null;

  // Load this student's historical submissions for consistency check
  const { rows: histRows } = await pool.query(`
    SELECT sa.answer_text
    FROM assessment_submissions sm
    JOIN submission_answers sa ON sa.submission_id = sm.id
    WHERE sm.student_id = $1
      AND sm.id != $2
      AND sa.answer_text IS NOT NULL
    ORDER BY sm.submitted_at DESC
    LIMIT 10`, [studentId, submissionId]);

  const historicalText = histRows.map((r: any) => r.answer_text as string).join("\n");

  // Load peer submissions for the same assessment
  const assessmentId = subRows[0].assessment_id as number | null;
  const { rows: peerRows } = await pool.query(`
    SELECT sa.student_id, sa.answer_text
    FROM assessment_submissions sm
    JOIN submission_answers sa ON sa.submission_id = sm.id
    WHERE sm.assessment_id = $1
      AND sm.student_id != $2
      AND sa.answer_text IS NOT NULL
    LIMIT 40`, [assessmentId, studentId]);

  // ── Signal scoring ───────────────────────────────────────────────────────
  const flags: string[] = [];
  const evidence: string[] = [];
  let riskScore = 0;

  // Signal 1: Time/length mismatch
  if (timeLengthMismatch(wordCount, timeTaken)) {
    const wpm = timeTaken ? Math.round((wordCount / timeTaken) * 60) : 0;
    flags.push("TIME_LENGTH_MISMATCH");
    evidence.push(`${wordCount} words submitted in unusually short time (~${wpm} wpm — avg human: 40 wpm)`);
    riskScore += 0.25;
  }

  // Signal 2: AI-text phrase density
  const aiSignal = aiTextSignalScore(fullText);
  if (aiSignal > 0.4) {
    flags.push("AI_TEXT_SIGNALS");
    evidence.push(`Answer contains ${Math.round(aiSignal * 4)} AI-style transitional phrases suggesting possible external tool use`);
    riskScore += aiSignal * 0.30;
  }

  // Signal 3: Semantic similarity with peers
  let maxSimilarity = 0;
  let mostSimilarPeer: number | null = null;
  for (const peer of peerRows) {
    const sim = tokenSimilarity(fullText, peer.answer_text as string);
    if (sim > maxSimilarity) {
      maxSimilarity = sim;
      mostSimilarPeer = peer.student_id as number;
    }
  }
  if (maxSimilarity > 0.75) {
    flags.push("HIGH_PEER_SIMILARITY");
    evidence.push(`Answer shares ${Math.round(maxSimilarity * 100)}% token overlap with another student's submission`);
    riskScore += 0.35;
  } else if (maxSimilarity > 0.55) {
    flags.push("MODERATE_PEER_SIMILARITY");
    evidence.push(`Answer shares ${Math.round(maxSimilarity * 100)}% token overlap with another submission — worth reviewing`);
    riskScore += 0.15;
  }

  // Signal 4: Writing consistency vs history (sudden quality spike)
  if (historicalText.length > 200) {
    const consistencySim = tokenSimilarity(fullText, historicalText);
    if (consistencySim < 0.15 && wordCount > 100) {
      flags.push("WRITING_STYLE_INCONSISTENCY");
      evidence.push("Writing style differs substantially from this student's historical submissions");
      riskScore += 0.20;
    }
  }

  // Signal 5: Exam session risk from shield data
  const { rows: sessionRows } = await pool.query(`
    SELECT risk_score, tab_switches, paste_attempts, copy_attempts
    FROM exam_sessions
    WHERE student_id = $1 AND assessment_id = $2
    ORDER BY started_at DESC LIMIT 1`, [studentId, assessmentId]);

  if (sessionRows[0]) {
    const sessionRisk = (sessionRows[0].risk_score ?? 0) / 100;
    if (sessionRisk > 0.3) {
      flags.push("SESSION_BEHAVIORAL_FLAGS");
      evidence.push(`Exam session had ${sessionRows[0].tab_switches ?? 0} tab switch(es), ${sessionRows[0].paste_attempts ?? 0} paste attempt(s) — session risk score: ${sessionRows[0].risk_score}`);
      riskScore += sessionRisk * 0.25;
    }
  }

  riskScore = Math.min(riskScore, 1.0);
  const level = riskLevel(riskScore);

  // ── AI deep analysis for high/medium risk ────────────────────────────────
  let aiAnalysis: string | null = null;
  if (AI_AVAILABLE && riskScore >= 0.40 && fullText.length > 100) {
    const flagSummary = flags.join(", ");
    const snippet = fullText.slice(0, 600);

    const aiRes = await generateAIResponse(
      `You are an academic integrity reviewer. Analyze this student submission excerpt for anomalies.

Flags detected by automated system: ${flagSummary}
Submission excerpt (first 600 chars):
"${snippet}"

Provide a 2-3 sentence professional assessment of:
1. Whether the writing shows signs of AI generation or copying
2. What specific linguistic patterns support or undermine the flags
3. Your recommendation to the teacher (review carefully / no major concern)

IMPORTANT: Do not accuse the student. Frame as "may suggest" or "worth reviewing".
Be concise. No bullet points.`,
      {
        systemPrompt: "You are a neutral academic integrity analyst. Be objective, evidence-based, and never accusatory.",
        maxTokens: 280,
        module: "anomaly-detection",
        userId: req.userId,
      },
    );
    aiAnalysis = aiRes.text;
  }

  // ── Persist anomaly record ────────────────────────────────────────────────
  if (riskScore >= 0.40) {
    await pool.query(`
      UPDATE assessment_submissions
      SET integrity_risk_score = $1,
          integrity_flags       = $2,
          integrity_reviewed    = false
      WHERE id = $3`,
      [Math.round(riskScore * 100), JSON.stringify(flags), submissionId],
    ).catch(() => {});

    if (riskScore >= 0.75) {
      await pool.query(`
        INSERT INTO notifications (account_id, type, title, message, created_at)
        SELECT a.id, 'integrity_alert',
               'Integrity Review Required',
               $1, NOW()
        FROM students s JOIN accounts a ON a.id = s.account_id
        WHERE s.teacher_account_id = $2
          AND a.role = 'teacher'
        LIMIT 1`,
        [
          `Submission #${submissionId} by ${studentName} has been flagged for integrity review (risk: ${Math.round(riskScore * 100)}%)`,
          req.userId,
        ],
      ).catch(() => {});
    }
  }

  const report: AnomalyReport = {
    student_id:      studentId,
    student_name:    studentName,
    submission_id:   submissionId,
    risk_score:      parseFloat(riskScore.toFixed(3)),
    risk_level:      level,
    flags,
    evidence,
    requires_review: riskScore >= 0.75,
    ai_analysis:     aiAnalysis,
  };

  res.json(report);
});

// ── POST /shield/anomaly/batch/:examId ────────────────────────────────────────

anomalyDetectionRouter.post("/shield/anomaly/batch/:examId", async (req: AuthRequest, res: Response): Promise<void> => {
  const examId = parseInt(req.params.examId, 10);
  if (isNaN(examId)) { res.status(400).json({ message: "Invalid exam ID" }); return; }

  // Verify teacher owns this exam
  const { rows: examRows } = await pool.query(
    `SELECT id FROM exams WHERE id = $1 AND teacher_account_id = $2`,
    [examId, req.userId],
  );
  if (!examRows[0]) { res.status(404).json({ message: "Exam not found" }); return; }

  // Get all submissions for this exam
  const { rows: submissions } = await pool.query(`
    SELECT DISTINCT sm.id AS submission_id
    FROM assessment_submissions sm
    JOIN assessments asmt ON asmt.id = sm.assessment_id
    WHERE asmt.exam_id = $1 OR sm.exam_id = $1
    LIMIT 100`, [examId]);

  if (submissions.length === 0) {
    res.json({ message: "No submissions found for this exam", analyzed: 0 });
    return;
  }

  // Run peer-similarity cross-check on all submissions
  const { rows: allAnswers } = await pool.query(`
    SELECT
      sm.id AS submission_id,
      sm.student_id,
      a.name AS student_name,
      sa.answer_text
    FROM assessment_submissions sm
    JOIN submission_answers sa ON sa.submission_id = sm.id
    JOIN accounts a ON a.id = sm.student_id
    WHERE sm.id = ANY($1::int[])
      AND sa.answer_text IS NOT NULL`,
    [submissions.map((s: any) => s.submission_id)],
  );

  const submissionTexts: Record<number, { studentId: number; name: string; text: string }> = {};
  for (const r of allAnswers) {
    if (!submissionTexts[r.submission_id]) {
      submissionTexts[r.submission_id] = { studentId: r.student_id, name: r.student_name, text: "" };
    }
    submissionTexts[r.submission_id].text += " " + r.answer_text;
  }

  const submIds = Object.keys(submissionTexts).map(Number);
  const results: Array<{ submissionId: number; studentName: string; riskScore: number; flags: string[] }> = [];

  for (let i = 0; i < submIds.length; i++) {
    const sid = submIds[i];
    const sub = submissionTexts[sid];
    const flags: string[] = [];
    let risk = 0;

    // AI phrase check
    const aiSignal = aiTextSignalScore(sub.text);
    if (aiSignal > 0.4) { flags.push("AI_TEXT_SIGNALS"); risk += aiSignal * 0.30; }

    // Peer similarity
    let maxSim = 0;
    for (let j = 0; j < submIds.length; j++) {
      if (i === j) continue;
      const sim = tokenSimilarity(sub.text, submissionTexts[submIds[j]].text);
      if (sim > maxSim) maxSim = sim;
    }
    if (maxSim > 0.75) { flags.push("HIGH_PEER_SIMILARITY"); risk += 0.35; }
    else if (maxSim > 0.55) { flags.push("MODERATE_PEER_SIMILARITY"); risk += 0.15; }

    risk = Math.min(risk, 1.0);
    results.push({
      submissionId: sid,
      studentName: sub.name,
      riskScore: parseFloat(risk.toFixed(3)),
      flags,
    });
  }

  results.sort((a, b) => b.riskScore - a.riskScore);

  res.json({
    examId,
    analyzed: results.length,
    flaggedCount: results.filter(r => r.riskScore >= 0.40).length,
    highRiskCount: results.filter(r => r.riskScore >= 0.75).length,
    results,
  });
});

// ── GET /shield/anomaly/report/:examId ────────────────────────────────────────

anomalyDetectionRouter.get("/shield/anomaly/report/:examId", async (req: AuthRequest, res: Response): Promise<void> => {
  const examId = parseInt(req.params.examId, 10);
  if (isNaN(examId)) { res.status(400).json({ message: "Invalid exam ID" }); return; }

  const { rows } = await pool.query(`
    SELECT
      sm.id                              AS submission_id,
      a.name                             AS student_name,
      sm.student_id,
      sm.integrity_risk_score,
      sm.integrity_flags,
      sm.integrity_reviewed,
      sm.submitted_at
    FROM assessment_submissions sm
    JOIN accounts a ON a.id = sm.student_id
    WHERE (sm.exam_id = $1)
      AND sm.integrity_risk_score IS NOT NULL
    ORDER BY sm.integrity_risk_score DESC`, [examId]);

  res.json({
    examId,
    totalFlagged: rows.length,
    highRisk:  rows.filter((r: any) => r.integrity_risk_score >= 75).length,
    mediumRisk: rows.filter((r: any) => r.integrity_risk_score >= 40 && r.integrity_risk_score < 75).length,
    submissions: rows.map((r: any) => ({
      ...r,
      risk_level: riskLevel(r.integrity_risk_score / 100),
      integrity_flags: r.integrity_flags ?? [],
    })),
  });
});

// ── PATCH /shield/anomaly/resolve/:submissionId ───────────────────────────────

anomalyDetectionRouter.patch("/shield/anomaly/resolve/:submissionId", async (req: AuthRequest, res: Response): Promise<void> => {
  const submissionId = parseInt(req.params.submissionId, 10);
  const { decision } = req.body as { decision: "cleared" | "confirmed" };

  await pool.query(
    `UPDATE assessment_submissions
     SET integrity_reviewed = true, integrity_decision = $1
     WHERE id = $2`,
    [decision, submissionId],
  ).catch(() => {});

  res.json({ success: true, submissionId, decision });
});
