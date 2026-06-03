import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { db } from "@workspace/db";

export const mentorRouter = Router();

// POST /mentor/chat — streamed conversation
mentorRouter.post("/chat", authenticate, async (req: AuthRequest, res: Response) => {
  const studentId = req.userId!;
  const { message, sessionId } = req.body; // sessionId ties a conversation together

  // 1. Fetch student memory (Echo)
  const memory = await db.query.echoMemory.findFirst({
    where: (m, { eq }) => eq(m.studentId, studentId),
  });

  const weakTopics = (memory?.weakTopics as string[]) ?? [];
  const preferredStyle = memory?.preferredStyle ?? "conceptual";
  const recentMistakes = (memory?.mistakeHistory as Record<string, number>) ?? {};

  // 2. Fetch relevant questions from QueryVault (simplified: top 3 weak topics)
  const relatedQuestions = weakTopics.length > 0
    ? await db.query.questionBank.findMany({
        where: (q, { inArray }) => inArray(q.topic, weakTopics.slice(0, 3)),
        limit: 3,
      })
    : [];

  // 3. Build the prompt for the internal reasoning engine
  const systemPrompt = `You are The Mentor, a patient, adaptive tutor inside the Aperti educational platform.

The student's preferred learning style is ${preferredStyle}.
Weak topics: ${weakTopics.join(", ") || "none yet"}.
Recent mistake patterns: ${JSON.stringify(recentMistakes)}.

Your task:
- If the student asks a question, explain it in their preferred style (visual → use analogies, textual → step-by-step, conceptual → big picture first).
- If they ask for practice, generate a question similar to these examples (without copying directly): ${JSON.stringify(relatedQuestions.map(q => q.questionText))}.
- If they struggle, offer to create a flashcard from this concept.
- Be encouraging, never condescending.
- Keep responses concise but thorough (max 300 words per message).`;

  if (!process.env.OPENAI_API_KEY) {
    // Rule-based fallback: structured explanation from question bank
    const fallbackContent = relatedQuestions.length > 0
      ? `Here are some practice questions to help you with: **${message}**\n\n${relatedQuestions.map((q, i) =>
          `**Q${i + 1}:** ${q.questionText}\n\n*Model Answer:* ${q.modelAnswer ?? "Think through the key concepts carefully."}`
        ).join("\n\n---\n\n")}\n\n*Tip: Focus on your weak areas: ${weakTopics.slice(0, 3).join(", ") || "general revision"}.*`
      : `I understand you're asking about **${message}**. While full AI is not available right now, here's a structured approach:\n\n1. Review your notes on this topic.\n2. Look at past exam questions.\n3. Practice with flashcards for key terms.\n\nYour preferred learning style is *${preferredStyle}* — try to apply that as you study.`;

    res.json({ content: fallbackContent, fallback: true });
    return;
  }

  // Set up SSE streaming
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const fetch = (await import("node:http")).request;
    const body = JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      stream: true,
      temperature: 0.7,
      max_tokens: 500,
    });

    const https = await import("node:https");
    const reqOptions = {
      hostname: "api.openai.com",
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const apiReq = https.request(reqOptions, (apiRes) => {
      apiRes.on("data", (chunk: Buffer) => {
        const lines = chunk.toString().split("\n").filter((line: string) => line.trim() !== "");
        for (const line of lines) {
          const msg = line.replace(/^data: /, "");
          if (msg === "[DONE]") {
            res.write("data: [DONE]\n\n");
            break;
          }
          try {
            const parsed = JSON.parse(msg);
            const content = parsed.choices[0]?.delta?.content;
            if (content) {
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
          } catch {
            // skip non-JSON
          }
        }
      });
      apiRes.on("end", () => res.end());
      apiRes.on("error", (err: Error) => { console.error("Mentor stream error:", err); res.end(); });
    });

    apiReq.on("error", (err: Error) => { console.error("Mentor request error:", err); res.end(); });
    apiReq.write(body);
    apiReq.end();
  } catch (err) {
    console.error("Mentor error:", err);
    res.end();
  }
});

// GET /mentor/sessions — list past sessions (for history)
mentorRouter.get("/sessions", authenticate, async (req: AuthRequest, res: Response) => {
  // Placeholder – in production, store sessions in a table
  res.json([]);
});
