import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { requireRole } from "../middleware/auth";
import type { AuthRequest } from "../middleware/auth";

export const notificationsInboxRouter = Router();
notificationsInboxRouter.use(requireRole("admin", "super_admin", "teacher", "assistant", "student", "parent"));

notificationsInboxRouter.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const role = (req as any).user?.role;
    const { type, limit = "30" } = req.query as Record<string, string>;
    const lim = Math.min(parseInt(limit) || 30, 100);
    const items: any[] = [];

    const [messagesRes, submissionsRes, alertsRes, ticketsRes, enrollRes] = await Promise.allSettled([
      // Unread student messages
      pool.query(`
        SELECT
          sm.id, 'message' AS type, 'Direct Message' AS category,
          sm.content AS title,
          'From: ' || COALESCE(a.display_name, a.email, 'Unknown') AS subtitle,
          sm.created_at, false AS is_read
        FROM student_messages sm
        LEFT JOIN accounts a ON a.id = sm.sender_id
        WHERE sm.thread_id IN (
          SELECT id FROM message_threads
          WHERE teacher_account_id = $1 OR student_account_id = $1
        )
        ORDER BY sm.created_at DESC LIMIT 15
      `, [userId]),

      // Pending submissions (teacher)
      role === "teacher" || role === "admin" ? pool.query(`
        SELECT
          ss.id, 'submission' AS type, 'Assignment Submission' AS category,
          COALESCE(h.title, 'Assignment') AS title,
          'Submitted by: ' || COALESCE(s.name, 'Student') AS subtitle,
          ss.submitted_at AS created_at, false AS is_read
        FROM snapgrade_submissions ss
        LEFT JOIN homework h ON h.id = ss.homework_id
        LEFT JOIN students s ON s.id = ss.student_id
        WHERE ss.teacher_account_id = $1 AND ss.status = 'pending'
        ORDER BY ss.submitted_at DESC LIMIT 10
      `, [userId]) : Promise.resolve({ rows: [] }),

      // System alerts (admin/founder)
      role === "admin" || role === "super_admin" ? pool.query(`
        SELECT
          id, 'alert' AS type, 'System Alert' AS category,
          message AS title,
          severity AS subtitle,
          created_at, false AS is_read
        FROM founder_alerts
        WHERE resolved = false OR resolved IS NULL
        ORDER BY created_at DESC LIMIT 10
      `) : Promise.resolve({ rows: [] }),

      // Open support tickets
      pool.query(`
        SELECT
          id, 'ticket' AS type, 'Support Ticket' AS category,
          subject AS title,
          'Status: ' || status AS subtitle,
          created_at, false AS is_read
        FROM support_tickets
        WHERE user_id = $1 AND status NOT IN ('closed', 'resolved')
        ORDER BY created_at DESC LIMIT 5
      `, [userId]),

      // Recent enrollment changes
      role === "teacher" || role === "admin" ? pool.query(`
        SELECT
          et.id, 'enrollment' AS type, 'Enrollment Change' AS category,
          et.action AS title,
          COALESCE(et.entity_name, 'Student') AS subtitle,
          et.created_at, false AS is_read
        FROM enrollment_timeline et
        WHERE et.performed_by = $1
        ORDER BY et.created_at DESC LIMIT 5
      `, [userId]).catch(() => ({ rows: [] })) : Promise.resolve({ rows: [] }),
    ]);

    if (messagesRes.status === "fulfilled") items.push(...(messagesRes.value.rows as any[]));
    if (submissionsRes.status === "fulfilled") items.push(...((submissionsRes.value as any).rows as any[]));
    if (alertsRes.status === "fulfilled") items.push(...((alertsRes.value as any).rows as any[]));
    if (ticketsRes.status === "fulfilled") items.push(...(ticketsRes.value.rows as any[]));
    if (enrollRes.status === "fulfilled") items.push(...((enrollRes.value as any).rows as any[]));

    const filtered = type ? items.filter(i => i.type === type) : items;
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.json({
      items: filtered.slice(0, lim),
      total: filtered.length,
      counts: {
        message: items.filter(i => i.type === "message").length,
        submission: items.filter(i => i.type === "submission").length,
        alert: items.filter(i => i.type === "alert").length,
        ticket: items.filter(i => i.type === "ticket").length,
        enrollment: items.filter(i => i.type === "enrollment").length,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

notificationsInboxRouter.post("/mark-read", async (req: AuthRequest, res: Response) => {
  res.json({ ok: true });
});
