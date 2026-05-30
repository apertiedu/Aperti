import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { db } from "../lib/db";

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

  // 4. Call the internal intelligence engine (OpenAI compatible)
  const { Configuration, OpenAIApi } = require("openai");
  const openai = new OpenAIApi(new Configuration({ apiKey: process.env.OPENAI_API_KEY }));

  // Set up SSE streaming
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const stream = await openai.createChatCompletion({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ],
    stream: true,
    temperature: 0.7,
    max_tokens: 500,
  }, { responseType: "stream" });

  // Pipe the OpenAI stream to our SSE response
  stream.data.on("data", (chunk: Buffer) => {
    const lines = chunk.toString().split("\n").filter((line: string) => line.trim() !== "");
    for (const line of lines) {
      const message = line.replace(/^data: /, "");
      if (message === "[DONE]") {
        res.write("data: [DONE]\n\n");
        break;
      }
      try {
        const parsed = JSON.parse(message);
        const content = parsed.choices[0]?.delta?.content;
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      } catch {
        // skip non-JSON
      }
    }
  });

  stream.data.on("end", () => {
    res.end();
  });

  stream.data.on("error", (err: Error) => {
    console.error("Mentor stream error:", err);
    res.end();
  });
});

// GET /mentor/sessions — list past sessions (for history)
mentorRouter.get("/sessions", authenticate, async (req: AuthRequest, res: Response) => {
  // Placeholder – in production, store sessions in a table
  res.json([]);
});
