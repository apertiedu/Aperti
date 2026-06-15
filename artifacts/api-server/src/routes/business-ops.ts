import { Router } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole } from "../middleware/auth";

const router = Router();
const adminOnly = [authenticate, requireRole("admin", "super_admin")];

// ══════════════════════════════════════════════════════════════════════════════
// SIGNUP WAITLIST — landing page submissions
// ══════════════════════════════════════════════════════════════════════════════

router.get("/admin/signup-waitlist", ...adminOnly, async (req, res) => {
  try {
    const { search = "", status = "", page = "1", limit = "50" } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params: any[] = [];
    let where = "WHERE 1=1";

    if (search) {
      params.push(`%${search}%`);
      where += ` AND (email ILIKE $${params.length} OR name ILIKE $${params.length})`;
    }
    if (status) {
      params.push(status);
      where += ` AND status=$${params.length}`;
    }

    const countQ = `SELECT COUNT(*) FROM waitlist_submissions ${where}`;
    const { rows: cnt } = await pool.query(countQ, params);
    const total = parseInt(cnt[0].count);

    params.push(parseInt(limit), offset);
    const dataQ = `SELECT * FROM waitlist_submissions ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const { rows } = await pool.query(dataQ, params);

    res.json({ entries: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/admin/signup-waitlist/stats", ...adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status='pending' OR status IS NULL) AS pending,
        COUNT(*) FILTER (WHERE status='contacted') AS contacted,
        COUNT(*) FILTER (WHERE status='converted') AS converted,
        COUNT(*) FILTER (WHERE status='rejected') AS rejected,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS this_week,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') AS this_month
      FROM waitlist_submissions
    `);
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/admin/signup-waitlist/growth", ...adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        date_trunc('day', created_at)::date AS day,
        COUNT(*) AS count
      FROM waitlist_submissions
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY day
      ORDER BY day ASC
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put("/admin/signup-waitlist/:id", ...adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    const { rows } = await pool.query(
      "UPDATE waitlist_submissions SET status=$1 WHERE id=$2 RETURNING *",
      [status, req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/admin/signup-waitlist/:id", ...adminOnly, async (req, res) => {
  try {
    await pool.query("DELETE FROM waitlist_submissions WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/admin/signup-waitlist/export", ...adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM waitlist_submissions ORDER BY created_at DESC");
    const cols = ["id", "email", "name", "role", "message", "status", "created_at"];
    const csv = [
      cols.join(","),
      ...rows.map((r: any) =>
        cols.map((c) => {
          const v = r[c] ?? "";
          return typeof v === "string" && (v.includes(",") || v.includes('"') || v.includes("\n"))
            ? `"${v.replace(/"/g, '""')}"` : v;
        }).join(","),
      ),
    ].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="waitlist-submissions.csv"');
    res.send(csv);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// BUSINESS ANALYTICS
// ══════════════════════════════════════════════════════════════════════════════

router.get("/admin/business-analytics", ...adminOnly, async (req, res) => {
  try {
    const [usersR, subsR, waitlistR, growthR, subTrendR] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) AS total_users,
          COUNT(*) FILTER (WHERE role='teacher') AS total_teachers,
          COUNT(*) FILTER (WHERE role='student') AS total_students,
          COUNT(*) FILTER (WHERE role='parent') AS total_parents,
          COUNT(*) FILTER (WHERE created_at > NOW()-INTERVAL '7 days') AS new_this_week,
          COUNT(*) FILTER (WHERE created_at > NOW()-INTERVAL '30 days') AS new_this_month,
          COUNT(*) FILTER (WHERE last_login_at > NOW()-INTERVAL '1 day') AS dau,
          COUNT(*) FILTER (WHERE last_login_at > NOW()-INTERVAL '7 days') AS wau,
          COUNT(*) FILTER (WHERE last_login_at > NOW()-INTERVAL '30 days') AS mau
        FROM accounts
      `),
      pool.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status='active') AS active,
          COUNT(*) FILTER (WHERE created_at > NOW()-INTERVAL '30 days') AS new_this_month
        FROM subscriptions
      `),
      pool.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status='pending' OR status IS NULL) AS pending,
          COUNT(*) FILTER (WHERE status='converted') AS converted,
          COUNT(*) FILTER (WHERE created_at > NOW()-INTERVAL '7 days') AS this_week
        FROM waitlist_submissions
      `),
      pool.query(`
        SELECT date_trunc('day', created_at)::date AS day, COUNT(*) AS users
        FROM accounts
        WHERE created_at > NOW()-INTERVAL '30 days'
        GROUP BY day ORDER BY day ASC
      `),
      pool.query(`
        SELECT date_trunc('day', created_at)::date AS day, COUNT(*) AS subs
        FROM subscriptions
        WHERE created_at > NOW()-INTERVAL '30 days'
        GROUP BY day ORDER BY day ASC
      `),
    ]);

    const totalUsers = parseInt(usersR.rows[0].total_users) || 0;
    const activeSubs = parseInt(subsR.rows[0].active) || 0;
    const conversionRate = totalUsers > 0 ? ((activeSubs / totalUsers) * 100).toFixed(1) : "0.0";

    res.json({
      users: usersR.rows[0],
      subscriptions: subsR.rows[0],
      waitlist: waitlistR.rows[0],
      user_growth: growthR.rows,
      sub_growth: subTrendR.rows,
      conversion_rate: conversionRate,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// CONTENT AUDIT LOG — phase 15 specific admin actions
// ══════════════════════════════════════════════════════════════════════════════

router.get("/admin/content-audit", ...adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM audit_logs
      WHERE action IN ('content_edit','feature_toggle','announcement_create','testimonial_edit','faq_edit','landing_update')
      ORDER BY created_at DESC LIMIT 100
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
