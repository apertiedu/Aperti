import { Router, Response } from "express";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { analyzeStudent, enhanceMentor, enhanceGrading, getStudentProfile } from "../lib/coremind";
import { logInteraction, moderateContent, wrapWithSafety } from "../lib/ai-safety";
import { db } from "@workspace/db";
import { knowledgeNodesTable, subjectsTable, questionBankTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const coremindRouter = Router();

// POST /coremind/analyze
coremindRouter.post("/analyze", authenticate, async (req: AuthRequest, res: Response) => {
  const { studentId, context } = req.body;
  if (!studentId) return res.status(400).json({ error: "studentId required" });
  const analysis = await analyzeStudent(parseInt(studentId));
  res.json(analysis);
});

// POST /coremind/enhance-mentor
coremindRouter.post("/enhance-mentor", authenticate, async (req: AuthRequest, res: Response) => {
  const { studentId, message } = req.body;
  if (!studentId) return res.status(400).json({ error: "studentId required" });

  const safety = await moderateContent(message ?? "");
  if (!safety.safe) {
    return res.status(422).json({ error: "Message flagged by content filter", reason: safety.reason });
  }

  const enhancement = await enhanceMentor(parseInt(studentId), message ?? "");
  res.json(enhancement);
});

// POST /coremind/enhance-grading
coremindRouter.post("/enhance-grading", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  const { questionId, answer, topic } = req.body;
  if (!questionId || !answer) return res.status(400).json({ error: "questionId and answer required" });
  const enhancement = await enhanceGrading(parseInt(questionId), answer, topic);
  res.json(enhancement);
});

// POST /coremind/generate-content
coremindRouter.post("/generate-content", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  const { type, topicId, difficulty, studentId, useWeave } = req.body;
  if (!type || !topicId) return res.status(400).json({ error: "type and topicId required" });

  const sources: string[] = [];
  let relatedObjectives: string[] = [];
  let prerequisiteTopics: string[] = [];
  let existingQuestions: Array<{ questionText: string; difficulty: string }> = [];

  if (useWeave) {
    try {
      const { getRelatedNodes, getIncomingNodes } = await import("../lib/weave-graph");
      const related = await getRelatedNodes(parseInt(topicId), "includes");
      relatedObjectives = related.map(n => n.name);
      if (relatedObjectives.length) sources.push("Knowledge graph objectives");

      const prereqs = await getIncomingNodes(parseInt(topicId), "prerequisite");
      prerequisiteTopics = prereqs.map(n => n.name);
      if (prerequisiteTopics.length) sources.push("Prerequisite chain from Weave");
    } catch { /* weave may be empty */ }
  }

  const qs = await db.select({
    questionText: questionBankTable.questionText,
    difficulty: questionBankTable.difficulty,
  }).from(questionBankTable).limit(5);
  existingQuestions = qs.map(q => ({ questionText: q.questionText ?? "", difficulty: q.difficulty ?? "medium" }));
  if (existingQuestions.length) sources.push("Question bank examples");

  let content: Record<string, unknown> = {};

  if (process.env.OPENAI_API_KEY) {
    try {
      const prompt = type === "quiz"
        ? `Generate a ${difficulty ?? "medium"} quiz with 5 questions for topic ID ${topicId}.
Prerequisites: ${prerequisiteTopics.join(", ") || "none"}.
Related objectives: ${relatedObjectives.join(", ") || "use general knowledge"}.
Respond as JSON: { "title": "...", "questions": [{ "text": "...", "answer": "...", "difficulty": "..." }] }`
        : `Generate a ${difficulty ?? "medium"} worksheet for topic ID ${topicId}.
Prerequisites: ${prerequisiteTopics.join(", ") || "none"}.
Scaffold from easy → medium → hard.
Respond as JSON: { "title": "...", "sections": [{ "difficulty": "easy|medium|hard", "tasks": ["..."] }] }`;

      const res2 = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 1000,
          temperature: 0.7,
        }),
      });
      const data = await res2.json() as { choices?: { message?: { content?: string } }[] };
      const raw = data.choices?.[0]?.message?.content ?? "{}";
      content = JSON.parse(raw.replace(/```json|```/g, "").trim());
      sources.push("OpenAI GPT-4o-mini");
    } catch {
      content = buildRuleBasedContent(type, topicId, difficulty, prerequisiteTopics);
      sources.push("Rule-based generator");
    }
  } else {
    content = buildRuleBasedContent(type, topicId, difficulty, prerequisiteTopics);
    sources.push("Rule-based generator");
  }

  await logInteraction({
    userId: req.userId,
    module: "coremind",
    action: "generate-content",
    inputSummary: `type=${type}, topicId=${topicId}`,
    outputSummary: `Generated ${type} content`,
    confidence: sources.includes("OpenAI GPT-4o-mini") ? 0.85 : 0.6,
    sources,
  });

  res.json(wrapWithSafety(
    { ...content, prerequisiteTopics, relatedObjectives, humanOverride: false },
    sources.includes("OpenAI GPT-4o-mini") ? 0.85 : 0.6,
    sources
  ));
});

function buildRuleBasedContent(
  type: string,
  topicId: number,
  difficulty = "medium",
  prereqs: string[] = []
): Record<string, unknown> {
  if (type === "quiz") {
    return {
      title: `Quiz — Topic ${topicId}`,
      questions: [
        { text: "Define the key concept of this topic.", answer: "See your notes and textbook.", difficulty: "easy" },
        { text: "Describe one real-world application.", answer: "Refer to examples from class.", difficulty: "medium" },
        { text: "Explain the relationship between the main variables.", answer: "Show working and use correct units.", difficulty: difficulty },
      ],
      note: prereqs.length > 0 ? `Review prerequisites first: ${prereqs.join(", ")}` : undefined,
    };
  }
  return {
    title: `Worksheet — Topic ${topicId}`,
    sections: [
      { difficulty: "easy", tasks: ["Define key terms.", "Label the diagram."] },
      { difficulty: "medium", tasks: ["Solve a sample problem.", "Compare two concepts."] },
      { difficulty: "hard", tasks: ["Analyse and evaluate a case study.", "Derive a formula from first principles."] },
    ],
    note: prereqs.length > 0 ? `Review prerequisites first: ${prereqs.join(", ")}` : undefined,
  };
}
