import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { logError } from "../lib/log-error";

export const smartStudyPlanRouter = Router();
smartStudyPlanRouter.use(authenticate);

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
    const timeout = setTimeout(() => ctrl.abort(), 30_000);
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        max_tokens: 2000,
        temperature: 0.5,
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

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function daysBetween(from: string, to: string): number {
  return Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000));
}

/* ── GET /api/study-plan/exam-dates ─────────────────────────────────────── */
smartStudyPlanRouter.get(
  "/exam-dates",
  requireRole("student", "teacher", "admin", "super_admin"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const studentId = req.query.student_id ? parseInt(req.query.student_id as string) : null;
      let examQuery: { rows: any[] };

      if (studentId) {
        examQuery = await pool.query(`
          SELECT e.id, e.name, e.exam_date, s.name AS subject_name, e.total_marks
          FROM exams e
          JOIN subjects s ON s.id = e.subject_id
          JOIN students st ON st.teacher_account_id = e.teacher_account_id
          WHERE st.id = $1 AND e.exam_date >= CURRENT_DATE
          ORDER BY e.exam_date ASC
          LIMIT 10
        `, [studentId]);
      } else {
        examQuery = await pool.query(`
          SELECT e.id, e.name, e.exam_date, s.name AS subject_name, e.total_marks
          FROM exams e
          JOIN subjects s ON s.id = e.subject_id
          WHERE e.exam_date >= CURRENT_DATE
          ORDER BY e.exam_date ASC
          LIMIT 10
        `);
      }

      res.json({ exams: examQuery.rows });
    } catch (err) {
      logError(err, { route: "study-plan/exam-dates" });
      res.status(500).json({ error: "Failed to load exam dates" });
    }
  }
);

/* ── POST /api/study-plan/generate ──────────────────────────────────────── */
smartStudyPlanRouter.post(
  "/generate",
  requireRole("student", "teacher", "admin", "super_admin"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { student_id, exam_date, exam_name, hours_per_day } = req.body as {
        student_id: number;
        exam_date: string;
        exam_name?: string;
        hours_per_day?: number;
      };

      if (!student_id || !exam_date) {
        res.status(400).json({ error: "EXAM_DATE_REQUIRED_FROM_ADMIN" });
        return;
      }

      const today = new Date().toISOString().split("T")[0];

      if (exam_date <= today) {
        res.status(400).json({ error: "Exam date must be in the future" });
        return;
      }

      const totalDays = daysBetween(today, exam_date);

      if (totalDays < 2) {
        res.status(400).json({ error: "Exam is too soon to generate a meaningful study plan" });
        return;
      }

      const hoursPerDay = Math.min(hours_per_day ?? 3, 5);
      const learningDays = Math.round(totalDays * 0.7);
      const revisionDays = totalDays - learningDays;
      const revisionStartDate = addDays(today, learningDays);

      const { rows: marks } = await pool.query(`
        SELECT eq.topic, sm.marks_scored, eq.max_marks,
               COUNT(*) AS attempts
        FROM student_marks sm
        JOIN exam_questions eq ON eq.id = sm.question_id
        WHERE sm.student_id = $1
        GROUP BY eq.topic, sm.marks_scored, eq.max_marks
        ORDER BY (sm.marks_scored::numeric / NULLIF(eq.max_marks::numeric, 0)) ASC
        LIMIT 50
      `, [student_id]);

      const topicMap: Record<string, { scored: number; total: number }> = {};
      for (const r of marks) {
        if (!r.topic) continue;
        if (!topicMap[r.topic]) topicMap[r.topic] = { scored: 0, total: 0 };
        topicMap[r.topic].scored += parseFloat(r.marks_scored) || 0;
        topicMap[r.topic].total += parseFloat(r.max_marks) || 0;
      }

      const rankedTopics = Object.entries(topicMap)
        .map(([topic, d]) => ({ topic, pct: d.total > 0 ? Math.round((d.scored / d.total) * 100) : 50 }))
        .sort((a, b) => a.pct - b.pct);

      const weakTopics = rankedTopics.filter(t => t.pct < 60).map(t => t.topic);
      const mediumTopics = rankedTopics.filter(t => t.pct >= 60 && t.pct < 80).map(t => t.topic);
      const strongTopics = rankedTopics.filter(t => t.pct >= 80).map(t => t.topic);

      const { rows: echo } = await pool.query(
        `SELECT weak_topics FROM echo_memory WHERE student_id = $1 LIMIT 1`,
        [student_id]
      );
      const echoWeak: string[] = echo[0]?.weak_topics?.map((t: any) => t.topic ?? t) ?? [];
      const allWeakTopics = [...new Set([...weakTopics, ...echoWeak])];

      const systemPrompt = `You are an expert academic study planner AI.
Create a smart, exam-aware daily study schedule. CRITICAL RULES:
1. NEVER schedule any day after ${exam_date}
2. Last ${Math.max(2, revisionDays)} days (${revisionStartDate} to ${exam_date}) = REVISION ONLY
3. Weak topics appear MORE frequently (every 2-3 days)
4. Strong topics get lighter coverage (once or twice)
5. Max ${hoursPerDay} hours per day — never exceed this
6. Each day has 1-3 topics maximum
7. Mix learning and practice sessions
8. First 3 days focus on weakest topics

Respond with ONLY valid JSON:
{
  "daily_schedule": [
    {
      "date": "YYYY-MM-DD",
      "topics": ["topic1"],
      "focus_type": "learning" | "practice" | "revision",
      "estimated_hours": number,
      "notes": "brief study tip for this day"
    }
  ],
  "summary": {
    "total_learning_days": number,
    "total_revision_days": number,
    "weak_topic_sessions": number,
    "plan_rationale": "one sentence explaining the approach"
  }
}`;

      const userPrompt = `Student ID: ${student_id}
Exam: "${exam_name ?? "Final Exam"}" on ${exam_date}
Today: ${today}
Total days available: ${totalDays} (${learningDays} learning + ${revisionDays} revision)
Hours per day: ${hoursPerDay}
Revision phase starts: ${revisionStartDate}

Weak topics (priority HIGH — schedule first, repeat often): ${allWeakTopics.slice(0, 8).join(", ") || "None identified — use general review"}
Medium topics (priority MEDIUM): ${mediumTopics.slice(0, 5).join(", ") || "General practice"}
Strong topics (priority LOW): ${strongTopics.slice(0, 3).join(", ") || "Quick revision only"}

Generate a complete day-by-day schedule from ${today} to ${addDays(exam_date, -1)}.
HARD LIMIT: Last entry date must be ${addDays(exam_date, -1)} or earlier. Never include ${exam_date}.`;

      if (!API_KEY) {
        const fallbackSchedule: any[] = [];
        for (let i = 0; i < Math.min(totalDays - 1, 30); i++) {
          const date = addDays(today, i);
          const isRevision = i >= learningDays;
          const topicPool = isRevision ? allWeakTopics : [...allWeakTopics, ...mediumTopics];
          const topic = topicPool[i % Math.max(topicPool.length, 1)] ?? "General Review";
          fallbackSchedule.push({
            date,
            topics: [topic],
            focus_type: isRevision ? "revision" : i % 3 === 0 ? "practice" : "learning",
            estimated_hours: hoursPerDay,
            notes: isRevision ? "Focus on weak areas and past paper questions" : "Study carefully and take notes",
          });
        }

        res.json({
          student_id,
          exam_date,
          exam_name: exam_name ?? "Final Exam",
          total_days: totalDays,
          daily_schedule: fallbackSchedule,
          revision_phase: { start_date: revisionStartDate, end_date: addDays(exam_date, -1), focus: "full review" },
          ai_generated: false,
        });
        return;
      }

      const raw = await callAI(systemPrompt, userPrompt);
      const parsed = parseJSON(raw);

      if (!parsed?.daily_schedule) {
        res.status(503).json({ error: "AI plan generation failed. Please retry." });
        return;
      }

      const safeSchedule = (parsed.daily_schedule as any[]).filter(
        (d: any) => d.date && d.date < exam_date && d.date >= today
      );

      res.json({
        student_id,
        exam_date,
        exam_name: exam_name ?? "Final Exam",
        total_days: totalDays,
        daily_schedule: safeSchedule,
        revision_phase: { start_date: revisionStartDate, end_date: addDays(exam_date, -1), focus: "full review" },
        summary: parsed.summary ?? null,
        ai_generated: true,
      });

    } catch (err) {
      logError(err, { route: "study-plan/generate" });
      res.status(500).json({ error: "Failed to generate study plan" });
    }
  }
);

/* ── POST /api/study-plan/regenerate ────────────────────────────────────── */
smartStudyPlanRouter.post(
  "/regenerate",
  requireRole("student", "teacher", "admin", "super_admin"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { student_id, exam_date, completed_up_to, new_weak_topics, hours_per_day } = req.body as {
        student_id: number;
        exam_date: string;
        completed_up_to: string;
        new_weak_topics?: string[];
        hours_per_day?: number;
      };

      if (!student_id || !exam_date || !completed_up_to) {
        res.status(400).json({ error: "student_id, exam_date, and completed_up_to are required" });
        return;
      }

      const remainingDays = daysBetween(completed_up_to, exam_date);
      if (remainingDays < 1) {
        res.status(400).json({ error: "No remaining days to schedule" });
        return;
      }

      const revisionStart = addDays(completed_up_to, Math.round(remainingDays * 0.7));
      const hoursPerDay = Math.min(hours_per_day ?? 3, 5);

      const systemPrompt = `You are an adaptive study planner AI. Regenerate ONLY the remaining study schedule.
Rules: Never go beyond ${exam_date}. Last 30% = revision. Max ${hoursPerDay}h/day. Prioritize newly weak topics.
Respond ONLY with valid JSON: { "daily_schedule": [{ "date": "YYYY-MM-DD", "topics": [], "focus_type": "learning"|"practice"|"revision", "estimated_hours": number, "notes": "string" }] }`;

      const userPrompt = `Regenerate from ${completed_up_to} to ${addDays(exam_date, -1)}.
Exam date: ${exam_date}. Remaining days: ${remainingDays}.
Updated weak topics: ${(new_weak_topics ?? []).join(", ") || "same as before"}.
Revision phase starts: ${revisionStart}.`;

      const raw = await callAI(systemPrompt, userPrompt);
      const parsed = parseJSON(raw);

      if (!parsed?.daily_schedule) {
        res.status(503).json({ error: "Regeneration failed. Please retry." });
        return;
      }

      const safeSchedule = (parsed.daily_schedule as any[]).filter(
        (d: any) => d.date && d.date >= completed_up_to && d.date < exam_date
      );

      res.json({ student_id, exam_date, daily_schedule: safeSchedule, regenerated: true, from_date: completed_up_to });
    } catch (err) {
      logError(err, { route: "study-plan/regenerate" });
      res.status(500).json({ error: "Failed to regenerate plan" });
    }
  }
);
