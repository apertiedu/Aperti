import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { logError } from "../lib/log-error";

export const schoolsRouter = Router();

schoolsRouter.use(authenticate);

/* ── GET /api/schools ───────────────────────────────────────────────────── */
schoolsRouter.get("/", requireRole("admin", "super_admin"), async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(`
      SELECT o.*,
             COUNT(DISTINCT sm.account_id) FILTER (WHERE sm.role = 'admin')::int AS admin_count,
             COUNT(DISTINCT sm.account_id) FILTER (WHERE sm.role = 'teacher')::int AS teacher_count,
             COUNT(DISTINCT sm.account_id) FILTER (WHERE sm.role = 'student')::int AS student_count,
             COUNT(DISTINCT sm.account_id)::int AS total_members
      FROM organizations o
      LEFT JOIN school_members sm ON sm.org_id = o.id
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `);
    const { rows: stats } = await pool.query(`
      SELECT
        COUNT(*)::int AS total_schools,
        COUNT(*) FILTER (WHERE status='active')::int AS active,
        COUNT(*) FILTER (WHERE plan='basic')::int AS basic_plan,
        COUNT(*) FILTER (WHERE plan='premium')::int AS premium_plan
      FROM organizations
    `);
    res.json({ schools: rows, stats: stats[0] ?? {} });
  } catch (err) {
    await logError(err, { route: "GET /api/schools" });
    res.status(500).json({ error: "Failed to fetch schools" });
  }
});

/* ── POST /api/schools ──────────────────────────────────────────────────── */
schoolsRouter.post("/", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, type = "school", country = "EG", plan = "basic", contact_info = {} } = req.body as {
      name: string;
      type?: string;
      country?: string;
      plan?: string;
      contact_info?: Record<string, unknown>;
    };

    if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36);

    const { rows } = await pool.query(
      `INSERT INTO organizations (name, slug, type, country, plan, status, contact_info, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,'active',$6,NOW(),NOW()) RETURNING *`,
      [name.trim(), slug, type, country, plan, JSON.stringify(contact_info)],
    );
    res.status(201).json({ school: rows[0] });
  } catch (err) {
    await logError(err, { route: "POST /api/schools" });
    res.status(500).json({ error: "Failed to create school" });
  }
});

/* ── GET /api/schools/:id ───────────────────────────────────────────────── */
schoolsRouter.get("/:id", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { rows } = await pool.query(
      `SELECT o.*,
              COUNT(DISTINCT sm.account_id) FILTER (WHERE sm.role = 'admin')::int AS admin_count,
              COUNT(DISTINCT sm.account_id) FILTER (WHERE sm.role = 'teacher')::int AS teacher_count,
              COUNT(DISTINCT sm.account_id) FILTER (WHERE sm.role = 'student')::int AS student_count
       FROM organizations o
       LEFT JOIN school_members sm ON sm.org_id = o.id
       WHERE o.id=$1
       GROUP BY o.id`,
      [id],
    );
    if (rows.length === 0) { res.status(404).json({ error: "School not found" }); return; }

    const { rows: members } = await pool.query(
      `SELECT sm.*, a.display_name, a.email, a.role AS account_role
       FROM school_members sm
       JOIN accounts a ON a.id = sm.account_id
       WHERE sm.org_id=$1
       ORDER BY sm.role, a.display_name`,
      [id],
    );

    res.json({ school: rows[0], members });
  } catch (err) {
    await logError(err, { route: `GET /api/schools/${req.params.id}` });
    res.status(500).json({ error: "Failed to fetch school" });
  }
});

/* ── PATCH /api/schools/:id ─────────────────────────────────────────────── */
schoolsRouter.patch("/:id", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { name, plan, status, contact_info, branding } = req.body as Record<string, unknown>;

    const updates: string[] = [];
    const params: unknown[] = [];

    if (name) { params.push(name); updates.push(`name = $${params.length}`); }
    if (plan) { params.push(plan); updates.push(`plan = $${params.length}`); }
    if (status) { params.push(status); updates.push(`status = $${params.length}`); }
    if (contact_info) { params.push(JSON.stringify(contact_info)); updates.push(`contact_info = $${params.length}`); }
    if (branding) { params.push(JSON.stringify(branding)); updates.push(`branding = $${params.length}`); }

    if (updates.length === 0) { res.status(400).json({ error: "No fields to update" }); return; }
    params.push(id);
    updates.push("updated_at = NOW()");

    const { rows } = await pool.query(
      `UPDATE organizations SET ${updates.join(", ")} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    if (rows.length === 0) { res.status(404).json({ error: "School not found" }); return; }
    res.json({ school: rows[0] });
  } catch (err) {
    await logError(err, { route: `PATCH /api/schools/${req.params.id}` });
    res.status(500).json({ error: "Failed to update school" });
  }
});

/* ── POST /api/schools/:id/members ──────────────────────────────────────── */
schoolsRouter.post("/:id/members", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = parseInt(req.params.id);
    const { account_id, role = "member" } = req.body as { account_id: number; role?: string };
    if (!account_id) { res.status(400).json({ error: "account_id is required" }); return; }

    const { rows } = await pool.query(
      `INSERT INTO school_members (org_id, account_id, role, created_at)
       VALUES ($1,$2,$3,NOW())
       ON CONFLICT (org_id, account_id) DO UPDATE SET role = $3
       RETURNING *`,
      [orgId, account_id, role],
    );
    res.status(201).json({ member: rows[0] });
  } catch (err) {
    await logError(err, { route: `POST /api/schools/${req.params.id}/members` });
    res.status(500).json({ error: "Failed to add member" });
  }
});

/* ── DELETE /api/schools/:id/members/:accountId ─────────────────────────── */
schoolsRouter.delete("/:id/members/:accountId", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await pool.query(
      "DELETE FROM school_members WHERE org_id=$1 AND account_id=$2",
      [parseInt(req.params.id), parseInt(req.params.accountId)],
    );
    res.json({ success: true });
  } catch (err) {
    await logError(err, { route: `DELETE /api/schools/${req.params.id}/members` });
    res.status(500).json({ error: "Failed to remove member" });
  }
});

/* ── GET /api/schools/:id/analytics ─────────────────────────────────────── */
schoolsRouter.get("/:id/analytics", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = parseInt(req.params.id);

    const { rows: memberIds } = await pool.query(
      "SELECT account_id FROM school_members WHERE org_id=$1",
      [orgId],
    );
    const ids = memberIds.map((r: { account_id: number }) => r.account_id);
    if (ids.length === 0) {
      res.json({ school_id: orgId, revenue: 0, transactions: 0, members: 0, message: "No members assigned" });
      return;
    }

    const idList = ids.join(",");

    const { rows: revenueRows } = await pool.query(
      `SELECT
         COALESCE(SUM(le.amount) FILTER (WHERE le.account_type='platform_revenue'),0)::numeric(12,2) AS platform_revenue,
         COALESCE(SUM(le.amount) FILTER (WHERE le.account_type='teacher_revenue'),0)::numeric(12,2) AS teacher_revenue,
         COUNT(DISTINCT le.transaction_id)::int AS transactions,
         COUNT(DISTINCT pt.user_id)::int AS unique_payers
       FROM ledger_entries le
       JOIN payment_transactions pt ON pt.id = le.transaction_id
       WHERE pt.user_id = ANY($1::int[]) AND le.entry_type='credit' AND le.is_reversal=FALSE`,
      [ids],
    ).catch(() => ({ rows: [{ platform_revenue: 0, teacher_revenue: 0, transactions: 0, unique_payers: 0 }] }));

    const { rows: courseRows } = await pool.query(
      `SELECT COUNT(DISTINCT c.id)::int AS courses
       FROM aperti_courses c
       WHERE c.teacher_id = ANY($1::int[])`,
      [ids],
    ).catch(() => ({ rows: [{ courses: 0 }] }));

    res.json({
      school_id: orgId,
      member_count: ids.length,
      ...revenueRows[0],
      courses: courseRows[0]?.courses ?? 0,
    });
  } catch (err) {
    await logError(err, { route: `GET /api/schools/${req.params.id}/analytics` });
    res.status(500).json({ error: "Failed to fetch school analytics" });
  }
});

/* ── GET /api/schools/my/membership ─────────────────────────────────────── */
schoolsRouter.get("/my/membership", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      `SELECT sm.*, o.name AS school_name, o.slug, o.plan, o.status AS school_status, o.logo_url
       FROM school_members sm
       JOIN organizations o ON o.id = sm.org_id
       WHERE sm.account_id = $1`,
      [req.userId],
    );
    res.json({ memberships: rows });
  } catch (err) {
    await logError(err, { route: "GET /api/schools/my/membership" });
    res.status(500).json({ error: "Failed to fetch school membership" });
  }
});
