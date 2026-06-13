import { Router, Request, Response } from "express";
import { db, pool } from "@workspace/db";
import { accountsTable, subscriptionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
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
  } catch {
    res.status(500).json({ error: "Failed to fetch user analytics" });
  }
});

/* ── Course Analytics ────────────────────────────────────────────────────── */
adminAnalyticsRouter.get("/courses", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT count(*) FROM teacher_courses) AS total_courses,
        (SELECT count(*) FROM teacher_courses WHERE visibility='published') AS published,
        (SELECT count(*) FROM teacher_courses WHERE visibility='draft') AS drafts,
        (SELECT count(*) FROM lessons) AS total_lessons,
        (SELECT count(*) FROM homework) AS total_homework
    `);
    const enrollmentGrowth = await pool.query(`
      SELECT date_trunc('month', created_at)::text as month, count(*)::int as enrollments
      FROM subscriptions
      WHERE created_at >= now() - interval '12 months'
      GROUP BY date_trunc('month', created_at)
      ORDER BY month
    `).catch(() => ({ rows: [] }));
    res.json({ ...result.rows[0], enrollmentGrowth: enrollmentGrowth.rows });
  } catch {
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
  } catch {
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
  } catch {
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

/* ── Retention Analytics (Phase 33) ─────────────────────────────────────── */
adminAnalyticsRouter.get("/retention", async (_req, res) => {
  try {
    // Monthly cohort retention: track students who signed up in each month
    // and whether they were still active (had an interaction) N months later
    const retention = await pool.query(`
      WITH cohort AS (
        SELECT
          to_char(date_trunc('month', created_at), 'YYYY-MM') AS cohort_month,
          id AS student_id
        FROM accounts
        WHERE role = 'student' AND created_at >= now() - interval '6 months'
      ),
      activity AS (
        SELECT DISTINCT
          account_id,
          to_char(date_trunc('month', created_at), 'YYYY-MM') AS active_month
        FROM audit_logs
        WHERE created_at >= now() - interval '6 months'
      )
      SELECT
        c.cohort_month,
        COUNT(DISTINCT c.student_id)::int AS cohort_size,
        COUNT(DISTINCT CASE WHEN a.account_id IS NOT NULL THEN c.student_id END)::int AS retained
      FROM cohort c
      LEFT JOIN activity a ON a.account_id = c.student_id AND a.active_month >= c.cohort_month
      GROUP BY c.cohort_month
      ORDER BY c.cohort_month DESC
      LIMIT 6
    `).catch(() => ({ rows: [] }));

    // Simple 30/60/90 day retention rates
    const simpleRetention = await pool.query(`
      SELECT
        COUNT(DISTINCT a.id)::int AS total_users,
        COUNT(DISTINCT CASE WHEN a.last_active_at >= now() - interval '30 days' THEN a.id END)::int AS retained_30d,
        COUNT(DISTINCT CASE WHEN a.last_active_at >= now() - interval '60 days' THEN a.id END)::int AS retained_60d,
        COUNT(DISTINCT CASE WHEN a.last_active_at >= now() - interval '90 days' THEN a.id END)::int AS retained_90d
      FROM accounts a
      WHERE a.role = 'student'
        AND a.created_at <= now() - interval '30 days'
        AND a.status = 'active'
    `).catch(() => ({ rows: [{ total_users: 0, retained_30d: 0, retained_60d: 0, retained_90d: 0 }] }));

    const sr = simpleRetention.rows[0] ?? {};
    const total = sr.total_users || 0;

    res.json({
      cohortRetention: retention.rows,
      retention30d: total > 0 ? Math.round((sr.retained_30d / total) * 100) : null,
      retention60d: total > 0 ? Math.round((sr.retained_60d / total) * 100) : null,
      retention90d: total > 0 ? Math.round((sr.retained_90d / total) * 100) : null,
      totalStudents: total,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch retention analytics" });
  }
});

/* ── Engagement funnel (Phase 33) ────────────────────────────────────────── */
adminAnalyticsRouter.get("/engagement", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT count(*)::int FROM accounts WHERE role='student' AND status='active') AS total_students,
        (SELECT count(DISTINCT student_id)::int FROM flashcard_progress WHERE created_at >= now() - interval '30 days') AS used_flashcards,
        (SELECT count(DISTINCT student_account_id)::int FROM exam_submissions WHERE submitted_at >= now() - interval '30 days') AS took_assessment,
        (SELECT count(DISTINCT student_id)::int FROM ai_interactions WHERE created_at >= now() - interval '30 days') AS used_ai_tutor
    `).catch(() => ({ rows: [{ total_students: 0, used_flashcards: 0, took_assessment: 0, used_ai_tutor: 0 }] }));

    const r = result.rows[0];
    const total = r.total_students || 1;

    res.json({
      totalStudents: r.total_students,
      funnelSteps: [
        { step: "Active Students", count: r.total_students, pct: 100 },
        { step: "Used Flashcards", count: r.used_flashcards, pct: Math.round((r.used_flashcards / total) * 100) },
        { step: "Took Assessment", count: r.took_assessment, pct: Math.round((r.took_assessment / total) * 100) },
        { step: "Used AI Tutor", count: r.used_ai_tutor, pct: Math.round((r.used_ai_tutor / total) * 100) },
      ],
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch engagement analytics" });
  }
});

/* ── Live Counters ───────────────────────────────────────────────────────── */
adminAnalyticsRouter.get("/live-counts", async (_req, res) => {
  try {
    const { pool } = await import("@workspace/db");
    const [counts, errors, aiToday] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE role='teacher' AND status='active')::int AS active_teachers,
          COUNT(*) FILTER (WHERE role='student' AND status='active')::int AS active_students,
          COUNT(*) FILTER (WHERE role='parent' AND status='active')::int AS active_parents
        FROM accounts
      `).catch(() => ({ rows: [{ active_teachers: 0, active_students: 0, active_parents: 0 }] })),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS errors_24h,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour')::int AS errors_1h
        FROM error_logs
      `).catch(() => ({ rows: [{ errors_24h: 0, errors_1h: 0 }] })),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS calls_today,
          COALESCE(SUM(tokens_used) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours'), 0)::int AS tokens_today,
          COUNT(*) FILTER (WHERE date_trunc('month',created_at) = date_trunc('month',NOW()))::int AS calls_month
        FROM ai_interactions
      `).catch(() => ({ rows: [{ calls_today: 0, tokens_today: 0, calls_month: 0 }] })),
    ]);

    const pending = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status='pending_approval')::int AS pending_payments,
        COUNT(*) FILTER (WHERE status='pending')::int AS pending_enrollments
      FROM subscriptions
    `).catch(() => ({ rows: [{ pending_payments: 0, pending_enrollments: 0 }] }));

    const errorsTop = await pool.query(`
      SELECT message, COUNT(*)::int AS count
      FROM error_logs
      WHERE created_at >= NOW() - INTERVAL '24 hours'
        AND message IS NOT NULL AND message != ''
      GROUP BY message
      ORDER BY count DESC
      LIMIT 10
    `).catch(() => ({ rows: [] }));

    res.json({
      activeTeachers: counts.rows[0].active_teachers,
      activeStudents: counts.rows[0].active_students,
      activeParents: counts.rows[0].active_parents,
      pendingPayments: pending.rows[0].pending_payments,
      pendingEnrollments: pending.rows[0].pending_enrollments,
      aiCallsToday: aiToday.rows[0].calls_today,
      aiTokensToday: aiToday.rows[0].tokens_today,
      aiCallsMonth: aiToday.rows[0].calls_month,
      errors24h: errors.rows[0].errors_24h,
      errors1h: errors.rows[0].errors_1h,
      topErrors: errorsTop.rows,
      lastUpdated: new Date().toISOString(),
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch live counts" });
  }
});

/* ── Enrollment Audit ────────────────────────────────────────────────────── */
adminAnalyticsRouter.get("/enrollment-audit", async (_req, res) => {
  try {
    const { pool } = await import("@workspace/db");
    const [orphans, dupes, inactive] = await Promise.all([
      pool.query(`
        SELECT s.id, a.display_name, s.status
        FROM subscriptions s
        LEFT JOIN teacher_courses tc ON tc.id = s.course_id
        JOIN accounts a ON a.id = s.student_account_id
        WHERE tc.id IS NULL
        LIMIT 50
      `).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT student_account_id, course_id, COUNT(*)::int AS count
        FROM subscriptions
        GROUP BY student_account_id, course_id
        HAVING COUNT(*) > 1
        LIMIT 50
      `).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT COUNT(*)::int AS count
        FROM subscriptions
        WHERE status IN ('cancelled','expired','rejected')
          AND updated_at < NOW() - INTERVAL '90 days'
      `).catch(() => ({ rows: [{ count: 0 }] })),
    ]);
    res.json({
      orphanedEnrollments: orphans.rows,
      duplicateEnrollments: dupes.rows,
      oldInactiveCount: inactive.rows[0].count,
      hasIssues: orphans.rows.length > 0 || dupes.rows.length > 0,
    });
  } catch {
    res.status(500).json({ error: "Failed to audit enrollments" });
  }
});

adminAnalyticsRouter.post("/enrollment-repair", async (_req, res) => {
  try {
    const { pool } = await import("@workspace/db");
    const removed = await pool.query(`
      DELETE FROM subscriptions
      WHERE id IN (
        SELECT s.id FROM subscriptions s
        LEFT JOIN teacher_courses tc ON tc.id = s.course_id
        WHERE tc.id IS NULL
      )
      RETURNING id
    `).catch(() => ({ rows: [] }));
    res.json({ repaired: removed.rows.length, message: `Removed ${removed.rows.length} orphaned enrollments` });
  } catch {
    res.status(500).json({ error: "Failed to repair enrollments" });
  }
});
