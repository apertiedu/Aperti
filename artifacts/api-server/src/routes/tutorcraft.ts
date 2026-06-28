import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { db, pool, studentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logInteraction, logFallback, emitAIOutage } from "../lib/ai-safety";

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
  const apiKey = process.env["OPENAI_API_KEY"] || process.env["NVIDIA_API_KEY"];
  if (!apiKey) throw new Error("No AI API key configured");

  const baseUrl = process.env["OPENAI_BASE_URL"] ||
    (process.env["NVIDIA_API_KEY"] ? "https://integrate.api.nvidia.com/v1" : "https://api.openai.com/v1");
  const model = process.env["OPENAI_MODEL"] || "meta/llama-3.1-8b-instruct";

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${err}`);
  }

  const data = (await response.json()) as any;
  return data.choices?.[0]?.message?.content ?? "";
}

async function ruleBasedChatWithQuestions(message: string, teacherAccountId: number): Promise<string> {
  const lower = message.toLowerCase();
  const topicWords = message.split(/\s+/).filter(w => w.length > 3).slice(0, 5);

  let relatedQuestions: Array<{ questionText: string; modelAnswer: string | null; topic: string | null }> = [];
  try {
    const allTeacherQs = await db.query.questionBank.findMany({
      where: (q, { eq }) => eq(q.teacherAccountId, teacherAccountId),
      limit: 100,
    });
    const scored = allTeacherQs.map(q => {
      const combined = `${q.questionText} ${q.topic ?? ""}`.toLowerCase();
      const overlap = topicWords.filter(w => combined.includes(w.toLowerCase())).length;
      return { q, overlap };
    }).filter(s => s.overlap > 0).sort((a, b) => b.overlap - a.overlap);
    relatedQuestions = scored.slice(0, 3).map(s => ({
      questionText: s.q.questionText,
      modelAnswer: s.q.modelAnswer,
      topic: s.q.topic,
    }));
  } catch { /* continue */ }

  if (relatedQuestions.length > 0) {
    return `**TutorCraft (Rule-based Mode)**\n\nYou asked about: *${message}*\n\nHere are ${relatedQuestions.length} related question(s) from your question bank:\n\n${relatedQuestions.map((q, i) =>
      `**Q${i + 1}:** ${q.questionText}${q.topic ? ` *(${q.topic})*` : ""}\n\n*Model Answer:* ${q.modelAnswer ?? "Think through the key concepts and apply the relevant theory."}`
    ).join("\n\n---\n\n")}\n\n*Configure an OpenAI API key for fully AI-generated, contextual responses.*`;
  }

  if (lower.includes("lesson plan") || lower.includes("lesson planning")) {
    return `**Rule-based Lesson Plan Outline**\n\nFor topic: *${message}*\n\n1. **Starter (5 min):** Activate prior knowledge — quick question or quiz.\n2. **Main Teaching (20 min):** Explain core concepts with worked examples.\n3. **Student Activity (15 min):** Structured practice — individual or paired.\n4. **Assessment Checkpoint (5 min):** Exit ticket or mini-quiz.\n5. **Homework:** Assign 3–5 questions from the question bank.\n\n*Configure an OpenAI API key for fully personalized plans.*`;
  }
  if (lower.includes("feedback") || lower.includes("mark")) {
    return `**Feedback Template**\n\nStrengths: [What the student did well]\nAreas for improvement: [Specific gaps]\nNext step: [One concrete action]\n\n*Configure an OpenAI API key for AI-generated feedback.*`;
  }
  if (lower.includes("question") || lower.includes("quiz") || lower.includes("assessment")) {
    return `**Assessment Tips**\n\n- Mix recall, application, and analysis questions.\n- Include at least one multi-step problem.\n- Provide a clear mark scheme for each question.\n\n*Configure an OpenAI API key to auto-generate questions from your syllabus.*`;
  }
  return `**TutorCraft (Rule-based Mode)**\n\nYou asked: *${message}*\n\nFull AI generation requires an OpenAI API key. In the meantime:\n- Use the Question Bank to build assessments.\n- Review the Gradebook for student performance insights.\n- Use the Resources section to share learning materials.`;
}

tutorcraftRouter.post("/tutorcraft/stream", authenticate, async (req: AuthRequest, res: Response) => {
  const { message, history = [] } = req.body;
  if (!message) { res.status(400).json({ error: "message required" }); return; }

  const AI_KEY = process.env.OPENAI_API_KEY || process.env.NVIDIA_API_KEY;
  if (!AI_KEY) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    const fallback = await ruleBasedChatWithQuestions(message, req.userId!).catch(() => "TutorCraft is temporarily unavailable.");
    res.write(`data: ${JSON.stringify({ content: fallback })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
    logFallback({ userId: req.userId, module: "tutorcraft", action: "stream_chat", inputSummary: message.slice(0, 200), reason: "No AI key configured" }).catch(() => {});
    return;
  }

  const AI_BASE = process.env.NVIDIA_API_KEY
    ? "https://integrate.api.nvidia.com/v1"
    : (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1");
  const AI_MODEL = process.env.OPENAI_MODEL ||
    (process.env.NVIDIA_API_KEY ? "meta/llama-3.1-8b-instruct" : "gpt-4o-mini");

  let coremindContext = "";
  const lowerMsg = message.toLowerCase();
  if (lowerMsg.includes("at-risk") || lowerMsg.includes("struggling") || lowerMsg.includes("weak student") || lowerMsg.includes("underperform")) {
    try {
      const { analyzeStudent } = await import("../lib/coremind");
      const { db: dbInst, studentsTable: st } = await import("@workspace/db");
      const { eq: eqOp } = await import("drizzle-orm");
      const students = await dbInst.select({ id: st.id, name: st.studentName })
        .from(st).where(eqOp(st.teacherAccountId, req.userId!)).limit(20);
      const analyses = await Promise.allSettled(students.map(s => analyzeStudent(s.id)));
      const atRisk = analyses
        .map((r, i) => r.status === "fulfilled" ? { ...r.value, studentName: students[i].name } : null)
        .filter(Boolean).filter((a: any) => a.riskLevel === "high" || a.riskLevel === "medium").slice(0, 5);
      if (atRisk.length > 0) {
        coremindContext = `\n\n[CoreMind — ${new Date().toLocaleDateString()}]\n` +
          atRisk.map((a: any) => `• ${a.studentName}: Risk=${a.riskLevel}, Readiness=${a.examReadiness}%, WeakTopics=[${(a.weakTopics ?? []).slice(0, 3).join(", ")}]`).join("\n");
      }
    } catch { /* best-effort */ }
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const t0 = Date.now();

  try {
    const upstreamRes = await fetch(`${AI_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${AI_KEY}` },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT + coremindContext },
          ...history.map((m: any) => ({ role: m.role, content: m.content })),
          { role: "user", content: message },
        ],
        stream: true,
        max_tokens: 1200,
        temperature: 0.7,
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
    let fullReply = "";

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
          if (content) { fullReply += content; res.write(`data: ${JSON.stringify({ content })}\n\n`); }
        } catch { /* skip */ }
      }
    }

    logInteraction({
      userId: req.userId,
      module: "tutorcraft",
      action: "stream_chat",
      inputSummary: message.slice(0, 300),
      outputSummary: fullReply.slice(0, 300),
      confidence: 0.9,
      latencyMs: Date.now() - t0,
      sources: [AI_BASE.includes("nvidia") ? "nvidia_nim" : "openai"],
    }).catch(() => {});

    res.end();
  } catch (err: any) {
    const errMsg = err?.message ?? "Unknown error";
    console.error("[tutorcraft] stream error:", err);

    emitAIOutage("tutorcraft", errMsg, req.userId).catch(() => {});
    logFallback({ userId: req.userId, module: "tutorcraft", action: "stream_chat", inputSummary: message.slice(0, 200), reason: `Stream error: ${errMsg.slice(0, 200)}` }).catch(() => {});

    const fallback = await ruleBasedChatWithQuestions(message, req.userId!).catch(() => "TutorCraft is temporarily unavailable.");
    res.write(`data: ${JSON.stringify({ content: fallback })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

tutorcraftRouter.post("/tutorcraft/chat", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) { res.status(400).json({ error: "message required" }); return; }

    if (!process.env.OPENAI_API_KEY && !process.env.NVIDIA_API_KEY) {
      const reply = await ruleBasedChatWithQuestions(message, req.userId!);
      logFallback({ userId: req.userId, module: "tutorcraft", action: "chat", inputSummary: message.slice(0, 200), reason: "No AI key configured" }).catch(() => {});
      res.json({ reply, fallback: true });
      return;
    }

    let coremindContext = "";
    const lowerMsg = message.toLowerCase();
    const needsCoreMind = lowerMsg.includes("at-risk") || lowerMsg.includes("struggling") ||
      lowerMsg.includes("lesson improve") || lowerMsg.includes("weak student") ||
      lowerMsg.includes("underperform") || lowerMsg.includes("below average");

    if (needsCoreMind) {
      try {
        const { analyzeStudent } = await import("../lib/coremind");
        const { db: dbInst, studentsTable: st } = await import("@workspace/db");
        const { eq: eqOp } = await import("drizzle-orm");
        const students = await dbInst.select({ id: st.id, name: st.studentName })
          .from(st).where(eqOp(st.teacherAccountId, req.userId!)).limit(20);
        const analyses = await Promise.allSettled(students.map(s => analyzeStudent(s.id)));
        const atRisk = analyses
          .map((r, i) => r.status === "fulfilled" ? { ...r.value, studentName: students[i].name } : null)
          .filter(Boolean)
          .filter((a: any) => a.riskLevel === "high" || a.riskLevel === "medium")
          .slice(0, 5);
        if (atRisk.length > 0) {
          coremindContext = `\n\n[CoreMind Data — ${new Date().toLocaleDateString()}]\n` +
            atRisk.map((a: any) =>
              `• ${a.studentName}: Risk=${a.riskLevel}, Readiness=${a.examReadiness}%, WeakTopics=[${(a.weakTopics ?? []).slice(0, 3).join(", ")}], Action="${(a.recommendedActions ?? [])[0] ?? ""}"`
            ).join("\n");
        }
      } catch { /* best-effort */ }
    }

    const messages = [
      { role: "system", content: SYSTEM_PROMPT + coremindContext },
      ...history.map((m: any) => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ];

    const t0 = Date.now();
    let reply = "";
    let success = false;
    let failureReason: string | undefined;

    try {
      reply = await openaiChat(messages);
      success = true;
    } catch (aiErr: any) {
      failureReason = aiErr?.message ?? "Unknown AI error";
      reply = await ruleBasedChatWithQuestions(message, req.userId!).catch(() =>
        "TutorCraft is temporarily unavailable. Please try again shortly."
      );
      emitAIOutage("tutorcraft", failureReason, req.userId).catch(() => {});
    }

    const latencyMs = Date.now() - t0;

    if (success) {
      logInteraction({
        userId: req.userId,
        module: "tutorcraft",
        action: "chat",
        inputSummary: message.slice(0, 300),
        outputSummary: reply.slice(0, 300),
        confidence: 0.9,
        latencyMs,
        sources: ["openai"],
      }).catch(() => {});
    } else {
      logFallback({ userId: req.userId, module: "tutorcraft", action: "chat", inputSummary: message.slice(0, 200), reason: failureReason ?? "AI error" }).catch(() => {});
    }

    res.json({ reply, fallback: !success });
  } catch (e: any) {
    if (!process.env.OPENAI_API_KEY) {
      const reply = await ruleBasedChatWithQuestions(req.body.message ?? "", req.userId!).catch(() =>
        "TutorCraft is in rule-based mode. Configure an OpenAI API key for full AI features."
      );
      logFallback({ userId: req.userId, module: "tutorcraft", action: "chat", inputSummary: (req.body.message ?? "").slice(0, 200), reason: "No AI key — outer catch" }).catch(() => {});
      res.json({ reply, fallback: true });
    } else {
      res.status(500).json({ error: "An unexpected error occurred" });
    }
  }
});

tutorcraftRouter.post("/tutorcraft/lesson-plan", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { subject, topic, level, duration_min, objectives } = req.body;

    if (!process.env.OPENAI_API_KEY) {
      const plan = `# Lesson Plan: ${topic ?? "Topic"}\n\n**Subject:** ${subject ?? "General"} | **Level:** ${level ?? "A-Level"} | **Duration:** ${duration_min ?? 60} min\n\n## Objectives\n${objectives ?? "Students will understand the core concepts of this topic."}\n\n## Starter (5 min)\nQuick recall question on prior knowledge.\n\n## Main Teaching (${Math.round((duration_min ?? 60) * 0.35)} min)\nExplain key concepts with worked examples.\n\n## Student Activity (${Math.round((duration_min ?? 60) * 0.4)} min)\nStructured practice problems from the question bank.\n\n## Assessment Checkpoint (5 min)\nExit ticket: 2 quick questions.\n\n## Homework\n3-5 questions at medium difficulty.\n\n*Configure an OpenAI API key for a fully personalized AI-generated plan.*`;
      logFallback({ userId: req.userId, module: "tutorcraft", action: "lesson_plan", inputSummary: `${subject}/${topic}`, reason: "No AI key configured" }).catch(() => {});
      res.json({ plan, fallback: true });
      return;
    }

    const t0 = Date.now();
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

    logInteraction({ userId: req.userId, module: "tutorcraft", action: "lesson_plan", inputSummary: `${subject}/${topic}`, outputSummary: plan.slice(0, 200), confidence: 0.9, latencyMs: Date.now() - t0, sources: ["openai"] }).catch(() => {});
    res.json({ plan });
  } catch (e: any) {
    emitAIOutage("tutorcraft", e?.message ?? "lesson-plan error", req.userId).catch(() => {});
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

tutorcraftRouter.post("/tutorcraft/generate-feedback", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { student_answer, model_answer, marks_awarded, max_marks, question_text } = req.body;

    if (!process.env.OPENAI_API_KEY) {
      const pct = max_marks > 0 ? Math.round((marks_awarded / max_marks) * 100) : 0;
      const tone = pct >= 70 ? "Good work" : pct >= 50 ? "Reasonable attempt" : "Needs improvement";
      const feedback = `${tone}. You scored ${marks_awarded}/${max_marks}. ${pct < 70 ? `Review the model answer and focus on: ${model_answer?.slice(0, 100) ?? "key concepts"}.` : "Keep building on this foundation."} Configure AI for more personalised feedback.`;
      logFallback({ userId: req.userId, module: "tutorcraft", action: "generate_feedback", inputSummary: question_text?.slice(0, 100), reason: "No AI key configured" }).catch(() => {});
      res.json({ feedback, fallback: true });
      return;
    }

    const t0 = Date.now();
    const prompt = `You are marking a student's answer. Write constructive teacher feedback (2-3 sentences).

Question: ${question_text}
Model Answer: ${model_answer}
Student Answer: ${student_answer}
Marks Awarded: ${marks_awarded} / ${max_marks}

Write specific, encouraging feedback that identifies what was good and what to improve. Be brief and direct.`;

    const feedback = await openaiChat([{ role: "user", content: prompt }], 200);
    logInteraction({ userId: req.userId, module: "tutorcraft", action: "generate_feedback", inputSummary: question_text?.slice(0, 100), outputSummary: feedback.slice(0, 200), confidence: 0.9, latencyMs: Date.now() - t0, sources: ["openai"] }).catch(() => {});
    res.json({ feedback });
  } catch (e: any) {
    emitAIOutage("tutorcraft", e?.message ?? "feedback error", req.userId).catch(() => {});
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

tutorcraftRouter.post("/tutorcraft/generate-variants", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { question_text, difficulty, count = 3 } = req.body;

    if (!process.env.OPENAI_API_KEY) {
      logFallback({ userId: req.userId, module: "tutorcraft", action: "generate_variants", inputSummary: question_text?.slice(0, 100), reason: "No AI key configured" }).catch(() => {});
      res.json({ variants: [], fallback: true, message: "Configure an OpenAI API key to auto-generate question variants." });
      return;
    }

    const t0 = Date.now();
    const prompt = `Generate ${count} variant questions based on this original question, at ${difficulty || "same"} difficulty:

Original: ${question_text}

Return as a JSON array with fields: question_text, model_answer, marks. No markdown wrapper, just raw JSON array.`;

    const raw = await openaiChat([{ role: "user", content: prompt }], 800);
    logInteraction({ userId: req.userId, module: "tutorcraft", action: "generate_variants", inputSummary: question_text?.slice(0, 100), outputSummary: `count=${count}`, confidence: 0.85, latencyMs: Date.now() - t0, sources: ["openai"] }).catch(() => {});
    try {
      const variants = JSON.parse(raw);
      res.json({ variants });
    } catch {
      res.json({ variants: [], raw });
    }
  } catch (e: any) {
    emitAIOutage("tutorcraft", e?.message ?? "variants error", req.userId).catch(() => {});
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

tutorcraftRouter.post("/tutorcraft/generate-syllabus", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { subject, level, board, duration_weeks } = req.body;

    if (!process.env.OPENAI_API_KEY) {
      logFallback({ userId: req.userId, module: "tutorcraft", action: "generate_syllabus", inputSummary: `${subject}/${level}`, reason: "No AI key configured" }).catch(() => {});
      res.json({ units: [], fallback: true, message: "Configure an OpenAI API key to auto-generate a syllabus." });
      return;
    }

    const t0 = Date.now();
    const prompt = `Create a structured course syllabus for:
Subject: ${subject}, Level: ${level || "A-Level"}, Board: ${board || "CAIE"}, Duration: ${duration_weeks || 12} weeks.

Return JSON: { units: [{ title, topics: [{ title, lessons: [{ title, type, duration_min }] }] }] }
No markdown, just raw JSON.`;

    const raw = await openaiChat([{ role: "user", content: prompt }], 1500);
    let parsed: { units: any[] } | null = null;
    try { parsed = JSON.parse(raw); } catch {
      logInteraction({ userId: req.userId, module: "tutorcraft", action: "generate_syllabus", inputSummary: `${subject}/${level}`, outputSummary: "JSON parse failed", confidence: 0, latencyMs: Date.now() - t0, sources: ["openai"] }).catch(() => {});
      res.json({ units: [], raw });
      return;
    }

    let weaveEnriched = false;
    try {
      const { getOrCreateNode, ensureEdge, getRelatedNodes } = await import("../lib/weave-graph");
      const unitNodeIds: number[] = [];
      for (const unit of (parsed!.units ?? [])) {
        if (!unit.title) continue;
        const nodeId = await getOrCreateNode(unit.title, "topic", { source: "syllabus", subject });
        if (unitNodeIds.length > 0) {
          await ensureEdge(unitNodeIds[unitNodeIds.length - 1], nodeId, "prerequisite");
        }
        unitNodeIds.push(nodeId);
        const prereqs = await getRelatedNodes(nodeId, "prerequisite");
        unit.weavePrerequisites = prereqs.map((n: any) => n.name);
        for (const topic of (unit.topics ?? [])) {
          if (!topic.title) continue;
          const topicId = await getOrCreateNode(topic.title, "topic", { parentUnit: unit.title, subject });
          await ensureEdge(nodeId, topicId, "includes");
        }
      }
      weaveEnriched = true;
    } catch { /* Weave best-effort */ }

    logInteraction({ userId: req.userId, module: "tutorcraft", action: "generate_syllabus", inputSummary: `${subject}/${level}`, outputSummary: `units=${parsed!.units?.length ?? 0}`, confidence: 0.9, latencyMs: Date.now() - t0, sources: ["openai"] }).catch(() => {});
    res.json({ ...parsed, weaveEnriched });
  } catch (e: any) {
    emitAIOutage("tutorcraft", e?.message ?? "syllabus error", req.userId).catch(() => {});
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});
