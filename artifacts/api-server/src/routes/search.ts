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

/* ── Universal Search ────────────────────────────────────────────────────── */
searchRouter.get("/", async (req: Request, res: Response) => {
  try {
    const q = ((req.query.q as string) || "").trim();
    if (!q || q.length < 2) return res.json({ results: [], query: q });
    const like = `%${q}%`;

    const token = (req.headers.authorization ?? "").replace("Bearer ", "");
    let userId: number | null = null;
    if (token) {
      try {
        const { rows } = await pool.query(
          `SELECT id FROM accounts WHERE id=(
            SELECT account_id FROM sessions WHERE token=$1 LIMIT 1
          )`, [token]
        ).catch(() => ({ rows: [] }));
        userId = rows[0]?.id ?? null;
      } catch { /* best-effort */ }
    }

    const [accounts, courses, subjects, questions, assessments, flashDecks, revNotes] =
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
           FROM aperti_courses WHERE title ILIKE $1 AND is_published=TRUE LIMIT 5`,
          [like]
        ).catch(() => ({ rows: [] as any[] })),

        pool.query(
          `SELECT id, name, board AS subtitle,
                  'subject' AS type, 'Subjects' AS category
           FROM subjects WHERE name ILIKE $1 LIMIT 4`,
          [like]
        ).catch(() => ({ rows: [] as any[] })),

        pool.query(
          `SELECT id, topic AS name, difficulty AS subtitle,
                  'question' AS type, 'Questions' AS category
           FROM question_bank WHERE topic ILIKE $1 LIMIT 6`,
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
           FROM revision_notes WHERE title ILIKE $1 LIMIT 4`,
          [like]
        ).catch(() => ({ rows: [] as any[] })),
      ]);

    const results = [
      ...accounts.rows,
      ...courses.rows,
      ...subjects.rows,
      ...questions.rows,
      ...assessments.rows,
      ...flashDecks.rows,
      ...revNotes.rows,
    ];

    await logSearch(userId, q, results.length);

    res.json({ results, query: q, total: results.length });
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

    const [accounts, courses, subjects, questions, assessments, flashDecks, revNotes] =
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
           FROM aperti_courses WHERE title ILIKE $1 AND is_published=TRUE LIMIT 5`,
          [like]
        ).catch(() => ({ rows: [] as any[] })),
        pool.query(
          `SELECT id, name, board AS subtitle, 'subject' AS type, 'Subjects' AS category
           FROM subjects WHERE name ILIKE $1 LIMIT 4`,
          [like]
        ).catch(() => ({ rows: [] as any[] })),
        pool.query(
          `SELECT id, topic AS name, difficulty AS subtitle, 'question' AS type, 'Questions' AS category
           FROM question_bank WHERE topic ILIKE $1 LIMIT 6`,
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
           FROM revision_notes WHERE title ILIKE $1 LIMIT 4`,
          [like]
        ).catch(() => ({ rows: [] as any[] })),
      ]);

    const results = [
      ...accounts.rows, ...courses.rows, ...subjects.rows, ...questions.rows,
      ...assessments.rows, ...flashDecks.rows, ...revNotes.rows,
    ];

    await logSearch(null, q, results.length);
    res.json({ results, query: q, total: results.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
