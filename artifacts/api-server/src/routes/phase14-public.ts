import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

// In-memory cache for landing stats (5 min TTL)
let statsCache: { data: Record<string, number>; expires: number } | null = null;

// GET /api/landing/stats — public, 5-min cache
router.get("/landing/stats", async (_req, res) => {
  try {
    if (statsCache && Date.now() < statsCache.expires) {
      return res.json(statsCache.data);
    }

    const [students, teachers, courses, assessments, resources, sessions] =
      await Promise.all([
        pool.query("SELECT COUNT(*)::int AS n FROM students"),
        pool.query("SELECT COUNT(*)::int AS n FROM accounts WHERE role='teacher'"),
        pool.query("SELECT COUNT(*)::int AS n FROM courses WHERE status='published'").catch(() => pool.query("SELECT 0::int AS n")),
        pool.query("SELECT COUNT(*)::int AS n FROM homework").catch(() => pool.query("SELECT 0::int AS n")),
        pool.query("SELECT COUNT(*)::int AS n FROM resources").catch(() => pool.query("SELECT 0::int AS n")),
        pool.query("SELECT COUNT(*)::int AS n FROM sessions WHERE status IN ('completed','live')").catch(() => pool.query("SELECT 0::int AS n")),
      ]);

    const data = {
      students: students.rows[0].n ?? 0,
      teachers: teachers.rows[0].n ?? 0,
      courses: courses.rows[0].n ?? 0,
      assessments_completed: assessments.rows[0].n ?? 0,
      resources_uploaded: resources.rows[0].n ?? 0,
      live_sessions: sessions.rows[0].n ?? 0,
    };

    statsCache = { data, expires: Date.now() + 5 * 60 * 1000 };
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/testimonials — public, approved only
router.get("/testimonials", async (req, res) => {
  try {
    const { rating } = req.query as Record<string, string>;
    let q = "SELECT id, name, role, organization, photo_url, quote, rating, is_verified, created_at FROM testimonials WHERE is_approved=true";
    const params: any[] = [];
    if (rating) { params.push(parseInt(rating, 10)); q += ` AND rating>=$${params.length}`; }
    q += " ORDER BY is_verified DESC, created_at DESC LIMIT 12";
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export { router as phase14PublicRouter };
