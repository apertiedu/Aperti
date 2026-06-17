import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { logError } from "../lib/log-error";
import { emitBillingEvent } from "../lib/billing-event-bus";

export const pricingExperimentsRouter = Router();
pricingExperimentsRouter.use(authenticate);

/* ── GET /api/pricing-experiments/assign ───────────────────────────────── */
pricingExperimentsRouter.get("/assign", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { experimentId } = req.query as Record<string, string>;
    if (!experimentId) { res.status(400).json({ error: "experimentId required" }); return; }

    const userId = req.userId!;
    const expId = parseInt(experimentId);

    const { rows: [exp] } = await pool.query(
      `SELECT * FROM pricing_experiments WHERE id=$1 AND status='active'`,
      [expId],
    );
    if (!exp) { res.status(404).json({ error: "Experiment not active" }); return; }

    const { rows: [existing] } = await pool.query(
      `SELECT * FROM experiment_assignments WHERE experiment_id=$1 AND user_id=$2`,
      [expId, userId],
    );
    if (existing) {
      res.json({ assignment: existing, experiment: exp });
      return;
    }

    const split = exp.traffic_split as Record<string, number>;
    const variants = Object.keys(split);
    const total = variants.reduce((sum, k) => sum + (split[k] ?? 0), 0);
    let rand = (userId * 2654435761) % 100;
    let chosenVariant = variants[0] ?? "A";
    let cumulative = 0;
    for (const v of variants) {
      cumulative += ((split[v] ?? 0) / total) * 100;
      if (rand < cumulative) { chosenVariant = v; break; }
    }

    const variantDef = (exp.variants as any[]).find((v: any) => v.name === chosenVariant) ?? {};
    const { rows: [assignment] } = await pool.query(
      `INSERT INTO experiment_assignments (experiment_id, user_id, variant, assigned_at)
       VALUES ($1,$2,$3,NOW()) RETURNING *`,
      [expId, userId, chosenVariant],
    );

    emitBillingEvent({
      type: "experiment_assigned",
      entityId: expId,
      entityType: "experiment",
      userId,
      payload: { variant: chosenVariant },
    });

    res.json({ assignment, variant_config: variantDef, experiment: exp });
  } catch (err) {
    await logError(err, { route: "GET /api/pricing-experiments/assign" });
    res.status(500).json({ error: "Failed" });
  }
});

/* ── GET /api/pricing-experiments/admin/all ─────────────────────────────── */
pricingExperimentsRouter.get("/admin/all", requireRole("admin", "super_admin"), async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows: experiments } = await pool.query(`
      SELECT pe.*,
        a.display_name AS created_by_name,
        sp.name AS plan_name,
        COUNT(ea.id)::int AS total_assigned,
        COUNT(ea.id) FILTER (WHERE ea.converted=TRUE)::int AS total_converted,
        ROUND(AVG(ea.revenue)::numeric, 2) AS avg_revenue_per_user
      FROM pricing_experiments pe
      LEFT JOIN accounts a ON a.id = pe.created_by
      LEFT JOIN subscription_plans sp ON sp.id = pe.plan_id
      LEFT JOIN experiment_assignments ea ON ea.experiment_id = pe.id
      GROUP BY pe.id, a.display_name, sp.name
      ORDER BY pe.created_at DESC
    `);

    for (const exp of experiments) {
      const { rows: variantStats } = await pool.query(`
        SELECT variant,
               COUNT(*)::int AS assigned,
               COUNT(*) FILTER (WHERE converted=TRUE)::int AS converted,
               ROUND(AVG(revenue)::numeric,2) AS avg_revenue,
               ROUND(COUNT(*) FILTER (WHERE converted=TRUE)::numeric / NULLIF(COUNT(*),0)*100,1) AS conversion_rate
        FROM experiment_assignments WHERE experiment_id=$1 GROUP BY variant
      `, [exp.id]);
      exp.variant_stats = variantStats;
    }

    res.json({ experiments });
  } catch (err) {
    await logError(err, { route: "GET /api/pricing-experiments/admin/all" });
    res.status(500).json({ error: "Failed" });
  }
});

/* ── POST /api/pricing-experiments/admin/create ─────────────────────────── */
pricingExperimentsRouter.post("/admin/create", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, variants, trafficSplit, planId, endDate } = req.body as {
      name: string;
      description?: string;
      variants: { name: string; price: number }[];
      trafficSplit: Record<string, number>;
      planId?: number;
      endDate?: string;
    };

    if (!name || !variants?.length) {
      res.status(400).json({ error: "name and variants required" });
      return;
    }

    const total = Object.values(trafficSplit ?? {}).reduce((s, v) => s + v, 0);
    if (Math.abs(total - 100) > 1) {
      res.status(400).json({ error: "trafficSplit must sum to 100" });
      return;
    }

    const { rows: [exp] } = await pool.query(
      `INSERT INTO pricing_experiments (name, description, variants, traffic_split, plan_id, end_date, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()) RETURNING *`,
      [name, description ?? null, JSON.stringify(variants), JSON.stringify(trafficSplit ?? { A: 50, B: 50 }), planId ?? null, endDate ?? null, req.userId],
    );

    res.status(201).json({ experiment: exp });
  } catch (err) {
    await logError(err, { route: "POST /api/pricing-experiments/admin/create" });
    res.status(500).json({ error: "Failed" });
  }
});

/* ── POST /api/pricing-experiments/admin/:id/status ─────────────────────── */
pricingExperimentsRouter.post("/admin/:id/status", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.body as { status: "active" | "paused" | "completed" };
    if (!["active", "paused", "completed"].includes(status)) {
      res.status(400).json({ error: "status must be active | paused | completed" });
      return;
    }
    const { rows: [exp] } = await pool.query(
      `UPDATE pricing_experiments SET status=$1, end_date=CASE WHEN $1='completed' THEN NOW() ELSE end_date END WHERE id=$2 RETURNING *`,
      [status, req.params.id],
    );
    if (!exp) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ experiment: exp });
  } catch (err) {
    await logError(err, { route: `POST /api/pricing-experiments/admin/${req.params.id}/status` });
    res.status(500).json({ error: "Failed" });
  }
});

/* ── POST /api/pricing-experiments/admin/:id/record-conversion ──────────── */
pricingExperimentsRouter.post("/admin/:id/record-conversion", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, revenue = 0 } = req.body as { userId: number; revenue?: number };
    await pool.query(
      `UPDATE experiment_assignments SET converted=TRUE, converted_at=NOW(), revenue=$1
       WHERE experiment_id=$2 AND user_id=$3`,
      [revenue, req.params.id, userId],
    );
    res.json({ success: true });
  } catch (err) {
    await logError(err, { route: `POST /api/pricing-experiments/admin/${req.params.id}/record-conversion` });
    res.status(500).json({ error: "Failed" });
  }
});
