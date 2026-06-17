import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { logError } from "../lib/log-error";
import { getRecentBillingEvents } from "../lib/billing-event-bus";

export const billingEventsRouter = Router();
billingEventsRouter.use(authenticate);

/* ── GET /api/billing-events/recent ────────────────────────────────────── */
billingEventsRouter.get("/recent", requireRole("admin", "super_admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { limit: lim, type, userId: uid } = req.query as Record<string, string>;
    const safeLimit = Math.min(parseInt(lim ?? "100", 10), 500);

    let q = `
      SELECT be.*, a.display_name AS user_name, a.username
      FROM billing_events be
      LEFT JOIN accounts a ON a.id = be.user_id
      WHERE 1=1`;
    const params: unknown[] = [];
    let idx = 1;
    if (type) { q += ` AND be.type = $${idx++}`; params.push(type); }
    if (uid)  { q += ` AND be.user_id = $${idx++}`; params.push(parseInt(uid)); }
    q += ` ORDER BY be.created_at DESC LIMIT $${idx}`;
    params.push(safeLimit);

    const { rows } = await pool.query(q, params);
    res.json({ events: rows, total: rows.length });
  } catch (err) {
    await logError(err, { route: "GET /api/billing-events/recent" });
    res.status(500).json({ error: "Failed" });
  }
});

/* ── GET /api/billing-events/counts ────────────────────────────────────── */
billingEventsRouter.get("/counts", requireRole("admin", "super_admin"), async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(`
      SELECT type, COUNT(*)::int AS count
      FROM billing_events
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY type
      ORDER BY count DESC
    `);
    res.json({ counts: rows });
  } catch (err) {
    await logError(err, { route: "GET /api/billing-events/counts" });
    res.status(500).json({ error: "Failed" });
  }
});

/* ── GET /api/billing-events/stream (SSE) ──────────────────────────────── */
billingEventsRouter.get("/stream", requireRole("admin", "super_admin"), async (_req: AuthRequest, res: Response): Promise<void> => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendSnapshot = async () => {
    try {
      const events = await getRecentBillingEvents(20);
      const data = JSON.stringify({ events, timestamp: new Date().toISOString() });
      res.write(`data: ${data}\n\n`);
    } catch {}
  };

  await sendSnapshot();
  const interval = setInterval(sendSnapshot, 10_000);

  res.on("close", () => {
    clearInterval(interval);
  });
});

/* ── GET /api/billing-events/my ─────────────────────────────────────────── */
billingEventsRouter.get("/my", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      `SELECT type, entity_id, entity_type, payload, created_at
       FROM billing_events WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 30`,
      [req.userId],
    );
    res.json({ events: rows });
  } catch (err) {
    await logError(err, { route: "GET /api/billing-events/my" });
    res.status(500).json({ error: "Failed" });
  }
});
