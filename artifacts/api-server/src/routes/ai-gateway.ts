/**
 * AI Gateway — Aperti Phase 48
 *
 * Single production-grade entry point for all AI requests.
 *
 * Routes:
 *   POST /api/ai/chat     — streaming SSE chat
 *   POST /api/ai/grade    — auto-marking (non-streaming JSON)
 *   POST /api/ai/generate — lesson / quiz / flashcard generation
 *   GET  /api/ai/health   — service status + today's cost
 *
 * Features:
 *   - Mode-based model selection: cheap | balanced | premium
 *   - In-memory prompt cache (10-min TTL, 500-entry cap)
 *   - Server-Sent Events streaming for /chat
 *   - Cost tracking to ai_interactions table
 *   - Graceful fallback — never throws, always returns a usable response
 *   - Budget cap — soft warning when daily spend exceeds platform_settings limit
 */
import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { pool } from "@workspace/db";

export const aiGatewayRouter = Router();
aiGatewayRouter.use(authenticate);

// ── Provider config ────────────────────────────────────────────────────────────
const REPLIT_KEY = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const REPLIT_BASE = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const NVIDIA_KEY = process.env.NVIDIA_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE = process.env.OPENAI_BASE_URL;

const API_KEY: string | null =
  (REPLIT_KEY && REPLIT_BASE ? REPLIT_KEY : null) ??
  NVIDIA_KEY ??
  OPENAI_KEY ??
  null;

const BASE_URL: string =
  (REPLIT_KEY && REPLIT_BASE ? REPLIT_BASE : null) ??
  (NVIDIA_KEY ? "https://integrate.api.nvidia.com/v1" : null) ??
  OPENAI_BASE ??
  "https://api.openai.com/v1";

const AI_AVAILABLE = !!API_KEY;

const MODELS: Record<string, string> = {
  cheap:    process.env.AI_MODEL_CHEAP    ?? (NVIDIA_KEY ? "openai/gpt-oss-20b" : "gpt-4o-mini"),
  balanced: process.env.AI_MODEL_BALANCED ?? (NVIDIA_KEY ? "openai/gpt-oss-20b" : "gpt-4o-mini"),
  premium:  process.env.AI_MODEL_PREMIUM  ?? (NVIDIA_KEY ? "openai/gpt-oss-20b" : "gpt-4o"),
};

const COST_PER_1K: Record<string, number> = {
  "gpt-4o-mini":       0.00015,
  "gpt-4o":            0.005,
  "openai/gpt-oss-20b": 0.00010,
};

// ── In-memory cache ────────────────────────────────────────────────────────────
const promptCache = new Map<string, { text: string; expires: number }>();
const CACHE_TTL = 10 * 60_000;

function cacheKey(mode: string, sys: string, msg: string): string {
  return `${mode}:${sys.slice(0, 80)}:${msg.slice(0, 180)}`;
}
function fromCache(key: string): string | null {
  const e = promptCache.get(key);
  if (e && Date.now() < e.expires) return e.text;
  promptCache.delete(key);
  return null;
}
function toCache(key: string, text: string) {
  if (promptCache.size >= 500) {
    const oldest = promptCache.keys().next().value;
    if (oldest) promptCache.delete(oldest);
  }
  promptCache.set(key, { text, expires: Date.now() + CACHE_TTL });
}

// ── Cost tracking ──────────────────────────────────────────────────────────────
function trackInteraction(
  accountId: number | undefined,
  interactionType: string,
  model: string,
  promptLen: number,
  completionLen: number,
  latencyMs: number,
) {
  const promptTokens = Math.round(promptLen / 4);
  const completionTokens = Math.round(completionLen / 4);
  const tokensUsed = promptTokens + completionTokens;
  const costRate = COST_PER_1K[model] ?? 0.0001;
  const estimatedCost = ((tokensUsed / 1000) * costRate).toFixed(6);

  pool.query(
    `INSERT INTO ai_interactions
       (account_id, interaction_type, model, prompt_tokens, completion_tokens, tokens_used,
        estimated_cost_usd, latency_ms, status, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'success',NOW())
     ON CONFLICT DO NOTHING`,
    [accountId ?? null, interactionType, model, promptTokens, completionTokens, tokensUsed, estimatedCost, latencyMs],
  ).catch(() => {});
}

// ── Budget check ──────────────────────────────────────────────────────────────
async function getBudgetStatus(): Promise<{ todayCost: number; budgetCap: number | null; overBudget: boolean }> {
  try {
    const [costRow, capRow] = await Promise.all([
      pool.query<{ total: number }>(
        `SELECT COALESCE(SUM(estimated_cost_usd),0)::float AS total
         FROM ai_interactions WHERE created_at > NOW() - INTERVAL '24h'`
      ),
      pool.query<{ value: string }>(
        `SELECT value FROM platform_settings WHERE key = 'ai_daily_budget_usd' LIMIT 1`
      ),
    ]);
    const todayCost = costRow.rows[0]?.total ?? 0;
    const budgetCap = capRow.rows[0]?.value ? parseFloat(capRow.rows[0].value) : null;
    return { todayCost, budgetCap, overBudget: budgetCap !== null && todayCost >= budgetCap };
  } catch {
    return { todayCost: 0, budgetCap: null, overBudget: false };
  }
}

// ── SSE helper ────────────────────────────────────────────────────────────────
function sseWrite(res: Response, data: object) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// ── POST /api/ai/chat (streaming SSE) ─────────────────────────────────────────
aiGatewayRouter.post("/chat", async (req: AuthRequest, res: Response) => {
  const { message, systemPrompt, mode = "balanced", context } = req.body as {
    message: string; systemPrompt?: string; mode?: string; context?: string;
  };

  if (!message) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  if (!AI_AVAILABLE) {
    sseWrite(res, { text: "AI is temporarily unavailable. Please try again later or contact your administrator.", done: true });
    res.end();
    return;
  }

  const { overBudget } = await getBudgetStatus();
  if (overBudget) {
    sseWrite(res, { text: "Daily AI budget reached. Please contact your administrator to increase the limit.", done: true });
    res.end();
    return;
  }

  const sys = systemPrompt ?? "You are an expert IGCSE educational AI assistant. Be concise, accurate, and supportive.";
  const model = MODELS[mode] ?? MODELS.balanced;
  const t0 = Date.now();
  let fullText = "";

  try {
    const apiRes = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model,
        stream: true,
        max_tokens: 1500,
        messages: [
          { role: "system", content: sys },
          ...(context ? [{ role: "assistant", content: String(context) }] : []),
          { role: "user", content: message },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!apiRes.ok) {
      sseWrite(res, { error: `AI API error ${apiRes.status}. Please try again.`, done: true });
      res.end();
      return;
    }

    const reader = apiRes.body?.getReader();
    if (!reader) { sseWrite(res, { error: "No readable stream", done: true }); res.end(); return; }

    const decoder = new TextDecoder();
    let buf = "";

    outer: while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === "[DONE]") { sseWrite(res, { done: true }); break outer; }
        try {
          const chunk = JSON.parse(raw) as { choices?: Array<{ delta?: { content?: string } }> };
          const text = chunk.choices?.[0]?.delta?.content ?? "";
          if (text) { fullText += text; sseWrite(res, { text }); }
        } catch {}
      }
    }

    if (fullText && !res.writableEnded) sseWrite(res, { done: true });
    trackInteraction(req.userId, "chat", model, sys.length + message.length, fullText.length, Date.now() - t0);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Stream failed";
    if (!res.writableEnded) sseWrite(res, { error: msg, done: true });
  } finally {
    if (!res.writableEnded) res.end();
  }
});

// ── POST /api/ai/grade (non-streaming) ────────────────────────────────────────
aiGatewayRouter.post("/grade", async (req: AuthRequest, res: Response) => {
  const { studentAnswer, markScheme, maxMarks = 10, subject, mode = "balanced" } = req.body as {
    studentAnswer: string; markScheme: string; maxMarks?: number; subject?: string; mode?: string;
  };

  if (!studentAnswer || !markScheme) {
    return res.status(400).json({ error: "studentAnswer and markScheme are required" });
  }

  if (!AI_AVAILABLE) {
    return res.json({ ok: false, fallback: true, result: { score: 0, feedback: "AI grading temporarily unavailable. Please review manually.", improvements: [] } });
  }

  const key = cacheKey("grade", markScheme, studentAnswer);
  const cached = fromCache(key);
  if (cached) {
    try { return res.json({ ok: true, cached: true, result: JSON.parse(cached) }); } catch {}
  }

  const model = MODELS[mode] ?? MODELS.balanced;
  const t0 = Date.now();
  const sys = `You are an expert ${subject || "IGCSE"} examiner. Grade strictly and return ONLY valid JSON:\n{"score":<0-${maxMarks}>,"grade":"<A*|A|B|C|D|E|U>","percentage":<0-100>,"awarded_marks":["<mark>"],"missed_marks":["<mark>"],"feedback":"<2-3 sentences>","improvements":["<action>"]}`;

  try {
    const apiRes = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model, max_tokens: 800,
        messages: [{ role: "system", content: sys }, { role: "user", content: `MARK SCHEME:\n${markScheme}\n\nSTUDENT ANSWER:\n${studentAnswer}` }],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!apiRes.ok) throw new Error(`AI ${apiRes.status}`);
    const data = await apiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data?.choices?.[0]?.message?.content ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    let parsed: unknown = null;
    try { if (match) parsed = JSON.parse(match[0]); } catch {}
    if (parsed) toCache(key, JSON.stringify(parsed));
    trackInteraction(req.userId, "grade", model, sys.length + studentAnswer.length, raw.length, Date.now() - t0);
    return res.json({ ok: true, cached: false, result: parsed ?? { raw, parse_error: true } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Grade failed";
    return res.json({ ok: false, fallback: true, result: { score: 0, feedback: `Grading failed: ${msg}. Please mark manually.`, improvements: [] } });
  }
});

// ── POST /api/ai/generate (lesson / quiz / flashcard) ─────────────────────────
aiGatewayRouter.post("/generate", async (req: AuthRequest, res: Response) => {
  const { type, topic, subject, level = "IGCSE", count = 5, mode = "balanced" } = req.body as {
    type: string; topic: string; subject?: string; level?: string; count?: number; mode?: string;
  };

  if (!type || !topic) return res.status(400).json({ error: "type and topic are required" });
  if (!AI_AVAILABLE) return res.json({ ok: false, fallback: true, type, result: `Content generation unavailable. Please create ${type} content manually.` });

  const key = cacheKey(mode, type, `${topic}:${subject}:${level}:${count}`);
  const cached = fromCache(key);
  if (cached) return res.json({ ok: true, cached: true, type, result: cached });

  const prompts: Record<string, string> = {
    lesson: `You are an expert ${level} ${subject ?? "subject"} teacher. Generate a structured lesson on "${topic}" with: learning objective, explanation (200w), 5 key concepts, 2 worked examples, common mistakes, mini quiz (3 MCQs with answers).`,
    quiz: `Generate a ${count}-question quiz on "${topic}" for ${level} ${subject ?? "students"}. Each question: text, 4 options (A-D), correct answer, brief explanation.`,
    flashcard: `Create ${count} study flashcards for "${topic}" (${level} ${subject ?? "subject"}). Format: FRONT: [term] | BACK: [definition]. One per line.`,
    "lesson-plan": `Create a 60-minute lesson plan on "${topic}" for ${level} ${subject ?? "subject"}. Include: objectives, starter (5min), main teaching (35min with 3 activities), practice (15min), plenary (5min), resources.`,
    "exam-predictor": `Predict the top 5 exam question styles for "${topic}" in ${level} ${subject ?? "subject"}. Include command words, mark scheme requirements, time guidance, and revision priorities.`,
  };

  const sys = prompts[type] ?? prompts.lesson;
  const model = MODELS[mode] ?? MODELS.balanced;
  const t0 = Date.now();

  try {
    const apiRes = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({ model, max_tokens: 1800, messages: [{ role: "system", content: sys }, { role: "user", content: `Generate the ${type} for topic: ${topic}` }] }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!apiRes.ok) throw new Error(`AI ${apiRes.status}`);
    const data = await apiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
    const result = data?.choices?.[0]?.message?.content ?? "";
    toCache(key, result);
    trackInteraction(req.userId, `generate-${type}`, model, sys.length + topic.length, result.length, Date.now() - t0);
    return res.json({ ok: true, cached: false, type, result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Generate failed";
    return res.json({ ok: false, fallback: true, type, result: `Content generation failed: ${msg}. Please try again.` });
  }
});

// ── GET /api/ai/health ────────────────────────────────────────────────────────
aiGatewayRouter.get("/health", async (_req: AuthRequest, res: Response) => {
  const { todayCost, budgetCap, overBudget } = await getBudgetStatus();

  let callsToday = 0;
  try {
    const { rows } = await pool.query<{ cnt: number }>(
      `SELECT count(*)::int AS cnt FROM ai_interactions WHERE created_at > NOW() - INTERVAL '24h'`
    );
    callsToday = rows[0]?.cnt ?? 0;
  } catch {}

  res.json({
    available: AI_AVAILABLE,
    status: AI_AVAILABLE ? (overBudget ? "budget_exceeded" : "operational") : "disabled",
    provider: NVIDIA_KEY ? "nvidia" : REPLIT_KEY ? "replit" : OPENAI_KEY ? "openai" : "none",
    model: MODELS.balanced,
    cache: { size: promptCache.size, maxSize: 500, ttlMin: 10 },
    budget: {
      todayCostUsd: Number(todayCost).toFixed(4),
      cap: budgetCap,
      overBudget,
    },
    callsToday,
    modes: Object.keys(MODELS),
  });
});
