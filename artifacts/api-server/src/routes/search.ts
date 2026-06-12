import { Router, Request, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";

export const searchRouter = Router();

async function logSearch(userId: number | null, query: string, resultsCount: number) {
  try {
    await pool.query(
      `INSERT INTO search_logs (user_id, query, results_count) VALUES ($1, $2, $3)`,
      [userId ?? null, query, resultsCount]
    );
  } catch { /* never crash on logging */ }
}

// ─── Natural language query parser ───────────────────────────────────────────
// Extracts intent from phrases like "show my weakest mechanics topics"
function parseNaturalLanguage(q: string): { keywords: string[]; intent?: string; syllabusCode?: string } {
  const lower = q.toLowerCase().trim();

  // Detect syllabus codes (4-5 digit Cambridge / IB codes like 0625, 9709, etc.)
  const syllabusMatch = lower.match(/\b(\d{4,5})\b/);
  if (syllabusMatch) {
    return { keywords: [syllabusMatch[1]], syllabusCode: syllabusMatch[1] };
  }

  // Intent mapping
  let intent: string | undefined;
  if (/weak(est)?|struggle|difficult|failing|poor/i.test(q)) intent = "weak_topics";
  else if (/master(ed)?|strong|best|excel/i.test(q)) intent = "strong_topics";
  else if (/due|review|revise|study/i.test(q)) intent = "due_review";
  else if (/recent|new|latest/i.test(q)) intent = "recent";

  // Strip stop words and extract meaningful keywords
  const stopWords = new Set(["show","my","the","a","an","of","in","for","from","to","with",
    "and","or","is","are","was","were","has","have","had","me","i","you","your",
    "weakest","strongest","topics","topic","questions","question","notes","note"]);
  const keywords = lower
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  return { keywords: keywords.length ? keywords : [lower], intent };
}

/* ── Syllabus code lookup — maps Cambridge/IB codes to subject names ───────── */
const SYLLABUS_MAP: Record<string, string> = {
  "0625": "Physics", "0620": "Chemistry", "0610": "Biology", "0580": "Mathematics",
  "0470": "History", "0460": "Geography", "0500": "English", "0510": "English Literature",
  "9709": "Mathematics A-Level", "9702": "Physics A-Level", "9701": "Chemistry A-Level",
  "9700": "Biology A-Level", "9608": "Computer Science", "0478": "Computer Science IGCSE",
  "0417": "Information Technology", "0450": "Business Studies", "0455": "Economics",
};

/* ── Universal Search ────────────────────────────────────────────────────────── */
searchRouter.get("/", async (req: Request, res: Response) => {
  try {
    const q = ((req.query.q as string) || "").trim();
    if (!q || q.length < 2) return res.json({ results: [], query: q });

    const token = (req.headers.authorization ?? "").replace("Bearer ", "");
    let userId: number | null = null;
    if (token) {
      try {
        const jwt = await import("jsonwebtoken");
        const JWT_SECRET = process.env.JWT_SECRET || "aperti-dev-secret-change-in-prod";
        const payload = jwt.default.verify(token, JWT_SECRET) as any;
        userId = payload?.id ?? null;
      } catch { /* best-effort */ }
    }

    const { keywords, intent, syllabusCode } = parseNaturalLanguage(q);
    const primaryKeyword = keywords[0] || q;
    const like = `%${primaryKeyword}%`;

    // If syllabus code, map to subject name for better results
    let subjectHint = syllabusCode ? SYLLABUS_MAP[syllabusCode] : undefined;
    const searchTerms = subjectHint ? [subjectHint, primaryKeyword] : [primaryKeyword];
    const likeTerms = searchTerms.map(t => `%${t}%`);

    // Try fuzzy matching with pg_trgm similarity if available, fall back to ILIKE
    let trgmEnabled = false;
    try {
      await pool.query("SELECT similarity('test','test')");
      trgmEnabled = true;
    } catch { /* pg_trgm not available */ }

    const buildFuzzyCondition = (col: string, terms: string[]): string => {
      if (trgmEnabled && terms.length === 1) {
        return `(${col} ILIKE $1 OR similarity(${col}, $2) > 0.3)`;
      }
      return terms.map((_, i) => `${col} ILIKE $${i + 1}`).join(" OR ");
    };

    const [accounts, courses, subjects, questions, questionText, assessments, flashDecks, revNotes, syllabusResults] =
      await Promise.all([
        pool.query(
          `SELECT id, display_name AS name, username, role, NULL AS subtitle,
                  'person' AS type, 'People' AS category
           FROM accounts
           WHERE (display_name ILIKE $1 OR username ILIKE $1) AND status='active' LIMIT 5`,
          [like]
        ),

        pool.query(
          `SELECT id, title AS name, subject AS subtitle,
                  'course' AS type, 'Courses' AS category
           FROM aperti_courses WHERE (title ILIKE $1 OR subject ILIKE $1) AND is_published=TRUE LIMIT 5`,
          [like]
        ).catch(() => ({ rows: [] as any[] })),

        pool.query(
          `SELECT id, name, board AS subtitle,
                  'subject' AS type, 'Subjects' AS category
           FROM subjects WHERE name ILIKE $1 LIMIT 4`,
          [like]
        ).catch(() => ({ rows: [] as any[] })),

        // Search questions by topic
        pool.query(
          `SELECT id, topic AS name, difficulty AS subtitle,
                  'question' AS type, 'Questions' AS category
           FROM question_bank WHERE topic ILIKE $1 LIMIT 6`,
          [like]
        ).catch(() => ({ rows: [] as any[] })),

        // Search questions by question text content (Phase 33 upgrade)
        pool.query(
          `SELECT id, COALESCE(topic, 'Question') AS name, difficulty AS subtitle,
                  'question' AS type, 'Questions' AS category
           FROM question_bank WHERE question_text ILIKE $1 LIMIT 4`,
          [like]
        ).catch(() => ({ rows: [] as any[] })),

        pool.query(
          `SELECT id, title AS name, subject AS subtitle,
                  'assessment' AS type, 'Assessments' AS category
           FROM exam_vault_packages WHERE title ILIKE $1 LIMIT 5`,
          [like]
        ).catch(() => ({ rows: [] as any[] })),

        pool.query(
          `SELECT id, title AS name, NULL AS subtitle,
                  'flashcard_deck' AS type, 'Flashcard Decks' AS category
           FROM flashcard_decks WHERE title ILIKE $1 LIMIT 4`,
          [like]
        ).catch(() => ({ rows: [] as any[] })),

        pool.query(
          `SELECT id, title AS name, subject AS subtitle,
                  'revision_note' AS type, 'Revision Notes' AS category
           FROM revision_notes WHERE (title ILIKE $1 OR content ILIKE $1) LIMIT 4`,
          [like]
        ).catch(() => ({ rows: [] as any[] })),

        // Syllabus code search — search subjects by board code
        syllabusCode ? pool.query(
          `SELECT id, name, board AS subtitle,
                  'subject' AS type, 'Subjects (by code)' AS category
           FROM subjects WHERE
             syllabus_code = $1 OR name ILIKE $2 LIMIT 5`,
          [syllabusCode, subjectHint ? `%${subjectHint}%` : `%${syllabusCode}%`]
        ).catch(() => ({ rows: [] as any[] })) : Promise.resolve({ rows: [] as any[] }),
      ]);

    // Deduplicate question results (by id+type)
    const questionsSeen = new Set<number>();
    const allQuestions: any[] = [];
    for (const row of [...questions.rows, ...questionText.rows]) {
      if (!questionsSeen.has(row.id)) {
        questionsSeen.add(row.id);
        allQuestions.push(row);
      }
    }

    const results = [
      ...accounts.rows,
      ...syllabusResults.rows,
      ...courses.rows,
      ...subjects.rows,
      ...allQuestions,
      ...assessments.rows,
      ...flashDecks.rows,
      ...revNotes.rows,
    ];

    await logSearch(userId, q, results.length);

    res.json({
      results,
      query: q,
      total: results.length,
      intent,
      syllabusCode,
      syllabusSubject: syllabusCode ? SYLLABUS_MAP[syllabusCode] : undefined,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Autocomplete ────────────────────────────────────────────────────────── */
searchRouter.get("/autocomplete", async (req: Request, res: Response) => {
  try {
    const q = ((req.query.q as string) || "").trim();
    if (!q || q.length < 2) return res.json({ suggestions: [] });
    const like = `${q}%`;

    // Check for syllabus code
    const syllabusMatch = q.match(/^\d{4,5}$/);
    if (syllabusMatch && SYLLABUS_MAP[q]) {
      return res.json({
        suggestions: [{ text: `${q} — ${SYLLABUS_MAP[q]}`, type: "syllabus_code" }],
        query: q,
      });
    }

    const [courses, subjects, topics] = await Promise.all([
      pool.query(
        `SELECT title AS text, 'course' AS type
         FROM aperti_courses WHERE title ILIKE $1 AND is_published=TRUE LIMIT 3`,
        [like]
      ).catch(() => ({ rows: [] as any[] })),
      pool.query(
        `SELECT name AS text, 'subject' AS type
         FROM subjects WHERE name ILIKE $1 LIMIT 3`,
        [like]
      ).catch(() => ({ rows: [] as any[] })),
      pool.query(
        `SELECT DISTINCT topic AS text, 'topic' AS type
         FROM question_bank WHERE topic ILIKE $1 LIMIT 4`,
        [like]
      ).catch(() => ({ rows: [] as any[] })),
    ]);

    const seen = new Set<string>();
    const suggestions: { text: string; type: string }[] = [];
    for (const row of [...courses.rows, ...subjects.rows, ...topics.rows]) {
      if (!seen.has(row.text)) {
        seen.add(row.text);
        suggestions.push(row);
      }
    }

    res.json({ suggestions: suggestions.slice(0, 8), query: q });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Universal Search (alias, identical to /) ─────────────────────────────── */
searchRouter.get("/universal", async (req: Request, res: Response) => {
  try {
    const q = ((req.query.q as string) || "").trim();
    if (!q || q.length < 2) return res.json({ results: [], query: q, total: 0 });
    const like = `%${q}%`;

    const { syllabusCode, keywords } = parseNaturalLanguage(q);
    const subjectHint = syllabusCode ? SYLLABUS_MAP[syllabusCode] : undefined;
    const termLike = subjectHint ? `%${subjectHint}%` : like;

    const [accounts, courses, subjects, questions, questionText, assessments, flashDecks, revNotes] =
      await Promise.all([
        pool.query(
          `SELECT id, display_name AS name, username, role, NULL AS subtitle,
                  'person' AS type, 'People' AS category
           FROM accounts WHERE (display_name ILIKE $1 OR username ILIKE $1) AND status='active' LIMIT 5`,
          [like]
        ),
        pool.query(
          `SELECT id, title AS name, subject AS subtitle,
                  'course' AS type, 'Courses' AS category
           FROM aperti_courses WHERE (title ILIKE $1 OR subject ILIKE $1) AND is_published=TRUE LIMIT 5`,
          [termLike]
        ).catch(() => ({ rows: [] as any[] })),
        pool.query(
          `SELECT id, name, board AS subtitle, 'subject' AS type, 'Subjects' AS category
           FROM subjects WHERE name ILIKE $1 LIMIT 4`,
          [termLike]
        ).catch(() => ({ rows: [] as any[] })),
        pool.query(
          `SELECT id, topic AS name, difficulty AS subtitle, 'question' AS type, 'Questions' AS category
           FROM question_bank WHERE topic ILIKE $1 LIMIT 6`,
          [like]
        ).catch(() => ({ rows: [] as any[] })),
        pool.query(
          `SELECT id, COALESCE(topic, 'Question') AS name, difficulty AS subtitle,
                  'question' AS type, 'Questions' AS category
           FROM question_bank WHERE question_text ILIKE $1 LIMIT 4`,
          [like]
        ).catch(() => ({ rows: [] as any[] })),
        pool.query(
          `SELECT id, title AS name, subject AS subtitle, 'assessment' AS type, 'Assessments' AS category
           FROM exam_vault_packages WHERE title ILIKE $1 LIMIT 5`,
          [like]
        ).catch(() => ({ rows: [] as any[] })),
        pool.query(
          `SELECT id, title AS name, NULL AS subtitle, 'flashcard_deck' AS type, 'Flashcard Decks' AS category
           FROM flashcard_decks WHERE title ILIKE $1 LIMIT 4`,
          [like]
        ).catch(() => ({ rows: [] as any[] })),
        pool.query(
          `SELECT id, title AS name, subject AS subtitle, 'revision_note' AS type, 'Revision Notes' AS category
           FROM revision_notes WHERE (title ILIKE $1 OR content ILIKE $1) LIMIT 4`,
          [like]
        ).catch(() => ({ rows: [] as any[] })),
      ]);

    // Deduplicate questions
    const qSeen = new Set<number>();
    const allQ: any[] = [];
    for (const row of [...questions.rows, ...questionText.rows]) {
      if (!qSeen.has(row.id)) { qSeen.add(row.id); allQ.push(row); }
    }

    const results = [
      ...accounts.rows, ...courses.rows, ...subjects.rows, ...allQ,
      ...assessments.rows, ...flashDecks.rows, ...revNotes.rows,
    ];

    await logSearch(null, q, results.length);
    res.json({
      results,
      query: q,
      total: results.length,
      syllabusCode,
      syllabusSubject: syllabusCode ? SYLLABUS_MAP[syllabusCode] : undefined,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Weak topics search (AI-enhanced intent) ─────────────────────────────── */
searchRouter.get("/weak-topics", authenticate as any, async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.userId!;
    const { rows } = await pool.query(`
      SELECT
        fp.card_id,
        fi.front        AS question,
        fi.difficulty,
        fp.mastery_level,
        fp.ease_factor,
        fp.repetitions,
        fd.title        AS deck_title
      FROM flashcard_progress fp
      JOIN flashcard_items fi ON fi.id = fp.card_id
      JOIN flashcard_decks fd ON fd.id = fi.deck_id
      WHERE fp.student_id = $1
        AND fp.mastery_level IN ('struggling', 'new')
      ORDER BY fp.ease_factor ASC, fp.repetitions ASC
      LIMIT 20
    `, [studentId]).catch(() => ({ rows: [] }));

    res.json({ weakTopics: rows, studentId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
