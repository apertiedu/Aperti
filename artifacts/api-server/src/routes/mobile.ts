import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import {
  getVapidPublicKey,
  saveSubscription,
  removeSubscription,
  sendPushToUser,
  sendPushToRole,
  sendPushToAll,
} from "../lib/push";

const adminOnly = (req: AuthRequest, res: Response, next: () => void) => {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  next();
};

export const mobileRouter = Router();

// ─── VAPID Public Key (public) ────────────────────────────────────────────────
mobileRouter.get("/push/vapid-key", (_req, res) => {
  res.json({ publicKey: getVapidPublicKey() });
});

// ─── Push: Subscribe ──────────────────────────────────────────────────────────
mobileRouter.post("/push/subscribe", authenticate, async (req: AuthRequest, res) => {
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys?.auth || !keys?.p256dh) {
    return res.status(400).json({ error: "Invalid subscription object" });
  }
  await saveSubscription(req.user!.id, endpoint, keys.auth, keys.p256dh);
  res.json({ ok: true });
});

// ─── Push: Unsubscribe ────────────────────────────────────────────────────────
mobileRouter.post("/push/unsubscribe", authenticate, async (req: AuthRequest, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ error: "endpoint required" });
  await removeSubscription(req.user!.id, endpoint);
  res.json({ ok: true });
});

// ─── Push: Admin Send ─────────────────────────────────────────────────────────
mobileRouter.post(
  "/admin/push/send",
  authenticate,
  adminOnly,
  async (req: AuthRequest, res) => {
    const { target, userId, role, title, body, url } = req.body || {};
    if (!title || !body) return res.status(400).json({ error: "title and body required" });

    if (target === "user" && userId) {
      await sendPushToUser(Number(userId), { title, body, url });
    } else if (target === "role" && role) {
      await sendPushToRole(role, { title, body, url });
    } else if (target === "all") {
      await sendPushToAll({ title, body, url });
    } else {
      return res.status(400).json({ error: "Invalid target" });
    }
    res.json({ ok: true });
  }
);

// ─── Push: Admin Stats ────────────────────────────────────────────────────────
mobileRouter.get(
  "/admin/push/stats",
  authenticate,
  adminOnly,
  async (_req, res) => {
    const { rows } = await pool.query(`
      SELECT a.role, COUNT(ps.id)::int AS subscribers
      FROM push_subscriptions ps
      JOIN accounts a ON a.id = ps.user_id
      GROUP BY a.role
    `);
    const total = await pool.query(`SELECT COUNT(*)::int AS total FROM push_subscriptions`);
    res.json({ byRole: rows, total: total.rows[0]?.total ?? 0 });
  }
);

// ─── Offline Sync ─────────────────────────────────────────────────────────────
mobileRouter.post("/offline/sync", authenticate, async (req: AuthRequest, res) => {
  const { actions } = req.body || {};
  if (!Array.isArray(actions)) return res.status(400).json({ error: "actions[] required" });

  const results: { action: string; status: string; error?: string }[] = [];

  for (const item of actions) {
    const { action, payload, queueId } = item;
    try {
      // Apply known offline actions
      if (action === "submit_answer" && payload?.questionId && payload?.answer) {
        await pool.query(
          `INSERT INTO student_answers (student_id, question_id, answer, submitted_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (student_id, question_id) DO UPDATE SET answer=$3, submitted_at=NOW()`,
          [req.user!.id, payload.questionId, payload.answer]
        ).catch(() => {});
      } else if (action === "update_note" && payload?.noteId && payload?.content !== undefined) {
        await pool.query(
          `UPDATE revision_notes SET content=$1, updated_at=NOW() WHERE id=$2 AND user_id=$3`,
          [payload.content, payload.noteId, req.user!.id]
        ).catch(() => {});
      }

      if (queueId) {
        await pool.query(
          `UPDATE offline_sync_queue SET status='synced' WHERE id=$1 AND user_id=$2`,
          [queueId, req.user!.id]
        ).catch(() => {});
      }
      results.push({ action, status: "synced" });
    } catch (err: any) {
      results.push({ action, status: "failed", error: err.message });
    }
  }
  res.json({ results });
});

mobileRouter.get("/offline/pending", authenticate, async (req: AuthRequest, res) => {
  const { rows } = await pool.query(
    `SELECT id, action, payload, created_at FROM offline_sync_queue
     WHERE user_id=$1 AND status='pending' ORDER BY created_at ASC`,
    [req.user!.id]
  );
  res.json(rows);
});

// ─── Mobile Dashboards ────────────────────────────────────────────────────────
mobileRouter.get("/mobile/student-home", authenticate, async (req: AuthRequest, res) => {
  const uid = req.user!.id;

  const [hw, upcoming, notifs, goals] = await Promise.all([
    pool.query(
      `SELECT h.id, h.title, h.due_date, s.name AS subject, h.status
       FROM homework h
       JOIN subjects s ON s.id = h.subject_id
       WHERE h.student_id=$1 AND h.status != 'submitted'
       ORDER BY h.due_date ASC LIMIT 5`,
      [uid]
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT e.id, e.name AS title, e.date, 'exam' AS type FROM exams e
       JOIN student_exams se ON se.exam_id = e.id WHERE se.student_id=$1
         AND e.date >= CURRENT_DATE ORDER BY e.date ASC LIMIT 3`,
      [uid]
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT id, title, body, is_read, created_at FROM notifications
       WHERE account_id=$1 ORDER BY created_at DESC LIMIT 5`,
      [uid]
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT id, title, target_value, current_value FROM student_goals
       WHERE student_id=$1 AND status='active' LIMIT 3`,
      [uid]
    ).catch(() => ({ rows: [] })),
  ]);

  res.json({
    todayTasks: hw.rows,
    upcomingAssessments: upcoming.rows,
    notifications: notifs.rows,
    goals: goals.rows,
  });
});

mobileRouter.get("/mobile/teacher-home", authenticate, async (req: AuthRequest, res) => {
  const uid = req.user!.id;

  const [lessons, pending, attendance] = await Promise.all([
    pool.query(
      `SELECT l.id, l.title, l.scheduled_at, tc.name AS course
       FROM lessons l
       JOIN teacher_courses tc ON tc.id = l.course_id
       WHERE tc.teacher_account_id=$1
         AND l.scheduled_at::date = CURRENT_DATE
       ORDER BY l.scheduled_at ASC LIMIT 5`,
      [uid]
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM homework h
       JOIN teacher_courses tc ON tc.id = h.course_id
       WHERE tc.teacher_account_id=$1 AND h.status='submitted'`,
      [uid]
    ).catch(() => ({ rows: [{ count: 0 }] })),
    pool.query(
      `SELECT COUNT(CASE WHEN ar.status='present' THEN 1 END)::int AS present,
              COUNT(*)::int AS total
       FROM attendance_records ar
       JOIN sessions s ON s.id = ar.session_id
       WHERE s.teacher_id=$1 AND ar.date = CURRENT_DATE`,
      [uid]
    ).catch(() => ({ rows: [{ present: 0, total: 0 }] })),
  ]);

  res.json({
    todayLessons: lessons.rows,
    pendingGrading: pending.rows[0]?.count ?? 0,
    todayAttendance: attendance.rows[0] ?? { present: 0, total: 0 },
  });
});

mobileRouter.get("/mobile/parent-home", authenticate, async (req: AuthRequest, res) => {
  const uid = req.user!.id;

  const children = await pool.query(
    `SELECT a.id, a.display_name, a.username
     FROM parent_students ps JOIN accounts a ON a.id = ps.student_id
     WHERE ps.parent_id=$1`,
    [uid]
  ).catch(() => ({ rows: [] }));

  const childIds: number[] = children.rows.map((r: any) => r.id);
  if (childIds.length === 0) return res.json({ children: [], attendance: [], recentGrades: [] });

  const [attendance, grades, announcements] = await Promise.all([
    pool.query(
      `SELECT ar.student_id, COUNT(CASE WHEN ar.status='present' THEN 1 END)::int AS present,
              COUNT(*)::int AS total
       FROM attendance_records ar
       WHERE ar.student_id = ANY($1::int[]) AND ar.date >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY ar.student_id`,
      [childIds]
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT g.student_id, g.score, g.max_score, h.title, g.graded_at
       FROM grades g JOIN homework h ON h.id = g.homework_id
       WHERE g.student_id = ANY($1::int[])
       ORDER BY g.graded_at DESC LIMIT 5`,
      [childIds]
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT id, title, body, created_at FROM announcements
       ORDER BY created_at DESC LIMIT 3`
    ).catch(() => ({ rows: [] })),
  ]);

  res.json({
    children: children.rows,
    attendance: attendance.rows,
    recentGrades: grades.rows,
    announcements: announcements.rows,
  });
});

mobileRouter.get("/mobile/admin-home", authenticate, adminOnly, async (_req, res) => {
  const [users, revenue, pending, health] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS total FROM accounts WHERE role != 'admin'`).catch(() => ({ rows: [{ total: 0 }] })),
    pool.query(
      `SELECT COALESCE(SUM(amount),0)::numeric AS mrr FROM billing_invoices
       WHERE issued_at >= date_trunc('month', NOW()) AND status='paid'`
    ).catch(() => ({ rows: [{ mrr: 0 }] })),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM payment_requests WHERE status='paid'`
    ).catch(() => ({ rows: [{ count: 0 }] })),
    pool.query(`SELECT NOW() AS server_time`).catch(() => ({ rows: [{ server_time: null }] })),
  ]);

  res.json({
    totalUsers: users.rows[0]?.total ?? 0,
    mrr: Number(revenue.rows[0]?.mrr ?? 0),
    pendingPayments: pending.rows[0]?.count ?? 0,
    serverTime: health.rows[0]?.server_time,
    status: "healthy",
  });
});

// ─── Camera Upload ────────────────────────────────────────────────────────────
mobileRouter.post("/upload/camera", authenticate, async (req: AuthRequest, res) => {
  const { base64, mimeType = "image/jpeg", context = "general" } = req.body || {};
  if (!base64) return res.status(400).json({ error: "base64 image required" });

  // Strip data URI prefix if present
  const data = base64.replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(data, "base64");

  // For now, return the base64 as a data URL (extendable to S3/Cloudinary)
  const dataUrl = `data:${mimeType};base64,${data}`;
  res.json({
    ok: true,
    url: dataUrl,
    size: buffer.length,
    context,
    message: "Upload received (stored in-memory; configure storage provider for persistence)",
  });
});
