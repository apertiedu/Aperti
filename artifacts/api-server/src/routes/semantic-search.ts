import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";

export const semanticSearchRouter = Router();

const STUDENT_PATTERNS = /who.*(weak|struggling|failing|behind|struggling)\s+in|students?\s+(weak|struggling|failing)\s+in|weak\s+(students?|in)|struggling\s+with/i;
const TOPIC_PATTERNS = /(?:about|on|for|in|explain|find|show|search)\s+(.+)/i;

semanticSearchRouter.post("/semantic", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { query } = req.body as { query: string };
    if (!query || query.trim().length < 2) {
      return res.json({ results: [], groups: {}, query });
    }

    const q = query.trim();
    const userId = req.userId!;
    const userRole = (req as any).userRole ?? "teacher";

    const results: Record<string, any[]> = {
      Topics: [],
      Questions: [],
      Resources: [],
      Students: [],
      People: [],
      Courses: [],
    };

    const words = q.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    // ── 1. Weave knowledge nodes matching ──────────────────────────────────
    try {
      if (words.length > 0) {
        const topicConditions = words.map((_, i) => `name ILIKE $${i + 1}`).join(" OR ");
        const likeWords = words.map(w => `%${w}%`);
        const topicRows = await pool.query(
          `SELECT id, name, type, subject_id, edge_count
           FROM knowledge_nodes
           WHERE ${topicConditions}
           ORDER BY edge_count DESC NULLS LAST
           LIMIT 8`,
          likeWords
        );
        results.Topics = topicRows.rows.map((r: any) => ({
          id: r.id,
          name: r.name,
          subtitle: r.type,
          type: "topic",
          category: "Topics",
          relevance: Math.min(1.0, (r.edge_count ?? 0) / 20 + 0.5),
        }));
      }
    } catch { /* knowledge_nodes may not exist yet */ }

    // ── 2. Student queries (teacher/admin only) ────────────────────────────
    const isStudentQuery = STUDENT_PATTERNS.test(q);
    if (isStudentQuery && (userRole === "teacher" || userRole === "admin")) {
      const topicMatch = q.match(/(?:weak|struggling|failing)\s+(?:in\s+)?(.+?)(?:\?|$)/i);
      const topicKeyword = topicMatch?.[1]?.trim() ?? words[words.length - 1] ?? "";
      try {
        const stuRows = await pool.query(
          `SELECT s.id, a.display_name AS name, s.grade_level AS subtitle,
                  wm.weak_topics
           FROM students s
           JOIN accounts a ON s.account_id = a.id
           LEFT JOIN (
             SELECT student_id,
                    string_agg(topic_name, ', ' ORDER BY misconception_count DESC) AS weak_topics
             FROM (
               SELECT student_id, topic_name,
                      COUNT(*) AS misconception_count
               FROM misconceptions
               WHERE resolved = FALSE
               GROUP BY student_id, topic_name
             ) sub
             GROUP BY student_id
           ) wm ON wm.student_id = s.id
           WHERE (wm.weak_topics ILIKE $1 OR a.display_name ILIKE $1)
             AND a.status = 'active'
           LIMIT 10`,
          [`%${topicKeyword}%`]
        );
        results.Students = stuRows.rows.map((r: any) => ({
          id: r.id,
          name: r.name,
          subtitle: `Weak in: ${r.weak_topics ?? topicKeyword}`,
          type: "student",
          category: "Students",
          relevance: 0.9,
        }));
      } catch { /* misconceptions or students table may not exist */ }
    }

    // ── 3. Questions from question bank ────────────────────────────────────
    try {
      const like = `%${q}%`;
      const qRows = await pool.query(
        `SELECT id, question_text AS name, subject AS subtitle, difficulty, marks
         FROM questions
         WHERE question_text ILIKE $1 OR topic ILIKE $1 OR subject ILIKE $1
         ORDER BY (CASE WHEN question_text ILIKE $1 THEN 1 ELSE 2 END)
         LIMIT 6`,
        [like]
      );
      results.Questions = qRows.rows.map((r: any) => ({
        id: r.id,
        name: r.name.length > 80 ? r.name.slice(0, 77) + "…" : r.name,
        subtitle: `${r.subtitle ?? ""} · ${r.difficulty ?? "any"} · ${r.marks ?? "?"} marks`,
        type: "question",
        category: "Questions",
        relevance: 0.75,
      }));
    } catch { /* questions table */ }

    // ── 4. Lessons / resources ─────────────────────────────────────────────
    try {
      const like = `%${q}%`;
      const lRows = await pool.query(
        `SELECT l.id, l.title AS name, s.name AS subtitle, 'lesson' AS type
         FROM lessons l
         LEFT JOIN subjects s ON l.subject_id = s.id
         WHERE l.title ILIKE $1
         LIMIT 5`,
        [like]
      );
      results.Resources = lRows.rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        subtitle: r.subtitle ?? "Lesson",
        type: "lesson",
        category: "Resources",
        relevance: 0.7,
      }));
    } catch { /* lessons table */ }

    // ── 5. People & courses (existing keyword search) ─────────────────────
    try {
      const like = `%${q}%`;
      const [people, courses] = await Promise.all([
        pool.query(
          `SELECT id, display_name AS name, username AS subtitle, role, 'person' AS type, 'People' AS category
           FROM accounts WHERE (display_name ILIKE $1 OR username ILIKE $1) AND status='active' LIMIT 5`,
          [like]
        ),
        pool.query(
          `SELECT id, title AS name, subject AS subtitle, 'course' AS type, 'Courses' AS category
           FROM aperti_courses WHERE title ILIKE $1 AND is_published=TRUE LIMIT 4`,
          [like]
        ).catch(() => ({ rows: [] as any[] })),
      ]);
      results.People = people.rows;
      results.Courses = courses.rows;
    } catch { /* accounts */ }

    // ── Build flat results & remove empty groups ───────────────────────────
    const groups: Record<string, any[]> = {};
    for (const [key, items] of Object.entries(results)) {
      if (items.length > 0) groups[key] = items;
    }
    const flat = Object.values(groups).flat();

    return res.json({ results: flat, groups, query: q, total: flat.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Legacy GET /search passthrough (keyword only)
semanticSearchRouter.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const q = ((req.query.q as string) || "").trim();
    if (!q || q.length < 2) return res.json({ results: [], query: q });
    const like = `%${q}%`;

    const [accounts, courses, subjects] = await Promise.all([
      pool.query(
        `SELECT id, display_name AS name, username, role, NULL AS subtitle, 'person' AS type, 'People' AS category
         FROM accounts WHERE (display_name ILIKE $1 OR username ILIKE $1) AND status='active' LIMIT 5`,
        [like]
      ),
      pool.query(
        `SELECT id, title AS name, subject AS subtitle, 'course' AS type, 'Courses' AS category
         FROM aperti_courses WHERE title ILIKE $1 AND is_published=TRUE LIMIT 5`,
        [like]
      ).catch(() => ({ rows: [] as any[] })),
      pool.query(
        `SELECT id, name, board AS subtitle, 'subject' AS type, 'Subjects' AS category
         FROM subjects WHERE name ILIKE $1 LIMIT 4`,
        [like]
      ).catch(() => ({ rows: [] as any[] })),
    ]);

    const results = [...accounts.rows, ...courses.rows, ...subjects.rows];
    res.json({ results, query: q, total: results.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
