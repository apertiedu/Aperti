/**
 * AI Exam Generator — Phase 48
 *
 * POST /exams/ai-generate
 *   Generates a fully-structured draft exam from curriculum topics and student
 *   weakness data.  Always returns status = "draft" — teacher must review and
 *   publish manually.
 *
 * GET  /exams/ai-generate/preview/:examId
 *   Returns the structured sections/questions for a draft exam.
 */

import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { generateAIResponse, AI_AVAILABLE } from "../services/ai";

export const aiExamGeneratorRouter = Router();
aiExamGeneratorRouter.use(authenticate, requireRole("teacher", "admin"));

// ── Helpers ───────────────────────────────────────────────────────────────────

function difficultyLabel(score: number): "easy" | "medium" | "hard" {
  if (score < 40) return "easy";
  if (score < 70) return "medium";
  return "hard";
}

/** Pick N items from arr weighted by weights (same length). */
function weightedSample<T>(arr: T[], weights: number[], n: number): T[] {
  const result: T[] = [];
  const pool = arr.map((item, i) => ({ item, w: weights[i] ?? 1 }));
  for (let i = 0; i < Math.min(n, pool.length); i++) {
    const total = pool.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * total;
    const idx = pool.findIndex(x => { r -= x.w; return r <= 0; });
    const pick = pool.splice(idx < 0 ? 0 : idx, 1)[0];
    result.push(pick.item);
  }
  return result;
}

// ── POST /exams/ai-generate ───────────────────────────────────────────────────

aiExamGeneratorRouter.post("/exams/ai-generate", async (req: AuthRequest, res: Response): Promise<void> => {
  const teacherAccountId = req.userId!;
  const {
    name,
    subjectId,
    totalScore = 100,
    targetStudentId,
    topics: requestedTopics,
    sectionCount = 3,
  } = req.body as {
    name?: string;
    subjectId?: number;
    totalScore?: number;
    targetStudentId?: number;
    topics?: string[];
    sectionCount?: number;
  };

  if (!name?.trim()) {
    res.status(400).json({ message: "Exam name is required" });
    return;
  }

  // ── 1. Load question bank ────────────────────────────────────────────────
  const qbParams: unknown[] = [teacherAccountId];
  let qbWhere = `WHERE teacher_account_id = $1 AND question_text IS NOT NULL`;
  if (subjectId) { qbWhere += ` AND subject_id = $2`; qbParams.push(subjectId); }

  const { rows: allQuestions } = await pool.query(
    `SELECT id, question_text, topic, difficulty, max_marks, question_type, times_used
     FROM question_bank ${qbWhere} ORDER BY RANDOM() LIMIT 300`,
    qbParams,
  );

  if (allQuestions.length === 0) {
    res.status(400).json({ message: "No questions found in your question bank. Add questions first." });
    return;
  }

  // ── 2. Load student weakness data (optional) ─────────────────────────────
  let weakTopics: string[] = [];
  let strongTopics: string[] = [];

  if (targetStudentId) {
    const { rows: echoRows } = await pool.query(
      `SELECT weak_topics, strong_topics FROM echo_memory WHERE student_id = $1 LIMIT 1`,
      [targetStudentId],
    );
    if (echoRows[0]) {
      weakTopics = (echoRows[0].weak_topics as string[] | null) ?? [];
      strongTopics = (echoRows[0].strong_topics as string[] | null) ?? [];
    }

    // Also pull from recent exam mistakes
    const { rows: mistakeRows } = await pool.query(
      `SELECT eq.topic, COUNT(*) AS miss_count
       FROM student_marks sm
       JOIN exam_questions eq ON eq.id = sm.question_id
       WHERE sm.student_id = $1
         AND sm.marks_scored < (eq.max_marks * 0.5)
         AND eq.topic IS NOT NULL
       GROUP BY eq.topic
       ORDER BY miss_count DESC
       LIMIT 10`,
      [targetStudentId],
    );
    weakTopics = [...new Set([...weakTopics, ...mistakeRows.map((r: any) => r.topic as string)])];
  }

  // ── 3. Determine topic pool ──────────────────────────────────────────────
  const topicSet = requestedTopics?.length
    ? requestedTopics
    : [...new Set(allQuestions.map((q: any) => q.topic).filter(Boolean))];

  // ── 4. Build difficulty distribution (20 / 50 / 30) ─────────────────────
  const EASY_PCT = 0.20;
  const MEDIUM_PCT = 0.50;
  const HARD_PCT = 0.30;

  const easyQ  = allQuestions.filter((q: any) => (q.difficulty ?? "medium") === "easy");
  const mediumQ = allQuestions.filter((q: any) => (q.difficulty ?? "medium") === "medium");
  const hardQ  = allQuestions.filter((q: any) => (q.difficulty ?? "medium") === "hard");

  // Weight selection toward weak topics
  function pickWithWeakBias(pool: any[], count: number): any[] {
    if (pool.length === 0) return [];
    const weights = pool.map((q: any) => {
      const topicStr = (q.topic ?? "").toLowerCase();
      const isWeak = weakTopics.some(t => topicStr.includes(t.toLowerCase()));
      return isWeak ? 3 : 1;
    });
    return weightedSample(pool, weights, count);
  }

  // Target question counts per bucket — derive from totalScore assuming avg 5 marks/q
  const avgMarks = allQuestions.reduce((s: number, q: any) => s + parseFloat(q.max_marks ?? 5), 0) / allQuestions.length;
  const totalQ = Math.min(Math.max(Math.round(totalScore / avgMarks), 5), 40);

  const easyCount  = Math.max(1, Math.round(totalQ * EASY_PCT));
  const mediumCount = Math.max(1, Math.round(totalQ * MEDIUM_PCT));
  const hardCount  = Math.max(1, Math.round(totalQ * HARD_PCT));

  const selectedEasy   = pickWithWeakBias(easyQ,   easyCount);
  const selectedMedium = pickWithWeakBias(mediumQ, mediumCount);
  const selectedHard   = pickWithWeakBias(hardQ,   hardCount);

  // Fallback: if we don't have enough categorised questions, fill from general pool
  const usedIds = new Set([...selectedEasy, ...selectedMedium, ...selectedHard].map((q: any) => q.id));
  const remainder = allQuestions.filter((q: any) => !usedIds.has(q.id));
  const needed = totalQ - usedIds.size;
  const fillers = needed > 0 ? pickWithWeakBias(remainder, needed) : [];

  const finalQuestions = [...selectedEasy, ...selectedMedium, ...selectedHard, ...fillers];

  if (finalQuestions.length === 0) {
    res.status(400).json({ message: "Could not assemble questions with the given criteria." });
    return;
  }

  // ── 5. Organise into sections ────────────────────────────────────────────
  const groupedByTopic: Record<string, any[]> = {};
  for (const q of finalQuestions) {
    const t = (q.topic ?? "General") as string;
    if (!groupedByTopic[t]) groupedByTopic[t] = [];
    groupedByTopic[t].push(q);
  }

  const topicKeys = Object.keys(groupedByTopic);
  const numSections = Math.min(sectionCount, topicKeys.length, 5);
  // Merge small topics
  const sectionTopics: string[][] = [];
  const perSection = Math.ceil(topicKeys.length / numSections);
  for (let i = 0; i < numSections; i++) {
    sectionTopics.push(topicKeys.slice(i * perSection, (i + 1) * perSection));
  }

  const sections = sectionTopics.map((topics, idx) => {
    const sectionQs = topics.flatMap(t => groupedByTopic[t] ?? []);
    const weight = Math.round(100 / numSections);
    return {
      name: topics.length === 1 ? topics[0] : `Section ${idx + 1}`,
      weight,
      questions: sectionQs.map((q: any) => ({
        questionBankId: q.id,
        question: q.question_text,
        type: (q.question_type ?? "short") as "mcq" | "short" | "essay",
        difficulty: (q.difficulty ?? "medium") as "easy" | "medium" | "hard",
        max_score: parseFloat(q.max_marks ?? 5),
        topic: q.topic ?? null,
      })),
    };
  });

  const computedTotal = finalQuestions.reduce((s: number, q: any) => s + parseFloat(q.max_marks ?? 5), 0);

  // ── 6. AI enrichment: generate exam title/instructions ──────────────────
  let aiNarrative: string | null = null;
  if (AI_AVAILABLE) {
    const topicSummary = topicKeys.slice(0, 10).join(", ");
    const weakSummary  = weakTopics.slice(0, 5).join(", ") || "none identified";
    const aiRes = await generateAIResponse(
      `You are a curriculum designer. Generate a brief (2-3 sentence) exam overview for:
Title: ${name}
Topics covered: ${topicSummary}
Student weak areas addressed: ${weakSummary}
Difficulty distribution: ${easyCount} easy, ${mediumCount} medium, ${hardCount} hard questions
Total marks: ${computedTotal}

Return only the overview text, no JSON.`,
      {
        systemPrompt: "You are a senior curriculum designer. Be concise and professional.",
        maxTokens: 200,
        module: "ai-exam-generator",
        userId: teacherAccountId,
      },
    );
    aiNarrative = aiRes.text;
  }

  // ── 7. Persist draft exam ────────────────────────────────────────────────
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: [exam] } = await client.query(
      `INSERT INTO exams (name, subject_id, teacher_account_id, total_marks, status, ai_draft_metadata)
       VALUES ($1, $2, $3, $4, 'draft', $5)
       RETURNING *`,
      [
        `[AI Draft] ${name.trim()}`,
        subjectId ?? null,
        teacherAccountId,
        computedTotal,
        JSON.stringify({
          generated: true,
          generatedAt: new Date().toISOString(),
          targetStudentId: targetStudentId ?? null,
          weakTopicsAddressed: weakTopics.slice(0, 10),
          difficultyBreakdown: { easy: easyCount, medium: mediumCount, hard: hardCount },
          aiNarrative,
          label: "AI Generated — Pending Teacher Approval",
        }),
      ],
    );

    let qOrder = 1;
    for (const section of sections) {
      for (const q of section.questions) {
        await client.query(
          `INSERT INTO exam_questions
             (exam_id, question_text, topic, max_marks, question_order, difficulty, section_name)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [exam.id, q.question, q.topic, q.max_score, qOrder++, q.difficulty, section.name],
        );
        // Increment usage counter
        await client.query(
          `UPDATE question_bank SET times_used = times_used + 1 WHERE id = $1`,
          [q.questionBankId],
        );
      }
    }

    await client.query("COMMIT");

    res.status(201).json({
      exam: {
        ...exam,
        label: "AI Generated — Pending Teacher Approval",
      },
      title: `[AI Draft] ${name.trim()}`,
      total_score: computedTotal,
      sections: sections.map(s => ({
        name: s.name,
        weight: s.weight,
        questionCount: s.questions.length,
        questions: s.questions,
      })),
      difficultyBreakdown: {
        easy: selectedEasy.length,
        medium: selectedMedium.length,
        hard: selectedHard.length,
      },
      weakTopicsAddressed: weakTopics.slice(0, 10),
      aiNarrative,
      status: "draft",
      requiresApproval: true,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[ai-exam-generator] DB error:", err);
    res.status(500).json({ message: "Failed to save generated exam" });
  } finally {
    client.release();
  }
});

// ── GET /exams/ai-generate/preview/:examId ────────────────────────────────────

aiExamGeneratorRouter.get("/exams/ai-generate/preview/:examId", async (req: AuthRequest, res: Response): Promise<void> => {
  const examId = parseInt(req.params.examId, 10);
  if (isNaN(examId)) { res.status(400).json({ message: "Invalid exam ID" }); return; }

  const { rows: examRows } = await pool.query(
    `SELECT e.*, s.name AS subject_name
     FROM exams e
     LEFT JOIN subjects s ON s.id = e.subject_id
     WHERE e.id = $1 AND e.teacher_account_id = $2`,
    [examId, req.userId],
  );

  if (!examRows[0]) { res.status(404).json({ message: "Exam not found" }); return; }

  const { rows: questions } = await pool.query(
    `SELECT id, question_text, topic, max_marks, question_order, difficulty, section_name
     FROM exam_questions WHERE exam_id = $1 ORDER BY question_order`,
    [examId],
  );

  // Group by section
  const sectionMap: Record<string, any[]> = {};
  for (const q of questions) {
    const sec = q.section_name ?? "General";
    if (!sectionMap[sec]) sectionMap[sec] = [];
    sectionMap[sec].push(q);
  }

  const metadata = examRows[0].ai_draft_metadata ?? {};

  res.json({
    exam: examRows[0],
    sections: Object.entries(sectionMap).map(([name, qs]) => ({
      name,
      questions: qs,
    })),
    difficultyBreakdown: metadata.difficultyBreakdown ?? {},
    weakTopicsAddressed: metadata.weakTopicsAddressed ?? [],
    aiNarrative: metadata.aiNarrative ?? null,
    label: metadata.label ?? "AI Generated",
    requiresApproval: (examRows[0].status ?? "draft") === "draft",
  });
});

// ── POST /exams/ai-generate/approve/:examId ───────────────────────────────────

aiExamGeneratorRouter.post("/exams/ai-generate/approve/:examId", async (req: AuthRequest, res: Response): Promise<void> => {
  const examId = parseInt(req.params.examId, 10);
  if (isNaN(examId)) { res.status(400).json({ message: "Invalid exam ID" }); return; }

  // Remove the [AI Draft] prefix on approval
  const { rows } = await pool.query(
    `UPDATE exams
     SET status = 'published',
         name   = REGEXP_REPLACE(name, '^\[AI Draft\] ', '')
     WHERE id = $1 AND teacher_account_id = $2
     RETURNING *`,
    [examId, req.userId],
  );

  if (!rows[0]) { res.status(404).json({ message: "Exam not found or not authorised" }); return; }
  res.json({ success: true, exam: rows[0] });
});
