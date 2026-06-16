/**
 * AI Multi-Agent Orchestrator — Aperti Phase 48
 *
 * Three cooperating agents that share student data and system state via
 * the ai_shared_memory table.
 *
 * Routes:
 *   POST /api/ai/teacher          — lesson, quiz, exam, revision plan generation
 *   POST /api/ai/student          — tutor Q&A, mistake explanation, study schedule
 *   POST /api/ai/admin/analyze    — system health insights, anomaly detection
 *   GET  /api/ai/memory/:userId   — shared memory snapshot for a student
 */
import { Router, Response } from "express";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { generateAIResponse, AI_AVAILABLE } from "../services/ai";
import { pool } from "@workspace/db";

export const aiAgentsRouter = Router();
aiAgentsRouter.use(authenticate);

// ── Shared memory helpers ─────────────────────────────────────────────────────

async function loadMemory(accountId: number, agent: string): Promise<Record<string, unknown>> {
  try {
    const { rows } = await pool.query(
      `SELECT key, value FROM ai_shared_memory
       WHERE account_id = $1 AND agent = $2
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [accountId, agent],
    );
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  } catch { return {}; }
}

async function saveMemory(
  accountId: number,
  agent: string,
  key: string,
  value: unknown,
  ttlHours = 168,
) {
  pool.query(
    `INSERT INTO ai_shared_memory (account_id, agent, key, value, expires_at, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, NOW() + ($5 || ' hours')::interval, NOW())
     ON CONFLICT (account_id, agent, key)
     DO UPDATE SET value = EXCLUDED.value,
                   expires_at = EXCLUDED.expires_at,
                   updated_at = NOW()`,
    [accountId, agent, key, JSON.stringify(value), ttlHours],
  ).catch(() => {});
}

async function getStudentContext(studentAccountId: number): Promise<string> {
  try {
    const { rows } = await pool.query(
      `SELECT
         a.username, a.display_name,
         s.student_name, s.student_code,
         sub.name AS subject_name,
         (SELECT COUNT(*) FROM attendance WHERE student_id = s.id AND is_present = true) AS sessions_attended,
         (SELECT ROUND(AVG(marks_obtained::float / NULLIF(marks_total, 0) * 100)::numeric, 1)
            FROM student_marks sm WHERE sm.student_id = s.id) AS avg_score_pct
       FROM accounts a
       LEFT JOIN students s ON s.account_id = a.id
       LEFT JOIN subjects sub ON sub.teacher_account_id = s.teacher_account_id
       WHERE a.id = $1
       LIMIT 1`,
      [studentAccountId],
    );
    if (!rows[0]) return "Student context unavailable.";
    const r = rows[0];
    return `Student: ${r.student_name || r.display_name} (${r.student_code || "N/A"}) | Subject: ${r.subject_name || "General"} | Sessions attended: ${r.sessions_attended ?? 0} | Avg score: ${r.avg_score_pct ?? "N/A"}%`;
  } catch { return "Student context unavailable."; }
}

// ── Fallback responses per agent ──────────────────────────────────────────────
const FALLBACKS: Record<string, string> = {
  teacher: "AI lesson generation is temporarily unavailable. Please create content manually using the built-in tools.",
  student: "The AI tutor is temporarily unavailable. Please review your notes and contact your teacher for help.",
  admin:   "AI system analysis is temporarily unavailable. Check the health dashboard for manual metrics.",
};

// ── POST /api/ai/teacher ──────────────────────────────────────────────────────
aiAgentsRouter.post("/teacher", requireRole("teacher", "admin", "assistant"), async (req: AuthRequest, res: Response) => {
  const { task, subject, topic, level = "IGCSE", studentCount, mode = "balanced" } = req.body as {
    task: "lesson" | "quiz" | "exam" | "revision-plan" | "feedback";
    subject?: string; topic: string; level?: string;
    studentCount?: number; mode?: string;
  };

  if (!task || !topic) return res.status(400).json({ error: "task and topic are required" });

  if (!AI_AVAILABLE) {
    return res.json({ ok: false, fallback: true, agent: "teacher", result: FALLBACKS.teacher });
  }

  const memory = await loadMemory(req.userId!, "teacher");
  const recentTopics = (memory.recentTopics as string[] | undefined) ?? [];

  const systemPrompts: Record<string, string> = {
    lesson: `You are an expert ${level} ${subject ?? "subject"} teacher with 15 years of IGCSE experience.
Generate a complete, ready-to-use lesson on "${topic}". Include:
1. Learning Objective (SMART format)
2. Starter activity (5 min)
3. Main explanation (250-300 words, clear and structured)
4. 3 worked examples with full solutions
5. Common misconceptions and how to address them
6. Practice questions (5 questions, graded difficulty)
7. Plenary / exit ticket question
8. Homework suggestion
Recent topics covered: ${recentTopics.slice(-3).join(", ") || "none"}`,

    quiz: `You are an expert ${level} ${subject ?? "subject"} examiner. Generate a ${studentCount ?? 20}-student-ready quiz on "${topic}".
Include: 5 MCQs, 3 short-answer (4 marks each), 1 extended question (8 marks).
For each question include the mark scheme and examiner tips.`,

    exam: `You are an exam paper writer for ${level} ${subject ?? "subject"}. Create a complete exam paper on "${topic}".
Structure: Section A (MCQs, 20 marks), Section B (structured, 30 marks), Section C (extended, 20 marks).
Total: 70 marks, 1.5 hours. Include a full mark scheme.`,

    "revision-plan": `You are a revision planner for ${level} ${subject ?? "subject"}. Create a 4-week revision plan for "${topic}".
Week-by-week breakdown with: daily tasks, key terms to review, past paper questions to attempt, self-assessment checkpoints.`,

    feedback: `You are an expert ${level} ${subject ?? "subject"} teacher. Provide constructive, encouraging feedback on a student submission about "${topic}".
Be specific, cite examples, suggest concrete improvements.`,
  };

  const sys = systemPrompts[task] ?? systemPrompts.lesson;

  const result = await generateAIResponse(topic, {
    systemPrompt: sys,
    maxTokens: 2000,
    userId: req.userId,
    module: `ai-teacher-${task}`,
  });

  if (result.ok) {
    saveMemory(req.userId!, "teacher", "recentTopics", [...recentTopics.slice(-9), topic]);
    saveMemory(req.userId!, "teacher", "lastTask", { task, topic, timestamp: new Date().toISOString() });
  }

  res.json({
    ok: result.ok,
    fallback: result.fallback,
    agent: "teacher",
    task,
    topic,
    result: result.text ?? FALLBACKS.teacher,
    latencyMs: result.latencyMs,
  });
});

// ── POST /api/ai/student ──────────────────────────────────────────────────────
aiAgentsRouter.post("/student", async (req: AuthRequest, res: Response) => {
  const { question, context, subject, mistakeToExplain, mode = "balanced" } = req.body as {
    question?: string; context?: string; subject?: string;
    mistakeToExplain?: string; mode?: string;
  };

  if (!question && !mistakeToExplain) {
    return res.status(400).json({ error: "question or mistakeToExplain is required" });
  }

  if (!AI_AVAILABLE) {
    return res.json({ ok: false, fallback: true, agent: "student", result: FALLBACKS.student });
  }

  const memory = await loadMemory(req.userId!, "student");
  const studentCtx = await getStudentContext(req.userId!);
  const weakAreas = (memory.weakAreas as string[] | undefined) ?? [];
  const questionHistory = (memory.questionHistory as string[] | undefined) ?? [];

  const sys = mistakeToExplain
    ? `You are a patient, encouraging IGCSE ${subject ?? "subject"} tutor. A student made a mistake.
Explain why it is wrong, what the correct approach is, and give a similar practice example.
Student context: ${studentCtx}
Known weak areas: ${weakAreas.join(", ") || "none yet"}.
Be warm, specific, and actionable.`
    : `You are a brilliant IGCSE ${subject ?? "subject"} tutor. Answer the student's question clearly and engagingly.
Student context: ${studentCtx}
Previous questions: ${questionHistory.slice(-3).join(" | ") || "first session"}.
Build on prior knowledge. Use examples. Check understanding with a follow-up question at the end.`;

  const userMsg = mistakeToExplain
    ? `I made this mistake: ${mistakeToExplain}\n${context ? `Context: ${context}` : ""}`
    : `${question}\n${context ? `Context: ${context}` : ""}`;

  const result = await generateAIResponse(userMsg, {
    systemPrompt: sys,
    maxTokens: 1200,
    userId: req.userId,
    module: "ai-student-tutor",
  });

  if (result.ok && question) {
    saveMemory(req.userId!, "student", "questionHistory", [...questionHistory.slice(-19), question.slice(0, 100)]);
  }
  if (result.ok && mistakeToExplain) {
    const updatedWeak = [...new Set([...weakAreas, subject ?? "general"])].slice(-10);
    saveMemory(req.userId!, "student", "weakAreas", updatedWeak);
  }

  res.json({
    ok: result.ok,
    fallback: result.fallback,
    agent: "student",
    result: result.text ?? FALLBACKS.student,
    latencyMs: result.latencyMs,
    followUp: result.ok,
  });
});

// ── POST /api/ai/admin/analyze ────────────────────────────────────────────────
aiAgentsRouter.post("/admin/analyze", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response) => {
  const { focus = "general" } = req.body as {
    focus?: "health" | "anomaly" | "performance" | "general";
  };

  if (!AI_AVAILABLE) {
    return res.json({ ok: false, fallback: true, agent: "admin", result: FALLBACKS.admin });
  }

  let systemData = "System data unavailable.";
  try {
    const [accounts, errors, aiUsage, sessions] = await Promise.allSettled([
      pool.query(`SELECT role, COUNT(*) AS cnt FROM accounts WHERE status='active' GROUP BY role`),
      pool.query(`SELECT COUNT(*) AS cnt, MAX(created_at) AS last FROM error_logs WHERE created_at > NOW() - INTERVAL '24h' AND level = 'error'`),
      pool.query(`SELECT COUNT(*) AS cnt, COALESCE(SUM(estimated_cost_usd),0)::float AS cost FROM ai_interactions WHERE created_at > NOW() - INTERVAL '24h'`),
      pool.query(`SELECT COUNT(*) AS cnt FROM device_sessions WHERE created_at > NOW() - INTERVAL '24h'`),
    ]);

    const accRows = accounts.status === "fulfilled" ? accounts.value.rows : [];
    const errRow  = errors.status  === "fulfilled" ? errors.value.rows[0]  : null;
    const aiRow   = aiUsage.status === "fulfilled" ? aiUsage.value.rows[0] : null;
    const sesRow  = sessions.status === "fulfilled" ? sessions.value.rows[0] : null;

    systemData = `
Active accounts: ${accRows.map(r => `${r.role}=${r.cnt}`).join(", ")}
Errors (24h): ${errRow?.cnt ?? 0} (last: ${errRow?.last ? new Date(errRow.last).toLocaleTimeString() : "none"})
AI calls (24h): ${aiRow?.cnt ?? 0}, estimated cost: $${Number(aiRow?.cost ?? 0).toFixed(4)}
Active sessions (24h): ${sesRow?.cnt ?? 0}
`.trim();
  } catch {}

  const focusPrompts: Record<string, string> = {
    health:      "Focus on: Is the system healthy? Any concerning error rates? DB performance? AI reliability?",
    anomaly:     "Focus on: Are there unusual patterns? Unexpected spikes in errors, logins, or AI usage? Potential security concerns?",
    performance: "Focus on: How is system performance? What are the bottlenecks? What optimisations would have the highest impact?",
    general:     "Provide a complete executive summary: overall health, key metrics, top 3 risks, and 3 recommended actions.",
  };

  const sys = `You are the Admin AI Agent for Aperti, an educational SaaS platform. Analyse the system data and provide actionable insights.
${focusPrompts[focus] ?? focusPrompts.general}
Be concise, data-driven, and prioritise by impact. Use bullet points.`;

  const result = await generateAIResponse(systemData, {
    systemPrompt: sys,
    maxTokens: 1000,
    userId: req.userId,
    module: "ai-admin-analyze",
  });

  res.json({
    ok: result.ok,
    fallback: result.fallback,
    agent: "admin",
    focus,
    systemData,
    result: result.text ?? FALLBACKS.admin,
    latencyMs: result.latencyMs,
  });
});

// ── GET /api/ai/memory/:userId ────────────────────────────────────────────────
aiAgentsRouter.get("/memory/:userId", requireRole("admin", "teacher"), async (req: AuthRequest, res: Response) => {
  const targetId = parseInt(req.params.userId);
  if (isNaN(targetId)) return res.status(400).json({ error: "Invalid userId" });

  try {
    const { rows } = await pool.query(
      `SELECT agent, key, value, updated_at, expires_at
       FROM ai_shared_memory
       WHERE account_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY agent, key`,
      [targetId],
    );
    const grouped: Record<string, unknown> = {};
    for (const row of rows) {
      if (!grouped[row.agent]) grouped[row.agent] = {};
      (grouped[row.agent] as Record<string, unknown>)[row.key] = { value: row.value, updatedAt: row.updated_at };
    }
    res.json({ accountId: targetId, memory: grouped });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});
