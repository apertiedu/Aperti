import { Router, Request, Response } from "express";
import { db, pool } from "@workspace/db";
import { accountsTable, subscriptionsTable, subscriptionPlansTable } from "@workspace/db";
import { eq, desc, sql, gte } from "drizzle-orm";
import { requireRole } from "../middleware/auth";

export const adminAnalyticsRouter = Router();
adminAnalyticsRouter.use(requireRole("admin", "super_admin"));

/* ── User Analytics ──────────────────────────────────────────────────────── */
adminAnalyticsRouter.get("/users", async (_req, res) => {
  try {
    const [byRole, newThisMonth, totalActive, growth] = await Promise.all([
      db.select({ role: accountsTable.role, count: sql<number>`count(*)::int` }).from(accountsTable).groupBy(accountsTable.role),
      db.select({ c: sql<number>`count(*)::int` }).from(accountsTable).where(sql`created_at >= date_trunc('month', now())`),
      db.select({ c: sql<number>`count(*)::int` }).from(accountsTable).where(eq(accountsTable.status, "active")),
      pool.query(`
        SELECT date_trunc('month', created_at)::text as month, count(*)::int as users
        FROM accounts
        WHERE created_at >= now() - interval '12 months'
        GROUP BY date_trunc('month', created_at)
        ORDER BY month
      `),
    ]);
    res.json({
      byRole,
      newThisMonth: newThisMonth[0].c,
      totalActive: totalActive[0].c,
      growthChart: growth.rows,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user analytics" });
  }
});

/* ── Course Analytics ────────────────────────────────────────────────────── */
adminAnalyticsRouter.get("/courses", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        (SELECT count(*) FROM teacher_courses) as total_courses,
        (SELECT count(*) FROM teacher_courses WHERE visibility='published') as published,
        (SELECT count(*) FROM teacher_courses WHERE visibility='draft') as drafts,
        (SELECT count(*) FROM lessons) as total_lessons,
        (SELECT count(*) FROM homework) as total_homework
    `);
    const enrollmentGrowth = await pool.query(`
      SELECT date_trunc('month', created_at)::text as month, count(*)::int as enrollments
      FROM subscriptions
      WHERE created_at >= now() - interval '12 months'
      GROUP BY date_trunc('month', created_at)
      ORDER BY month
    `).catch(() => ({ rows: [] }));
    res.json({ ...result.rows[0], enrollmentGrowth: enrollmentGrowth.rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch course analytics" });
  }
});

/* ── AI Analytics ────────────────────────────────────────────────────────── */
adminAnalyticsRouter.get("/ai", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT count(*) FROM ai_interactions WHERE created_at >= now() - interval '30 days') as monthly_interactions,
        (SELECT count(*) FROM ai_interactions) as total_interactions,
        (SELECT count(DISTINCT student_id) FROM ai_interactions WHERE created_at >= now() - interval '30 days') as active_ai_users
    `).catch(() => ({ rows: [{ monthly_interactions: 0, total_interactions: 0, active_ai_users: 0 }] }));
    const aiGrowth = await pool.query(`
      SELECT date_trunc('month', created_at)::text as month, count(*)::int as interactions
      FROM ai_interactions
      WHERE created_at >= now() - interval '12 months'
      GROUP BY date_trunc('month', created_at)
      ORDER BY month
    `).catch(() => ({ rows: [] }));
    res.json({ ...result.rows[0], aiGrowth: aiGrowth.rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch AI analytics" });
  }
});

/* ── Dashboard Overview ──────────────────────────────────────────────────── */
adminAnalyticsRouter.get("/dashboard", async (_req, res) => {
  try {
    const [users, subs, tickets, revenue] = await Promise.all([
      db.select({ c: sql<number>`count(*)::int` }).from(accountsTable).where(eq(accountsTable.status, "active")),
      db.select({ c: sql<number>`count(*)::int` }).from(subscriptionsTable).where(eq(subscriptionsTable.status, "active")),
      pool.query("SELECT count(*)::int as c FROM helpdesk_tickets WHERE status != 'resolved'").catch(() => ({ rows: [{ c: 0 }] })),
      pool.query("SELECT coalesce(sum(amount),0)::text as total FROM revenue_records WHERE date >= to_char(date_trunc('month', now()),'YYYY-MM-DD')").catch(() => ({ rows: [{ total: "0" }] })),
    ]);
    res.json({
      activeUsers: users[0].c,
      activeSubscriptions: subs[0].c,
      openTickets: tickets.rows[0].c,
      monthlyRevenue: parseFloat(revenue.rows[0].total),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});
