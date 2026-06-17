import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { logError } from "../lib/log-error";

export const subscriptionAnalyticsRouter = Router();
subscriptionAnalyticsRouter.use(authenticate, requireRole("admin", "super_admin"));

/* ── GET /api/sub-analytics/overview ───────────────────────────────────── */
subscriptionAnalyticsRouter.get("/overview", async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows: [base] } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status='active')::int          AS active_count,
        COUNT(*) FILTER (WHERE status='trial')::int           AS trial_count,
        COUNT(*) FILTER (WHERE status='grace_period')::int    AS grace_count,
        COUNT(*) FILTER (WHERE status='expired')::int         AS expired_count,
        COUNT(*) FILTER (WHERE status='suspended')::int       AS suspended_count,
        COUNT(*) FILTER (
          WHERE status IN ('active','trial','grace_period')
            AND created_at >= date_trunc('month',NOW())
        )::int AS new_this_month,
        COUNT(*) FILTER (
          WHERE status IN ('expired','cancelled','suspended')
            AND updated_at >= date_trunc('month',NOW())
        )::int AS churned_this_month,
        COUNT(*) FILTER (
          WHERE status='active' AND auto_renew=TRUE
        )::int AS auto_renew_count
      FROM subscriptions
    `);

    const { rows: [ledger] } = await pool.query(`
      SELECT
        COALESCE(SUM(le.amount) FILTER (WHERE le.created_at >= date_trunc('month',NOW())),0)::numeric(12,2) AS mrr_ledger,
        COALESCE(SUM(le.amount),0)::numeric(12,2) AS total_confirmed_revenue,
        COUNT(*) FILTER (WHERE le.created_at >= date_trunc('month',NOW()))::int AS payments_this_month
      FROM ledger_entries le
      WHERE le.entry_type = 'credit' AND le.reference_type = 'subscription'
    `).catch(() => ({ rows: [{ mrr_ledger: 0, total_confirmed_revenue: 0, payments_this_month: 0 }] }));

    const activeCount = parseInt(base.active_count) || 0;
    const churnedCount = parseInt(base.churned_this_month) || 0;
    const churnRate = activeCount + churnedCount > 0
      ? Math.round((churnedCount / (activeCount + churnedCount)) * 10000) / 100
      : 0;
    const retentionRate = Math.round((100 - churnRate) * 100) / 100;

    const mrr = parseFloat(ledger.mrr_ledger) || 0;
    const arr = Math.round(mrr * 12 * 100) / 100;

    const { rows: trialConv } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status='trial')::int        AS total_trials,
        COUNT(*) FILTER (WHERE status='active' AND payment_status='paid')::int AS converted
      FROM subscriptions
    `);
    const totalTrials = parseInt(trialConv[0]?.total_trials) || 0;
    const converted = parseInt(trialConv[0]?.converted) || 0;
    const conversionRate = totalTrials > 0 ? Math.round((converted / totalTrials) * 10000) / 100 : 0;

    res.json({
      mrr,
      arr,
      churn_rate: churnRate,
      retention_rate: retentionRate,
      conversion_rate: conversionRate,
      active_subscriptions: activeCount,
      trial_subscriptions: base.trial_count,
      grace_period_subscriptions: base.grace_count,
      new_this_month: base.new_this_month,
      churned_this_month: churnedCount,
      auto_renew_enabled: base.auto_renew_count,
      total_confirmed_revenue: parseFloat(ledger.total_confirmed_revenue) || 0,
      payments_this_month: ledger.payments_this_month,
    });
  } catch (err) {
    await logError(err, { route: "GET /api/sub-analytics/overview" });
    res.status(500).json({ error: "Failed" });
  }
});

/* ── GET /api/sub-analytics/revenue-trend ──────────────────────────────── */
subscriptionAnalyticsRouter.get("/revenue-trend", async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(`
      SELECT
        TO_CHAR(date_trunc('month', le.created_at), 'YYYY-MM') AS month,
        SUM(le.amount)::numeric(12,2)                          AS revenue,
        COUNT(*)::int                                          AS payment_count
      FROM ledger_entries le
      WHERE le.entry_type = 'credit'
        AND le.reference_type = 'subscription'
        AND le.created_at >= NOW() - INTERVAL '12 months'
      GROUP BY 1
      ORDER BY 1
    `).catch(() => ({ rows: [] }));

    res.json({ trend: rows });
  } catch (err) {
    await logError(err, { route: "GET /api/sub-analytics/revenue-trend" });
    res.status(500).json({ error: "Failed" });
  }
});

/* ── GET /api/sub-analytics/churn ──────────────────────────────────────── */
subscriptionAnalyticsRouter.get("/churn", async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(`
      SELECT
        TO_CHAR(date_trunc('month', updated_at), 'YYYY-MM') AS month,
        COUNT(*) FILTER (WHERE status IN ('expired','suspended'))::int AS churned,
        COUNT(*) FILTER (WHERE status='active')::int AS retained_active
      FROM subscriptions
      WHERE updated_at >= NOW() - INTERVAL '12 months'
      GROUP BY 1
      ORDER BY 1
    `);

    res.json({ churn_by_month: rows });
  } catch (err) {
    await logError(err, { route: "GET /api/sub-analytics/churn" });
    res.status(500).json({ error: "Failed" });
  }
});

/* ── GET /api/sub-analytics/retention-cohort ───────────────────────────── */
subscriptionAnalyticsRouter.get("/retention-cohort", async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(`
      WITH cohorts AS (
        SELECT
          account_id,
          date_trunc('month', start_date) AS cohort_month
        FROM subscriptions
        WHERE start_date IS NOT NULL
        GROUP BY 1,2
      ),
      activity AS (
        SELECT
          c.cohort_month,
          date_trunc('month', s.created_at) AS activity_month,
          COUNT(DISTINCT s.account_id)::int AS users
        FROM subscriptions s
        JOIN cohorts c ON c.account_id = s.account_id
        WHERE s.status IN ('active','trial','grace_period')
        GROUP BY 1,2
      ),
      cohort_sizes AS (
        SELECT cohort_month, COUNT(DISTINCT account_id)::int AS size
        FROM cohorts
        GROUP BY 1
      )
      SELECT
        TO_CHAR(a.cohort_month,'YYYY-MM') AS cohort,
        TO_CHAR(a.activity_month,'YYYY-MM') AS month,
        cs.size AS cohort_size,
        a.users AS active_users,
        ROUND(a.users::numeric / NULLIF(cs.size,0) * 100, 1) AS retention_pct
      FROM activity a
      JOIN cohort_sizes cs ON cs.cohort_month = a.cohort_month
      ORDER BY 1, 2
      LIMIT 120
    `);

    res.json({ cohort_retention: rows });
  } catch (err) {
    await logError(err, { route: "GET /api/sub-analytics/retention-cohort" });
    res.status(500).json({ error: "Failed" });
  }
});

/* ── GET /api/sub-analytics/funnel ─────────────────────────────────────── */
subscriptionAnalyticsRouter.get("/funnel", async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows: [counts] } = await pool.query(`
      SELECT
        COUNT(DISTINCT a.id)::int                                     AS total_registered,
        COUNT(DISTINCT s.account_id)::int                            AS initiated_subscription,
        COUNT(DISTINCT s.account_id) FILTER (WHERE s.status NOT IN ('inactive'))::int AS submitted_payment,
        COUNT(DISTINCT s.account_id) FILTER (WHERE s.status='active')::int AS confirmed_active
      FROM accounts a
      LEFT JOIN subscriptions s ON s.account_id = a.id
      WHERE a.role IN ('teacher','student')
    `);

    const total = counts.total_registered || 1;
    res.json({
      funnel: [
        { stage: "Registered",           count: counts.total_registered,      pct: 100 },
        { stage: "Started Subscription", count: counts.initiated_subscription, pct: Math.round(counts.initiated_subscription / total * 100) },
        { stage: "Submitted Payment",    count: counts.submitted_payment,      pct: Math.round(counts.submitted_payment / total * 100) },
        { stage: "Active",               count: counts.confirmed_active,       pct: Math.round(counts.confirmed_active / total * 100) },
      ],
    });
  } catch (err) {
    await logError(err, { route: "GET /api/sub-analytics/funnel" });
    res.status(500).json({ error: "Failed" });
  }
});

/* ── GET /api/sub-analytics/teacher-split ──────────────────────────────── */
subscriptionAnalyticsRouter.get("/teacher-split", async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(`
      SELECT
        sp.type              AS plan_type,
        sp.name              AS plan_name,
        COUNT(s.id)::int     AS subscriber_count,
        SUM(le.amount)::numeric(12,2) AS total_revenue
      FROM subscriptions s
      JOIN subscription_plans sp ON sp.id = s.plan_id
      LEFT JOIN ledger_entries le ON le.reference_id = s.id
        AND le.reference_type = 'subscription' AND le.entry_type = 'credit'
      WHERE s.status = 'active'
      GROUP BY 1, 2
      ORDER BY total_revenue DESC NULLS LAST
    `).catch(() => ({ rows: [] }));

    res.json({ split: rows });
  } catch (err) {
    await logError(err, { route: "GET /api/sub-analytics/teacher-split" });
    res.status(500).json({ error: "Failed" });
  }
});

/* ── POST /api/sub-analytics/snapshot ──────────────────────────────────── */
subscriptionAnalyticsRouter.post("/snapshot", async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows: [overview] } = await pool.query(`
      SELECT
        COALESCE(SUM(le.amount) FILTER (WHERE le.created_at >= date_trunc('month',NOW())),0)::numeric(12,2) AS mrr,
        COUNT(s.id) FILTER (WHERE s.status='active')::int AS active_count,
        COUNT(s.id) FILTER (WHERE s.status IN ('active','trial','grace_period') AND s.created_at >= date_trunc('month',NOW()))::int AS new_count,
        COUNT(s.id) FILTER (WHERE s.status IN ('expired','suspended') AND s.updated_at >= date_trunc('month',NOW()))::int AS churned_count
      FROM subscriptions s
      LEFT JOIN ledger_entries le ON le.reference_id = s.id AND le.reference_type='subscription' AND le.entry_type='credit'
    `).catch(() => ({ rows: [{ mrr: 0, active_count: 0, new_count: 0, churned_count: 0 }] }));

    const mrr = parseFloat(overview.mrr) || 0;
    const active = parseInt(overview.active_count) || 0;
    const churned = parseInt(overview.churned_count) || 0;
    const churnRate = active + churned > 0 ? churned / (active + churned) : 0;

    await pool.query(
      `INSERT INTO subscription_metrics_snapshots
         (snapshot_date, mrr, arr, active_count, new_count, churned_count, churn_rate, retention_rate, created_at)
       VALUES (CURRENT_DATE, $1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (snapshot_date) DO UPDATE SET
         mrr=EXCLUDED.mrr, arr=EXCLUDED.arr, active_count=EXCLUDED.active_count,
         new_count=EXCLUDED.new_count, churned_count=EXCLUDED.churned_count,
         churn_rate=EXCLUDED.churn_rate, retention_rate=EXCLUDED.retention_rate`,
      [mrr, mrr * 12, active, overview.new_count, churned, churnRate, 1 - churnRate],
    );

    res.json({ success: true, snapshot: { mrr, arr: mrr * 12, active_count: active } });
  } catch (err) {
    await logError(err, { route: "POST /api/sub-analytics/snapshot" });
    res.status(500).json({ error: "Failed" });
  }
});
