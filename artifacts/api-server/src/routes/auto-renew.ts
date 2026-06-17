import { Router, Response } from "express";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { logError } from "../lib/log-error";
import { safeHandler } from "../lib/safe-handler";
import { runAutoRenewInvoices, getUpcomingRenewals, getRecentAutoRenewInvoices } from "../lib/auto-renew-invoices";
import { pool } from "@workspace/db";

export const autoRenewRouter = Router();
autoRenewRouter.use(authenticate);

/* ── GET /api/auto-renew/upcoming ───────────────────────────────────────── */
autoRenewRouter.get(
  "/upcoming",
  requireRole("admin", "super_admin"),
  safeHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
      const renewals = await getUpcomingRenewals();
      res.json({ renewals, count: renewals.length });
    } catch (err) {
      logError(err, { route: "GET /api/auto-renew/upcoming" });
      res.status(500).json({ error: "Failed to fetch upcoming renewals" });
    }
  }),
);

/* ── POST /api/auto-renew/run ───────────────────────────────────────────── */
autoRenewRouter.post(
  "/run",
  requireRole("admin", "super_admin"),
  safeHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const dryRun = req.query.dry === "1" || req.body?.dry_run === true;
      const result = await runAutoRenewInvoices(dryRun);
      res.json({
        ...result,
        dry_run: dryRun,
        ran_at: new Date().toISOString(),
      });
    } catch (err) {
      logError(err, { route: "POST /api/auto-renew/run" });
      res.status(500).json({ error: "Failed to run auto-renew job" });
    }
  }),
);

/* ── GET /api/auto-renew/history ────────────────────────────────────────── */
autoRenewRouter.get(
  "/history",
  requireRole("admin", "super_admin"),
  safeHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string || "50"), 200);
      const invoices = await getRecentAutoRenewInvoices(limit);
      res.json({ invoices, count: invoices.length });
    } catch (err) {
      logError(err, { route: "GET /api/auto-renew/history" });
      res.status(500).json({ error: "Failed to fetch renewal history" });
    }
  }),
);

/* ── GET /api/auto-renew/stats ──────────────────────────────────────────── */
autoRenewRouter.get(
  "/stats",
  requireRole("admin", "super_admin"),
  safeHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { rows: [stats] } = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE bi.issued_at > NOW() - INTERVAL '24 hours')::int  AS created_today,
          COUNT(*) FILTER (WHERE bi.issued_at > NOW() - INTERVAL '7 days')::int    AS created_this_week,
          COUNT(*) FILTER (WHERE bi.issued_at > NOW() - INTERVAL '30 days')::int   AS created_this_month,
          COUNT(*) FILTER (WHERE bi.status='paid')::int                            AS paid_count,
          COUNT(*) FILTER (WHERE bi.status='issued' AND bi.due_at < NOW())::int    AS overdue_count,
          COUNT(*) FILTER (WHERE bi.status='issued' AND bi.due_at >= NOW())::int   AS pending_count,
          COALESCE(SUM(bi.total) FILTER (WHERE bi.status='paid'), 0)               AS total_collected,
          COALESCE(SUM(bi.total) FILTER (WHERE bi.status='issued'), 0)             AS total_outstanding
        FROM billing_invoices bi
        WHERE bi.metadata->>'type' = 'auto_renewal'
      `);

      const { rows: [upcoming] } = await pool.query(`
        SELECT COUNT(*)::int AS expiring_7_days
        FROM subscriptions
        WHERE status='active' AND auto_renew=TRUE AND end_date IS NOT NULL
          AND end_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'
      `);

      res.json({
        stats: {
          ...stats,
          expiring_7_days: upcoming?.expiring_7_days ?? 0,
        },
      });
    } catch (err) {
      logError(err, { route: "GET /api/auto-renew/stats" });
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  }),
);
