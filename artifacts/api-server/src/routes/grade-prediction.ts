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

/* ── GET /api/grade-prediction/class-forecast ───────────────────────────── */
/* Runs the statistical prediction model for ALL students in a subject        */
gradePredictionRouter.get(
  "/class-forecast",
  requireRole("teacher", "admin", "super_admin"),
  safeHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const teacherId = req.userId!;
      const subjectId = req.query.subjectId ? parseInt(req.query.subjectId as string) : null;
      const examId    = req.query.examId    ? parseInt(req.query.examId    as string) : null;

      if (!subjectId && !examId) {
        res.status(400).json({ error: "subjectId or examId required" });
        return;
      }

      /* ── 1. Verify teacher owns subject ──────────────────────────────── */
      if (subjectId) {
        const { rows: [sub] } = await pool.query(
          `SELECT id FROM subjects WHERE id=$1 AND teacher_account_id=$2`,
          [subjectId, teacherId],
        );
        if (!sub && req.role !== "admin" && req.role !== "super_admin") {
          res.status(403).json({ error: "Subject not found or access denied" });
          return;
        }
      }

      /* ── 2. Resolve subjectId from examId if needed ──────────────────── */
      let resolvedSubjectId = subjectId;
      let resolvedExamId = examId;
      if (!resolvedSubjectId && examId) {
        const { rows: [ex] } = await pool.query(
          `SELECT subject_id FROM exams WHERE id=$1`, [examId],
        );
        resolvedSubjectId = ex?.subject_id ?? null;
      }

      /* ── 3. Pull all mark data for teacher's students in this subject ── */
      const examFilter = resolvedExamId
        ? `AND e.id = ${resolvedExamId}`
        : resolvedSubjectId ? `AND e.subject_id = ${resolvedSubjectId}` : "";

      const { rows: allMarks } = await pool.query(`
        SELECT
          s.id            AS student_id,
          s.student_name,
          s.student_code,
          sm.marks_scored::numeric AS marks_scored,
          eq.max_marks::numeric    AS max_marks,
          eq.topic,
          sm.teacher_override_marks,
          e.exam_date,
          e.name   AS exam_name,
          e.id     AS exam_id
        FROM students s
        JOIN student_marks sm ON sm.student_id = s.id
        JOIN exam_questions eq ON eq.id = sm.question_id
        JOIN exams e ON e.id = eq.exam_id
        WHERE s.teacher_account_id = $1
          AND sm.marks_scored IS NOT NULL
          AND eq.max_marks > 0
          ${examFilter}
        ORDER BY s.id, e.exam_date DESC NULLS LAST, sm.id DESC
      `, [teacherId]);

      if (allMarks.length === 0) {
        res.json({
          students: [],
          distribution: [],
          class_stats: { mean: 0, median: 0, pass_rate: 0, at_risk_count: 0, borderline_count: 0, on_track_count: 0, total_students: 0 },
          subject_id: resolvedSubjectId,
          exam_id: resolvedExamId,
          disclaimer: "No student mark data found for this subject/exam.",
        });
        return;
      }

      /* ── 4. Pull attendance per student (for context) ────────────────── */
      const studentIds = [...new Set(allMarks.map((r: any) => r.student_id))];
      const { rows: attendanceRows } = await pool.query(`
        SELECT a.student_id,
               COUNT(*) FILTER (WHERE a.status='Present')::int AS present,
               COUNT(*)::int AS total
        FROM attendance a
        WHERE a.student_id = ANY($1::int[])
        GROUP BY a.student_id
      `, [studentIds]).catch(() => ({ rows: [] }));

      const attendanceMap: Record<number, { present: number; total: number }> = {};
      for (const r of attendanceRows) {
        attendanceMap[r.student_id] = { present: parseInt(r.present), total: parseInt(r.total) };
      }

      /* ── 5. Group marks by student and run prediction model ──────────── */
      const studentMarkMap: Record<number, { name: string; code: string; marks: any[] }> = {};
      for (const row of allMarks) {
        if (!studentMarkMap[row.student_id]) {
          studentMarkMap[row.student_id] = { name: row.student_name, code: row.student_code, marks: [] };
        }
        studentMarkMap[row.student_id].marks.push(row);
      }

      const calcAvg = (arr: any[]) => {
        const valid = arr.filter((r: any) => r.max_marks > 0 && r.marks_scored != null);
        if (!valid.length) return 0;
        return valid.reduce((s: number, r: any) => s + (Number(r.marks_scored) / Number(r.max_marks)) * 100, 0) / valid.length;
      };

      const predictions: any[] = [];

      for (const [sidStr, data] of Object.entries(studentMarkMap)) {
        const sid = parseInt(sidStr);
        const marks = data.marks;
        const recentCount = Math.max(1, Math.ceil(marks.length * 0.4));
        const recent = marks.slice(0, recentCount);
        const recentAvg = calcAvg(recent);
        const overallAvg = calcAvg(marks);

        const topicMap: Record<string, { scored: number; total: number }> = {};
        for (const r of marks) {
          if (!r.topic) continue;
          if (!topicMap[r.topic]) topicMap[r.topic] = { scored: 0, total: 0 };
          topicMap[r.topic].scored += Number(r.marks_scored) || 0;
          topicMap[r.topic].total  += Number(r.max_marks) || 0;
        }
        const weakTopics = Object.entries(topicMap)
          .map(([t, d]) => ({ topic: t, pct: d.total > 0 ? (d.scored / d.total) * 100 : 0 }))
          .filter((t) => t.pct < 55)
          .sort((a, b) => a.pct - b.pct)
          .map((t) => t.topic);

        const overrideCount = marks.filter((r: any) => r.teacher_override_marks != null).length;
        const overrideFreq  = marks.length > 0 ? (overrideCount / marks.length) * 10 : 0;
        const examCount     = new Set(marks.map((r: any) => r.exam_id)).size;

        const trendFactor   = recentAvg >= overallAvg ? 1.03 : 0.97;
        const weakPenalty   = Math.min(weakTopics.length * 2.5, 20);
        const overridePenalty = Math.min(overrideFreq * 1.5, 10);
        const attendance    = attendanceMap[sid];
        const attendanceRate = attendance && attendance.total > 0
          ? attendance.present / attendance.total
          : 1;
        const absencePenalty = attendanceRate < 0.7 ? (0.7 - attendanceRate) * 30 : 0;

        const basePrediction = Math.max(0, Math.min(100,
          recentAvg * trendFactor - weakPenalty - overridePenalty - absencePenalty,
        ));

        const range: [number, number] = [
          Math.round(Math.max(0, basePrediction - 8)),
          Math.round(Math.min(100, basePrediction + 6)),
        ];
        const midpoint      = (range[0] + range[1]) / 2;
        const passProb      = Math.round(Math.min(99, Math.max(1, (basePrediction - 45) * 2 + 50)));
        const riskLevel     = basePrediction < 45 ? "high" : basePrediction < 62 ? "medium" : "low";
        const trend         = recentAvg > overallAvg + 3 ? "improving"
                            : recentAvg < overallAvg - 3 ? "declining"
                            : "stable";
        const confidence    = examCount >= 5 ? "high" : examCount >= 2 ? "medium" : "low";

        const topicBreakdown = Object.entries(topicMap).map(([t, d]) => ({
          topic: t,
          pct: d.total > 0 ? Math.round((d.scored / d.total) * 100) : 0,
          weak: d.total > 0 && (d.scored / d.total) < 0.55,
        })).sort((a, b) => a.pct - b.pct);

        predictions.push({
          student_id:          sid,
          student_name:        data.name,
          student_code:        data.code,
          predicted_range:     range,
          predicted_midpoint:  Math.round(midpoint),
          pass_probability:    passProb / 100,
          risk_level:          riskLevel,
          trend,
          confidence,
          recent_avg:          Math.round(recentAvg),
          overall_avg:         Math.round(overallAvg),
          attendance_rate:     attendance ? Math.round(attendanceRate * 100) : null,
          data_points:         marks.length,
          exam_count:          examCount,
          top_weak_topic:      weakTopics[0] ?? null,
          weak_topic_count:    weakTopics.length,
          topic_breakdown:     topicBreakdown.slice(0, 8),
          key_factors: [
            `Recent avg: ${Math.round(recentAvg)}%`,
            weakTopics.length > 0 ? `Weak in ${weakTopics.slice(0, 2).join(", ")}` : "No major weak topics",
            trend !== "stable" ? `Trend: ${trend}` : null,
            attendance && attendanceRate < 0.75 ? `Low attendance: ${Math.round(attendanceRate * 100)}%` : null,
          ].filter(Boolean),
        });
      }

      predictions.sort((a, b) => a.predicted_midpoint - b.predicted_midpoint);

      /* ── 6. Score distribution buckets ──────────────────────────────── */
      const buckets = [
        { label: "0–20",  min: 0,  max: 20,  count: 0, students: [] as string[] },
        { label: "21–40", min: 21, max: 40,  count: 0, students: [] as string[] },
        { label: "41–50", min: 41, max: 50,  count: 0, students: [] as string[] },
        { label: "51–65", min: 51, max: 65,  count: 0, students: [] as string[] },
        { label: "66–80", min: 66, max: 80,  count: 0, students: [] as string[] },
        { label: "81–100",min: 81, max: 100, count: 0, students: [] as string[] },
      ];
      for (const p of predictions) {
        const bucket = buckets.find((b) => p.predicted_midpoint >= b.min && p.predicted_midpoint <= b.max);
        if (bucket) { bucket.count++; bucket.students.push(p.student_name); }
      }

      /* ── 7. Class stats ──────────────────────────────────────────────── */
      const midpoints   = predictions.map((p) => p.predicted_midpoint);
      const mean        = midpoints.length > 0
        ? Math.round(midpoints.reduce((s, v) => s + v, 0) / midpoints.length)
        : 0;
      const sorted      = [...midpoints].sort((a, b) => a - b);
      const median      = sorted.length > 0
        ? sorted[Math.floor(sorted.length / 2)]
        : 0;
      const passRate    = midpoints.length > 0
        ? Math.round(midpoints.filter((m) => m >= 50).length / midpoints.length * 100)
        : 0;

      const classStats = {
        mean,
        median,
        pass_rate:        passRate,
        at_risk_count:    predictions.filter((p) => p.risk_level === "high").length,
        borderline_count: predictions.filter((p) => p.risk_level === "medium").length,
        on_track_count:   predictions.filter((p) => p.risk_level === "low").length,
        total_students:   predictions.length,
        improving_count:  predictions.filter((p) => p.trend === "improving").length,
        declining_count:  predictions.filter((p) => p.trend === "declining").length,
      };

      /* ── 8. Subject/exam info ────────────────────────────────────────── */
      let subjectInfo = null;
      if (resolvedSubjectId) {
        const { rows: [si] } = await pool.query(
          `SELECT name, board, level FROM subjects WHERE id=$1`, [resolvedSubjectId],
        ).catch(() => ({ rows: [] }));
        subjectInfo = si ?? null;
      }

      let examInfo = null;
      if (resolvedExamId) {
        const { rows: [ei] } = await pool.query(
          `SELECT name, exam_date, total_marks FROM exams WHERE id=$1`, [resolvedExamId],
        ).catch(() => ({ rows: [] }));
        examInfo = ei ?? null;
      }

      res.json({
        students:    predictions,
        distribution: buckets,
        class_stats: classStats,
        subject_id:  resolvedSubjectId,
        exam_id:     resolvedExamId,
        subject:     subjectInfo,
        exam:        examInfo,
        disclaimer:  "Statistical model only — not final grades. Predictions use historical marks, recency weighting, topic analysis, and attendance.",
        generated_at: new Date().toISOString(),
      });

    } catch (err) {
      logError(err, { route: "grade-prediction/class-forecast" });
      res.status(500).json({ error: "Failed to generate class forecast" });
    }
  }),
);

/* ── GET /api/grade-prediction/teacher-subjects ─────────────────────────── */
/* Subjects with exam data for the teacher subject selector                   */
gradePredictionRouter.get(
  "/teacher-subjects",
  requireRole("teacher", "admin", "super_admin"),
  safeHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const teacherId = req.userId!;
      const { rows } = await pool.query(`
        SELECT
          su.id,
          su.name,
          su.board,
          su.level,
          su.syllabus_code,
          COUNT(DISTINCT e.id)::int   AS exam_count,
          COUNT(DISTINCT sm.student_id)::int AS student_count,
          MAX(e.exam_date)            AS last_exam_date
        FROM subjects su
        JOIN exams e   ON e.subject_id = su.id AND e.status = 'published'
        JOIN exam_questions eq ON eq.exam_id = e.id
        JOIN student_marks sm ON sm.question_id = eq.id AND sm.marks_scored IS NOT NULL
        WHERE su.teacher_account_id = $1
        GROUP BY su.id
        HAVING COUNT(DISTINCT sm.student_id) > 0
        ORDER BY student_count DESC, su.name
      `, [teacherId]);
      res.json({ subjects: rows });
    } catch (err) {
      logError(err, { route: "grade-prediction/teacher-subjects" });
      res.status(500).json({ error: "Failed" });
    }
  }),
);

/* ── GET /api/grade-prediction/subject-exams/:subjectId ─────────────────── */
gradePredictionRouter.get(
  "/subject-exams/:subjectId",
  requireRole("teacher", "admin", "super_admin"),
  safeHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const teacherId = req.userId!;
      const subjectId = parseInt(req.params.subjectId);
      const { rows } = await pool.query(`
        SELECT e.id, e.name, e.exam_date, e.total_marks,
               COUNT(DISTINCT sm.student_id)::int AS students_with_data
        FROM exams e
        JOIN exam_questions eq ON eq.exam_id = e.id
        JOIN student_marks sm ON sm.question_id = eq.id
        WHERE e.subject_id = $1 AND e.teacher_account_id = $2
        GROUP BY e.id
        HAVING COUNT(sm.id) > 0
        ORDER BY e.exam_date DESC NULLS LAST
      `, [subjectId, teacherId]);
      res.json({ exams: rows });
    } catch (err) {
      logError(err, { route: `grade-prediction/subject-exams/${req.params.subjectId}` });
      res.status(500).json({ error: "Failed" });
    }
  }),
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
