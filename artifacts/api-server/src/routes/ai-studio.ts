/**
 * AI Studio Route
 *
 * POST /api/ai-studio/generate
 *   Generates block content for ContentCraft Studio via the AI gateway.
 *   Accepts: { contentType, topic, subject }
 *   Returns: { generated, ok }
 */
import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";

export const aiStudioRouter = Router();
aiStudioRouter.use(authenticate);

const REPLIT_KEY = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const REPLIT_BASE = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE = process.env.OPENAI_BASE_URL;

const API_KEY: string | null =
  (REPLIT_KEY && REPLIT_BASE ? REPLIT_KEY : null) ??
  OPENAI_KEY ??
  null;

const BASE_URL: string =
  (REPLIT_KEY && REPLIT_BASE ? REPLIT_BASE : null) ??
  OPENAI_BASE ??
  "https://api.openai.com/v1";

const AI_AVAILABLE = !!API_KEY;

const MODEL = process.env.AI_MODEL_CHEAP ?? "gpt-4o-mini";

// POST /generate
aiStudioRouter.post("/generate", async (req: AuthRequest, res: Response) => {
  const { contentType = "lesson", topic = "General Topic", subject = "" } = req.body as {
    contentType?: string;
    topic?: string;
    subject?: string;
  };

  if (!AI_AVAILABLE) {
    return res.json({
      ok: false,
      fallback: true,
      generated: getStaticFallback(contentType, topic),
    });
  }

  try {
    const prompt = buildPrompt(contentType, topic, subject);
    const apiRes = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 800,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are an expert educational content creator. Return ONLY valid JSON.",
          },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!apiRes.ok) throw new Error(`AI ${apiRes.status}`);
    const data = await apiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data?.choices?.[0]?.message?.content ?? "{}";
    let generated: unknown;
    try { generated = JSON.parse(raw); } catch { generated = getStaticFallback(contentType, topic); }
    return res.json({ ok: true, generated });
  } catch {
    return res.json({ ok: false, fallback: true, generated: getStaticFallback(contentType, topic) });
  }
});

function buildPrompt(contentType: string, topic: string, subject: string): string {
  const ctx = subject ? `${subject}: ` : "";
  switch (contentType) {
    case "flashcards":
      return `Create 5 flashcard pairs for "${ctx}${topic}". Return JSON: {"generated": [{"front": "term", "back": "definition"}, ...]}`;
    case "quiz":
      return `Create a 3-question MCQ quiz about "${ctx}${topic}". Return JSON: {"generated": {"questions": [{"q": "...", "options": ["A","B","C","D"], "answer": 0, "explanation": "..."}]}}`;
    case "key-terms":
      return `List 5 key terms for "${ctx}${topic}" with definitions. Return JSON: {"generated": {"terms": [{"term": "...", "definition": "..."}]}}`;
    case "lesson":
    default:
      return `Write a short lesson introduction for "${ctx}${topic}". Return JSON: {"generated": {"introduction": "...(2-3 sentences)", "mainContent": "...(paragraph)", "keyPoints": ["...", "..."]}}`;
  }
}

function getStaticFallback(contentType: string, topic: string): unknown {
  switch (contentType) {
    case "flashcards":
      return [
        { front: `What is ${topic}?`, back: `${topic} is an important concept in this subject.` },
        { front: `Key feature of ${topic}`, back: "A defining characteristic of this topic." },
        { front: `Example of ${topic}`, back: "See your textbook for worked examples." },
      ];
    case "quiz":
      return { questions: [{ q: `Which best describes ${topic}?`, options: ["Option A", "Option B", "Option C", "Option D"], answer: 0, explanation: "Review your notes for the answer." }] };
    case "key-terms":
      return { terms: [{ term: topic, definition: "Definition to be filled in." }] };
    case "lesson":
    default:
      return { introduction: `${topic} is an important area of study.`, mainContent: "In this lesson we will explore the key concepts and applications.", keyPoints: ["Understand the fundamentals", "Apply knowledge to examples"] };
  }
}
