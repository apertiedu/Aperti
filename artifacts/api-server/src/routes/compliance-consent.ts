import { Router, Request, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";

export const complianceConsentRouter = Router();

const POLICY_VERSION = "v2026.06";

complianceConsentRouter.post("/compliance/consent", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { consents } = req.body as { consents: Array<{ type: string; granted: boolean }> };
    if (!Array.isArray(consents) || consents.length === 0) {
      res.status(400).json({ error: "consents array required" });
      return;
    }
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? null;
    const ua = (req.headers["user-agent"] ?? "").slice(0, 512);
    for (const c of consents) {
      const { type, granted } = c;
      await pool.query(
        `INSERT INTO consent_records (user_id, policy_version, consent_type, granted, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, POLICY_VERSION, type, !!granted, ip, ua]
      ).catch(() => {});
    }
    res.json({ ok: true, policy_version: POLICY_VERSION });
  } catch {
    res.status(500).json({ error: "Failed to record consent" });
  }
});

complianceConsentRouter.get("/compliance/consent", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (consent_type) consent_type, granted, policy_version, granted_at
       FROM consent_records WHERE user_id = $1
       ORDER BY consent_type, granted_at DESC`,
      [userId]
    );
    res.json({ consents: rows, policy_version: POLICY_VERSION });
  } catch {
    res.status(500).json({ error: "Failed to fetch consent" });
  }
});

complianceConsentRouter.post("/compliance/consent/public", async (req: Request, res: Response) => {
  try {
    const { consents, fingerprint } = req.body as { consents: Array<{ type: string; granted: boolean }>; fingerprint?: string };
    if (!Array.isArray(consents)) {
      res.status(400).json({ error: "consents array required" });
      return;
    }
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? null;
    const ua = (req.headers["user-agent"] ?? "").slice(0, 512);
    const fp = (fingerprint ?? "").slice(0, 128);
    for (const c of consents) {
      await pool.query(
        `INSERT INTO consent_records (session_fingerprint, policy_version, consent_type, granted, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [fp || null, POLICY_VERSION, c.type, !!c.granted, ip, ua]
      ).catch(() => {});
    }
    res.json({ ok: true, policy_version: POLICY_VERSION });
  } catch {
    res.status(500).json({ error: "Failed to record consent" });
  }
});

complianceConsentRouter.get("/admin/compliance/consent-stats", requireRole("admin", "super_admin"), async (_req, res: Response) => {
  try {
    const { rows: stats } = await pool.query(`
      SELECT consent_type,
             COUNT(*) FILTER (WHERE granted = true)  AS granted_count,
             COUNT(*) FILTER (WHERE granted = false) AS denied_count,
             MAX(granted_at) AS last_recorded
      FROM consent_records
      GROUP BY consent_type
      ORDER BY consent_type
    `);
    const { rows: recent } = await pool.query(`
      SELECT cr.id, cr.consent_type, cr.granted, cr.policy_version, cr.granted_at,
             a.username, a.display_name
      FROM consent_records cr
      LEFT JOIN accounts a ON cr.user_id = a.id
      ORDER BY cr.granted_at DESC LIMIT 50
    `);
    res.json({ stats, recent, policy_version: POLICY_VERSION });
  } catch {
    res.status(500).json({ error: "Failed to fetch consent stats" });
  }
});
