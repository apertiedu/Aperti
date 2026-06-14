/**
 * AI Teaching Assistant System — Aperti V2
 *
 * Four core modules:
 *   POST /api/ai-teach/lesson          — Lesson generator
 *   POST /api/ai-teach/grade           — Auto marking engine
 *   POST /api/ai-teach/analyze-student — Student weakness analysis
 *   POST /api/ai-teach/copilot         — Teacher copilot (worksheets, quizzes, plans)
 *
 * All calls go through the central AI service. Graceful fallback on failure.
 * Response caching for identical prompts (in-memory Map, 10-min TTL).
 * Usage tracked per user per day.
 */
import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { generateAIText, AI_AVAILABLE } from "../services/ai";
import { pool } from "@workspace/db";

export const aiTeachRouter = Router();
aiTeachRouter.use(authenticate);

// ── In-memory response cache ──────────────────────────────────────────────────
const responseCache = new Map<string, { text: string; expires: number }>();
const CACHE_TTL = 10 * 60_000;

function cacheKey(module: string, payload: object): string {
  return `${module}:${JSON.stringify(payload)}`;
}
function fromCache(key: string): string | null {
  const entry = responseCache.get(key);
  if (entry && Date.now() < entry.expires) return entry.text;
  return null;
}
function setCache(key: string, text: string) {
  responseCache.set(key, { text, expires: Date.now() + CACHE_TTL });
  if (responseCache.size > 500) {
    const oldest = responseCache.keys().next().value;
    if (oldest) responseCache.delete(oldest);
  }
}

// ── Usage tracking ────────────────────────────────────────────────────────────
async function trackUsage(userId: number, module: string) {
  pool.query(
    `INSERT INTO ai_usage_log (account_id, module, created_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT DO NOTHING`,
    [userId, module],
  ).catch(() => {});
}

// ── AI unavailable helper ─────────────────────────────────────────────────────
function aiUnavailable(res: Response, module: string) {
  return res.json({
    ok: false,
    fallback: true,
    module,
    result: `AI is temporarily unavailable. Please try again later or contact your administrator to configure the AI service.`,
  });
}

// ── POST /api/ai-teach/lesson ─────────────────────────────────────────────────
aiTeachRouter.post("/lesson", async (req: AuthRequest, res: Response) => {
  const { topic, subject, syllabusCode, level = "IGCSE", language } = req.body;
  if (!topic) return res.status(400).json({ error: "topic is required" });

  if (!AI_AVAILABLE) return aiUnavailable(res, "lesson");

  const ck = cacheKey("lesson", { topic, subject, syllabusCode, level });
  const cached = fromCache(ck);
  if (cached) return res.json({ ok: true, fallback: false, cached: true, module: "lesson", result: cached });

  const systemPrompt = `You are an expert IGCSE/A-Level ${subject || "subject"} teacher. 
Generate comprehensive lesson content structured as follows:
1. EXPLANATION: Clear, concise explanation (200-300 words)
2. KEY CONCEPTS: 3-5 bullet points of essential takeaways
3. WORKED EXAMPLES: 2 step-by-step examples with full working shown
4. COMMON MISTAKES: 3 mistakes students typically make, and how to avoid them
5. MINI QUIZ: 3 multiple-choice questions with answers and explanations

Format with clear section headers. Use appropriate technical vocabulary for ${level} level.`;

  const userMessage = `Topic: ${topic}${syllabusCode ? ` (Syllabus: ${syllabusCode})` : ""}${subject ? ` — Subject: ${subject}` : ""}. Level: ${level}. Create a complete lesson.`;

  const result = await generateAIText(userMessage,
    `Lesson content for "${topic}" is being prepared. Please check back shortly.`,
    { systemPrompt, maxTokens: 2000, language, module: "ai-teach/lesson" }
  );

  setCache(ck, result);
  trackUsage(req.userId!, "lesson");
  res.json({ ok: true, fallback: false, cached: false, module: "lesson", result });
});

// ── POST /api/ai-teach/grade ──────────────────────────────────────────────────
aiTeachRouter.post("/grade", async (req: AuthRequest, res: Response) => {
  const { studentAnswer, markScheme, maxMarks = 10, subject, language } = req.body;
  if (!studentAnswer) return res.status(400).json({ error: "studentAnswer is required" });
  if (!markScheme) return res.status(400).json({ error: "markScheme is required" });

  if (!AI_AVAILABLE) return aiUnavailable(res, "grade");

  const systemPrompt = `You are an expert ${subject || "IGCSE"} examiner. 
Grade the student's answer against the mark scheme. You MUST respond ONLY with valid JSON:
{
  "score": <number 0-${maxMarks}>,
  "grade": "<A*|A|B|C|D|E|U>",
  "percentage": <number 0-100>,
  "awarded_marks": ["<mark point awarded>"],
  "missed_marks": ["<mark point missed>"],
  "feedback": "<constructive 2-3 sentence feedback>",
  "improvements": ["<specific improvement 1>", "<improvement 2>"]
}
Be precise, fair, and follow the mark scheme strictly. Award partial marks where appropriate.`;

  const userMessage = `MARK SCHEME:\n${markScheme}\n\nSTUDENT ANSWER:\n${studentAnswer}\n\nMaximum marks: ${maxMarks}`;

  const raw = await generateAIText(userMessage,
    JSON.stringify({ score: 0, grade: "U", percentage: 0, awarded_marks: [], missed_marks: ["Unable to grade at this time"], feedback: "AI grading is temporarily unavailable.", improvements: [] }),
    { systemPrompt, maxTokens: 800, language, module: "ai-teach/grade" }
  );

  let parsed: any = null;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch { parsed = null; }

  trackUsage(req.userId!, "grade");
  res.json({ ok: true, module: "grade", result: parsed ?? { raw, parse_error: true }, raw });
});

// ── POST /api/ai-teach/analyze-student ───────────────────────────────────────
aiTeachRouter.post("/analyze-student", async (req: AuthRequest, res: Response) => {
  const { studentId, recentGrades, attendanceRate, submissionRate, subject, language } = req.body;
  if (!recentGrades) return res.status(400).json({ error: "recentGrades is required" });

  if (!AI_AVAILABLE) return aiUnavailable(res, "analyze-student");

  const systemPrompt = `You are an educational data analyst specializing in IGCSE student performance.
Analyze the student's data and return ONLY valid JSON:
{
  "exam_readiness_score": <0-100>,
  "risk_level": "<low|medium|high|critical>",
  "weak_topics": ["<topic>"],
  "strong_topics": ["<topic>"],
  "forgetting_patterns": "<description of retention issues if any>",
  "predicted_grade": "<A*|A|B|C|D|E|U>",
  "intervention_priority": "<none|monitor|support|urgent>",
  "recommendations": ["<action 1>", "<action 2>", "<action 3>"],
  "revision_focus": ["<topic to focus on>"]
}`;

  const userMessage = `Student data for subject ${subject || "unknown"}:
Recent grades: ${JSON.stringify(recentGrades)}
Attendance rate: ${attendanceRate ?? "unknown"}%
Submission rate: ${submissionRate ?? "unknown"}%
Student ID: ${studentId ?? "anonymous"}

Analyze performance and generate recommendations.`;

  const raw = await generateAIText(userMessage,
    JSON.stringify({ exam_readiness_score: 50, risk_level: "medium", weak_topics: [], strong_topics: [], recommendations: ["Continue current study plan"], predicted_grade: "C" }),
    { systemPrompt, maxTokens: 1000, language, module: "ai-teach/analyze" }
  );

  let parsed: any = null;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch { parsed = null; }

  trackUsage(req.userId!, "analyze-student");
  res.json({ ok: true, module: "analyze-student", result: parsed ?? { raw, parse_error: true }, raw });
});

// ── POST /api/ai-teach/copilot ────────────────────────────────────────────────
aiTeachRouter.post("/copilot", async (req: AuthRequest, res: Response) => {
  const { task, topic, subject, level = "IGCSE", count = 5, language } = req.body;
  if (!task) return res.status(400).json({ error: "task is required (worksheet|quiz|lesson-plan|exam-predictor)" });
  if (!topic) return res.status(400).json({ error: "topic is required" });

  if (!AI_AVAILABLE) return aiUnavailable(res, "copilot");

  const ck = cacheKey("copilot", { task, topic, subject, level, count });
  const cached = fromCache(ck);
  if (cached) return res.json({ ok: true, fallback: false, cached: true, module: "copilot", result: cached });

  const prompts: Record<string, string> = {
    worksheet: `You are an expert ${level} ${subject || "subject"} teacher. Create a structured worksheet on "${topic}" with:
- Clear learning objective
- ${count} exam-style questions (mix of short answer and structured)
- Space indicators for student answers
- Mark allocation for each question
- Answer guidance section
Format cleanly with question numbers.`,

    quiz: `You are a ${level} ${subject || "subject"} examiner. Create a ${count}-question quiz on "${topic}".
For each question include: the question, 4 answer options (A-D), the correct answer, and a brief explanation.
Format as numbered list.`,

    "lesson-plan": `You are a master educator. Create a 60-minute lesson plan on "${topic}" for ${level} ${subject || "subject"}.
Include: Learning objectives, starter activity (5min), main teaching (35min with 3 activities), student practice (15min), plenary/exit ticket (5min), resources needed, differentiation strategies.`,

    "exam-predictor": `You are an experienced ${level} ${subject || "subject"} examiner. Based on the topic "${topic}", predict:
1. TOP 5 most likely exam question styles and formats
2. Key command words to expect (analyze, evaluate, calculate, etc.)
3. Common mark scheme requirements
4. Time management guidance per question type
5. Revision priorities for exam success`,
  };

  const systemPrompt = prompts[task] ?? prompts["worksheet"];

  const result = await generateAIText(`Generate the ${task} resource for: ${topic}`,
    `The ${task} resource for "${topic}" is being prepared. Please try again in a moment.`,
    { systemPrompt, maxTokens: 1500, language, module: `ai-teach/copilot/${task}` }
  );

  setCache(ck, result);
  trackUsage(req.userId!, `copilot-${task}`);
  res.json({ ok: true, module: "copilot", task, result });
});

// ── GET /api/ai-teach/status ──────────────────────────────────────────────────
aiTeachRouter.get("/status", (_req: AuthRequest, res: Response) => {
  res.json({
    available: AI_AVAILABLE,
    modules: ["lesson", "grade", "analyze-student", "copilot"],
    cacheSize: responseCache.size,
  });
});
