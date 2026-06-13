import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { openaiChat, AI_CONFIG } from "../lib/ai-config";
import { pool } from "@workspace/db";

export const aiGatewayRouter = Router();

aiGatewayRouter.use(authenticate);

async function logAiCall(params: {
  accountId: number | null;
  type: string;
  inputSummary: string;
  response: string | null;
  latencyMs: number;
  success: boolean;
  failureReason?: string;
}) {
  try {
    await pool.query(
      `INSERT INTO ai_logs (account_id, type, input_summary, response_summary, latency_ms, success, failure_reason, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
       ON CONFLICT DO NOTHING`,
      [
        params.accountId,
        params.type,
        params.inputSummary?.slice(0, 500),
        params.response?.slice(0, 500) ?? null,
        params.latencyMs,
        params.success,
        params.failureReason ?? null,
      ]
    );
  } catch {
    // Table may not exist yet — non-critical
  }
}

function buildSystemPrompt(type: string, context: Record<string, string> = {}): string {
  const { subject = "", syllabus = "", studentLevel = "general" } = context;
  const base = `You are an expert educational AI for Aperti. Subject: ${subject || "general"}. Syllabus: ${syllabus || "general curriculum"}. Student level: ${studentLevel}.`;
  switch (type) {
    case "explain":
      return `${base} Explain concepts clearly and concisely. Use examples appropriate for the student level. Keep explanations under 300 words.`;
    case "quiz":
      return `${base} Generate a short quiz (3-5 questions) with multiple choice answers. Format as JSON array: [{question, options:[...], answer, explanation}].`;
    case "feedback":
      return `${base} Provide constructive, encouraging feedback on the student's work. Be specific and actionable. Keep it under 200 words.`;
    case "marking":
      return `${base} You are marking a student's answer. Provide a score out of 10, detailed feedback, and suggest improvements. Return JSON: {score, feedback, improvements, grade}.`;
    case "summary":
      return `${base} Summarise the provided content concisely for revision purposes. Bullet points preferred. Under 250 words.`;
    default:
      return `${base} Respond helpfully to the educational request.`;
  }
}

function getFallbackResponse(type: string, input: string): string {
  switch (type) {
    case "explain":
      return `I'm unable to generate an AI explanation right now. Please consult your textbook or ask your teacher about: "${input.slice(0, 100)}"`;
    case "quiz":
      return JSON.stringify([{
        question: "AI quiz generation is temporarily unavailable. Please check back later.",
        options: ["Check again shortly", "Ask your teacher", "Review your notes", "All of the above"],
        answer: "All of the above",
        explanation: "The AI service is temporarily unavailable."
      }]);
    case "feedback":
      return "AI feedback is temporarily unavailable. Your teacher will provide feedback on your submission.";
    case "marking":
      return JSON.stringify({ score: null, feedback: "Auto-marking is temporarily unavailable. Your teacher will review this.", improvements: [], grade: "Pending" });
    case "summary":
      return "AI summary is temporarily unavailable. Please review the source material directly.";
    default:
      return "The AI service is temporarily unavailable. Please try again shortly or contact your teacher.";
  }
}

// POST /api/ai/generate
aiGatewayRouter.post("/generate", async (req: AuthRequest, res: Response) => {
  const { type, input, context = {} } = req.body;

  if (!type || !input) {
    return res.status(400).json({ error: "type and input are required" });
  }

  const validTypes = ["explain", "quiz", "feedback", "marking", "summary"];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(", ")}` });
  }

  if (typeof input !== "string" || input.length > 8000) {
    return res.status(400).json({ error: "input must be a string under 8000 characters" });
  }

  const apiKeyPresent = !!AI_CONFIG.apiKey;
  const startTime = Date.now();

  if (!apiKeyPresent) {
    const fallback = getFallbackResponse(type, input);
    await logAiCall({
      accountId: req.userId ?? null,
      type,
      inputSummary: input.slice(0, 200),
      response: fallback,
      latencyMs: 0,
      success: false,
      failureReason: "No API key configured",
    });
    return res.json({
      response: fallback,
      fallback: true,
      reason: "AI service not configured",
      model: null,
    });
  }

  const systemPrompt = buildSystemPrompt(type, context);

  try {
    const response = await openaiChat({
      systemPrompt,
      userMessage: input,
      maxTokens: type === "quiz" ? 800 : type === "marking" ? 600 : 400,
    });

    const latencyMs = Date.now() - startTime;

    if (!response) {
      const fallback = getFallbackResponse(type, input);
      await logAiCall({
        accountId: req.userId ?? null,
        type,
        inputSummary: input.slice(0, 200),
        response: fallback,
        latencyMs,
        success: false,
        failureReason: "AI returned null response",
      });
      return res.json({
        response: fallback,
        fallback: true,
        reason: "AI service returned empty response",
        model: AI_CONFIG.model,
      });
    }

    await logAiCall({
      accountId: req.userId ?? null,
      type,
      inputSummary: input.slice(0, 200),
      response,
      latencyMs,
      success: true,
    });

    res.json({
      response,
      fallback: false,
      latencyMs,
      model: AI_CONFIG.model,
    });
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const fallback = getFallbackResponse(type, input);
    await logAiCall({
      accountId: req.userId ?? null,
      type,
      inputSummary: input.slice(0, 200),
      response: null,
      latencyMs,
      success: false,
      failureReason: err?.message ?? "Unknown error",
    });
    res.json({
      response: fallback,
      fallback: true,
      reason: "AI service error",
      model: AI_CONFIG.model,
    });
  }
});

// GET /api/ai/status — check if AI is available
aiGatewayRouter.get("/status", async (req: AuthRequest, res: Response) => {
  const hasKey = !!AI_CONFIG.apiKey;
  res.json({
    available: hasKey,
    model: hasKey ? AI_CONFIG.model : null,
    features: {
      explain: hasKey,
      quiz: hasKey,
      feedback: hasKey,
      marking: hasKey,
      summary: hasKey,
    },
  });
});
