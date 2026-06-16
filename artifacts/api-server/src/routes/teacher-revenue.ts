import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { logError } from "../lib/log-error";

export const teacherRevenueRouter = Router();

teacherRevenueRouter.use(authenticate);

async function buildTeacherRevenue(teacherId: number) {
  const [totals, courseBreakdown, daily, weekly, refundedTotal, discountImpact] = await Promise.allSettled([
    pool.query(
      `SELECT
         COALESCE(SUM(pt.amount::numeric) FILTER (WHERE pt.status IN ('verified','approved')), 0) AS gross_revenue,
         COALESCE(SUM(pt.amount::numeric) FILTER (WHERE pt.status = 'refunded'), 0) AS refunded_total,
         COUNT(*) FILTER (WHERE pt.status IN ('verified','approved')) AS approved_count,
         COUNT(*) FILTER (WHERE pt.status = 'pending') AS pending_count
       FROM payment_transactions pt
       JOIN aperti_courses c ON c.id = pt.target_id
       WHERE c.teacher_id = $1 AND pt.purpose = 'course_enrollment'`,
      [teacherId],
    ),
    pool.query(
      `SELECT
         c.id AS course_id, c.name AS course_name,
         COUNT(DISTINCT ce.student_id)::int AS students_enrolled,
         COALESCE(SUM(pt.amount::numeric) FILTER (WHERE pt.status IN ('verified','approved')), 0)::numeric(12,2) AS revenue,
         COALESCE(SUM(pt.amount::numeric) FILTER (WHERE pt.status = 'refunded'), 0)::numeric(12,2) AS refunded
       FROM aperti_courses c
       LEFT JOIN course_enrollments ce ON ce.course_id = c.id
       LEFT JOIN payment_transactions pt ON pt.target_id = c.id AND pt.purpose = 'course_enrollment'
       WHERE c.teacher_id = $1
       GROUP BY c.id, c.name
       ORDER BY revenue DESC`,
      [teacherId],
    ),
    pool.query(
      `SELECT
         DATE(pt.created_at) AS day,
         COALESCE(SUM(pt.amount::numeric) FILTER (WHERE pt.status IN ('verified','approved')), 0)::numeric(12,2) AS revenue
       FROM payment_transactions pt
       JOIN aperti_courses c ON c.id = pt.target_id
       WHERE c.teacher_id = $1
         AND pt.purpose = 'course_enrollment'
         AND pt.created_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(pt.created_at)
       ORDER BY day ASC`,
      [teacherId],
    ),
    pool.query(
      `SELECT
         DATE_TRUNC('week', pt.created_at) AS week_start,
         COALESCE(SUM(pt.amount::numeric) FILTER (WHERE pt.status IN ('verified','approved')), 0)::numeric(12,2) AS revenue
       FROM payment_transactions pt
       JOIN aperti_courses c ON c.id = pt.target_id
       WHERE c.teacher_id = $1
         AND pt.purpose = 'course_enrollment'
         AND pt.created_at >= NOW() - INTERVAL '12 weeks'
       GROUP BY DATE_TRUNC('week', pt.created_at)
       ORDER BY week_start ASC`,
      [teacherId],
    ),
    pool.query(
      `SELECT COALESCE(SUM(rr.refund_amount), 0)::numeric(12,2) AS refunded
       FROM refund_requests rr
       JOIN payment_transactions pt ON pt.id = rr.transaction_id
       JOIN aperti_courses c ON c.id = pt.target_id
       WHERE c.teacher_id = $1 AND rr.status IN ('approved','partial')`,
      [teacherId],
    ),
    pool.query(
      `SELECT
         co.code,
         COUNT(*)::int AS uses,
         COALESCE(SUM(pt.amount::numeric), 0)::numeric(12,2) AS affected_revenue
       FROM coupons co
       JOIN payment_transactions pt ON pt.target_id IN (
         SELECT id FROM aperti_courses WHERE teacher_id = $1
       ) AND pt.status IN ('verified','approved')
       WHERE co.teacher_id = $1 AND co.scope = 'teacher_courses'
       GROUP BY co.code
       ORDER BY uses DESC
       LIMIT 10`,
      [teacherId],
    ),
  ]);

  const t = totals.status === "fulfilled" ? totals.value.rows[0] : {};
  const grossRevenue = parseFloat(t.gross_revenue ?? "0");
  const refundedAmount = parseFloat(
    refundedTotal.status === "fulfilled" ? (refundedTotal.value.rows[0]?.refunded ?? "0") : "0",
  );

  return {
    teacher_id: teacherId,
    total_revenue: grossRevenue,
    refunded_total: refundedAmount,
    net_revenue: parseFloat((grossRevenue - refundedAmount).toFixed(2)),
    approved_count: parseInt(t.approved_count ?? "0"),
    pending_count: parseInt(t.pending_count ?? "0"),
    course_breakdown: courseBreakdown.status === "fulfilled" ? courseBreakdown.value.rows : [],
    discount_impact: discountImpact.status === "fulfilled" ? discountImpact.value.rows : [],
    trends: {
      daily: daily.status === "fulfilled" ? daily.value.rows.map((r: { day: string; revenue: string }) => ({
        date: r.day,
        revenue: parseFloat(r.revenue),
      })) : [],
      weekly: weekly.status === "fulfilled" ? weekly.value.rows.map((r: { week_start: string; revenue: string }) => ({
        week: r.week_start,
        revenue: parseFloat(r.revenue),
      })) : [],
    },
    generated_at: new Date().toISOString(),
  };
}

/* ── GET /api/revenue/my ────────────────────────────────────────────────── */
teacherRevenueRouter.get(
  "/my",
  requireRole("teacher"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const data = await buildTeacherRevenue(req.userId!);
      res.json(data);
    } catch (err) {
      await logError(err, { route: "/api/revenue/my" });
      res.status(500).json({ error: "Failed to fetch revenue data" });
    }
  },
);

/* ── GET /api/revenue/teacher/:id (admin only) ──────────────────────────── */
teacherRevenueRouter.get(
  "/teacher/:id",
  requireRole("admin", "super_admin"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const teacherId = parseInt(req.params.id);
      if (isNaN(teacherId)) { res.status(400).json({ error: "Invalid teacher ID" }); return; }
      const data = await buildTeacherRevenue(teacherId);
      res.json(data);
    } catch (err) {
      await logError(err, { route: `/api/revenue/teacher/${req.params.id}` });
      res.status(500).json({ error: "Failed to fetch teacher revenue" });
    }
  },
);

/* ── GET /api/revenue/platform (admin only) ─────────────────────────────── */
teacherRevenueRouter.get(
  "/platform",
  requireRole("admin", "super_admin"),
  async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
      const [overview, topTeachers, daily, subscriptionRevenue] = await Promise.allSettled([
        pool.query(
          `SELECT
             COALESCE(SUM(pt.amount::numeric) FILTER (WHERE pt.status IN ('verified','approved')), 0)::numeric(12,2) AS gross_revenue,
             COALESCE(SUM(pt.amount::numeric) FILTER (WHERE pt.purpose = 'course_enrollment' AND pt.status IN ('verified','approved')), 0)::numeric(12,2) AS course_revenue,
             COALESCE(SUM(pt.amount::numeric) FILTER (WHERE pt.purpose = 'platform_subscription' AND pt.status IN ('verified','approved')), 0)::numeric(12,2) AS subscription_revenue,
             COUNT(*) FILTER (WHERE pt.status IN ('verified','approved'))::int AS total_payments,
             COUNT(*) FILTER (WHERE pt.status = 'pending')::int AS pending_payments,
             COUNT(*) FILTER (WHERE pt.status = 'refunded')::int AS refunded_payments
           FROM payment_transactions pt`,
        ),
        pool.query(
          `SELECT
             a.id AS teacher_id, a.display_name, a.email,
             COALESCE(SUM(pt.amount::numeric) FILTER (WHERE pt.status IN ('verified','approved')), 0)::numeric(12,2) AS revenue,
             COUNT(DISTINCT pt.target_id)::int AS active_courses,
             COUNT(*) FILTER (WHERE pt.status IN ('verified','approved'))::int AS payment_count
           FROM accounts a
           JOIN aperti_courses c ON c.teacher_id = a.id
           JOIN payment_transactions pt ON pt.target_id = c.id AND pt.purpose = 'course_enrollment'
           WHERE a.role = 'teacher'
           GROUP BY a.id, a.display_name, a.email
           ORDER BY revenue DESC
           LIMIT 20`,
        ),
        pool.query(
          `SELECT
             DATE(pt.created_at) AS day,
             SUM(pt.amount::numeric) FILTER (WHERE pt.status IN ('verified','approved'))::numeric(12,2) AS revenue,
             COUNT(*) FILTER (WHERE pt.status IN ('verified','approved'))::int AS count
           FROM payment_transactions pt
           WHERE pt.created_at >= NOW() - INTERVAL '30 days'
           GROUP BY DATE(pt.created_at)
           ORDER BY day ASC`,
        ),
        pool.query(
          `SELECT
             sp.name AS plan_name,
             COUNT(s.id)::int AS active_subscriptions,
             (sp.price_egp * COUNT(s.id))::numeric(12,2) AS mrr
           FROM subscriptions s
           JOIN subscription_plans sp ON sp.id = s.plan_id
           WHERE s.status = 'active'
           GROUP BY sp.id, sp.name, sp.price_egp
           ORDER BY mrr DESC`,
        ),
      ]);

      res.json({
        overview: overview.status === "fulfilled" ? overview.value.rows[0] : {},
        top_teachers: topTeachers.status === "fulfilled" ? topTeachers.value.rows : [],
        subscription_breakdown: subscriptionRevenue.status === "fulfilled" ? subscriptionRevenue.value.rows : [],
        trends: {
          daily: daily.status === "fulfilled" ? daily.value.rows : [],
        },
        generated_at: new Date().toISOString(),
      });
    } catch (err) {
      await logError(err, { route: "/api/revenue/platform" });
      res.status(500).json({ error: "Failed to fetch platform revenue" });
    }
  },
);
