import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { db } from "@workspace/db";
import { enhanceMentor } from "../lib/coremind";
import { logInteraction, moderateContent } from "../lib/ai-safety";
import { withLanguage, getFallbackPhrase } from "../lib/ai-config";

export const mentorRouter = Router();

// POST /mentor/chat — streamed conversation
mentorRouter.post("/chat", authenticate, async (req: AuthRequest, res: Response) => {
  const studentId = req.userId!;
  const { message, sessionId, language } = req.body;

  const safety = await moderateContent(message ?? "");
  if (!safety.safe) {
    res.json({ content: "I'm sorry, I can't respond to that message. Please keep our conversation focused on your studies.", fallback: true });
    return;
  }

  // 1. Fetch student memory (Echo)
  const memory = await db.query.echoMemory.findFirst({
    where: (m, { eq }) => eq(m.studentId, studentId),
  });

  const weakTopics = (memory?.weakTopics as string[]) ?? [];
  const preferredStyle = memory?.preferredStyle ?? "conceptual";
  const recentMistakes = (memory?.mistakeHistory as Record<string, number>) ?? {};

  // 2. CoreMind enhancement — enriches with knowledge graph context
  let mentorContext = {
    contextualNodes: [] as Array<{ id: number; name: string; type: string }>,
    preferredStyle,
    recentMistakes: [] as Array<{ topic: string; count: number }>,
    relatedTopics: [] as string[],
    misconceptions: [] as string[],
    confidence: 0.5,
    sources: [] as string[],
  };
  try {
    mentorContext = await enhanceMentor(studentId, message ?? "");
  } catch { /* enhancement is best-effort */ }

  // 3. Fetch relevant questions from QueryVault (top 3 weak topics)
  const relatedQuestions = weakTopics.length > 0
    ? await db.query.questionBank.findMany({
        where: (q, { inArray }) => inArray(q.topic, weakTopics.slice(0, 3)),
        limit: 3,
      })
    : [];

  // 4. Build the enriched system prompt
  const miscNote = mentorContext.misconceptions.length > 0
    ? `\nCommon misconceptions for this topic: ${mentorContext.misconceptions.join("; ")}.`
    : "";
  const relatedNote = mentorContext.relatedTopics.length > 0
    ? `\nRelated topics from the knowledge graph: ${mentorContext.relatedTopics.join(", ")}.`
    : "";
  const recentMistakesNote = mentorContext.recentMistakes.length > 0
    ? `\nRecent mistake areas: ${mentorContext.recentMistakes.map(m => `${m.topic} (${m.count}x)`).join(", ")}.`
    : `\nRecent mistake patterns: ${JSON.stringify(recentMistakes)}.`;

  const systemPrompt = `You are The Mentor, a patient, adaptive tutor inside the Aperti educational platform.

The student's preferred learning style is ${mentorContext.preferredStyle}.
Weak topics: ${weakTopics.join(", ") || "none yet"}.${recentMistakesNote}${miscNote}${relatedNote}

Your task:
- If the student asks a question, explain it in their preferred style (visual → use analogies, textual → step-by-step, conceptual → big picture first).
- If they ask for practice, generate a question similar to these examples (without copying directly): ${JSON.stringify(relatedQuestions.map(q => q.questionText))}.
- If they struggle, offer to create a flashcard from this concept.
- Be encouraging, never condescending.
- Keep responses concise but thorough (max 300 words per message).`;

  const localizedSystemPrompt = withLanguage(systemPrompt, language);

  const AI_KEY = process.env.OPENAI_API_KEY || process.env.NVIDIA_API_KEY;
  if (!AI_KEY) {
    const fallbackContent = relatedQuestions.length > 0
      ? `Here are some practice questions to help you with: **${message}**\n\n${relatedQuestions.map((q, i) =>
          `**Q${i + 1}:** ${q.questionText}\n\n*Model Answer:* ${q.modelAnswer ?? "Think through the key concepts carefully."}`
        ).join("\n\n---\n\n")}\n\n*Tip: Focus on your weak areas: ${weakTopics.slice(0, 3).join(", ") || "general revision"}.*`
      : `I understand you're asking about **${message}**. While full AI is not available right now, here's a structured approach:\n\n1. Review your notes on this topic.\n2. Look at past exam questions.\n3. Practice with flashcards for key terms.\n\nYour preferred learning style is *${mentorContext.preferredStyle}* — try to apply that as you study.${miscNote}`;

    await logInteraction({
      userId: studentId,
      module: "mentor",
      action: "chat",
      inputSummary: message?.slice(0, 200),
      outputSummary: "Rule-based fallback",
      confidence: 0.5,
      sources: ["question_bank", "echo_memory"],
    });

    res.json({ content: fallbackContent, fallback: true });
    return;
  }

  const AI_BASE = process.env.NVIDIA_API_KEY
    ? "https://integrate.api.nvidia.com/v1"
    : (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1");
  const AI_MODEL = process.env.OPENAI_MODEL ||
    (process.env.NVIDIA_API_KEY ? "meta/llama-3.1-8b-instruct" : "gpt-4o-mini");

  // Set up SSE streaming
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  await logInteraction({
    userId: studentId,
    module: "mentor",
    action: "chat",
    inputSummary: message?.slice(0, 200),
    outputSummary: "AI streaming response",
    confidence: mentorContext.confidence,
    sources: [AI_BASE.includes("nvidia") ? "nvidia_nim" : "openai", ...mentorContext.sources],
  });

  try {
    const upstreamRes = await fetch(`${AI_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: localizedSystemPrompt },
          { role: "user", content: message },
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!upstreamRes.ok || !upstreamRes.body) {
      const errText = await upstreamRes.text().catch(() => "");
      throw new Error(`AI API ${upstreamRes.status}: ${errText}`);
    }

    const reader = upstreamRes.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const msg = trimmed.slice(6);
        if (msg === "[DONE]") { res.write("data: [DONE]\n\n"); break; }
        try {
          const parsed = JSON.parse(msg);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) res.write(`data: ${JSON.stringify({ content })}\n\n`);
        } catch { /* skip non-JSON lines */ }
      }
    }
    res.end();
  } catch (err) {
    console.error("[mentor] stream error:", err);
    res.end();
  }
});

// GET /mentor/sessions — list past sessions (for history)
mentorRouter.get("/sessions", authenticate, async (req: AuthRequest, res: Response) => {
  res.json([]);
});
