import { Router, Response } from "express";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { pool } from "@workspace/db";
import { generateAIResponse, AI_AVAILABLE } from "../services/ai";

export const studyPlanRouter = Router();

const studentGuard = [authenticate, requireRole("student")];

studyPlanRouter.post("/generate", ...studentGuard, async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.userId!;
    const { subjectId, examDate, hoursPerDay = 2, focusAreas = [] } = req.body;

    const [studentRes, marksRes, echoRes, homeworkRes] = await Promise.all([
      pool.query(
        `SELECT s.student_name, s.grade_level, a.display_name
         FROM students s LEFT JOIN accounts a ON a.id = s.account_id
         WHERE s.account_id = $1 LIMIT 1`,
        [studentId]
      ),
      pool.query(
        `SELECT e.title AS exam_title, sm.marks_scored, e.total_marks,
                ROUND((sm.marks_scored::float / NULLIF(e.total_marks,0)) * 100, 1) AS pct,
                sub.name AS subject_name
         FROM student_marks sm
         JOIN exams e ON e.id = sm.exam_id
         JOIN subjects sub ON sub.id = e.subject_id
         WHERE sm.student_id = (SELECT id FROM students WHERE account_id = $1 LIMIT 1)
           AND ($2::int IS NULL OR sub.id = $2)
           AND sm.approved_at IS NOT NULL
         ORDER BY e.created_at DESC LIMIT 10`,
        [studentId, subjectId ?? null]
      ),
      pool.query(
        `SELECT weak_topics, strong_topics, learning_pace, burnout_risk, retention_scores
         FROM echo_memory WHERE student_id = (SELECT id FROM students WHERE account_id = $1 LIMIT 1)`,
        [studentId]
      ),
      pool.query(
        `SELECT h.title, h.due_date, hs.grade
         FROM homework h
         LEFT JOIN homework_submissions hs ON hs.homework_id = h.id
           AND hs.student_id = (SELECT id FROM students WHERE account_id = $1 LIMIT 1)
         WHERE h.is_published = true
           AND h.due_date >= CURRENT_DATE
           AND ($2::int IS NULL OR h.subject_id = $2)
         ORDER BY h.due_date ASC LIMIT 5`,
        [studentId, subjectId ?? null]
      ),
    ]);

    const student = studentRes.rows[0];
    const echo = echoRes.rows[0] ?? {};
    const marks = marksRes.rows;
    const upcoming = homeworkRes.rows;

    const avgPct = marks.length
      ? Math.round(marks.reduce((s: number, r: any) => s + parseFloat(r.pct ?? "0"), 0) / marks.length)
      : null;

    const weakTopics: string[] = echo.weak_topics ?? focusAreas;
    const strongTopics: string[] = echo.strong_topics ?? [];
    const burnout = echo.burnout_risk ?? "low";
    const pace = echo.learning_pace ?? "medium";

    if (!AI_AVAILABLE) {
      const fallbackPlan = buildFallbackPlan({
        studentName: student?.display_name ?? student?.student_name ?? "Student",
        weakTopics,
        strongTopics,
        avgPct,
        hoursPerDay,
        examDate,
        upcoming,
        pace,
        burnout,
      });
      return res.json({ plan: fallbackPlan, source: "template", ai_available: false });
    }

    const prompt = buildPrompt({
      studentName: student?.display_name ?? student?.student_name ?? "Student",
      gradeLevel: student?.grade_level,
      weakTopics,
      strongTopics,
      avgPct,
      marks,
      hoursPerDay,
      examDate,
      upcoming,
      pace,
      burnout,
      focusAreas,
    });

    const aiText = await generateAIResponse(
      [
        { role: "system", content: "You are an expert academic coach generating personalised weekly study plans for students. Output structured JSON only." },
        { role: "user", content: prompt },
      ],
      { maxTokens: 1200, module: "study_plan", userId: studentId }
    );

    let plan: any;
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      plan = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: aiText };
    } catch {
      plan = { raw: aiText };
    }

    await pool.query(
      `INSERT INTO ai_learning_events
         (student_id, event_type, module, action, outcome, tokens_used, accepted, created_at)
       VALUES (
         (SELECT id FROM students WHERE account_id = $1 LIMIT 1),
         'study_plan', 'study_plan', 'generate',
         $2, 0, false, NOW()
       )`,
      [studentId, plan.raw ? "raw_text" : "structured"]
    ).catch(() => {});

    return res.json({ plan, source: "ai", ai_available: true });
  } catch (err: any) {
    console.error("[study-plan] error:", err.message);
    return res.status(500).json({ error: "Failed to generate study plan" });
  }
});

studyPlanRouter.get("/history", ...studentGuard, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, event_type, action, outcome, created_at
       FROM ai_learning_events
       WHERE student_id = (SELECT id FROM students WHERE account_id = $1 LIMIT 1)
         AND module = 'study_plan'
       ORDER BY created_at DESC LIMIT 10`,
      [req.userId!]
    );
    return res.json({ history: rows });
  } catch {
    return res.status(500).json({ error: "Failed to load history" });
  }
});

function buildPrompt(ctx: any): string {
  return `Generate a personalised study plan for ${ctx.studentName} (${ctx.gradeLevel ?? "unknown grade"}).

STUDENT PROFILE:
- Average score: ${ctx.avgPct !== null ? `${ctx.avgPct}%` : "No data yet"}
- Weak topics: ${ctx.weakTopics.length ? ctx.weakTopics.join(", ") : "none identified"}
- Strong topics: ${ctx.strongTopics.length ? ctx.strongTopics.join(", ") : "none identified"}
- Learning pace: ${ctx.pace}
- Burnout risk: ${ctx.burnout}
- Available hours/day: ${ctx.hoursPerDay}
${ctx.examDate ? `- Exam date: ${ctx.examDate}` : ""}

RECENT PERFORMANCE (last 10 assessments):
${ctx.marks.length ? ctx.marks.map((m: any) => `- ${m.exam_title}: ${m.pct}%`).join("\n") : "No assessments yet"}

UPCOMING ASSIGNMENTS:
${ctx.upcoming.length ? ctx.upcoming.map((h: any) => `- ${h.title} (due: ${h.due_date})`).join("\n") : "None"}

Return ONLY a JSON object in this exact format:
{
  "title": "Weekly Study Plan",
  "summary": "One-paragraph personalised summary",
  "daily_schedule": [
    { "day": "Monday", "sessions": [{ "topic": "...", "duration_min": 45, "type": "review|practice|new_content", "priority": "high|medium|low" }] }
  ],
  "weekly_goals": ["goal1", "goal2", "goal3"],
  "focus_areas": ["topic1", "topic2"],
  "tips": ["tip1", "tip2"],
  "estimated_readiness_pct": 70
}`;
}

function buildFallbackPlan(ctx: any): object {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const topics = ctx.weakTopics.length ? ctx.weakTopics : ["Core concepts", "Practice problems", "Past papers"];
  const sessionsPerDay = Math.max(1, Math.floor(ctx.hoursPerDay));

  return {
    title: "Personalised Study Plan",
    summary: `This plan is tailored for ${ctx.studentName}. Focus on weak areas with ${ctx.hoursPerDay} study hours per day. ${ctx.burnout === "high" ? "Take regular breaks — burnout risk is elevated." : "Maintain a consistent daily routine."}`,
    daily_schedule: days.slice(0, 5).map((day, i) => ({
      day,
      sessions: Array.from({ length: sessionsPerDay }, (_, j) => ({
        topic: topics[(i + j) % topics.length] ?? "Revision",
        duration_min: 50,
        type: j === 0 ? "review" : "practice",
        priority: ctx.weakTopics.includes(topics[(i + j) % topics.length]) ? "high" : "medium",
      })),
    })),
    weekly_goals: [
      `Cover ${topics.slice(0, 2).join(" and ")}`,
      "Complete at least 2 practice sets",
      ctx.avgPct !== null ? `Aim to improve average from ${ctx.avgPct}% to ${Math.min(ctx.avgPct + 5, 100)}%` : "Attempt one full past paper",
    ],
    focus_areas: topics.slice(0, 3),
    tips: [
      ctx.pace === "slow" ? "Use shorter, frequent sessions (30 min) rather than long blocks." : "Group related topics into 50-minute deep work blocks.",
      "Review your Echo profile weekly to track weak area improvement.",
      ctx.upcoming.length ? `Complete "${ctx.upcoming[0]?.title}" before your next session.` : "Set a weekly revision goal and track it.",
    ],
    estimated_readiness_pct: ctx.avgPct ?? 50,
    source: "template",
    ai_available: false,
  };
}
