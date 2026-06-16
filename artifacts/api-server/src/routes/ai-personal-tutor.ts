import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { logError } from "../lib/log-error";
import { safeHandler } from "../lib/safe-handler";
import { validateAIResponse, buildFallbackAIResponse } from "../lib/validate-ai-response";

export const aiPersonalTutorRouter = Router();
aiPersonalTutorRouter.use(authenticate);

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
        max_tokens: 1200,
        temperature: 0.7,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json() as any;
    return data?.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

function parseJSON(text: string | null): any | null {
  if (!text) return null;
  try {
    const match = text.match(/```json\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
    return JSON.parse(match ? match[1] : text);
  } catch { return null; }
}

/* ── GET /api/ai-tutor/student/:studentId/weakness ───────────────────────── */
aiPersonalTutorRouter.get(
  "/student/:studentId/weakness",
  requireRole("teacher", "admin", "super_admin", "student"),
  safeHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const studentId = parseInt(req.params.studentId);
      if (isNaN(studentId)) { res.status(400).json({ error: "Invalid student ID" }); return; }

      const { rows: marks } = await pool.query(`
        SELECT eq.topic, sm.marks_scored, eq.max_marks, sm.mistakes,
               e.name AS exam_name, e.exam_date
        FROM student_marks sm
        JOIN exam_questions eq ON eq.id = sm.question_id
        JOIN exams e ON e.id = eq.exam_id
        JOIN students s ON s.id = sm.student_id
        WHERE sm.student_id = $1
        ORDER BY e.exam_date DESC NULLS LAST
        LIMIT 80
      `, [studentId]);

      const { rows: echo } = await pool.query(
        `SELECT weak_topics, strong_topics, mistake_history FROM echo_memory WHERE student_id = $1 LIMIT 1`,
        [studentId]
      );

      const topicMap: Record<string, { total: number; scored: number; count: number }> = {};
      for (const r of marks) {
        if (!r.topic) continue;
        if (!topicMap[r.topic]) topicMap[r.topic] = { total: 0, scored: 0, count: 0 };
        topicMap[r.topic].total += parseFloat(r.max_marks) || 0;
        topicMap[r.topic].scored += parseFloat(r.marks_scored) || 0;
        topicMap[r.topic].count++;
      }

      const weakTopics = Object.entries(topicMap)
        .map(([topic, d]) => ({ topic, pct: d.total > 0 ? Math.round((d.scored / d.total) * 100) : 0 }))
        .sort((a, b) => a.pct - b.pct)
        .slice(0, 10);

      res.json({ weakTopics, echoMemory: echo[0] ?? null });
    } catch (err) {
      logError(err, { route: "ai-tutor/weakness" });
      res.status(500).json({ error: "Failed to load weakness profile" });
    }
  })
);

/* ── POST /api/ai-tutor/explain ──────────────────────────────────────────── */
aiPersonalTutorRouter.post(
  "/explain",
  requireRole("student", "teacher", "admin", "super_admin"),
  safeHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { student_id, concept, subject, preferred_style } = req.body as {
        student_id: number;
        concept: string;
        subject?: string;
        preferred_style?: "visual" | "step-by-step" | "analogy" | "auto";
      };

      if (!student_id || !concept) {
        res.status(400).json({ error: "student_id and concept are required" });
        return;
      }

      const { rows: marks } = await pool.query(`
        SELECT eq.topic, sm.marks_scored, eq.max_marks, sm.mistakes,
               AVG(sm.marks_scored::numeric / NULLIF(eq.max_marks::numeric, 0)) OVER (PARTITION BY eq.topic) AS avg_pct
        FROM student_marks sm
        JOIN exam_questions eq ON eq.id = sm.question_id
        WHERE sm.student_id = $1
        ORDER BY eq.topic
        LIMIT 60
      `, [student_id]);

      const { rows: echo } = await pool.query(
        `SELECT weak_topics, strong_topics FROM echo_memory WHERE student_id = $1 LIMIT 1`,
        [student_id]
      );

      const topicScores: Record<string, number[]> = {};
      for (const r of marks) {
        if (!r.topic) continue;
        if (!topicScores[r.topic]) topicScores[r.topic] = [];
        const pct = parseFloat(r.max_marks) > 0 ? (parseFloat(r.marks_scored) / parseFloat(r.max_marks)) * 100 : 50;
        topicScores[r.topic].push(pct);
      }

      const conceptScore = topicScores[concept]
        ? topicScores[concept].reduce((a, b) => a + b, 0) / topicScores[concept].length
        : null;

      let difficultyLevel: "easy" | "medium" | "hard" = "medium";
      if (conceptScore !== null) {
        if (conceptScore < 45) difficultyLevel = "easy";
        else if (conceptScore > 75) difficultyLevel = "hard";
      }

      const weakTopics: string[] = echo[0]?.weak_topics?.map((t: any) => t.topic ?? t) ?? [];
      const isWeak = weakTopics.includes(concept) || (conceptScore !== null && conceptScore < 50);
      const style = preferred_style && preferred_style !== "auto"
        ? preferred_style
        : isWeak ? "step-by-step" : "analogy";

      const systemPrompt = `You are an expert adaptive AI tutor for a ${subject ?? "academic"} student.
Your task: explain a concept in a personalized, adaptive way.
Teaching style: ${style}.
Difficulty adaptation: ${difficultyLevel === "easy" ? "SIMPLIFY — student is struggling, use very clear language and basic examples" : difficultyLevel === "hard" ? "ADVANCE — student is strong, increase depth and complexity" : "BALANCED — clear but substantive"}.
${isWeak ? "IMPORTANT: This student is WEAK in this topic. Break it down into very small steps. Be encouraging." : ""}
Always vary your explanation — never generate identical content for different students.
Respond with ONLY valid JSON matching this exact structure:
{
  "explanation": "string — clear explanation tailored to level",
  "difficulty_level": "${difficultyLevel}",
  "examples": ["example1", "example2"],
  "follow_up_questions": ["question1", "question2"],
  "reinforcement_needed": ${isWeak},
  "teaching_style_used": "${style}",
  "key_insight": "one memorable takeaway sentence"
}`;

      const userPrompt = `Explain the concept: "${concept}"${subject ? ` (subject: ${subject})` : ""}.
Student performance on this topic: ${conceptScore !== null ? `${Math.round(conceptScore)}% average` : "no prior data"}.
Student's weak areas: ${weakTopics.slice(0, 5).join(", ") || "none identified"}.
Generate a ${style} explanation at ${difficultyLevel} difficulty.`;

      if (!API_KEY) {
        const fallback = {
          student_id,
          concept,
          explanation: `Let's break down ${concept} step by step. This is an important topic that requires careful understanding. Start by reviewing your notes and textbook examples, then practice with past questions.`,
          difficulty_level: difficultyLevel,
          examples: [`Basic example of ${concept}`, `Applied example of ${concept} in exam context`],
          follow_up_questions: [`Can you define ${concept} in your own words?`, `How would you apply ${concept} to solve a problem?`],
          reinforcement_needed: isWeak,
          teaching_style_used: style,
          key_insight: `Understanding ${concept} is key to your exam success.`,
          ai_generated: false,
        };
        res.json(fallback);
        return;
      }

      const raw = await callAI(systemPrompt, userPrompt);
      const parsed = parseJSON(raw);

      if (!parsed) {
        const fb = buildFallbackAIResponse("ai-tutor/explain");
        res.json({ student_id, concept, ...fb, difficulty_level: difficultyLevel, examples: [], follow_up_questions: [], reinforcement_needed: isWeak, teaching_style_used: style, ai_generated: false });
        return;
      }

      await validateAIResponse(parsed, "ai-tutor/explain", { requiredFields: ["explanation", "examples", "follow_up_questions"] });

      res.json({
        student_id,
        concept,
        explanation: parsed.explanation ?? "",
        difficulty_level: parsed.difficulty_level ?? difficultyLevel,
        examples: Array.isArray(parsed.examples) ? parsed.examples : [],
        follow_up_questions: Array.isArray(parsed.follow_up_questions) ? parsed.follow_up_questions : [],
        reinforcement_needed: parsed.reinforcement_needed ?? isWeak,
        teaching_style_used: parsed.teaching_style_used ?? style,
        key_insight: parsed.key_insight ?? "",
        ai_generated: true,
      });

      pool.query(
        `INSERT INTO ai_interactions (account_id, interaction_type, model, prompt_tokens, completion_tokens, tokens_used, estimated_cost_usd, latency_ms, status, created_at)
         VALUES ($1, 'personal_tutor', $2, $3, $4, $5, $6, 0, 'success', NOW())`,
        [req.userId, MODEL, Math.round((systemPrompt.length + userPrompt.length) / 4), Math.round((raw?.length ?? 0) / 4), Math.round(((systemPrompt.length + userPrompt.length + (raw?.length ?? 0)) / 4)), "0.0001"]
      ).catch(() => {});

    } catch (err) {
      logError(err, { route: "ai-tutor/explain" });
      res.status(500).json({ error: "Failed to generate explanation" });
    }
  })
);

/* ── POST /api/ai-tutor/adaptive-followup ────────────────────────────────── */
aiPersonalTutorRouter.post(
  "/adaptive-followup",
  requireRole("student", "teacher", "admin", "super_admin"),
  safeHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { student_id, concept, student_answer, original_question, current_difficulty } = req.body as {
        student_id: number;
        concept: string;
        student_answer: string;
        original_question: string;
        current_difficulty: "easy" | "medium" | "hard";
      };

      if (!student_id || !concept || !student_answer) {
        res.status(400).json({ error: "student_id, concept, and student_answer are required" });
        return;
      }

      const systemPrompt = `You are an adaptive AI tutor evaluating a student's follow-up answer.
Assess the answer and decide:
- If CORRECT and confident → increase difficulty
- If PARTIALLY correct → stay at same level, clarify the gap
- If INCORRECT → reduce difficulty and switch teaching style
Respond ONLY with valid JSON:
{
  "correct": boolean,
  "feedback": "encouraging, specific feedback on their answer",
  "next_difficulty": "easy" | "medium" | "hard",
  "next_style": "visual" | "step-by-step" | "analogy",
  "next_question": "a follow-up question at the appropriate new level",
  "hint": "a helpful hint if they were wrong or partially correct"
}`;

      const userPrompt = `Concept: "${concept}"
Original question: "${original_question}"
Student answered: "${student_answer}"
Current difficulty: ${current_difficulty}
Evaluate and adapt.`;

      const raw = await callAI(systemPrompt, userPrompt);
      const parsed = parseJSON(raw);

      if (!parsed) {
        const fb = buildFallbackAIResponse("ai-tutor/adaptive-followup");
        res.json({ student_id, concept, correct: false, feedback: fb.content, next_difficulty: current_difficulty, next_style: "step-by-step", next_question: `Can you try explaining ${concept} again in your own words?`, hint: "Review the explanation and try again." });
        return;
      }

      await validateAIResponse(parsed, "ai-tutor/adaptive-followup", { requiredFields: ["correct", "feedback", "next_difficulty"] });

      res.json({ student_id, concept, ...parsed });
    } catch (err) {
      logError(err, { route: "ai-tutor/adaptive-followup" });
      res.status(500).json({ error: "Failed to process follow-up" });
    }
  })
);
