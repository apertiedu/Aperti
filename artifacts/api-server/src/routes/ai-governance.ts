import { Router, Response } from "express";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { pool } from "@workspace/db";
import { generateAIResponse, AI_AVAILABLE } from "../services/ai";

export const aiGovernanceRouter = Router();
aiGovernanceRouter.use(authenticate);

const adminGuard = requireRole("admin", "super_admin");

// ── GET /api/ai-governance/teacher-stats ──────────────────────────────────────
aiGovernanceRouter.get("/teacher-stats", adminGuard, async (_req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        r.reviewer_id AS teacher_id,
        a.name AS teacher_name,
        COUNT(*)::int                                         AS total_reviews,
        ROUND(100.0 * COUNT(CASE WHEN r.decision <> 'approved' THEN 1 END) / COUNT(*), 1)
                                                              AS override_rate,
        ROUND(AVG(ABS(r.grade_delta)) FILTER (WHERE r.grade_delta IS NOT NULL)::numeric, 2)
                                                              AS avg_delta,
        ROUND(AVG(r.original_ai_confidence::numeric) FILTER (WHERE r.decision <> 'approved'), 3)
                                                              AS avg_confidence_overridden,
        ROUND(AVG(r.grade_delta::numeric) FILTER (WHERE r.grade_delta IS NOT NULL), 2)
                                                              AS strictness_index,
        MODE() WITHIN GROUP (ORDER BY r.override_reason_category)
                                                              AS most_common_reason,
        ROUND(AVG(
          EXTRACT(EPOCH FROM (r.created_at - ss.submitted_at)) / 60.0
        )::numeric, 1)                                        AS avg_review_latency_min
      FROM ai_grade_reviews r
      JOIN accounts a ON a.id = r.reviewer_id
      JOIN snapgrade_submissions ss ON ss.id = r.submission_id
      GROUP BY r.reviewer_id, a.name
      ORDER BY total_reviews DESC
      LIMIT 20
    `);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch teacher stats" });
  }
});

// ── GET /api/ai-governance/hardest-questions ──────────────────────────────────
aiGovernanceRouter.get("/hardest-questions", adminGuard, async (_req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        ss.homework_id,
        h.title AS question_title,
        COUNT(ss.id)::int                                       AS total_submissions,
        COUNT(CASE WHEN r.decision IS NOT NULL AND r.decision <> 'approved' THEN 1 END)::int
                                                                AS overrides,
        ROUND(100.0 * COUNT(CASE WHEN r.decision IS NOT NULL AND r.decision <> 'approved' THEN 1 END)
          / NULLIF(COUNT(ss.id), 0), 1)                        AS disagreement_rate,
        ROUND(AVG(ss.ai_confidence::numeric), 3)               AS avg_confidence
      FROM snapgrade_submissions ss
      LEFT JOIN homework h ON h.id = ss.homework_id
      LEFT JOIN ai_grade_reviews r ON r.submission_id = ss.id
      WHERE ss.homework_id IS NOT NULL
      GROUP BY ss.homework_id, h.title
      HAVING COUNT(ss.id) >= 2
      ORDER BY disagreement_rate DESC NULLS LAST
      LIMIT 10
    `);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch hardest questions" });
  }
});

// ── GET /api/ai-governance/subject-confidence ─────────────────────────────────
aiGovernanceRouter.get("/subject-confidence", adminGuard, async (_req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        sub.name                                        AS subject,
        COUNT(ss.id)::int                               AS total_submissions,
        ROUND(AVG(ss.ai_confidence::numeric), 3)        AS avg_confidence,
        COUNT(CASE WHEN ss.confidence_level = 'high'   THEN 1 END)::int AS high_count,
        COUNT(CASE WHEN ss.confidence_level = 'medium' THEN 1 END)::int AS medium_count,
        COUNT(CASE WHEN ss.confidence_level = 'low'    THEN 1 END)::int AS low_count,
        COUNT(CASE WHEN ss.teacher_reviewed = TRUE      THEN 1 END)::int AS reviewed
      FROM snapgrade_submissions ss
      JOIN homework hw ON hw.id = ss.homework_id
      JOIN subjects sub ON sub.id = hw.subject_id
      GROUP BY sub.name
      ORDER BY avg_confidence ASC
      LIMIT 15
    `);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch subject confidence" });
  }
});

// ── GET /api/ai-governance/override-rate-trend ────────────────────────────────
aiGovernanceRouter.get("/override-rate-trend", adminGuard, async (req: AuthRequest, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const { rows } = await pool.query(`
      SELECT
        DATE_TRUNC('day', r.created_at)::date        AS day,
        COUNT(*)::int                                  AS total_reviews,
        COUNT(CASE WHEN r.decision = 'approved'  THEN 1 END)::int AS approved,
        COUNT(CASE WHEN r.decision = 'modified'  THEN 1 END)::int AS modified,
        COUNT(CASE WHEN r.decision = 'rejected'  THEN 1 END)::int AS rejected,
        ROUND(100.0 * COUNT(CASE WHEN r.decision <> 'approved' THEN 1 END)
          / NULLIF(COUNT(*), 0), 1)                   AS override_rate
      FROM ai_grade_reviews r
      WHERE r.created_at >= NOW() - ($1 || ' days')::interval
      GROUP BY 1
      ORDER BY 1
    `, [days]);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch override rate trend" });
  }
});

// ── GET /api/ai-governance/failure-rate-trend ─────────────────────────────────
aiGovernanceRouter.get("/failure-rate-trend", adminGuard, async (req: AuthRequest, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 14;
    const { rows } = await pool.query(`
      SELECT
        DATE_TRUNC('day', created_at)::date         AS day,
        COUNT(*)::int                                AS total_calls,
        COUNT(CASE WHEN status='error' THEN 1 END)::int AS failures,
        ROUND(100.0 * COUNT(CASE WHEN status='error' THEN 1 END)
          / NULLIF(COUNT(*), 0), 1)                  AS failure_rate
      FROM ai_interactions
      WHERE created_at >= NOW() - ($1 || ' days')::interval
        AND interaction_type = 'grade'
      GROUP BY 1
      ORDER BY 1
    `, [days]);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch failure rate trend" });
  }
});

// ── GET /api/ai-governance/summary ────────────────────────────────────────────
aiGovernanceRouter.get("/summary", adminGuard, async (_req: AuthRequest, res: Response) => {
  try {
    const [overallR, failR, learningR] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)::int                                         AS total_reviews,
          ROUND(100.0 * COUNT(CASE WHEN decision <> 'approved' THEN 1 END)
            / NULLIF(COUNT(*), 0), 1)                          AS override_rate,
          ROUND(AVG(original_ai_confidence::numeric), 3)       AS avg_confidence,
          ROUND(AVG(ABS(grade_delta::numeric)) FILTER (WHERE grade_delta IS NOT NULL), 2)
                                                                AS avg_delta
        FROM ai_grade_reviews
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `),
      pool.query(`
        SELECT
          COUNT(*)::int                              AS total_grade_calls,
          COUNT(CASE WHEN status='error' THEN 1 END)::int AS failures,
          ROUND(100.0 * COUNT(CASE WHEN status='error' THEN 1 END)
            / NULLIF(COUNT(*), 0), 1)               AS failure_rate
        FROM ai_interactions
        WHERE interaction_type='grade'
          AND created_at >= NOW() - INTERVAL '30 days'
      `),
      pool.query(`
        SELECT COUNT(*)::int AS total_events FROM ai_learning_events
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `),
    ]);
    res.json({
      reviews: overallR.rows[0] ?? {},
      grading: failR.rows[0] ?? {},
      learning: learningR.rows[0] ?? {},
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch governance summary" });
  }
});

// ── POST /api/ai-governance/generate-rubric ───────────────────────────────────
aiGovernanceRouter.post("/generate-rubric", requireRole("teacher", "admin", "super_admin"), async (req: AuthRequest, res: Response) => {
  const { question, subject, max_score = 10, homework_id } = req.body as {
    question: string;
    subject?: string;
    max_score?: number;
    homework_id?: number;
  };

  if (!question) {
    res.status(400).json({ error: "question is required" });
    return;
  }

  let historicalContext = "";

  if (homework_id) {
    try {
      const { rows: pastRows } = await pool.query(`
        SELECT ss.grade, ss.feedback, ss.ai_confidence, ss.reasoning_summary,
               r.override_grade, r.override_reason_category, r.decision,
               LEFT(ss.ocr_text, 300) AS sample_answer
        FROM snapgrade_submissions ss
        LEFT JOIN ai_grade_reviews r ON r.submission_id = ss.id
        WHERE ss.homework_id = $1
        ORDER BY ss.submitted_at DESC
        LIMIT 8
      `, [homework_id]);

      if (pastRows.length > 0) {
        historicalContext = `\n\nPAST GRADING PATTERNS (${pastRows.length} submissions):\n` +
          pastRows.slice(0, 4).map((r: any) =>
            `- AI grade: ${r.grade ?? "N/A"}, Final: ${r.override_grade ?? r.grade ?? "N/A"}, Decision: ${r.decision ?? "pending"}${r.override_reason_category ? `, Reason: ${r.override_reason_category}` : ""}`
          ).join("\n");
      }
    } catch {}
  }

  if (!AI_AVAILABLE) {
    res.json({
      ok: false,
      fallback: true,
      rubric: {
        question,
        max_score,
        rubric_confidence_score: 0,
        rubric_stability_score: 0,
        criteria: [
          { title: "Content", weight: 0.5, expected_points: ["Key concept addressed", "Accurate information provided"] },
          { title: "Clarity", weight: 0.3, expected_points: ["Clear communication", "Logical structure"] },
          { title: "Detail", weight: 0.2, expected_points: ["Supporting examples", "Specific terminology used"] },
        ],
      },
      note: "AI unavailable — generic rubric generated. Please review and customise.",
    });
    return;
  }

  const prompt = `You are an expert ${subject || "IGCSE"} curriculum designer. Analyse the following question and generate a structured grading rubric.

QUESTION: "${question}"
MAX SCORE: ${max_score} marks
${historicalContext}

Generate a rubric with 3-5 criteria. Respond with JSON only:
{
  "question": "${question}",
  "max_score": ${max_score},
  "rubric_confidence_score": <0.0-1.0 how confident you are this rubric is appropriate>,
  "rubric_stability_score": <0.0-1.0 how consistent this rubric would be across different graders>,
  "suggested_by": "ai",
  "approved": false,
  "criteria": [
    {
      "title": "<criterion name>",
      "weight": <fraction 0-1, all weights must sum to 1>,
      "expected_points": ["<specific point to award marks>", "..."]
    }
  ]
}`;

  const result = await generateAIResponse(prompt, {
    maxTokens: 1000,
    module: "rubric-generator",
    userId: req.userId,
  });

  if (!result.ok || !result.text) {
    res.json({
      ok: false,
      status: "degraded",
      message: "AI temporarily unavailable",
      rubric: null,
    });
    return;
  }

  try {
    const match = result.text.match(/\{[\s\S]*\}/);
    const rubric = match ? JSON.parse(match[0]) : null;

    if (rubric && homework_id) {
      pool.query(
        `INSERT INTO ai_learning_events (module, context_meta, created_at)
         VALUES ($1, $2, NOW())`,
        ["rubric-generator", JSON.stringify({ homework_id, question: question.slice(0, 100), subject })]
      ).catch(() => {});
    }

    res.json({ ok: true, rubric, latencyMs: result.latencyMs });
  } catch {
    res.json({ ok: false, error: "Failed to parse rubric response", raw: result.text?.slice(0, 500) });
  }
});

// ── POST /api/ai-governance/refresh-teacher-stats ─────────────────────────────
aiGovernanceRouter.post("/refresh-teacher-stats", adminGuard, async (_req: AuthRequest, res: Response) => {
  try {
    await pool.query(`
      INSERT INTO teacher_ai_stats
        (teacher_id, override_rate, avg_delta, avg_confidence_overridden, strictness_index, total_reviews, last_updated)
      SELECT
        r.reviewer_id,
        ROUND(100.0 * COUNT(CASE WHEN r.decision <> 'approved' THEN 1 END) / NULLIF(COUNT(*), 0), 1),
        ROUND(AVG(ABS(r.grade_delta::numeric)) FILTER (WHERE r.grade_delta IS NOT NULL), 2),
        ROUND(AVG(r.original_ai_confidence::numeric) FILTER (WHERE r.decision <> 'approved'), 3),
        ROUND(AVG(r.grade_delta::numeric) FILTER (WHERE r.grade_delta IS NOT NULL), 2),
        COUNT(*)::int,
        NOW()
      FROM ai_grade_reviews r
      GROUP BY r.reviewer_id
      ON CONFLICT (teacher_id) DO UPDATE SET
        override_rate             = EXCLUDED.override_rate,
        avg_delta                 = EXCLUDED.avg_delta,
        avg_confidence_overridden = EXCLUDED.avg_confidence_overridden,
        strictness_index          = EXCLUDED.strictness_index,
        total_reviews             = EXCLUDED.total_reviews,
        last_updated              = NOW()
    `);
    res.json({ ok: true, message: "Teacher stats refreshed" });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to refresh teacher stats" });
  }
});
