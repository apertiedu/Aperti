import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";

export const teacherOpsRouter = Router();
teacherOpsRouter.use(authenticate, requireRole("teacher", "admin", "super_admin", "assistant"));

/* ── GET /api/teacher-ops/dashboard — aggregated operations summary ─────── */
teacherOpsRouter.get("/dashboard", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isAdmin = req.role === "admin" || req.role === "super_admin";
    const teacherId = req.userId!;
    const filter = isAdmin ? [] : [teacherId];
    const teacherWhere = isAdmin ? "" : "AND c.teacher_account_id = $1";
    const teacherWhereE = isAdmin ? "" : "AND teacher_account_id = $1";

    const [enrollments, grading, notifications, assistants, recentActivity] = await Promise.allSettled([
      pool.query(
        `SELECT e.status, COUNT(*)::int AS count
         FROM course_enrollments e
         JOIN aperti_courses c ON c.id = e.course_id
         WHERE e.deleted_at IS NULL ${teacherWhere}
         GROUP BY e.status`,
        filter,
      ),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE sm.grading_status = 'pending')::int AS pending_marks,
           COUNT(*) FILTER (WHERE sm.grading_status = 'graded')::int AS graded_not_approved,
           COUNT(*) FILTER (WHERE ss.grading_status = 'pending')::int AS pending_submissions
         FROM aperti_courses c
         LEFT JOIN exams ex ON ex.teacher_account_id = c.teacher_account_id
         LEFT JOIN student_marks sm ON sm.exam_id = ex.id
         LEFT JOIN snapgrade_submissions ss ON ss.teacher_account_id = c.teacher_account_id
         WHERE TRUE ${teacherWhereE.replace("AND c.teacher_account_id", "AND c.teacher_account_id")}`,
        filter,
      ).catch(() => ({ rows: [{ pending_marks: 0, graded_not_approved: 0, pending_submissions: 0 }] })),
      pool.query(
        `SELECT COUNT(*)::int AS unread FROM notifications WHERE account_id=$1 AND is_read=false`,
        [teacherId],
      ),
      pool.query(
        `SELECT a.id, a.display_name, a.username, a.status,
                ARRAY_AGG(ap.permission) FILTER (WHERE ap.permission IS NOT NULL) AS permissions
         FROM accounts a
         LEFT JOIN assistant_permissions ap ON ap.assistant_id = a.id
         WHERE a.role='assistant' ${isAdmin ? "" : "AND a.teacher_account_id=$1"}
         GROUP BY a.id, a.display_name, a.username, a.status
         ORDER BY a.created_at DESC LIMIT 10`,
        filter,
      ),
      pool.query(
        `SELECT al.* FROM activity_logs al
         WHERE TRUE ${isAdmin ? "" : "AND al.tenant_id=$1"}
         ORDER BY al.created_at DESC LIMIT 20`,
        filter,
      ),
    ]);

    const enrollmentStats = enrollments.status === "fulfilled"
      ? Object.fromEntries(enrollments.value.rows.map((r: any) => [r.status, r.count]))
      : {};

    const gradingData = grading.status === "fulfilled" ? grading.value.rows[0] : {};
    const unreadNotifs = notifications.status === "fulfilled" ? notifications.value.rows[0]?.unread ?? 0 : 0;
    const assistantList = assistants.status === "fulfilled" ? assistants.value.rows : [];
    const activityFeed = recentActivity.status === "fulfilled" ? recentActivity.value.rows : [];

    const [pendingCourseUpdates] = await Promise.allSettled([
      pool.query(
        `SELECT c.id, c.title, c.updated_at
         FROM aperti_courses c
         WHERE c.deleted_at IS NULL ${teacherWhere}
         ORDER BY c.updated_at DESC LIMIT 5`,
        filter,
      ),
    ]);

    res.json({
      enrollments: {
        pending: enrollmentStats["requested"] ?? 0,
        payment_pending: enrollmentStats["payment_pending"] ?? 0,
        verification_pending: enrollmentStats["verification_pending"] ?? 0,
        approved: enrollmentStats["approved"] ?? 0,
        rejected: enrollmentStats["rejected"] ?? 0,
        suspended: enrollmentStats["suspended"] ?? 0,
        total: Object.values(enrollmentStats).reduce((a: number, b: unknown) => a + (b as number), 0),
      },
      grading: gradingData,
      notifications: { unread: unreadNotifs },
      assistants: assistantList,
      recentActivity: activityFeed,
      recentCourseUpdates: pendingCourseUpdates.status === "fulfilled" ? pendingCourseUpdates.value.rows : [],
    });
  } catch {
    res.status(500).json({ error: "Failed to load ops dashboard" });
  }
});

/* ── GET /api/teacher-ops/activity — full activity log (paginated) ───────── */
teacherOpsRouter.get("/activity", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isAdmin = req.role === "admin" || req.role === "super_admin";
    const { limit = "50", offset = "0", entity_type, action } = req.query as Record<string, string>;
    const lim = Math.min(parseInt(limit) || 50, 200);
    const off = parseInt(offset) || 0;

    const params: unknown[] = [];
    const conditions: string[] = [];

    if (!isAdmin) {
      params.push(req.userId);
      conditions.push(`tenant_id = $${params.length}`);
    }
    if (entity_type) {
      params.push(entity_type);
      conditions.push(`entity_type = $${params.length}`);
    }
    if (action) {
      params.push(action);
      conditions.push(`action = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT * FROM activity_logs ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, lim, off],
    );
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM activity_logs ${where}`,
      params,
    );

    res.json({ logs: rows, total: countRows[0]?.total ?? 0 });
  } catch {
    res.status(500).json({ error: "Failed to fetch activity log" });
  }
});
