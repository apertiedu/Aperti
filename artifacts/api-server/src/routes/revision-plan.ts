import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";

export const revisionPlanRouter = Router();
revisionPlanRouter.use(authenticate as any);

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function fmt(d: Date): string {
  return d.toISOString().split("T")[0];
}

/* POST /api/revision/generate-plan */
revisionPlanRouter.post("/generate-plan", async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.userId!;
    const { examDate, mode = "balanced", subject } = req.body;

    // Gather weak topics from echo memory
    const { rows: echoRows } = await pool.query(
      `SELECT topic, subject, strength_score FROM echo_memory
       WHERE account_id=$1 AND strength_score < 0.6
       ORDER BY strength_score ASC LIMIT 12`,
      [studentId]
    ).catch(() => ({ rows: [] as any[] }));

    // Gather recent exam performance
    const { rows: examRows } = await pool.query(
      `SELECT subject_id, score, created_at FROM exam_submissions
       WHERE student_id=$1 AND created_at > NOW()-INTERVAL '60 days'
       ORDER BY score ASC LIMIT 10`,
      [studentId]
    ).catch(() => ({ rows: [] as any[] }));

    // Gather flashcard decks for the student
    const { rows: deckRows } = await pool.query(
      `SELECT fd.id, fd.title, fd.subject,
              COUNT(fi.id) AS card_count,
              SUM(CASE WHEN fp.confidence >= 4 THEN 1 ELSE 0 END) AS mastered
       FROM flashcard_decks fd
       LEFT JOIN flashcard_items fi ON fi.deck_id=fd.id
       LEFT JOIN flashcard_progress fp ON fp.item_id=fi.id AND fp.student_id=$1
       WHERE fd.created_by=$1 OR fd.created_by IS NULL
       GROUP BY fd.id LIMIT 10`,
      [studentId]
    ).catch(() => ({ rows: [] as any[] }));

    // Determine how many days to plan for
    let daysAvailable = 14;
    if (examDate) {
      const diff = Math.floor((new Date(examDate).getTime() - Date.now()) / 86400000);
      daysAvailable = Math.max(3, Math.min(diff, 30));
    }

    const today = new Date();
    const calendar: any[] = [];

    // Build topics list
    const weakTopics = echoRows.map((r: any) => ({
      topic: r.topic || "General Revision",
      subject: r.subject || subject || "General",
      priority: Math.round((1 - (r.strength_score ?? 0.5)) * 100),
    }));

    // Fill with flashcard decks if no echo data
    const deckTopics = deckRows.map((d: any) => ({
      topic: d.title,
      subject: d.subject || "General",
      priority: 50,
      deckId: d.id,
      cardCount: parseInt(d.card_count ?? "0"),
      mastered: parseInt(d.mastered ?? "0"),
    }));

    const allTopics = weakTopics.length > 0 ? weakTopics : deckTopics;

    // AI-enhanced plan if API key is available
    if (process.env.OPENAI_API_KEY && allTopics.length > 0) {
      try {
        const prompt = `Create a ${daysAvailable}-day revision plan for a student.
Weak topics (sorted by priority): ${allTopics.slice(0, 8).map(t => `${t.topic} (${t.subject})`).join(", ")}.
${examDate ? `Exam date: ${examDate}.` : ""}
Mode: ${mode} (balanced = mix everything, weak = focus on weak areas, exam = exam practice).

Return a JSON array of ${daysAvailable} day objects:
[{"day":1,"date":"YYYY-MM-DD","theme":"Topic Name","tasks":[{"type":"flashcards|questions|revision|simulation","title":"Task title","duration_min":20,"subject":"Subject","topic":"Topic"}]}]
Max 3 tasks per day. Keep it achievable.`;

        const aiRes = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL || "meta/llama-3.1-70b-instruct",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 2000,
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json() as any;
          const text = aiData.choices?.[0]?.message?.content ?? "";
          const jsonMatch = text.match(/\[[\s\S]+\]/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            res.json({ plan: parsed, daysAvailable, generatedAt: new Date().toISOString(), aiGenerated: true });
            return;
          }
        }
      } catch { /* fall through to manual */ }
    }

    // Manual fallback plan
    const taskTypes = ["flashcards", "questions", "revision", "simulation"];
    for (let i = 0; i < daysAvailable; i++) {
      const topicIdx = i % Math.max(allTopics.length, 1);
      const topic = allTopics[topicIdx] ?? { topic: "General Revision", subject: subject || "All Subjects", priority: 50 };
      const isRestDay = (i + 1) % 7 === 0;
      calendar.push({
        day: i + 1,
        date: fmt(addDays(today, i)),
        theme: isRestDay ? "Rest & Review" : topic.topic,
        tasks: isRestDay ? [
          { type: "revision", title: "Weekly recap — revisit all topics covered", duration_min: 30, subject: topic.subject, topic: "Review" },
        ] : [
          { type: taskTypes[(i * 2) % 4], title: `Study: ${topic.topic}`, duration_min: 25, subject: topic.subject, topic: topic.topic },
          { type: "questions", title: `Practice questions — ${topic.topic}`, duration_min: 20, subject: topic.subject, topic: topic.topic },
          ...(topic.priority > 60 ? [{ type: "flashcards", title: `Flashcard drill — ${topic.topic}`, duration_min: 15, subject: topic.subject, topic: topic.topic }] : []),
        ],
      });
    }

    res.json({ plan: calendar, daysAvailable, generatedAt: new Date().toISOString(), aiGenerated: false });
  } catch (err: any) {
    console.error("generate-plan error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* GET /api/revision/plan/today */
revisionPlanRouter.get("/plan/today", async (req: AuthRequest, res: Response) => {
  res.json({ message: "Use POST /api/revision/generate-plan to create a plan" });
});
