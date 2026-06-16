import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";

export const revisionV3Router = Router();
revisionV3Router.use(authenticate as any);

/* ── Generate Smart Revision Pack ────────────────────────────────────────── */
revisionV3Router.post("/generate-smart-pack", async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.userId!;
    const { subject, topics, examDate } = req.body;

    // Gather student's weak areas from recent submissions
    const { rows: weakAreas } = await pool.query(`
      SELECT es.answers::text AS context, es.score, tc.title AS assessment_title
      FROM exam_submissions es
      LEFT JOIN exam_vault_packages tc ON es.assessment_id=tc.id
      WHERE es.student_id=$1 AND es.submitted_at >= NOW()-INTERVAL '30 days'
      ORDER BY es.score ASC LIMIT 5`,
      [studentId]
    ).catch(() => ({ rows: [] }));

    // Gather revision notes for subject
    const { rows: notes } = await pool.query(`
      SELECT id, title, content, subject
      FROM revision_notes
      WHERE user_id=$1 ${subject ? "AND subject ILIKE $2" : ""}
      ORDER BY created_at DESC LIMIT 10`,
      subject ? [studentId, `%${subject}%`] : [studentId]
    ).catch(() => ({ rows: [] }));

    // Build content using available data
    const packTopics: string[] = topics?.length > 0 ? topics :
      (notes.slice(0, 3).map((n: any) => n.title ?? "General") as string[]);

    if (packTopics.length === 0) packTopics.push("General Revision");

    // Try AI generation, fall back to structured pack
    let packContent: any[] = [];
    const OPENAI_KEY = process.env.OPENAI_API_KEY;

    if (OPENAI_KEY) {
      try {
        const prompt = `Create a concise revision pack for a student. Subject: ${subject || "General"}. Topics: ${packTopics.join(", ")}.
Weak areas from recent tests: ${weakAreas.map((w: any) => `score ${w.score}% on "${w.assessment_title}"`).join(", ") || "None identified"}.
${examDate ? `Exam date: ${examDate}.` : ""}
Return JSON array of 5-8 items, each with: {"type":"summary|key_points|practice_q|tip","title":"...","content":"..."}`;

        const aiRes = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}/chat/completions`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: process.env["OPENAI_MODEL"] || "meta/llama-3.1-8b-instruct",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 1500,
          }),
        });
        const aiData = await aiRes.json() as any;
        const content = aiData.choices?.[0]?.message?.content ?? "";
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) packContent = JSON.parse(jsonMatch[0]);
      } catch { /* fall through to manual pack */ }
    }

    if (packContent.length === 0) {
      // Build manual pack from notes
      packContent = [
        ...notes.slice(0, 3).map((n: any) => ({
          type: "summary",
          title: n.title ?? "Revision Note",
          content: (n.content ?? "").slice(0, 300),
        })),
        ...packTopics.slice(0, 3).map((t: string) => ({
          type: "key_points",
          title: `Key Points: ${t}`,
          content: `Review your notes and textbook sections on ${t}. Focus on definitions, formulas, and worked examples.`,
        })),
        {
          type: "tip",
          title: "Exam Technique",
          content: "Read questions carefully, show all working, and check units. Attempt all questions — partial marks are available.",
        },
      ];
    }

    const title = `${subject || "General"} Smart Pack — ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;

    const { rows: inserted } = await pool.query(
      `INSERT INTO revision_smart_packs (student_id, title, subject, topics, content, ai_generated)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [studentId, title, subject ?? null, JSON.stringify(packTopics), JSON.stringify(packContent), !!OPENAI_KEY]
    );

    // Log AI interaction if used
    if (OPENAI_KEY) {
      await pool.query(
        `INSERT INTO ai_interactions (account_id, interaction_type, tokens_used, model, status)
         VALUES ($1, 'smart_pack', 500, 'gpt-3.5-turbo', 'success')`,
        [studentId]
      ).catch(() => {});
    }

    res.status(201).json({ pack: inserted[0] });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

/* ── Get Smart Pack ───────────────────────────────────────────────────────── */
revisionV3Router.get("/smart-pack/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM revision_smart_packs WHERE id=$1 AND student_id=$2`,
      [req.params.id, req.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Pack not found" });
    res.json({ pack: rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

revisionV3Router.get("/smart-packs", async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM revision_smart_packs WHERE student_id=$1 ORDER BY created_at DESC LIMIT 20`,
      [req.userId]
    );
    res.json({ packs: rows });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});
