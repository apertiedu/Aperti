import { Router } from "express";
import { pool } from "@workspace/db";
import { requireRole } from "../middleware/auth";
import os from "os";

export const adminLaunchDashboardRouter = Router();
adminLaunchDashboardRouter.use(requireRole("admin", "super_admin"));

adminLaunchDashboardRouter.get("/", async (_req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      activeUsersRow,
      totalUsersRow,
      newUsersRow,
      revenueRow,
      revenueMonthRow,
      pendingPaymentsRow,
      pendingEnrollmentsRow,
      failedLoginsRow,
      errorRateRow,
      activeSubsRow,
      totalStudentsRow,
      newStudentsRow,
    ] = await Promise.all([
      pool.query(`SELECT COUNT(DISTINCT account_id) as count FROM login_history WHERE created_at > $1`, [last24h]).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(`SELECT COUNT(*) as count FROM accounts WHERE status = 'active'`).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(`SELECT COUNT(*) as count FROM accounts WHERE created_at > $1`, [startOfDay]).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(`SELECT COALESCE(SUM(amount), 0) as total FROM payment_transactions WHERE status = 'approved' AND created_at > $1`, [startOfDay]).catch(() => ({ rows: [{ total: 0 }] })),
      pool.query(`SELECT COALESCE(SUM(amount), 0) as total FROM payment_transactions WHERE status = 'approved' AND created_at > $1`, [startOfMonth]).catch(() => ({ rows: [{ total: 0 }] })),
      pool.query(`SELECT COUNT(*) as count FROM payment_transactions WHERE status = 'pending'`).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(`SELECT COUNT(*) as count FROM students WHERE status = 'pending'`).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(`SELECT COUNT(*) as count FROM login_history WHERE success = false AND created_at > $1`, [last24h]).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(`SELECT COUNT(*) as count FROM problem_reports WHERE created_at > $1`, [last24h]).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(`SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active'`).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(`SELECT COUNT(*) as count FROM students`).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(`SELECT COUNT(*) as count FROM students WHERE created_at > $1`, [startOfDay]).catch(() => ({ rows: [{ count: 0 }] })),
    ]);

    // DB latency
    const dbStart = Date.now();
    await pool.query("SELECT 1");
    const dbLatencyMs = Date.now() - dbStart;

    // Memory
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memPct = Math.round(((totalMem - freeMem) / totalMem) * 100);

    const systemHealth = dbLatencyMs < 100 ? "healthy" : dbLatencyMs < 500 ? "degraded" : "critical";

    res.json({
      users: {
        activeToday: parseInt(activeUsersRow.rows[0].count),
        totalActive: parseInt(totalUsersRow.rows[0].count),
        newToday: parseInt(newUsersRow.rows[0].count),
      },
      students: {
        total: parseInt(totalStudentsRow.rows[0].count),
        newToday: parseInt(newStudentsRow.rows[0].count),
      },
      revenue: {
        today: parseFloat(revenueRow.rows[0].total),
        thisMonth: parseFloat(revenueMonthRow.rows[0].total),
      },
      subscriptions: {
        active: parseInt(activeSubsRow.rows[0].count),
      },
      pendingApprovals: {
        payments: parseInt(pendingPaymentsRow.rows[0].count),
        enrollments: parseInt(pendingEnrollmentsRow.rows[0].count),
        total: parseInt(pendingPaymentsRow.rows[0].count) + parseInt(pendingEnrollmentsRow.rows[0].count),
      },
      errors: {
        failedLoginsLast24h: parseInt(failedLoginsRow.rows[0].count),
        problemReportsLast24h: parseInt(errorRateRow.rows[0].count),
      },
      system: {
        status: systemHealth,
        dbLatencyMs,
        memoryUsedPct: memPct,
        uptimeSeconds: Math.round(process.uptime()),
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to load launch dashboard", details: err?.message });
  }
});

// DB integrity audit
adminLaunchDashboardRouter.get("/db-integrity", async (_req, res) => {
  try {
    const checks = await Promise.all([
      // Orphaned students (no account)
      pool.query(`SELECT COUNT(*) as count FROM students s WHERE account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.id = s.account_id)`).catch(() => ({ rows: [{ count: 0 }] })),
      // Subscriptions with no plan
      pool.query(`SELECT COUNT(*) as count FROM subscriptions s WHERE plan_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM subscription_plans sp WHERE sp.id = s.plan_id)`).catch(() => ({ rows: [{ count: 0 }] })),
      // Enrollments without valid student/course
      pool.query(`SELECT COUNT(*) as count FROM course_enrollments e WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.id = e.student_id) OR NOT EXISTS (SELECT 1 FROM aperti_courses c WHERE c.id = e.course_id)`).catch(() => ({ rows: [{ count: 0 }] })),
      // Duplicate active subscriptions per account
      pool.query(`SELECT COUNT(*) as count FROM (SELECT account_id FROM subscriptions WHERE status='active' GROUP BY account_id HAVING COUNT(*) > 1) t`).catch(() => ({ rows: [{ count: 0 }] })),
      // Accounts with no role
      pool.query(`SELECT COUNT(*) as count FROM accounts WHERE role IS NULL OR role = ''`).catch(() => ({ rows: [{ count: 0 }] })),
      // Students with no teacher
      pool.query(`SELECT COUNT(*) as count FROM students WHERE teacher_account_id IS NULL`).catch(() => ({ rows: [{ count: 0 }] })),
    ]);

    const [orphanedStudents, subNoPlans, orphanedEnrollments, dupSubs, noRole, noTeacher] = checks;

    const issues = [];
    if (parseInt(orphanedStudents.rows[0].count) > 0) issues.push({ severity: "high", table: "students", count: parseInt(orphanedStudents.rows[0].count), description: "Students with no linked account" });
    if (parseInt(subNoPlans.rows[0].count) > 0) issues.push({ severity: "high", table: "subscriptions", count: parseInt(subNoPlans.rows[0].count), description: "Subscriptions referencing non-existent plans" });
    if (parseInt(orphanedEnrollments.rows[0].count) > 0) issues.push({ severity: "medium", table: "course_enrollments", count: parseInt(orphanedEnrollments.rows[0].count), description: "Enrollments with invalid student or course" });
    if (parseInt(dupSubs.rows[0].count) > 0) issues.push({ severity: "medium", table: "subscriptions", count: parseInt(dupSubs.rows[0].count), description: "Accounts with multiple active subscriptions" });
    if (parseInt(noRole.rows[0].count) > 0) issues.push({ severity: "medium", table: "accounts", count: parseInt(noRole.rows[0].count), description: "Accounts missing role" });
    if (parseInt(noTeacher.rows[0].count) > 0) issues.push({ severity: "low", table: "students", count: parseInt(noTeacher.rows[0].count), description: "Students with no assigned teacher" });

    res.json({
      healthy: issues.filter(i => i.severity !== "low").length === 0,
      issues,
      checkedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: "DB integrity check failed", details: err?.message });
  }
});
