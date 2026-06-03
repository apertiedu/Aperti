import { Router, Request, Response } from "express";
import { pool } from "@workspace/db";

export const searchRouter = Router();

searchRouter.get("/", async (req: Request, res: Response) => {
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

    const results = [
      ...accounts.rows,
      ...courses.rows,
      ...subjects.rows,
    ];

    res.json({ results, query: q, total: results.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
