/**
 * Extended admin analytics — Phase 33
 * Adds DAU/WAU/MAU, retention, error trends, revenue growth.
 */
import { Router } from "express";
import { requireRole } from "../middleware/auth";
import { pool } from "@workspace/db";

export const adminAnalyticsExtendedRouter = Router();
adminAnalyticsExtendedRouter.use(requireRole("admin", "super_admin"));

/* ── Active users: DAU/WAU/MAU ───────────────────────────────────────────── */
adminAnalyticsExtendedRouter.get("/active-users", async (_req, res) => {
  try {
    const [dau, wau, mau, dailyTrend] = await Promise.all([
      pool.query(`SELECT COUNT(DISTINCT account_id)::int AS count FROM audit_logs WHERE created_at >= NOW() - INTERVAL '1 day'`).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(`SELECT COUNT(DISTINCT account_id)::int AS count FROM audit_logs WHERE created_at >= NOW() - INTERVAL '7 days'`).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(`SELECT COUNT(DISTINCT account_id)::int AS count FROM audit_logs WHERE created_at >= NOW() - INTERVAL '30 days'`).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(`
        SELECT date_trunc('day', created_at)::date AS day,
               COUNT(DISTINCT account_id)::int AS active_users
        FROM audit_logs
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY 1 ORDER BY 1
      `).catch(() => ({ rows: [] })),
    ]);
    res.json({
      dau: dau.rows[0]?.count ?? 0,
      wau: wau.rows[0]?.count ?? 0,
      mau: mau.rows[0]?.count ?? 0,
      dailyTrend: dailyTrend.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

/* ── Revenue growth (weekly) ─────────────────────────────────────────────── */
adminAnalyticsExtendedRouter.get("/revenue-growth", async (_req, res) => {
  try {
    const [weekly, monthly, total] = await Promise.all([
      pool.query(`
        SELECT date_trunc('week', created_at)::date AS week,
               COUNT(*)::int AS transactions,
               COALESCE(SUM(amount), 0)::float AS revenue
        FROM payment_transactions
        WHERE status = 'completed' AND created_at >= NOW() - INTERVAL '12 weeks'
        GROUP BY 1 ORDER BY 1
      `).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT date_trunc('month', created_at)::date AS month,
               COUNT(*)::int AS transactions,
               COALESCE(SUM(amount), 0)::float AS revenue
        FROM payment_transactions
        WHERE status = 'completed' AND created_at >= NOW() - INTERVAL '12 months'
        GROUP BY 1 ORDER BY 1
      `).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT COALESCE(SUM(amount), 0)::float AS total,
               COUNT(*)::int AS count,
               COALESCE(SUM(amount) FILTER (WHERE created_at >= date_trunc('month', NOW())), 0)::float AS this_month
        FROM payment_transactions WHERE status = 'completed'
      `).catch(() => ({ rows: [{ total: 0, count: 0, this_month: 0 }] })),
    ]);
    res.json({
      weekly: weekly.rows,
      monthly: monthly.rows,
      total: total.rows[0]?.total ?? 0,
      totalTransactions: total.rows[0]?.count ?? 0,
      thisMonth: total.rows[0]?.this_month ?? 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

/* ── Retention cohorts ───────────────────────────────────────────────────── */
adminAnalyticsExtendedRouter.get("/retention", async (_req, res) => {
  try {
    // 7d retention: users created 8+ days ago who also have audit_logs in last 7 days
    const [ret7d, ret30d, newVsReturning] = await Promise.all([
      pool.query(`
        SELECT COUNT(DISTINCT a.id)::int AS retained,
               (SELECT COUNT(*)::int FROM accounts WHERE created_at <= NOW() - INTERVAL '8 days' AND status='active') AS cohort
        FROM accounts a
        JOIN audit_logs al ON al.account_id = a.id
        WHERE a.created_at <= NOW() - INTERVAL '8 days'
          AND al.created_at >= NOW() - INTERVAL '7 days'
      `).catch(() => ({ rows: [{ retained: 0, cohort: 0 }] })),
      pool.query(`
        SELECT COUNT(DISTINCT a.id)::int AS retained,
               (SELECT COUNT(*)::int FROM accounts WHERE created_at <= NOW() - INTERVAL '31 days' AND status='active') AS cohort
        FROM accounts a
        JOIN audit_logs al ON al.account_id = a.id
        WHERE a.created_at <= NOW() - INTERVAL '31 days'
          AND al.created_at >= NOW() - INTERVAL '30 days'
      `).catch(() => ({ rows: [{ retained: 0, cohort: 0 }] })),
      pool.query(`
        SELECT
          date_trunc('week', a.created_at)::date AS week,
          COUNT(DISTINCT CASE WHEN a.created_at >= NOW() - INTERVAL '7 days' THEN a.id END)::int AS new_users,
          COUNT(DISTINCT CASE WHEN a.created_at < NOW() - INTERVAL '7 days' AND al.created_at >= NOW() - INTERVAL '7 days' THEN a.id END)::int AS returning_users
        FROM accounts a
        LEFT JOIN audit_logs al ON al.account_id = a.id AND al.created_at >= NOW() - INTERVAL '8 weeks'
        WHERE a.created_at >= NOW() - INTERVAL '8 weeks'
        GROUP BY 1 ORDER BY 1
      `).catch(() => ({ rows: [] })),
    ]);

    const r7 = ret7d.rows[0];
    const r30 = ret30d.rows[0];
    res.json({
      retention7d: r7.cohort > 0 ? Math.round((r7.retained / r7.cohort) * 100) : null,
      retention30d: r30.cohort > 0 ? Math.round((r30.retained / r30.cohort) * 100) : null,
      cohort7dSize: r7.cohort,
      cohort30dSize: r30.cohort,
      newVsReturning: newVsReturning.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

/* ── Error trends (last 7 days) ──────────────────────────────────────────── */
adminAnalyticsExtendedRouter.get("/error-trends", async (_req, res) => {
  try {
    const [daily, bySource, recent] = await Promise.all([
      pool.query(`
        SELECT date_trunc('day', created_at)::date AS day,
               COUNT(*)::int AS errors
        FROM frontend_error_logs
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY 1 ORDER BY 1
      `).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT user_role AS source, COUNT(*)::int AS count
        FROM frontend_error_logs
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY 1 ORDER BY 2 DESC
      `).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT error_message, route, user_role, created_at
        FROM frontend_error_logs
        ORDER BY created_at DESC LIMIT 10
      `).catch(() => ({ rows: [] })),
    ]);
    res.json({ daily: daily.rows, bySource: bySource.rows, recent: recent.rows });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

/* ── Enrollment trends (weekly) ──────────────────────────────────────────── */
adminAnalyticsExtendedRouter.get("/enrollment-trends", async (_req, res) => {
  try {
    const weekly = await pool.query(`
      SELECT date_trunc('week', created_at)::date AS week,
             COUNT(*)::int AS enrollments
      FROM subscriptions
      WHERE created_at >= NOW() - INTERVAL '12 weeks'
      GROUP BY 1 ORDER BY 1
    `).catch(() => ({ rows: [] }));
    res.json({ weekly: weekly.rows });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

/* ── User growth (weekly new signups) ────────────────────────────────────── */
adminAnalyticsExtendedRouter.get("/user-growth", async (_req, res) => {
  try {
    const [weekly, byRole, total] = await Promise.all([
      pool.query(`
        SELECT date_trunc('week', created_at)::date AS week,
               COUNT(*)::int AS new_users
        FROM accounts
        WHERE created_at >= NOW() - INTERVAL '12 weeks'
        GROUP BY 1 ORDER BY 1
      `),
      pool.query(`
        SELECT role, COUNT(*)::int AS count
        FROM accounts GROUP BY role ORDER BY count DESC
      `),
      pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='active')::int AS active FROM accounts`),
    ]);
    res.json({
      weekly: weekly.rows,
      byRole: byRole.rows,
      total: total.rows[0]?.total ?? 0,
      active: total.rows[0]?.active ?? 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});
