import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, AuthRequest, requireRole } from "../middleware/auth";

export const founderRouter = Router();
founderRouter.use(authenticate as any);
founderRouter.use(requireRole("admin", "super_admin") as any);

/* ── Overview ─────────────────────────────────────────────────────────────── */
founderRouter.get("/overview", async (_req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [counts, revMTD, revYTD, openTickets] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE role='student' AND status='active')   AS students,
          COUNT(*) FILTER (WHERE role='teacher' AND status='active')   AS teachers,
          COUNT(*) FILTER (WHERE role='parent'  AND status='active')   AS parents,
          COUNT(*) FILTER (WHERE status='active')                      AS total_active,
          COUNT(*) FILTER (WHERE created_at >= NOW()-INTERVAL '30 days') AS new_30d,
          COUNT(*) FILTER (WHERE created_at >= NOW()-INTERVAL '7 days')  AS new_7d
        FROM accounts`),
      pool.query(
        `SELECT COALESCE(SUM(amount),0) AS total FROM payment_requests
         WHERE status='approved' AND created_at >= $1`, [startOfMonth]).catch(() => ({ rows: [{ total: 0 }] })),
      pool.query(
        `SELECT COALESCE(SUM(amount),0) AS total FROM payment_requests
         WHERE status='approved' AND created_at >= $1`, [startOfYear]).catch(() => ({ rows: [{ total: 0 }] })),
      pool.query(`SELECT COUNT(*) AS open FROM support_tickets WHERE status IN ('open','in_progress')`)
        .catch(() => ({ rows: [{ open: 0 }] })),
    ]);

    const [courses, questions, assessments, activeSubs] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total FROM teacher_courses`).catch(() => ({ rows: [{ total: 0 }] })),
      pool.query(`SELECT COUNT(*) AS total FROM question_bank`).catch(() => ({ rows: [{ total: 0 }] })),
      pool.query(`SELECT COUNT(*) AS total FROM exam_vault_packages`).catch(() => ({ rows: [{ total: 0 }] })),
      pool.query(`SELECT COUNT(*) AS total FROM subscriptions WHERE status='active'`).catch(() => ({ rows: [{ total: 0 }] })),
    ]);

    const c = counts.rows[0];
    const revMTDNum = parseFloat(revMTD.rows[0]?.total ?? 0);
    const revYTDNum = parseFloat(revYTD.rows[0]?.total ?? 0);
    const totalUsers = parseInt(c.total_active) || 0;

    res.json({
      users: {
        students: parseInt(c.students) || 0,
        teachers: parseInt(c.teachers) || 0,
        parents:  parseInt(c.parents)  || 0,
        totalActive: totalUsers,
        new30d: parseInt(c.new_30d) || 0,
        new7d:  parseInt(c.new_7d)  || 0,
      },
      content: {
        courses:     parseInt(courses.rows[0]?.total)     || 0,
        questions:   parseInt(questions.rows[0]?.total)   || 0,
        assessments: parseInt(assessments.rows[0]?.total) || 0,
      },
      revenue: {
        mtd: revMTDNum,
        ytd: revYTDNum,
        activeSubs: parseInt(activeSubs.rows[0]?.total) || 0,
      },
      support: { openTickets: parseInt(openTickets.rows[0]?.open) || 0 },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Revenue ─────────────────────────────────────────────────────────────── */
founderRouter.get("/revenue", async (_req: AuthRequest, res: Response) => {
  try {
    const [monthly, byPlan, totals] = await Promise.all([
      pool.query(`
        SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
               COALESCE(SUM(amount), 0)                            AS revenue,
               COUNT(*)                                            AS transactions
        FROM payment_requests
        WHERE status='approved' AND created_at >= NOW()-INTERVAL '12 months'
        GROUP BY 1 ORDER BY 1`).catch(() => ({ rows: [] })),

      pool.query(`
        SELECT sp.name AS plan, COALESCE(SUM(pr.amount), 0) AS revenue, COUNT(pr.id) AS payments
        FROM payment_requests pr
        JOIN subscriptions s ON pr.subscription_id=s.id
        JOIN subscription_plans sp ON s.plan_id=sp.id
        WHERE pr.status='approved' AND pr.created_at >= NOW()-INTERVAL '12 months'
        GROUP BY sp.name ORDER BY revenue DESC`).catch(() => ({ rows: [] })),

      pool.query(`
        SELECT
          COALESCE(SUM(amount) FILTER (WHERE created_at >= DATE_TRUNC('month',NOW())), 0) AS mrr,
          COALESCE(SUM(amount) FILTER (WHERE created_at >= DATE_TRUNC('year', NOW())), 0) AS arr_ytd,
          COALESCE(SUM(amount), 0) AS total_all_time,
          COUNT(*) FILTER (WHERE status='approved') AS paid_count,
          COUNT(*) FILTER (WHERE status='pending')  AS pending_count,
          COUNT(*) FILTER (WHERE status='rejected') AS failed_count
        FROM payment_requests`).catch(() => ({ rows: [{ mrr:0,arr_ytd:0,total_all_time:0,paid_count:0,pending_count:0,failed_count:0 }] })),
    ]);

    const t = totals.rows[0];
    const mrr = parseFloat(t?.mrr ?? 0);
    const arr = mrr * 12;

    // Simple growth: compare current month vs last month
    const monthlyArr = monthly.rows;
    const currMonthRev = monthlyArr.at(-1)?.revenue ?? 0;
    const prevMonthRev = monthlyArr.at(-2)?.revenue ?? 1;
    const growthRate = prevMonthRev > 0 ? ((currMonthRev - prevMonthRev) / prevMonthRev) * 100 : 0;

    res.json({
      monthly: monthlyArr,
      byPlan: byPlan.rows,
      totals: {
        mrr, arr,
        ytd:         parseFloat(t?.arr_ytd       ?? 0),
        allTime:     parseFloat(t?.total_all_time ?? 0),
        paidCount:   parseInt(t?.paid_count    ?? 0),
        pendingCount: parseInt(t?.pending_count ?? 0),
        failedCount: parseInt(t?.failed_count  ?? 0),
        growthRate:  parseFloat(growthRate.toFixed(1)),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Growth ──────────────────────────────────────────────────────────────── */
founderRouter.get("/growth", async (_req: AuthRequest, res: Response) => {
  try {
    const [daily, planDist, funnel, byRole] = await Promise.all([
      pool.query(`
        SELECT TO_CHAR(created_at::date, 'YYYY-MM-DD') AS day, COUNT(*) AS signups
        FROM accounts
        WHERE created_at >= NOW()-INTERVAL '30 days'
        GROUP BY 1 ORDER BY 1`),

      pool.query(`
        SELECT sp.name AS plan, COUNT(s.id) AS count
        FROM subscriptions s
        JOIN subscription_plans sp ON s.plan_id=sp.id
        WHERE s.status='active'
        GROUP BY sp.name ORDER BY count DESC`).catch(() => ({ rows: [] })),

      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE created_at >= NOW()-INTERVAL '30 days') AS registrations,
          COUNT(*) FILTER (WHERE status='active' AND created_at >= NOW()-INTERVAL '30 days') AS active_users
        FROM accounts`),

      pool.query(`
        SELECT role, COUNT(*) AS count
        FROM accounts WHERE status='active'
        GROUP BY role ORDER BY count DESC`),
    ]);

    const funnelData = funnel.rows[0];
    const activeSubs = planDist.rows.reduce((s: number, r: any) => s + parseInt(r.count), 0);
    const registrations = parseInt(funnelData?.registrations ?? 0);

    res.json({
      daily: daily.rows,
      planDistribution: planDist.rows,
      byRole: byRole.rows,
      funnel: {
        registrations,
        activeUsers: parseInt(funnelData?.active_users ?? 0),
        subscribers: activeSubs,
        conversionRate: registrations > 0 ? ((activeSubs / registrations) * 100).toFixed(1) : "0",
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Academic ────────────────────────────────────────────────────────────── */
founderRouter.get("/academic", async (_req: AuthRequest, res: Response) => {
  try {
    const [submissions, revNotes, revPacks, teachers, qbActivity] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) AS total_submissions,
          COUNT(*) FILTER (WHERE submitted_at >= NOW()-INTERVAL '7 days')  AS week_submissions,
          COUNT(*) FILTER (WHERE submitted_at >= NOW()-INTERVAL '30 days') AS month_submissions,
          ROUND(AVG(score)::numeric, 1) AS avg_score
        FROM exam_submissions`).catch(() => ({ rows: [{ total_submissions:0, week_submissions:0, month_submissions:0, avg_score:0 }] })),

      pool.query(`
        SELECT COUNT(*) AS total,
               COUNT(*) FILTER (WHERE created_at >= NOW()-INTERVAL '7 days') AS this_week
        FROM revision_notes`).catch(() => ({ rows: [{ total:0, this_week:0 }] })),

      pool.query(`SELECT COUNT(*) AS total FROM revision_smart_packs`).catch(() => ({ rows: [{ total:0 }] })),

      pool.query(`
        SELECT COUNT(DISTINCT id) AS active
        FROM accounts
        WHERE role='teacher' AND status='active' AND last_login_at >= NOW()-INTERVAL '7 days'`).catch(() => ({ rows: [{ active:0 }] })),

      pool.query(`
        SELECT COUNT(*) AS total,
               COUNT(*) FILTER (WHERE created_at >= NOW()-INTERVAL '30 days') AS recent
        FROM question_bank`).catch(() => ({ rows: [{ total:0, recent:0 }] })),
    ]);

    res.json({
      submissions: submissions.rows[0],
      revisionNotes: revNotes.rows[0],
      smartPacks: parseInt(revPacks.rows[0]?.total ?? 0),
      activeTeachers: parseInt(teachers.rows[0]?.active ?? 0),
      questions: qbActivity.rows[0],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Content Quality ─────────────────────────────────────────────────────── */
founderRouter.get("/content-quality", async (_req: AuthRequest, res: Response) => {
  try {
    const [top, lowRated, unused] = await Promise.all([
      pool.query(`
        SELECT content_type, content_id, quality_score, usage_count, avg_rating
        FROM content_quality_scores
        ORDER BY usage_count DESC LIMIT 10`).catch(() => ({ rows: [] })),

      pool.query(`
        SELECT content_type, content_id, quality_score, usage_count, avg_rating
        FROM content_quality_scores
        WHERE avg_rating < 3 AND avg_rating IS NOT NULL
        ORDER BY avg_rating ASC LIMIT 10`).catch(() => ({ rows: [] })),

      pool.query(`
        SELECT content_type, content_id, quality_score, usage_count
        FROM content_quality_scores
        WHERE usage_count = 0 OR reviewed_at < NOW()-INTERVAL '30 days'
        ORDER BY reviewed_at ASC LIMIT 10`).catch(() => ({ rows: [] })),
    ]);

    res.json({ top: top.rows, lowRated: lowRated.rows, unused: unused.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ── AI Usage ────────────────────────────────────────────────────────────── */
founderRouter.get("/ai-usage", async (_req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        ai.interaction_type,
        a.role,
        COUNT(ai.id) AS calls,
        SUM(ai.tokens_used) AS tokens,
        TO_CHAR(DATE_TRUNC('day', ai.created_at), 'YYYY-MM-DD') AS day
      FROM ai_interactions ai
      LEFT JOIN accounts a ON ai.account_id=a.id
      WHERE ai.created_at >= NOW()-INTERVAL '30 days'
      GROUP BY ai.interaction_type, a.role, DATE_TRUNC('day', ai.created_at)
      ORDER BY day DESC`).catch(() => ({ rows: [] }));

    const totalTokens = rows.reduce((s: number, r: any) => s + parseInt(r.tokens || 0), 0);
    const totalCalls  = rows.reduce((s: number, r: any) => s + parseInt(r.calls  || 0), 0);

    res.json({
      rows,
      totals: {
        calls: totalCalls,
        tokens: totalTokens,
        estimatedCostUSD: ((totalTokens / 1000) * 0.002).toFixed(4),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ── User Lifecycle ──────────────────────────────────────────────────────── */
founderRouter.get("/user-lifecycle", async (_req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT stage, COUNT(*) AS count
      FROM user_lifecycle_stages
      GROUP BY stage ORDER BY
        CASE stage WHEN 'visitor' THEN 1 WHEN 'registered' THEN 2
          WHEN 'active' THEN 3 WHEN 'subscriber' THEN 4 WHEN 'long_term' THEN 5
          ELSE 6 END`).catch(() => ({ rows: [] }));

    // Fallback: derive from accounts table
    if (rows.length === 0) {
      const { rows: acctRows } = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status='active' AND last_login_at >= NOW()-INTERVAL '180 days'
            AND id IN (SELECT user_id FROM subscriptions WHERE status='active')) AS subscribers,
          COUNT(*) FILTER (WHERE status='active' AND last_login_at >= NOW()-INTERVAL '7 days') AS active,
          COUNT(*) FILTER (WHERE status='active' AND last_login_at < NOW()-INTERVAL '7 days') AS registered,
          COUNT(*) FILTER (WHERE status='active'
            AND id IN (SELECT user_id FROM subscriptions WHERE started_at < NOW()-INTERVAL '365 days' AND status='active')) AS long_term
        FROM accounts`).catch(() => ({ rows: [{ subscribers:0, active:0, registered:0, long_term:0 }] }));

      const r = acctRows[0];
      return res.json({
        stages: [
          { stage: 'registered', count: parseInt(r.registered || 0) },
          { stage: 'active',     count: parseInt(r.active     || 0) },
          { stage: 'subscriber', count: parseInt(r.subscribers || 0) },
          { stage: 'long_term',  count: parseInt(r.long_term  || 0) },
        ],
        source: 'derived',
      });
    }

    res.json({ stages: rows, source: 'lifecycle_stages' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Subscriptions ───────────────────────────────────────────────────────── */
founderRouter.get("/subscriptions", async (_req: AuthRequest, res: Response) => {
  try {
    const [byStatus, byPlan, monthly] = await Promise.all([
      pool.query(`
        SELECT status, COUNT(*) AS count FROM subscriptions GROUP BY status ORDER BY count DESC`
      ).catch(() => ({ rows: [] })),

      pool.query(`
        SELECT sp.name, sp.price_egp, COUNT(s.id) AS active_count,
               COALESCE(SUM(sp.price_egp), 0) AS monthly_value
        FROM subscriptions s
        JOIN subscription_plans sp ON s.plan_id=sp.id
        WHERE s.status='active'
        GROUP BY sp.name, sp.price_egp ORDER BY monthly_value DESC`
      ).catch(() => ({ rows: [] })),

      pool.query(`
        SELECT TO_CHAR(DATE_TRUNC('month', started_at),'YYYY-MM') AS month,
               COUNT(*) FILTER (WHERE status='active')   AS new_subs,
               COUNT(*) FILTER (WHERE status='expired')  AS expired
        FROM subscriptions
        WHERE started_at >= NOW()-INTERVAL '12 months'
        GROUP BY 1 ORDER BY 1`
      ).catch(() => ({ rows: [] })),
    ]);

    res.json({ byStatus: byStatus.rows, byPlan: byPlan.rows, monthly: monthly.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Readiness ───────────────────────────────────────────────────────────── */
founderRouter.get("/readiness", async (_req: AuthRequest, res: Response) => {
  try {
    const checks = [
      { key: "db_connected",      label: "Database connection", status: "pass" },
      { key: "jwt_secret",        label: "JWT secret set",      status: process.env.JWT_SECRET && process.env.JWT_SECRET !== "aperti-dev-secret-change-in-prod" ? "pass" : "warning" },
      { key: "database_url",      label: "DATABASE_URL set",    status: process.env.DATABASE_URL ? "pass" : "fail" },
      { key: "openai_key",        label: "OpenAI key set",      status: process.env.OPENAI_API_KEY ? "pass" : "warning" },
    ];

    const [backupOk, adminExists, planExists, healthLogs] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS c FROM backup_logs WHERE created_at >= NOW()-INTERVAL '24 hours'`).catch(() => ({ rows: [{ c: 0 }] })),
      pool.query(`SELECT COUNT(*) AS c FROM accounts WHERE role IN ('admin','super_admin') AND status='active'`).catch(() => ({ rows: [{ c: 0 }] })),
      pool.query(`SELECT COUNT(*) AS c FROM subscription_plans WHERE is_active=TRUE`).catch(() => ({ rows: [{ c: 0 }] })),
      pool.query(`SELECT COUNT(*) AS c FROM system_health_logs WHERE status='healthy' AND timestamp >= NOW()-INTERVAL '1 hour'`).catch(() => ({ rows: [{ c: 0 }] })),
    ]);

    checks.push(
      { key: "recent_backup",   label: "Recent backup exists",     status: parseInt(backupOk.rows[0]?.c) > 0 ? "pass" : "warning" },
      { key: "admin_user",      label: "Admin user exists",        status: parseInt(adminExists.rows[0]?.c) > 0 ? "pass" : "fail" },
      { key: "sub_plans",       label: "Subscription plans active",status: parseInt(planExists.rows[0]?.c) > 0 ? "pass" : "fail" },
      { key: "health_logs",     label: "Health monitoring active", status: parseInt(healthLogs.rows[0]?.c) > 0 ? "pass" : "warning" },
    );

    const passCount    = checks.filter(c => c.status === "pass").length;
    const warningCount = checks.filter(c => c.status === "warning").length;
    const failCount    = checks.filter(c => c.status === "fail").length;
    const score = Math.round((passCount / checks.length) * 100);

    res.json({ checks, score, passCount, warningCount, failCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Alerts ──────────────────────────────────────────────────────────────── */
founderRouter.get("/alerts", async (_req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM founder_alerts ORDER BY created_at DESC LIMIT 50`
    );
    res.json({ alerts: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

founderRouter.put("/alerts/:id/read", async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(`UPDATE founder_alerts SET is_read=TRUE WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

founderRouter.put("/alerts/read-all", async (_req: AuthRequest, res: Response) => {
  try {
    await pool.query(`UPDATE founder_alerts SET is_read=TRUE WHERE is_read=FALSE`);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Launch Blockers ──────────────────────────────────────────────────────── */
founderRouter.get("/launch-blockers", async (_req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM launch_blockers ORDER BY
        CASE severity WHEN 'critical' THEN 0 WHEN 'major' THEN 1 ELSE 2 END,
        CASE status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
        created_at DESC`
    );
    res.json(rows);
  } catch (err: any) {
    if (err.code === "42P01") return res.json([]);
    res.status(500).json({ error: err.message });
  }
});

founderRouter.post("/launch-blockers", async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, severity = "major", category = "general", assignee } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: "Title required" });
    const { rows } = await pool.query(
      `INSERT INTO launch_blockers (title, description, severity, category, assignee, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'open', NOW(), NOW()) RETURNING *`,
      [title.trim(), description?.trim() || null, severity, category, assignee || null]
    );
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

founderRouter.patch("/launch-blockers/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { status, description, assignee } = req.body;
    const resolvedAt = status === "resolved" ? "NOW()" : "resolved_at";
    await pool.query(
      `UPDATE launch_blockers SET
         status = COALESCE($1, status),
         description = COALESCE($2, description),
         assignee = COALESCE($3, assignee),
         resolved_at = ${resolvedAt},
         updated_at = NOW()
       WHERE id = $4`,
      [status || null, description !== undefined ? description : null, assignee !== undefined ? assignee : null, id]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

founderRouter.delete("/launch-blockers/:id", async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(`DELETE FROM launch_blockers WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Frontend Error Log ───────────────────────────────────────────────────── */
founderRouter.post("/frontend-errors", async (req: AuthRequest, res: Response) => {
  try {
    const { message, stack, componentStack, route, browserInfo } = req.body;
    await pool.query(
      `INSERT INTO frontend_error_logs (user_id, user_role, error_message, error_stack, component_stack, route, browser_info, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [req.userId ?? null, req.role ?? null,
       (message || "unknown error").slice(0, 1000),
       (stack || "").slice(0, 5000),
       (componentStack || "").slice(0, 5000),
       (route || "").slice(0, 500),
       (browserInfo || "").slice(0, 500)]
    ).catch(() => {});
    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
  }
});
