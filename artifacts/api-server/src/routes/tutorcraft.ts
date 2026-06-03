import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { pool } from "@workspace/db";

export const tutorcraftRouter = Router();

const SYSTEM_PROMPT = `You are TutorCraft™, an expert AI assistant built for teachers inside Aperti EdOS.
You help teachers with:
- Lesson planning and curriculum design
- Creating differentiated learning activities
- Writing student feedback and reports
- Generating assessment questions and mark schemes
- Classroom management strategies
- Explaining complex topics in multiple ways
- Analysing student performance data

Be concise, practical and professional. Format responses clearly using markdown when helpful.
Address the teacher as a colleague. Always offer actionable next steps.`;

async function openaiChat(messages: any[], maxTokens = 1200): Promise<string> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: "gpt-4o-mini", messages, max_tokens: maxTokens }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${err}`);
  }

  const data = (await response.json()) as any;
  return data.choices?.[0]?.message?.content ?? "";
}

/* ── Chat ──────────────────────────────────────────────────────────────── */
tutorcraftRouter.post("/tutorcraft/chat", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) { res.status(400).json({ error: "message required" }); return; }

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map((m: any) => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ];

    const reply = await openaiChat(messages);
    res.json({ reply });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── AI lesson plan generator ──────────────────────────────────────────── */
tutorcraftRouter.post("/tutorcraft/lesson-plan", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { subject, topic, level, duration_min, objectives } = req.body;
    const prompt = `Generate a detailed lesson plan for:
Subject: ${subject}
Topic: ${topic}
Level: ${level || "A-Level"}
Duration: ${duration_min || 60} minutes
Learning objectives: ${objectives || "As appropriate for the topic"}

Include: starter activity, main teaching points, student activities, assessment checkpoint, homework suggestion, and differentiation ideas.
Format as structured markdown.`;

    const plan = await openaiChat([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ], 1500);

    res.json({ plan });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── AI feedback generator ─────────────────────────────────────────────── */
tutorcraftRouter.post("/tutorcraft/generate-feedback", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { student_answer, model_answer, marks_awarded, max_marks, question_text } = req.body;
    const prompt = `You are marking a student's answer. Write constructive teacher feedback (2-3 sentences).

Question: ${question_text}
Model Answer: ${model_answer}
Student Answer: ${student_answer}
Marks Awarded: ${marks_awarded} / ${max_marks}

Write specific, encouraging feedback that identifies what was good and what to improve. Be brief and direct.`;

    const feedback = await openaiChat([{ role: "user", content: prompt }], 200);
    res.json({ feedback });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── AI question variant generator ────────────────────────────────────── */
tutorcraftRouter.post("/tutorcraft/generate-variants", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { question_text, difficulty, count = 3 } = req.body;
    const prompt = `Generate ${count} variant questions based on this original question, at ${difficulty || "same"} difficulty:

Original: ${question_text}

Return as a JSON array with fields: question_text, model_answer, marks. No markdown wrapper, just raw JSON array.`;

    const raw = await openaiChat([{ role: "user", content: prompt }], 800);
    try {
      const variants = JSON.parse(raw);
      res.json({ variants });
    } catch {
      res.json({ variants: [], raw });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── AI syllabus generator ─────────────────────────────────────────────── */
tutorcraftRouter.post("/tutorcraft/generate-syllabus", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { subject, level, board, duration_weeks } = req.body;
    const prompt = `Create a structured course syllabus for:
Subject: ${subject}, Level: ${level || "A-Level"}, Board: ${board || "CAIE"}, Duration: ${duration_weeks || 12} weeks.

Return JSON: { units: [{ title, topics: [{ title, lessons: [{ title, type, duration_min }] }] }] }
No markdown, just raw JSON.`;

    const raw = await openaiChat([{ role: "user", content: prompt }], 1500);
    try {
      res.json(JSON.parse(raw));
    } catch {
      res.json({ units: [], raw });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
