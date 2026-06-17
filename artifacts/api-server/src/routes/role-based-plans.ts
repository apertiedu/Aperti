import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { logError } from "../lib/log-error";

export const roleBasedPlansRouter = Router();
roleBasedPlansRouter.use(authenticate);

/* ── GET /api/role-plans/mine (teacher: their own plans) ────────────────── */
roleBasedPlansRouter.get("/mine", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      `SELECT sp.*, COUNT(s.id)::int AS subscriber_count
       FROM subscription_plans sp
       LEFT JOIN subscriptions s ON s.plan_id = sp.id AND s.status='active'
       WHERE sp.teacher_id = $1 AND sp.scope = 'teacher_course'
       GROUP BY sp.id
       ORDER BY sp.created_at DESC`,
      [req.userId],
    );
    res.json({ plans: rows });
  } catch (err) {
    await logError(err, { route: "GET /api/role-plans/mine" });
    res.status(500).json({ error: "Failed" });
  }
});

/* ── POST /api/role-plans/teacher/create ────────────────────────────────── */
roleBasedPlansRouter.post("/teacher/create", requireRole("teacher", "admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const userRole = req.role!;
    const { name, priceEgp, features, courseId, description, durationDays = 30 } = req.body as {
      name: string;
      priceEgp: number;
      features?: string[];
      courseId?: number;
      description?: string;
      durationDays?: number;
    };

    if (!name || !priceEgp) { res.status(400).json({ error: "name and priceEgp required" }); return; }

    const teacherId = userRole === "teacher" ? userId : null;
    const scope = "teacher_course";

    if (userRole === "teacher" && courseId) {
      const { rows: [course] } = await pool.query(
        `SELECT id FROM lessons WHERE id=$1 AND teacher_account_id=$2 LIMIT 1`,
        [courseId, userId],
      ).catch(() => ({ rows: [] }));
      if (!course) {
        res.status(403).json({ error: "Course not found or you do not own this course" });
        return;
      }
    }

    const { rows: [plan] } = await pool.query(
      `INSERT INTO subscription_plans
         (name, type, price_egp, features, scope, teacher_id, course_id, visibility, is_active, created_at)
       VALUES ($1,'teacher',$2,$3,$4,$5,$6,TRUE,TRUE,NOW()) RETURNING *`,
      [name, String(priceEgp), JSON.stringify(features ?? []), scope, teacherId, courseId ?? null],
    );

    res.status(201).json({ plan });
  } catch (err) {
    await logError(err, { route: "POST /api/role-plans/teacher/create" });
    res.status(500).json({ error: "Failed" });
  }
});

/* ── PUT /api/role-plans/teacher/:id ────────────────────────────────────── */
roleBasedPlansRouter.put("/teacher/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const planId = parseInt(req.params.id);

    const { rows: [existing] } = await pool.query(
      `SELECT * FROM subscription_plans WHERE id=$1 AND teacher_id=$2 AND scope='teacher_course'`,
      [planId, userId],
    );
    if (!existing && req.role !== "admin" && req.role !== "super_admin") {
      res.status(403).json({ error: "Not authorized to modify this plan" });
      return;
    }

    const { name, priceEgp, features, visibility } = req.body as {
      name?: string;
      priceEgp?: number;
      features?: string[];
      visibility?: boolean;
    };

    const { rows: [updated] } = await pool.query(
      `UPDATE subscription_plans SET
         name       = COALESCE($1, name),
         price_egp  = COALESCE($2, price_egp),
         features   = COALESCE($3, features),
         visibility = COALESCE($4, visibility)
       WHERE id = $5 RETURNING *`,
      [name ?? null, priceEgp ? String(priceEgp) : null, features ? JSON.stringify(features) : null, visibility ?? null, planId],
    );
    res.json({ plan: updated });
  } catch (err) {
    await logError(err, { route: `PUT /api/role-plans/teacher/${req.params.id}` });
    res.status(500).json({ error: "Failed" });
  }
});

/* ── DELETE /api/role-plans/teacher/:id (archive only) ─────────────────── */
roleBasedPlansRouter.delete("/teacher/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const planId = parseInt(req.params.id);

    const { rows: [activeSubs] } = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM subscriptions WHERE plan_id=$1 AND status='active'`,
      [planId],
    );
    if (activeSubs.cnt > 0) {
      res.status(409).json({ error: `Cannot archive plan with ${activeSubs.cnt} active subscribers.` });
      return;
    }

    const filter = req.role === "admin" || req.role === "super_admin"
      ? `id=$1`
      : `id=$1 AND teacher_id=$2 AND scope='teacher_course'`;
    const params = filter.includes("$2") ? [planId, userId] : [planId];

    await pool.query(`UPDATE subscription_plans SET visibility=FALSE, is_active=FALSE WHERE ${filter}`, params);
    res.json({ success: true, message: "Plan archived (not deleted, preserving subscriber history)" });
  } catch (err) {
    await logError(err, { route: `DELETE /api/role-plans/teacher/${req.params.id}` });
    res.status(500).json({ error: "Failed" });
  }
});

/* ── GET /api/role-plans/admin/all ──────────────────────────────────────── */
roleBasedPlansRouter.get("/admin/all", requireRole("admin", "super_admin"), async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(`
      SELECT sp.*, a.display_name AS teacher_name,
             COUNT(s.id) FILTER (WHERE s.status='active')::int AS active_subscribers,
             SUM(le.amount)::numeric(12,2) AS total_revenue
      FROM subscription_plans sp
      LEFT JOIN accounts a ON a.id = sp.teacher_id
      LEFT JOIN subscriptions s ON s.plan_id = sp.id
      LEFT JOIN ledger_entries le ON le.reference_id = s.id AND le.reference_type='subscription' AND le.entry_type='credit'
      GROUP BY sp.id, a.display_name
      ORDER BY sp.scope, sp.created_at DESC
    `);
    res.json({ plans: rows });
  } catch (err) {
    await logError(err, { route: "GET /api/role-plans/admin/all" });
    res.status(500).json({ error: "Failed" });
  }
});
