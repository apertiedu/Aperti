import { Router } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, type AuthRequest } from "../middleware/auth";

const router = Router();
const adminOnly = [authenticate, requireRole("admin", "super_admin")];

// ══════════════════════════════════════════════════════════════════════════════
// TESTIMONIALS — authenticated submit only (public read is in phase14-public.ts)
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/testimonials — authenticated user submits
router.post("/testimonials", authenticate, async (req: AuthRequest, res) => {
  try {
    const { name, role, organization, photo_url, quote, rating } = req.body as {
      name: string; role: string; organization?: string; photo_url?: string; quote: string; rating: number;
    };

    if (!name || !quote || !rating) {
      return res.status(400).json({ error: "name, quote, and rating are required" });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: "rating must be between 1 and 5" });
    }
    if (quote.length < 20) {
      return res.status(400).json({ error: "quote must be at least 20 characters" });
    }

    // Check if user is verified
    const userRes = await pool.query("SELECT verified FROM accounts WHERE id=$1", [req.userId!]);
    const isVerified = userRes.rows[0]?.verified ?? false;

    const { rows } = await pool.query(
      `INSERT INTO testimonials (user_id, name, role, organization, photo_url, quote, rating, is_verified, is_approved)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false) RETURNING *`,
      [req.userId!, name, role || "teacher", organization || null, photo_url || null, quote, rating, isVerified],
    );
    res.status(201).json({ ok: true, testimonial: rows[0], pending_approval: true });
  } catch (e: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// GET /api/admin/testimonials — all testimonials
router.get("/admin/testimonials/all", ...adminOnly, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, a.username, a.email as submitter_email
       FROM testimonials t
       LEFT JOIN accounts a ON a.id=t.user_id
       ORDER BY t.created_at DESC`,
    );
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// PUT /api/admin/testimonials/:id/approve
router.put("/admin/testimonials/:id/approve", ...adminOnly, async (req, res) => {
  try {
    const { verified } = req.body as { verified?: boolean };
    const { rows } = await pool.query(
      "UPDATE testimonials SET is_approved=true, is_verified=COALESCE($1,is_verified) WHERE id=$2 RETURNING *",
      [verified ?? null, req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// PUT /api/admin/testimonials/:id/reject
router.put("/admin/testimonials/:id/reject", ...adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "UPDATE testimonials SET is_approved=false WHERE id=$1 RETURNING *",
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// DELETE /api/admin/testimonials/:id
router.delete("/admin/testimonials/:id", ...adminOnly, async (req, res) => {
  try {
    await pool.query("DELETE FROM testimonials WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// CONTENT GOVERNANCE — admin only
// ══════════════════════════════════════════════════════════════════════════════

router.get("/admin/content-governance", ...adminOnly, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT cg.*,
         o.display_name AS owner_name, o.email AS owner_email,
         r.display_name AS reviewer_name, r.email AS reviewer_email
       FROM content_governance cg
       LEFT JOIN accounts o ON o.id=cg.owner_id
       LEFT JOIN accounts r ON r.id=cg.reviewer_id
       ORDER BY cg.page_name ASC`,
    );
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

router.put("/admin/content-governance/:id", ...adminOnly, async (req, res) => {
  try {
    const { owner_id, reviewer_id, approval_date, version, notes } = req.body as {
      owner_id?: number; reviewer_id?: number; approval_date?: string; version?: string; notes?: string;
    };
    const { rows } = await pool.query(
      `UPDATE content_governance SET
         owner_id=COALESCE($1,owner_id),
         reviewer_id=COALESCE($2,reviewer_id),
         approval_date=COALESCE($3::TIMESTAMPTZ,approval_date),
         version=COALESCE($4,version),
         notes=COALESCE($5,notes),
         last_updated=NOW()
       WHERE id=$6 RETURNING *`,
      [owner_id || null, reviewer_id || null, approval_date || null, version || null, notes || null, req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// POST /api/admin/content-governance — add new page
router.post("/admin/content-governance", ...adminOnly, async (req, res) => {
  try {
    const { page_url, page_name, owner_id, reviewer_id, version = "1.0" } = req.body as {
      page_url: string; page_name: string; owner_id?: number; reviewer_id?: number; version?: string;
    };
    if (!page_url || !page_name) return res.status(400).json({ error: "page_url and page_name required" });
    const { rows } = await pool.query(
      `INSERT INTO content_governance (page_url, page_name, owner_id, reviewer_id, version)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (page_url) DO UPDATE SET page_name=$2 RETURNING *`,
      [page_url, page_name, owner_id || null, reviewer_id || null, version],
    );
    res.status(201).json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// GET /api/admin/users/verified — list accounts with verified flag
router.get("/admin/users/verified", ...adminOnly, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, username, display_name, email, role, verified, status FROM accounts ORDER BY role, display_name",
    );
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// PUT /api/admin/users/:id/verify
router.put("/admin/users/:id/verify", ...adminOnly, async (req, res) => {
  try {
    const { verified } = req.body as { verified: boolean };
    const { rows } = await pool.query(
      "UPDATE accounts SET verified=$1 WHERE id=$2 RETURNING id, username, display_name, verified",
      [verified, req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "User not found" });
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

export { router as phase14Router };
