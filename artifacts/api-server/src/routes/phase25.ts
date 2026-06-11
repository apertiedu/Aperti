/**
 * Phase 25 – Product Excellence
 * Founder Scores, Feature Usage, User Preferences, Course Quality Score
 */
import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";

export const phase25Router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// FOUNDER SCORES — 5 composite platform health scores
// GET /api/founder/scores
// ─────────────────────────────────────────────────────────────────────────────
phase25Router.get("/founder/scores", authenticate, requireRole("admin"), async (_req, res: Response) => {
  try {
    const [users, tickets, problems, usage, revenue] = await Promise.allSettled([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status='active') AS total_active,
          COUNT(*) FILTER (WHERE created_at >= NOW()-INTERVAL '30 days') AS new_30d,
          COUNT(*) FILTER (WHERE role='teacher' AND status='active') AS teachers
        FROM accounts`),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status IN ('open','in_progress')) AS open_count,
          COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at-created_at))/3600)
            FILTER (WHERE resolved_at IS NOT NULL), 0) AS avg_hours
        FROM support_tickets`).catch(() => ({ rows: [{ open_count: 0, avg_hours: 0 }] })),
      pool.query(`
        SELECT COUNT(*) FILTER (WHERE status='open') AS open_count
        FROM problem_reports`).catch(() => ({ rows: [{ open_count: 0 }] })),
      pool.query(`
        SELECT COUNT(DISTINCT feature_key) AS distinct_features,
               COUNT(DISTINCT account_id) AS active_users
        FROM feature_usage WHERE used_at >= NOW()-INTERVAL '30 days'`).catch(() => ({ rows: [{ distinct_features: 0, active_users: 0 }] })),
      pool.query(`
        SELECT COALESCE(SUM(amount),0) AS mrr
        FROM payment_requests
        WHERE status IN ('approved','verified') AND created_at >= DATE_TRUNC('month',NOW())`).catch(() => ({ rows: [{ mrr: 0 }] })),
    ]);

    const u = (users as any).value?.rows[0] ?? {};
    const t = (tickets as any).value?.rows[0] ?? {};
    const p = (problems as any).value?.rows[0] ?? {};
    const fu = (usage as any).value?.rows[0] ?? {};
    const r = (revenue as any).value?.rows[0] ?? {};

    const totalActive = parseInt(u.total_active) || 0;
    const new30d      = parseInt(u.new_30d) || 0;
    const teachers    = parseInt(u.teachers) || 1;
    const openTickets = parseInt(t.open_count) || 0;
    const openProbs   = parseInt(p.open_count) || 0;
    const distinctFt  = parseInt(fu.distinct_features) || 0;
    const mrr         = parseFloat(r.mrr) || 0;

    // Growth Score: how quickly new users join vs existing base (0–100)
    const growthRate = totalActive > 0 ? (new30d / totalActive) * 100 : 0;
    const growthScore = Math.min(Math.round(growthRate * 10), 100);

    // Happiness Score: inverse of open issues (problems × 5 + tickets × 3, capped)
    const issueImpact = Math.min(openProbs * 5 + openTickets * 3, 100);
    const happinessScore = Math.max(100 - issueImpact, 0);

    // Feature Adoption Score: distinct features used in last 30d (cap at 50 features = 100)
    const adoptionScore = Math.min(Math.round((distinctFt / 50) * 100), 100);

    // Support Burden Score: inverse of open tickets + avg resolution time
    const avgHours = parseFloat(t.avg_hours) || 0;
    const burden = Math.min(openTickets * 4 + Math.max(avgHours - 24, 0) * 0.5, 100);
    const supportBurdenScore = Math.max(100 - Math.round(burden), 0);

    // Revenue Efficiency Score: MRR per active teacher (target: 5000 EGP/teacher = 100)
    const mrrPerTeacher = teachers > 0 ? mrr / teachers : 0;
    const revenueEffScore = Math.min(Math.round((mrrPerTeacher / 5000) * 100), 100);

    res.json({
      scores: {
        growth:          { score: growthScore,        label: "Platform Growth",      sub: `+${new30d} new users this month` },
        happiness:       { score: happinessScore,     label: "User Happiness",       sub: `${openProbs} open reports, ${openTickets} tickets` },
        adoption:        { score: adoptionScore,      label: "Feature Adoption",     sub: `${distinctFt} features used this month` },
        supportBurden:   { score: supportBurdenScore, label: "Support Health",       sub: `${openTickets} open tickets` },
        revenueEfficiency:{ score: revenueEffScore,  label: "Revenue Efficiency",   sub: `EGP ${Math.round(mrrPerTeacher).toLocaleString()} per teacher` },
      },
      overview: { totalActive, new30d, mrr, openTickets, openProbs },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE USAGE — track + admin view
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/feature/track
phase25Router.post("/feature/track", authenticate, async (req: AuthRequest, res: Response) => {
  const { featureKey, category } = req.body;
  if (!featureKey) { res.json({ ok: true }); return; }
  try {
    await pool.query(
      `INSERT INTO feature_usage (account_id, feature_key, feature_category, used_at)
       VALUES ($1, $2, $3, NOW())`,
      [req.userId, String(featureKey).slice(0, 100), String(category || "general").slice(0, 50)]
    );
  } catch { /* silent — tracking must never break the app */ }
  res.json({ ok: true });
});

// GET /api/admin/feature-usage — admin heatmap data
phase25Router.get("/admin/feature-usage", authenticate, requireRole("admin"), async (_req, res: Response) => {
  try {
    const [heatmap, timeline, topUsers] = await Promise.all([
      pool.query(`
        SELECT feature_key, feature_category,
               COUNT(*) AS total_uses,
               COUNT(DISTINCT account_id) AS unique_users,
               COUNT(*) FILTER (WHERE used_at >= NOW()-INTERVAL '7 days') AS uses_7d,
               COUNT(*) FILTER (WHERE used_at >= NOW()-INTERVAL '30 days') AS uses_30d,
               MAX(used_at) AS last_used
        FROM feature_usage
        GROUP BY feature_key, feature_category
        ORDER BY total_uses DESC
        LIMIT 50`),
      pool.query(`
        SELECT TO_CHAR(used_at::date,'YYYY-MM-DD') AS day, COUNT(*) AS events
        FROM feature_usage
        WHERE used_at >= NOW()-INTERVAL '30 days'
        GROUP BY 1 ORDER BY 1`),
      pool.query(`
        SELECT a.username, a.display_name, a.role,
               COUNT(*) AS total_events,
               COUNT(DISTINCT fu.feature_key) AS distinct_features
        FROM feature_usage fu
        JOIN accounts a ON a.id = fu.account_id
        WHERE fu.used_at >= NOW()-INTERVAL '30 days'
        GROUP BY a.id, a.username, a.display_name, a.role
        ORDER BY total_events DESC LIMIT 10`).catch(() => ({ rows: [] })),
    ]);
    res.json({
      heatmap: heatmap.rows,
      timeline: timeline.rows,
      topUsers: topUsers.rows,
      totalFeatures: heatmap.rows.length,
      totalEvents: heatmap.rows.reduce((s: number, r: any) => s + parseInt(r.uses_30d), 0),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// USER PREFERENCES — recent items + preferences
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/user/preferences
phase25Router.get("/user/preferences", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM user_preferences WHERE account_id = $1`, [req.userId]
    );
    if (rows[0]) {
      res.json(rows[0]);
    } else {
      res.json({ account_id: req.userId, recent_courses: [], recent_assessments: [], recent_students: [], preferences: {} });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/user/preferences
phase25Router.put("/user/preferences", authenticate, async (req: AuthRequest, res: Response) => {
  const { recentCourses, recentAssessments, recentStudents, preferences } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO user_preferences (account_id, recent_courses, recent_assessments, recent_students, preferences, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (account_id) DO UPDATE SET
         recent_courses      = COALESCE($2, user_preferences.recent_courses),
         recent_assessments  = COALESCE($3, user_preferences.recent_assessments),
         recent_students     = COALESCE($4, user_preferences.recent_students),
         preferences         = COALESCE($5, user_preferences.preferences),
         updated_at          = NOW()
       RETURNING *`,
      [
        req.userId,
        recentCourses      ? JSON.stringify(recentCourses)     : null,
        recentAssessments  ? JSON.stringify(recentAssessments) : null,
        recentStudents     ? JSON.stringify(recentStudents)    : null,
        preferences        ? JSON.stringify(preferences)       : null,
      ]
    );
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// COURSE QUALITY SCORE
// GET /api/teacher/courses/:courseId/quality-score
// ─────────────────────────────────────────────────────────────────────────────
phase25Router.get("/teacher/courses/:courseId/quality-score", authenticate, async (req: AuthRequest, res: Response) => {
  const courseId = parseInt(req.params.courseId);
  try {
    const [attRes, examRes, enrollRes] = await Promise.all([
      pool.query(`
        SELECT ROUND(AVG(CASE WHEN a.status='present' THEN 100 ELSE 0 END)::numeric,1) AS att_rate
        FROM attendance a
        JOIN students st ON st.id = a.student_id
        WHERE st.teacher_account_id = $1
          AND a.date >= NOW()-INTERVAL '60 days'`, [req.userId]).catch(() => ({ rows: [{ att_rate: null }] })),
      pool.query(`
        SELECT ROUND(AVG(sm.marks_scored::numeric / NULLIF(eq.max_marks,0) * 100), 1) AS avg_score
        FROM student_marks sm
        JOIN exam_questions eq ON eq.id = sm.question_id
        JOIN exams e ON e.id = sm.exam_id
        WHERE e.course_id = $1`, [courseId]).catch(() => ({ rows: [{ avg_score: null }] })),
      pool.query(`
        SELECT COUNT(DISTINCT student_id) AS enrolled
        FROM course_enrollments WHERE course_id = $1 AND status = 'active'`, [courseId]).catch(() => ({ rows: [{ enrolled: 0 }] })),
    ]);

    const attRate  = parseFloat(attRes.rows[0]?.att_rate   ?? 70);
    const avgScore = parseFloat(examRes.rows[0]?.avg_score  ?? 70);
    const enrolled = parseInt(enrollRes.rows[0]?.enrolled   ?? 0);

    // Composite: 40% attendance + 40% exam scores + 20% enrollment health
    const enrollScore = Math.min(enrolled * 5, 100);
    const qualityScore = Math.round(attRate * 0.4 + avgScore * 0.4 + enrollScore * 0.2);

    const grade = qualityScore >= 85 ? "A" : qualityScore >= 70 ? "B" : qualityScore >= 55 ? "C" : "D";
    const label = qualityScore >= 85 ? "Excellent" : qualityScore >= 70 ? "Good" : qualityScore >= 55 ? "Fair" : "Needs Attention";

    res.json({
      courseId,
      qualityScore,
      grade,
      label,
      breakdown: {
        attendanceRate:  attRate,
        avgExamScore:    avgScore,
        enrolledStudents: enrolled,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM HEALTH — store & retrieve metrics
// GET /api/admin/system-health
// ─────────────────────────────────────────────────────────────────────────────
phase25Router.get("/admin/system-health", authenticate, requireRole("admin"), async (_req, res: Response) => {
  try {
    const t0 = Date.now();
    await pool.query("SELECT 1"); // DB ping
    const dbLatency = Date.now() - t0;

    const [errorRate, pendingPayments, recentMetrics] = await Promise.all([
      pool.query(`
        SELECT COUNT(*) FILTER (WHERE severity IN ('error','critical') AND created_at >= NOW()-INTERVAL '1 hour') AS errors,
               COUNT(*) FILTER (WHERE created_at >= NOW()-INTERVAL '1 hour') AS total
        FROM audit_logs`).catch(() => ({ rows: [{ errors: 0, total: 1 }] })),
      pool.query(`
        SELECT COUNT(*) AS pending
        FROM payment_requests WHERE status='pending'`).catch(() => ({ rows: [{ pending: 0 }] })),
      pool.query(`
        SELECT metric_name, value, category, date
        FROM platform_metrics
        ORDER BY date DESC, id DESC
        LIMIT 20`).catch(() => ({ rows: [] })),
    ]);

    const errorCount = parseInt(errorRate.rows[0]?.errors ?? 0);
    const totalLogs  = Math.max(parseInt(errorRate.rows[0]?.total ?? 1), 1);
    const errorPct   = parseFloat(((errorCount / totalLogs) * 100).toFixed(2));
    const pending    = parseInt(pendingPayments.rows[0]?.pending ?? 0);

    // Persist today's metrics
    const today = new Date().toISOString().split("T")[0];
    await Promise.allSettled([
      pool.query(`INSERT INTO platform_metrics (date, metric_name, value, category) VALUES ($1,'db_latency_ms',$2,'infrastructure') ON CONFLICT (metric_name,date) DO UPDATE SET value=$2`, [today, dbLatency]),
      pool.query(`INSERT INTO platform_metrics (date, metric_name, value, category) VALUES ($1,'error_rate_pct',$2,'reliability') ON CONFLICT (metric_name,date) DO UPDATE SET value=$2`, [today, errorPct]),
      pool.query(`INSERT INTO platform_metrics (date, metric_name, value, category) VALUES ($1,'pending_payments',$2,'commerce') ON CONFLICT (metric_name,date) DO UPDATE SET value=$2`, [today, pending]),
    ]);

    const status = dbLatency < 100 && errorPct < 5 ? "healthy" : dbLatency < 500 && errorPct < 15 ? "degraded" : "critical";

    res.json({
      status,
      checks: [
        { name: "Database", status: dbLatency < 200 ? "pass" : dbLatency < 800 ? "warn" : "fail", value: `${dbLatency}ms`, target: "<200ms" },
        { name: "Error Rate (1h)", status: errorPct < 2 ? "pass" : errorPct < 10 ? "warn" : "fail", value: `${errorPct}%`, target: "<2%" },
        { name: "Pending Payments", status: pending < 10 ? "pass" : pending < 30 ? "warn" : "fail", value: String(pending), target: "<10" },
      ],
      metrics: recentMetrics.rows,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
