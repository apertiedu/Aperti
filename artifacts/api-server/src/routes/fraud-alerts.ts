import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { logError } from "../lib/log-error";

export const fraudAlertsRouter = Router();

fraudAlertsRouter.use(authenticate, requireRole("admin", "super_admin"));

/* ── GET /api/fraud-alerts ──────────────────────────────────────────────── */
fraudAlertsRouter.get("/", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const q = req.query as Record<string, string>;
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (q.severity && ["low","medium","high"].includes(q.severity)) {
      params.push(q.severity);
      conditions.push(`fa.severity = $${params.length}`);
    }
    if (q.status && ["open","reviewed","resolved","ignored"].includes(q.status)) {
      params.push(q.status);
      conditions.push(`fa.status = $${params.length}`);
    }
    if (q.type) {
      params.push(q.type);
      conditions.push(`fa.type = $${params.length}`);
    }
    if (q.since) {
      params.push(new Date(q.since).toISOString());
      conditions.push(`fa.created_at >= $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = Math.min(parseInt(q.limit ?? "100"), 500);
    params.push(limit);

    const { rows } = await pool.query(
      `SELECT fa.*,
              resolver.display_name AS resolved_by_name
       FROM fraud_alerts fa
       LEFT JOIN accounts resolver ON resolver.id = fa.resolved_by
       ${where}
       ORDER BY
         CASE fa.severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
         fa.created_at DESC
       LIMIT $${params.length}`,
      params,
    );

    const { rows: stats } = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE severity='high' AND status='open')::int AS open_high,
        COUNT(*) FILTER (WHERE severity='medium' AND status='open')::int AS open_medium,
        COUNT(*) FILTER (WHERE severity='low' AND status='open')::int AS open_low,
        COUNT(*) FILTER (WHERE status='open')::int AS total_open,
        COUNT(*) FILTER (WHERE status='resolved')::int AS resolved,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS last_24h
      FROM fraud_alerts
    `);

    res.json({ alerts: rows, stats: stats[0] ?? {} });
  } catch (err) {
    await logError(err, { route: "/api/fraud-alerts" });
    res.status(500).json({ error: "Failed to fetch fraud alerts" });
  }
});

/* ── POST /api/fraud-alerts/:id/resolve ────────────────────────────────── */
fraudAlertsRouter.post("/:id/resolve", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { rows } = await pool.query(
      `UPDATE fraud_alerts SET status='resolved', resolved_by=$1, resolved_at=NOW()
       WHERE id=$2 AND status != 'resolved'
       RETURNING id, status`,
      [req.userId, id],
    );
    if (rows.length === 0) { res.status(404).json({ error: "Alert not found or already resolved" }); return; }
    res.json({ success: true, alert: rows[0] });
  } catch (err) {
    await logError(err, { route: `/api/fraud-alerts/${req.params.id}/resolve` });
    res.status(500).json({ error: "Failed to resolve alert" });
  }
});

/* ── POST /api/fraud-alerts/:id/ignore ─────────────────────────────────── */
fraudAlertsRouter.post("/:id/ignore", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { rows } = await pool.query(
      `UPDATE fraud_alerts SET status='ignored', resolved_by=$1, resolved_at=NOW()
       WHERE id=$2 AND status='open'
       RETURNING id, status`,
      [req.userId, id],
    );
    if (rows.length === 0) { res.status(404).json({ error: "Alert not found or not open" }); return; }
    res.json({ success: true, alert: rows[0] });
  } catch (err) {
    await logError(err, { route: `/api/fraud-alerts/${req.params.id}/ignore` });
    res.status(500).json({ error: "Failed to ignore alert" });
  }
});

/* ── POST /api/fraud-alerts/:id/review ─────────────────────────────────── */
fraudAlertsRouter.post("/:id/review", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { rows } = await pool.query(
      `UPDATE fraud_alerts SET status='reviewed' WHERE id=$1 AND status='open' RETURNING id, status`,
      [id],
    );
    if (rows.length === 0) { res.status(404).json({ error: "Alert not found or not open" }); return; }
    res.json({ success: true, alert: rows[0] });
  } catch (err) {
    await logError(err, { route: `/api/fraud-alerts/${req.params.id}/review` });
    res.status(500).json({ error: "Failed to mark alert reviewed" });
  }
});

/* ── GET /api/fraud-alerts/live (latest 30, open only, for polling) ─────── */
fraudAlertsRouter.get("/live", async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      `SELECT fa.*, resolver.display_name AS resolved_by_name
       FROM fraud_alerts fa
       LEFT JOIN accounts resolver ON resolver.id = fa.resolved_by
       WHERE fa.status = 'open'
       ORDER BY CASE fa.severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, fa.created_at DESC
       LIMIT 30`,
    );
    res.json({ alerts: rows, fetched_at: new Date().toISOString() });
  } catch (err) {
    await logError(err, { route: "/api/fraud-alerts/live" });
    res.status(500).json({ error: "Failed to fetch live alerts" });
  }
});

/* ── POST /api/fraud-alerts/generate-from-log (backfill from fraud_audit_log) */
fraudAlertsRouter.post("/generate-from-log", async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows: unalerted } = await pool.query(`
      SELECT fal.*, pt.user_id, u.display_name AS user_name, pt.amount
      FROM fraud_audit_log fal
      LEFT JOIN payment_transactions pt ON pt.id = fal.transaction_id
      LEFT JOIN accounts u ON u.id = pt.user_id
      WHERE fal.risk_level IN ('medium','high')
        AND fal.transaction_id NOT IN (
          SELECT DISTINCT entity_id::integer FROM fraud_alerts
          WHERE entity_type = 'payment_transaction' AND entity_id ~ '^[0-9]+$'
        )
      ORDER BY fal.fraud_risk_score DESC
      LIMIT 50
    `);

    let created = 0;
    for (const row of unalerted) {
      const severity: "medium" | "high" = row.risk_level === "high" ? "high" : "medium";
      const flags: string[] = Array.isArray(row.flags) ? row.flags : JSON.parse(row.flags || "[]");
      await pool.query(
        `INSERT INTO fraud_alerts (severity, type, entity_id, entity_type, message, metadata, created_at)
         VALUES ($1, $2, $3, 'payment_transaction', $4, $5, $6)`,
        [
          severity,
          `fraud_risk_${row.risk_level}`,
          String(row.transaction_id),
          `${severity.toUpperCase()} fraud risk on transaction #${row.transaction_id} (score: ${row.fraud_risk_score}). Signals: ${flags.join(", ") || "none"}. Action: ${row.recommended_action}.`,
          JSON.stringify({ score: row.fraud_risk_score, flags, recommended_action: row.recommended_action, user_name: row.user_name, amount: row.amount }),
          row.created_at,
        ],
      ).catch(() => {});
      created++;
    }

    res.json({ success: true, alerts_created: created });
  } catch (err) {
    await logError(err, { route: "/api/fraud-alerts/generate-from-log" });
    res.status(500).json({ error: "Backfill failed" });
  }
});
