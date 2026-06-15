/**
 * Centralized AI service for Aperti.
 *
 * ALL AI calls must go through this module. Never import openai SDK or call
 * AI endpoints directly from routes. This module:
 *   - Reads config once from environment (no hardcoded keys, ever)
 *   - Degrades gracefully when the key is absent
 *   - Logs every failure to the error_logs table
 *   - Returns typed, safe responses
 */
import { pool } from "@workspace/db";

// ── Config (resolved once at module load) ─────────────────────────────────────

const NVIDIA_KEY = process.env.NVIDIA_API_KEY;
const REPLIT_KEY = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const REPLIT_BASE = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE = process.env.OPENAI_BASE_URL;

// Priority: NVIDIA → Replit AI Integration → plain OpenAI
const API_KEY: string | null =
  NVIDIA_KEY ??
  (REPLIT_KEY && REPLIT_BASE ? REPLIT_KEY : null) ??
  OPENAI_KEY ??
  null;

const BASE_URL: string =
  (NVIDIA_KEY ? "https://integrate.api.nvidia.com/v1" : null) ??
  (REPLIT_KEY && REPLIT_BASE ? REPLIT_BASE : null) ??
  OPENAI_BASE ??
  "https://api.openai.com/v1";

const DEFAULT_MODEL: string =
  process.env.OPENAI_MODEL ??
  (NVIDIA_KEY ? "openai/gpt-oss-20b" : "gpt-4o-mini");

// ── Public AI status flag ─────────────────────────────────────────────────────

export const AI_AVAILABLE = !!API_KEY;

if (!AI_AVAILABLE) {
  console.warn(
    "[ai-service] WARNING: No AI API key configured. AI features are disabled. " +
    "Set NVIDIA_API_KEY, OPENAI_API_KEY, or use Replit AI Integration."
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AIOptions {
  systemPrompt?: string;
  maxTokens?: number;
  model?: string;
  language?: string;
  userId?: number;
  module?: string;
}

export interface AIResponse {
  text: string | null;
  ok: boolean;
  fallback: boolean;
  latencyMs: number;
  error?: string;
}

// ── Language injection ────────────────────────────────────────────────────────

const LANG_NAMES: Record<string, string> = {
  ar: "Arabic", fr: "French", es: "Spanish", de: "German",
  zh: "Chinese (Simplified)", hi: "Hindi", ur: "Urdu",
  tr: "Turkish", pt: "Portuguese",
};

function injectLanguage(prompt: string, language?: string): string {
  if (!language || language === "en") return prompt;
  const name = LANG_NAMES[language] ?? language;
  return prompt + `\n\nIMPORTANT: You must respond entirely in ${name}.`;
}

// ── Internal logging ──────────────────────────────────────────────────────────

function logAIFailure(message: string, detail: unknown, module = "ai-service") {
  const msg = `[${module}] AI call failed: ${message}`;
  console.error(msg, detail);
  pool.query(
    `INSERT INTO error_logs (level, message, stack, route, device, created_at)
     VALUES ($1,$2,$3,$4,$5,NOW())`,
    ["error", msg.slice(0, 1000), String(detail).slice(0, 3000), module, "ai-service"],
  ).catch(() => {});
}

// ── Core generation function ──────────────────────────────────────────────────

/**
 * Generate an AI response. Returns { text, ok, fallback, latencyMs }.
 * Never throws. If AI is unavailable or fails, returns fallback=true with text=null.
 */
export async function generateAIResponse(
  userMessage: string,
  opts: AIOptions = {},
): Promise<AIResponse> {
  const t0 = Date.now();

  if (!AI_AVAILABLE) {
    return {
      text: null,
      ok: false,
      fallback: true,
      latencyMs: 0,
      error: "AI service not configured",
    };
  }

  const system = injectLanguage(
    opts.systemPrompt ?? "You are a helpful educational AI assistant.",
    opts.language,
  );
  const model = opts.model ?? DEFAULT_MODEL;
  const maxTokens = opts.maxTokens ?? 1000;

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMessage },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logAIFailure(`HTTP ${res.status}`, body, opts.module);
      return {
        text: null,
        ok: false,
        fallback: true,
        latencyMs: Date.now() - t0,
        error: `AI API returned ${res.status}`,
      };
    }

    const data = await res.json() as any;
    const text: string | null = data?.choices?.[0]?.message?.content ?? null;

    return { text, ok: true, fallback: false, latencyMs: Date.now() - t0 };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logAIFailure(msg, err, opts.module);
    return {
      text: null,
      ok: false,
      fallback: true,
      latencyMs: Date.now() - t0,
      error: msg,
    };
  }
}

/**
 * Convenience wrapper — returns the text string or a canned fallback message.
 * Use when you just need a string and want automatic fallback copy.
 */
export async function generateAIText(
  userMessage: string,
  fallbackMessage: string,
  opts: AIOptions = {},
): Promise<string> {
  const result = await generateAIResponse(userMessage, opts);
  return result.text ?? fallbackMessage;
}

// ── Re-export legacy openaiChat shape for backward compatibility ───────────────
// Routes that already call openaiChat() don't need to change.

export async function openaiChat(opts: {
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
  language?: string;
}): Promise<string | null> {
  const result = await generateAIResponse(opts.userMessage, {
    systemPrompt: opts.systemPrompt,
    maxTokens: opts.maxTokens,
    language: opts.language,
    module: "openaiChat-compat",
  });
  return result.text;
}

// ── Export config for routes that need it (read-only) ────────────────────────

export const AI_CONFIG = {
  provider: (NVIDIA_KEY ? "nvidia" : REPLIT_KEY ? "replit" : "openai") as string,
  model: DEFAULT_MODEL,
  baseUrl: BASE_URL,
  apiKey: API_KEY,
  maxTokens: {
    default: 1000,
    feedback: 200,
    analysis: 1500,
    summary: 800,
    syllabus: 2000,
  },
} as const;
