/**
 * Legal Policy CMS — Phase 4 Compliance & Trust Layer
 * Manages versioned legal policy content with admin editing and public read access.
 */
import { Router, Request, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";

// Helper: apply authenticate + requireRole together for admin routes
function adminAuth(...roles: string[]) {
  return [authenticate, requireRole(...roles as any)];
}

export const legalPolicyRouter = Router();

const POLICY_TYPES = ["privacy_policy", "terms_of_service", "data_retention", "cookie_policy"] as const;
type PolicyType = typeof POLICY_TYPES[number];

// ── Public: get active policy version ─────────────────────────────────────────
legalPolicyRouter.get("/legal/policies", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, policy_type, version, summary, effective_date, is_active, requires_reconsent, created_at
      FROM legal_policy_versions
      WHERE is_active = true
      ORDER BY policy_type
    `);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch policies" });
  }
});

legalPolicyRouter.get("/legal/policies/:type", async (req: Request, res: Response) => {
  const type = req.params.type as PolicyType;
  if (!POLICY_TYPES.includes(type)) {
    res.status(400).json({ error: "Unknown policy type" });
    return;
  }
  try {
    const { rows } = await pool.query(`
      SELECT id, policy_type, version, content, summary, effective_date, is_active, requires_reconsent, created_at
      FROM legal_policy_versions
      WHERE policy_type = $1 AND is_active = true
      LIMIT 1
    `, [type]);
    if (!rows.length) {
      res.status(404).json({ error: "Policy not found" });
      return;
    }
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Failed to fetch policy" });
  }
});

// ── Admin: version history ─────────────────────────────────────────────────────
legalPolicyRouter.get("/admin/legal/policies/:type/history", ...adminAuth("admin", "super_admin"), async (req: Request, res: Response) => {
  const type = req.params.type;
  try {
    const { rows } = await pool.query(`
      SELECT lpv.*, a.display_name as created_by_name
      FROM legal_policy_versions lpv
      LEFT JOIN accounts a ON lpv.created_by = a.id
      WHERE lpv.policy_type = $1
      ORDER BY lpv.created_at DESC
      LIMIT 50
    `, [type]);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch policy history" });
  }
});

// ── Admin: create new policy version ──────────────────────────────────────────
legalPolicyRouter.post("/admin/legal/policies", ...adminAuth("admin", "super_admin"), async (req: AuthRequest, res: Response) => {
  const { policy_type, version, content, summary, effective_date, requires_reconsent } = req.body;
  if (!POLICY_TYPES.includes(policy_type) || !version || !content || !effective_date) {
    res.status(400).json({ error: "policy_type, version, content and effective_date are required" });
    return;
  }
  const adminId = req.userId;
  try {
    const { rows } = await pool.query(`
      INSERT INTO legal_policy_versions
        (policy_type, version, content, summary, effective_date, created_by, is_active, requires_reconsent)
      VALUES ($1, $2, $3, $4, $5, $6, false, $7)
      RETURNING *
    `, [policy_type, version, content, summary ?? "", effective_date, adminId, !!requires_reconsent]);
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ error: "Failed to create policy version" });
  }
});

// ── Admin: activate a policy version (deactivates others of same type) ─────────
legalPolicyRouter.put("/admin/legal/policies/:id/activate", ...adminAuth("admin", "super_admin"), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    // Get the policy_type first
    const { rows: target } = await pool.query(`SELECT policy_type FROM legal_policy_versions WHERE id = $1`, [id]);
    if (!target.length) { res.status(404).json({ error: "Policy not found" }); return; }
    const type = target[0].policy_type;

    // Deactivate all others of same type
    await pool.query(`UPDATE legal_policy_versions SET is_active = false WHERE policy_type = $1`, [type]);
    // Activate this one
    const { rows } = await pool.query(`UPDATE legal_policy_versions SET is_active = true WHERE id = $1 RETURNING *`, [id]);
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Failed to activate policy" });
  }
});

// ── Admin: update content of a DRAFT (non-active) policy only ─────────────────
// Active versions are immutable to preserve audit trail integrity.
legalPolicyRouter.put("/admin/legal/policies/:id", ...adminAuth("admin", "super_admin"), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { content, summary, version, effective_date, requires_reconsent } = req.body;
  try {
    // Check that the target version is NOT active — active policies are immutable
    const { rows: check } = await pool.query(
      `SELECT id, is_active FROM legal_policy_versions WHERE id = $1`, [id]
    );
    if (!check.length) { res.status(404).json({ error: "Policy not found" }); return; }
    if (check[0].is_active) {
      res.status(409).json({ error: "Active policy versions are immutable. Create a new draft version instead." });
      return;
    }
    const { rows } = await pool.query(`
      UPDATE legal_policy_versions
      SET content = COALESCE($1, content),
          summary = COALESCE($2, summary),
          version = COALESCE($3, version),
          effective_date = COALESCE($4, effective_date),
          requires_reconsent = COALESCE($5, requires_reconsent)
      WHERE id = $6 AND is_active = false
      RETURNING *
    `, [content, summary, version, effective_date, requires_reconsent, id]);
    if (!rows.length) { res.status(409).json({ error: "Cannot edit an active policy version" }); return; }
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Failed to update policy" });
  }
});

// ── Admin: compliance overview stats ──────────────────────────────────────────
legalPolicyRouter.get("/admin/legal/compliance-overview", ...adminAuth("admin", "super_admin"), async (_req: Request, res: Response) => {
  try {
    const [policies, requests, consents] = await Promise.all([
      pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_active) as active FROM legal_policy_versions`).catch(() => ({ rows: [{ total: 0, active: 0 }] })),
      pool.query(`SELECT status, COUNT(*) as count FROM compliance_requests GROUP BY status`).catch(() => ({ rows: [] })),
      pool.query(`SELECT consent_type, COUNT(*) FILTER (WHERE granted) as granted, COUNT(*) as total FROM consent_records GROUP BY consent_type`).catch(() => ({ rows: [] })),
    ]);
    res.json({
      policy_versions: policies.rows[0],
      request_breakdown: requests.rows,
      consent_summary: consents.rows,
      generated_at: new Date().toISOString(),
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch compliance overview" });
  }
});
