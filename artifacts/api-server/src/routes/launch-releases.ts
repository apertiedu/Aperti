import { Router, Request, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, AuthRequest, requireRole } from "../middleware/auth";

export const launchCmdRouter = Router();
export const releasesRouter  = Router();

/* ══════════════════════════════════════════════════════════════════════════
   LAUNCH COMMAND CENTER
   ══════════════════════════════════════════════════════════════════════════ */

launchCmdRouter.use(authenticate as any);
launchCmdRouter.use(requireRole("admin", "super_admin") as any);

launchCmdRouter.get("/status", async (_req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM launch_audit_items ORDER BY id`
    ).catch(() => ({ rows: [] }));

    const total   = rows.length;
    const passed  = rows.filter((r: any) => r.status === "pass").length;
    const failed  = rows.filter((r: any) => r.status === "fail").length;
    const pending = rows.filter((r: any) => r.status === "pending").length;
    const score   = total > 0 ? Math.round((passed / total) * 100) : 0;

    res.json({ items: rows, summary: { total, passed, failed, pending, score } });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

launchCmdRouter.put("/checklist/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { status, notes } = req.body;
    const { rows } = await pool.query(
      `UPDATE launch_audit_items
       SET status=$1, notes=$2, checked_manually=TRUE, updated_at=NOW()
       WHERE id=$3 RETURNING *`,
      [status ?? "pass", notes ?? null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Item not found" });
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

launchCmdRouter.get("/readiness-score", async (_req: AuthRequest, res: Response) => {
  try {
    const [auditRows, bugRows, healthRows] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status='pass') AS passed,
          COUNT(*) AS total
        FROM launch_audit_items`).catch(() => ({ rows: [{ passed:0, total:1 }] })),

      pool.query(`
        SELECT COUNT(*) FILTER (WHERE status IN ('open','in_progress') AND severity='critical') AS critical_bugs
        FROM qa_bugs`).catch(() => ({ rows: [{ critical_bugs: 0 }] })),

      pool.query(`
        SELECT COUNT(*) FILTER (WHERE status='healthy') AS healthy,
               COUNT(*) AS total
        FROM system_health_logs
        WHERE timestamp >= NOW()-INTERVAL '1 hour'`).catch(() => ({ rows: [{ healthy:0, total:0 }] })),
    ]);

    const auditScore   = auditRows.rows[0]?.total > 0
      ? Math.round((auditRows.rows[0].passed / auditRows.rows[0].total) * 100) : 0;
    const criticalBugs = parseInt(bugRows.rows[0]?.critical_bugs ?? 0);
    const healthScore  = healthRows.rows[0]?.total > 0
      ? Math.round((healthRows.rows[0].healthy / healthRows.rows[0].total) * 100) : 100;

    const overall = Math.max(0, Math.round(
      auditScore * 0.5 + healthScore * 0.3 + (criticalBugs === 0 ? 100 : Math.max(0, 100 - criticalBugs * 20)) * 0.2
    ));

    res.json({
      overall,
      breakdown: {
        auditScore,
        healthScore,
        criticalBugs,
        bugPenalty: criticalBugs * 20,
      },
      launchReady: overall >= 80 && criticalBugs === 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

/* ── Feature Retirement ───────────────────────────────────────────────────── */
launchCmdRouter.post("/features/retire", async (req: AuthRequest, res: Response) => {
  try {
    const { feature_name, reason } = req.body;
    if (!feature_name) return res.status(400).json({ error: "feature_name required" });

    const { rows } = await pool.query(
      `INSERT INTO feature_retirement_log (feature_name, reason, retired_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (feature_name) DO UPDATE SET reason=$2, retired_at=NOW()
       RETURNING *`,
      [feature_name, reason ?? null, req.userId]
    );
    res.status(201).json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

launchCmdRouter.get("/features/retired", async (_req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT frl.*, a.display_name AS retired_by_name
       FROM feature_retirement_log frl
       LEFT JOIN accounts a ON frl.retired_by=a.id
       ORDER BY frl.retired_at DESC`
    );
    res.json({ features: rows });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   RELEASES
   ══════════════════════════════════════════════════════════════════════════ */

// Admin — manage releases
releasesRouter.get("/admin/releases", authenticate as any, requireRole("admin", "super_admin") as any,
  async (_req: AuthRequest, res: Response) => {
    try {
      const { rows } = await pool.query(`SELECT * FROM releases ORDER BY release_date DESC`);
      res.json({ releases: rows });
    } catch (err: any) {
      res.status(500).json({ error: "An unexpected error occurred" });
    }
  }
);

releasesRouter.post("/admin/releases", authenticate as any, requireRole("admin", "super_admin") as any,
  async (req: AuthRequest, res: Response) => {
    try {
      const { version, description, release_date, notes, is_published } = req.body;
      if (!version) return res.status(400).json({ error: "version required" });

      const { rows } = await pool.query(
        `INSERT INTO releases (version, description, release_date, notes, is_published)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [version, description ?? "", release_date ?? new Date(), notes ?? "", is_published ?? true]
      );
      res.status(201).json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: "An unexpected error occurred" });
    }
  }
);

releasesRouter.put("/admin/releases/:id", authenticate as any, requireRole("admin", "super_admin") as any,
  async (req: AuthRequest, res: Response) => {
    try {
      const { version, description, release_date, notes, is_published } = req.body;
      const { rows } = await pool.query(
        `UPDATE releases SET
           version=COALESCE($1,version),
           description=COALESCE($2,description),
           release_date=COALESCE($3,release_date),
           notes=COALESCE($4,notes),
           is_published=COALESCE($5,is_published)
         WHERE id=$6 RETURNING *`,
        [version, description, release_date, notes, is_published, req.params.id]
      );
      if (rows.length === 0) return res.status(404).json({ error: "Release not found" });
      res.json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: "An unexpected error occurred" });
    }
  }
);

releasesRouter.delete("/admin/releases/:id", authenticate as any, requireRole("admin", "super_admin") as any,
  async (req: AuthRequest, res: Response) => {
    try {
      await pool.query(`DELETE FROM releases WHERE id=$1`, [req.params.id]);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: "An unexpected error occurred" });
    }
  }
);

// Public — view published releases
releasesRouter.get("/releases", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, version, description, release_date, notes, is_published
       FROM releases WHERE is_published=TRUE ORDER BY release_date DESC`
    );
    res.json({ releases: rows });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});
