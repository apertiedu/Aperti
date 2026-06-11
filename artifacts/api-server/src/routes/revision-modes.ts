import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { pool } from "@workspace/db";
import { openaiChat } from "../lib/ai-config";

export const revisionModesRouter = Router();

revisionModesRouter.use(authenticate);

type RevisionMode = "quick" | "deep" | "last-minute";

function buildPrompt(mode: RevisionMode, topic: string, subjectName: string, extraContext: string): string {
  const ctx = extraContext ? `\nAdditional context: ${extraContext}` : "";
  switch (mode) {
    case "quick":
      return `You are an educational assistant creating a Quick Revision guide.
Topic: "${topic}" (Subject: ${subjectName})${ctx}

Generate a concise Quick Revision guide with:
1. 5-8 KEY FACTS (bullet points, max 1 sentence each)
2. 3-5 KEY DEFINITIONS (term: definition)
3. 3-4 IMPORTANT FORMULAS or rules (if applicable)
4. 3 COMMON MISTAKES to avoid

Format as structured JSON with keys: keyFacts, definitions, formulas, commonMistakes
Keep everything brief and scannable. Maximum 15 minutes to read.`;

    case "deep":
      return `You are an educational assistant creating a Deep Revision guide.
Topic: "${topic}" (Subject: ${subjectName})${ctx}

Generate a comprehensive Deep Revision guide with:
1. CORE CONCEPTS (2-3 paragraphs explaining the topic thoroughly)
2. WORKED EXAMPLES (2-3 step-by-step examples with explanations)
3. PRACTICE QUESTIONS (5 questions with answers)
4. CONNECTIONS TO OTHER TOPICS (how this topic links to others)
5. EXTENSION NOTES (for top marks)

Format as structured JSON with keys: coreConcepts, workedExamples, practiceQuestions, connections, extensionNotes`;

    case "last-minute":
      return `You are an educational assistant creating a Last-Minute Revision summary.
Topic: "${topic}" (Subject: ${subjectName})${ctx}

Generate a high-yield Last-Minute Revision guide with:
1. THE 3 MOST IMPORTANT THINGS TO REMEMBER (must-know facts)
2. EXAM TIPS (3-4 specific tips for answering exam questions on this topic)
3. FREQUENTLY TESTED CONCEPTS (what appears most in exams)
4. MEMORY AIDS / MNEMONICS (if applicable)
5. RED FLAGS (things students lose marks on)

Format as structured JSON with keys: topThings, examTips, frequentlyTested, memoryAids, redFlags
This should be readable in 5 minutes.`;
  }
}

// POST /api/revision-modes/generate — Generate revision content for a topic
revisionModesRouter.post("/generate", async (req: AuthRequest, res: Response) => {
  try {
    const { topicId, topicName, subjectName, mode, extraContext } = req.body;

    if (!topicName || !subjectName || !mode) {
      return res.status(400).json({ error: "topicName, subjectName and mode are required" });
    }
    if (!["quick", "deep", "last-minute"].includes(mode)) {
      return res.status(400).json({ error: "mode must be: quick, deep, or last-minute" });
    }

    const prompt = buildPrompt(mode as RevisionMode, topicName, subjectName, extraContext || "");
    const result = await openaiChat({
      systemPrompt: "You are a helpful educational assistant. Always respond with valid JSON only. No markdown code blocks.",
      userMessage: prompt,
      maxTokens: mode === "deep" ? 1500 : mode === "quick" ? 800 : 600,
    });

    if (!result) {
      // Fallback: return template-based content
      const fallback = {
        quick: {
          keyFacts: [`${topicName} is a key topic in ${subjectName}`, "Review your class notes for specific details", "Focus on understanding the core principles"],
          definitions: [],
          formulas: [],
          commonMistakes: ["Not reading the question carefully", "Skipping steps in calculations", "Missing units in answers"],
        },
        deep: {
          coreConcepts: `${topicName} is an important concept in ${subjectName}. Review your textbook and class notes for a thorough understanding.`,
          workedExamples: [],
          practiceQuestions: [],
          connections: [],
          extensionNotes: "",
        },
        "last-minute": {
          topThings: [`Review the main definition of ${topicName}`, "Understand the key principles", "Practice at least one past exam question"],
          examTips: ["Read the question carefully", "Show all working", "Check your answer makes sense"],
          frequentlyTested: [`Definition and explanation of ${topicName}`],
          memoryAids: [],
          redFlags: ["Confusing similar concepts", "Missing units or labels"],
        },
      };
      return res.json({ mode, topicName, subjectName, content: fallback[mode as RevisionMode], aiGenerated: false });
    }

    let content: any;
    try {
      content = JSON.parse(result);
    } catch {
      content = { rawText: result };
    }

    // Cache result in DB if topicId provided
    if (topicId) {
      await pool.query(`
        INSERT INTO revision_mode_cache (topic_id, mode, content, generated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (topic_id, mode) DO UPDATE
          SET content = EXCLUDED.content, generated_at = NOW()
      `, [topicId, mode, JSON.stringify(content)]).catch(() => {});
    }

    res.json({ mode, topicName, subjectName, content, aiGenerated: true });
  } catch (err) {
    console.error("revision-modes error:", err);
    res.status(500).json({ error: "Failed to generate revision content" });
  }
});

// GET /api/revision-modes/cache/:topicId/:mode — check cache
revisionModesRouter.get("/cache/:topicId/:mode", async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS revision_mode_cache (
        topic_id INTEGER,
        mode TEXT,
        content JSONB,
        generated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (topic_id, mode)
      )
    `).catch(() => {});

    const { rows } = await pool.query(
      `SELECT content, generated_at FROM revision_mode_cache
       WHERE topic_id = $1 AND mode = $2
         AND generated_at > NOW() - INTERVAL '7 days'`,
      [req.params.topicId, req.params.mode]
    );

    if (rows.length) {
      res.json({ cached: true, content: rows[0].content, generatedAt: rows[0].generated_at });
    } else {
      res.json({ cached: false });
    }
  } catch {
    res.json({ cached: false });
  }
});
