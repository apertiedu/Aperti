import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { db, studentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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

async function ruleBasedChatWithQuestions(message: string, teacherAccountId: number): Promise<string> {
  // Extract topic keywords from the message to search the question bank
  const lower = message.toLowerCase();
  const topicWords = message.split(/\s+/).filter(w => w.length > 3).slice(0, 5);

  // Fetch up to 3 related questions from this teacher's question bank
  let relatedQuestions: Array<{ questionText: string; modelAnswer: string | null; topic: string | null }> = [];
  try {
    const allTeacherQs = await db.query.questionBank.findMany({
      where: (q, { eq }) => eq(q.teacherAccountId, teacherAccountId),
      limit: 100,
    });
    // Score by keyword overlap
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
  } catch {
    // Question bank query failed silently — continue with structured response
  }

  if (relatedQuestions.length > 0) {
    return `**TutorCraft (Rule-based Mode)**\n\nYou asked about: *${message}*\n\nHere are ${relatedQuestions.length} related question(s) from your question bank:\n\n${relatedQuestions.map((q, i) =>
      `**Q${i + 1}:** ${q.questionText}${q.topic ? ` *(${q.topic})*` : ""}\n\n*Model Answer:* ${q.modelAnswer ?? "Think through the key concepts and apply the relevant theory."}`
    ).join("\n\n---\n\n")}\n\n*Configure an OpenAI API key for fully AI-generated, contextual responses.*`;
  }

  // Fallback templates when no question bank results
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

/* ── Chat ──────────────────────────────────────────────────────────────── */
tutorcraftRouter.post("/tutorcraft/chat", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) { res.status(400).json({ error: "message required" }); return; }

    if (!process.env.OPENAI_API_KEY) {
      const reply = await ruleBasedChatWithQuestions(message, req.userId!);
      res.json({ reply, fallback: true });
      return;
    }

    // CoreMind enrichment: inject class-level intelligence for at-risk / lesson-improvement queries
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

    const reply = await openaiChat(messages);
    res.json({ reply });
  } catch (e: any) {
    if (!process.env.OPENAI_API_KEY) {
      const reply = await ruleBasedChatWithQuestions(req.body.message ?? "", req.userId!).catch(() =>
        "TutorCraft is in rule-based mode. Configure an OpenAI API key for full AI features."
      );
      res.json({ reply, fallback: true });
    } else {
      res.status(500).json({ error: e.message });
    }
  }
});

/* ── AI lesson plan generator ──────────────────────────────────────────── */
tutorcraftRouter.post("/tutorcraft/lesson-plan", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { subject, topic, level, duration_min, objectives } = req.body;

    if (!process.env.OPENAI_API_KEY) {
      const plan = `# Lesson Plan: ${topic ?? "Topic"}\n\n**Subject:** ${subject ?? "General"} | **Level:** ${level ?? "A-Level"} | **Duration:** ${duration_min ?? 60} min\n\n## Objectives\n${objectives ?? "Students will understand the core concepts of this topic."}\n\n## Starter (5 min)\nQuick recall question on prior knowledge.\n\n## Main Teaching (${Math.round((duration_min ?? 60) * 0.35)} min)\nExplain key concepts with worked examples.\n\n## Student Activity (${Math.round((duration_min ?? 60) * 0.4)} min)\nStructured practice problems from the question bank.\n\n## Assessment Checkpoint (5 min)\nExit ticket: 2 quick questions.\n\n## Homework\n3-5 questions at medium difficulty.\n\n*Configure an OpenAI API key for a fully personalized AI-generated plan.*`;
      res.json({ plan, fallback: true });
      return;
    }

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

    if (!process.env.OPENAI_API_KEY) {
      const pct = max_marks > 0 ? Math.round((marks_awarded / max_marks) * 100) : 0;
      const tone = pct >= 70 ? "Good work" : pct >= 50 ? "Reasonable attempt" : "Needs improvement";
      const feedback = `${tone}. You scored ${marks_awarded}/${max_marks}. ${pct < 70 ? `Review the model answer and focus on: ${model_answer?.slice(0, 100) ?? "key concepts"}.` : "Keep building on this foundation."} Configure AI for more personalised feedback.`;
      res.json({ feedback, fallback: true });
      return;
    }

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

    if (!process.env.OPENAI_API_KEY) {
      res.json({ variants: [], fallback: true, message: "Configure an OpenAI API key to auto-generate question variants." });
      return;
    }

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

    if (!process.env.OPENAI_API_KEY) {
      res.json({ units: [], fallback: true, message: "Configure an OpenAI API key to auto-generate a syllabus." });
      return;
    }

    const prompt = `Create a structured course syllabus for:
Subject: ${subject}, Level: ${level || "A-Level"}, Board: ${board || "CAIE"}, Duration: ${duration_weeks || 12} weeks.

Return JSON: { units: [{ title, topics: [{ title, lessons: [{ title, type, duration_min }] }] }] }
No markdown, just raw JSON.`;

    const raw = await openaiChat([{ role: "user", content: prompt }], 1500);
    let parsed: { units: any[] } | null = null;
    try { parsed = JSON.parse(raw); } catch { res.json({ units: [], raw }); return; }

    // Weave integration: enrich each unit with prerequisites + register nodes
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

    res.json({ ...parsed, weaveEnriched });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
