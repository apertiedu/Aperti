import { Router } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, type AuthRequest } from "../middleware/auth";
import { logger } from "../lib/logger";

const router = Router();
const adminOnly = [authenticate, requireRole("admin", "super_admin")];

// ── Scheduled launch timers in-memory ─────────────────────────────────────────
const scheduledTimers = new Map<number, NodeJS.Timeout>();

function scheduleFeatureLaunch(featureId: number, releaseDate: Date) {
  if (scheduledTimers.has(featureId)) {
    clearTimeout(scheduledTimers.get(featureId)!);
  }
  const delay = releaseDate.getTime() - Date.now();
  if (delay <= 0) return;
  const timer = setTimeout(async () => {
    await pool.query(
      "UPDATE feature_registry SET status='released', updated_at=NOW() WHERE id=$1 AND status='scheduled'",
      [featureId],
    );
    scheduledTimers.delete(featureId);
    logger.info({ featureId }, "[LaunchCMS] Feature auto-released");
  }, Math.min(delay, 2147483647));
  scheduledTimers.set(featureId, timer);
}

// Re-arm timers on server startup
pool.query("SELECT id, release_date FROM feature_registry WHERE status='scheduled' AND release_date > NOW()")
  .then((r) => { r.rows.forEach((row) => scheduleFeatureLaunch(row.id, new Date(row.release_date))); })
  .catch(() => {});

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE REGISTRY
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/admin/features — list all features
router.get("/admin/features", ...adminOnly, async (req, res) => {
  try {
    const { status, category, search } = req.query as Record<string, string>;
    let q = `
      SELECT fr.*,
        (SELECT COUNT(*) FROM feature_waitlist fw WHERE fw.feature_id=fr.id) AS waitlist_count,
        (SELECT COUNT(*) FROM beta_testers bt WHERE bt.feature_id=fr.id AND bt.active=true) AS beta_count
      FROM feature_registry fr
      WHERE 1=1
    `;
    const params: any[] = [];
    if (status) { params.push(status); q += ` AND fr.status=$${params.length}`; }
    if (category) { params.push(category); q += ` AND fr.category=$${params.length}`; }
    if (search) { params.push(`%${search}%`); q += ` AND (fr.name ILIKE $${params.length} OR fr.description ILIKE $${params.length})`; }
    q += " ORDER BY fr.created_at DESC";
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/features — create feature
router.post("/admin/features", ...adminOnly, async (req, res) => {
  try {
    const { name, description, category, owner, status = "draft", release_date, visibility_rules, documentation_url, dependencies, version } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO feature_registry (name,description,category,owner,status,release_date,visibility_rules,documentation_url,dependencies,version,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW()) RETURNING *`,
      [name, description, category, owner, status, release_date || null, JSON.stringify(visibility_rules || {}), documentation_url, JSON.stringify(dependencies || []), version],
    );
    const feature = rows[0];
    if (status === "scheduled" && release_date) scheduleFeatureLaunch(feature.id, new Date(release_date));
    res.status(201).json(feature);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PUT /api/admin/features/:id — update feature
router.put("/admin/features/:id", ...adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, owner, status, release_date, visibility_rules, documentation_url, dependencies, version } = req.body;
    const { rows } = await pool.query(
      `UPDATE feature_registry SET
        name=COALESCE($1,name), description=COALESCE($2,description), category=COALESCE($3,category),
        owner=COALESCE($4,owner), status=COALESCE($5,status), release_date=COALESCE($6::TIMESTAMPTZ,release_date),
        visibility_rules=COALESCE($7::JSONB,visibility_rules), documentation_url=COALESCE($8,documentation_url),
        dependencies=COALESCE($9::JSONB,dependencies), version=COALESCE($10,version), updated_at=NOW()
       WHERE id=$11 RETURNING *`,
      [name, description, category, owner, status, release_date || null, visibility_rules ? JSON.stringify(visibility_rules) : null, documentation_url, dependencies ? JSON.stringify(dependencies) : null, version, id],
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    if (rows[0].status === "scheduled" && rows[0].release_date) scheduleFeatureLaunch(rows[0].id, new Date(rows[0].release_date));
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/admin/features/:id — soft delete
router.delete("/admin/features/:id", ...adminOnly, async (req, res) => {
  try {
    await pool.query("UPDATE feature_registry SET status='archived', updated_at=NOW() WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/features/:id/schedule — set launch date
router.post("/admin/features/:id/schedule", ...adminOnly, async (req, res) => {
  try {
    const { release_date } = req.body;
    if (!release_date) return res.status(400).json({ error: "release_date required" });
    const { rows } = await pool.query(
      "UPDATE feature_registry SET status='scheduled', release_date=$1, updated_at=NOW() WHERE id=$2 RETURNING *",
      [release_date, req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    scheduleFeatureLaunch(rows[0].id, new Date(release_date));
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/features/:id/dependencies — dependency check
router.get("/admin/features/:id/dependencies", ...adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT dependencies FROM feature_registry WHERE id=$1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    const depIds: number[] = rows[0].dependencies || [];
    if (!depIds.length) return res.json({ dependencies: [], all_released: true });
    const { rows: deps } = await pool.query(
      "SELECT id, name, status FROM feature_registry WHERE id=ANY($1)",
      [depIds],
    );
    const all_released = deps.every((d) => d.status === "released");
    res.json({ dependencies: deps, all_released });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/features/:id/dependency-tree — full tree
router.get("/admin/features/:id/dependency-tree", ...adminOnly, async (req, res) => {
  try {
    const { rows: all } = await pool.query("SELECT id, name, status, dependencies FROM feature_registry");
    const map = new Map(all.map((r: any) => [r.id, r]));
    function buildTree(id: number, visited = new Set<number>()): any {
      if (visited.has(id)) return { id, name: "circular", status: "error", children: [] };
      visited.add(id);
      const node = map.get(id);
      if (!node) return { id, name: "unknown", status: "missing", children: [] };
      const deps: number[] = node.dependencies || [];
      return { ...node, children: deps.map((d: number) => buildTree(d, new Set(visited))) };
    }
    res.json(buildTree(parseInt(req.params.id)));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Public Feature Routes ─────────────────────────────────────────────────────

// GET /api/features/public — public feature list
router.get("/features/public", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, description, category, status, release_date, version,
        CASE WHEN status='scheduled' AND release_date > NOW()
          THEN EXTRACT(EPOCH FROM (release_date - NOW()))::BIGINT ELSE NULL END AS launch_countdown_seconds
       FROM feature_registry
       WHERE status IN ('released','beta','coming_soon','scheduled')
       ORDER BY CASE status WHEN 'released' THEN 1 WHEN 'beta' THEN 2 WHEN 'coming_soon' THEN 3 WHEN 'scheduled' THEN 4 ELSE 5 END, name`,
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/features/:id — feature detail
router.get("/features/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT *,
        CASE WHEN status='scheduled' AND release_date > NOW()
          THEN EXTRACT(EPOCH FROM (release_date - NOW()))::BIGINT ELSE NULL END AS launch_countdown_seconds
       FROM feature_registry WHERE id=$1`,
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    const feat = rows[0];
    const depIds: number[] = feat.dependencies || [];
    if (depIds.length) {
      const { rows: deps } = await pool.query("SELECT id,name,status FROM feature_registry WHERE id=ANY($1)", [depIds]);
      feat.dependency_details = deps;
    } else { feat.dependency_details = []; }
    const { rows: wl } = await pool.query("SELECT COUNT(*) AS count FROM feature_waitlist WHERE feature_id=$1", [req.params.id]);
    feat.waitlist_count = parseInt(wl[0].count);
    res.json(feat);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// WAITLIST
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/features/:id/waitlist — join (no auth)
router.post("/features/:id/waitlist", async (req, res) => {
  try {
    const { name, email, role, interest_level, organization } = req.body;
    if (!email) return res.status(400).json({ error: "email required" });
    const existing = await pool.query("SELECT id FROM feature_waitlist WHERE feature_id=$1 AND email=$2", [req.params.id, email]);
    if (existing.rows[0]) return res.json({ ok: true, already_joined: true });
    await pool.query(
      "INSERT INTO feature_waitlist (feature_id,name,email,role,interest_level,organization) VALUES ($1,$2,$3,$4,$5,$6)",
      [req.params.id, name, email, role, interest_level || 5, organization],
    );
    // Track conversion
    await pool.query("INSERT INTO conversion_events (visitor_id,event_type,metadata) VALUES ($1,'waitlist_join',$2)", [email, JSON.stringify({ feature_id: req.params.id })]).catch(() => {});
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/features/:id/waitlist — admin view waitlist
router.get("/admin/features/:id/waitlist", ...adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM feature_waitlist WHERE feature_id=$1 ORDER BY created_at DESC",
      [req.params.id],
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/waitlists — all waitlists summary
router.get("/admin/waitlists", ...adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT fr.id, fr.name, fr.status,
        COUNT(fw.id) AS total_waitlist,
        COUNT(fw.id) FILTER (WHERE fw.status='pending') AS pending,
        COUNT(fw.id) FILTER (WHERE fw.status='invited') AS invited,
        COUNT(fw.id) FILTER (WHERE fw.status='granted') AS granted
      FROM feature_registry fr
      LEFT JOIN feature_waitlist fw ON fw.feature_id=fr.id
      GROUP BY fr.id, fr.name, fr.status
      HAVING COUNT(fw.id) > 0
      ORDER BY total_waitlist DESC
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PUT /api/admin/waitlist/:id — update waitlist entry (invite/grant/revoke)
router.put("/admin/waitlist/:id", ...adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    const { rows } = await pool.query(
      "UPDATE feature_waitlist SET status=$1 WHERE id=$2 RETURNING *",
      [status, req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// BETA PROGRAM
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/admin/features/:id/beta/enroll — enroll users
router.post("/admin/features/:id/beta/enroll", ...adminOnly, async (req, res) => {
  try {
    const { user_ids } = req.body as { user_ids: number[] };
    const results = [];
    for (const uid of user_ids || []) {
      try {
        const { rows } = await pool.query(
          "INSERT INTO beta_testers (feature_id,user_id) VALUES ($1,$2) ON CONFLICT (feature_id,user_id) DO UPDATE SET active=true RETURNING *",
          [req.params.id, uid],
        );
        results.push(rows[0]);
      } catch {}
    }
    res.json({ enrolled: results.length, results });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/features/:id/beta/testers
router.get("/admin/features/:id/beta/testers", ...adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT bt.*, a.username, a.display_name, a.email
       FROM beta_testers bt
       LEFT JOIN accounts a ON a.id=bt.user_id
       WHERE bt.feature_id=$1 ORDER BY bt.enrolled_at DESC`,
      [req.params.id],
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/beta — all beta programs summary
router.get("/admin/beta", ...adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT fr.id, fr.name, fr.status,
        COUNT(bt.id) FILTER (WHERE bt.active=true) AS active_testers,
        COUNT(bt.id) AS total_enrolled,
        MAX(bt.enrolled_at) AS last_enrollment
      FROM feature_registry fr
      LEFT JOIN beta_testers bt ON bt.feature_id=fr.id
      WHERE fr.status IN ('beta','testing')
      GROUP BY fr.id, fr.name, fr.status
      ORDER BY active_testers DESC
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/features/:id/beta/feedback — submit feedback
router.post("/features/:id/beta/feedback", authenticate, async (req: AuthRequest, res) => {
  try {
    const { rating, comment, category } = req.body;
    const fb = { rating, comment, category, user_id: req.userId, submitted_at: new Date().toISOString() };
    await pool.query(
      "UPDATE beta_testers SET feedback=feedback||$1::JSONB WHERE feature_id=$2 AND user_id=$3",
      [JSON.stringify([fb]), req.params.id, req.userId],
    );
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// RELEASE NOTES
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/admin/release-notes
router.post("/admin/release-notes", ...adminOnly, async (req, res) => {
  try {
    const { title, summary, content, type, feature_id, version, scheduled_at, status = "draft" } = req.body;
    const published_at = status === "published" ? new Date() : null;
    const { rows } = await pool.query(
      "INSERT INTO release_notes (title,summary,content,type,feature_id,version,scheduled_at,status,published_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW()) RETURNING *",
      [title, summary, content, type || "minor", feature_id || null, version, scheduled_at || null, status, published_at],
    );
    res.status(201).json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/release-notes — public list
router.get("/release-notes", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT rn.*, fr.name AS feature_name FROM release_notes rn
       LEFT JOIN feature_registry fr ON fr.id=rn.feature_id
       WHERE rn.status='published'
       ORDER BY rn.published_at DESC LIMIT 50`,
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/release-notes — all (admin)
router.get("/admin/release-notes", ...adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT rn.*, fr.name AS feature_name FROM release_notes rn
       LEFT JOIN feature_registry fr ON fr.id=rn.feature_id
       ORDER BY rn.created_at DESC`,
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PUT /api/admin/release-notes/:id
router.put("/admin/release-notes/:id", ...adminOnly, async (req, res) => {
  try {
    const { title, summary, content, type, version, status, scheduled_at } = req.body;
    const published_at = status === "published" ? new Date() : undefined;
    const { rows } = await pool.query(
      `UPDATE release_notes SET
        title=COALESCE($1,title), summary=COALESCE($2,summary), content=COALESCE($3,content),
        type=COALESCE($4,type), version=COALESCE($5,version), status=COALESCE($6,status),
        scheduled_at=COALESCE($7::TIMESTAMPTZ,scheduled_at),
        published_at=COALESCE($8::TIMESTAMPTZ,published_at), updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [title, summary, content, type, version, status, scheduled_at || null, published_at || null, req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// ROADMAP
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/admin/roadmap
router.post("/admin/roadmap", ...adminOnly, async (req, res) => {
  try {
    const { title, description, category, status = "planned", target_date, feature_id, order } = req.body;
    const { rows } = await pool.query(
      "INSERT INTO roadmap_items (title,description,category,status,target_date,feature_id,\"order\",updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()) RETURNING *",
      [title, description, category, status, target_date || null, feature_id || null, order || 0],
    );
    res.status(201).json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/roadmap — public
router.get("/roadmap", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ri.*, fr.name AS feature_name FROM roadmap_items ri
       LEFT JOIN feature_registry fr ON fr.id=ri.feature_id
       ORDER BY ri."order" ASC, ri.created_at DESC`,
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/roadmap — admin
router.get("/admin/roadmap", ...adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ri.*, fr.name AS feature_name FROM roadmap_items ri
       LEFT JOIN feature_registry fr ON fr.id=ri.feature_id
       ORDER BY ri."order" ASC`,
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PUT /api/admin/roadmap/:id
router.put("/admin/roadmap/:id", ...adminOnly, async (req, res) => {
  try {
    const { title, description, category, status, target_date, order } = req.body;
    const { rows } = await pool.query(
      `UPDATE roadmap_items SET
        title=COALESCE($1,title), description=COALESCE($2,description),
        category=COALESCE($3,category), status=COALESCE($4,status),
        target_date=COALESCE($5::DATE,target_date),
        "order"=COALESCE($6,"order"), updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [title, description, category, status, target_date || null, order, req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// LANDING PAGE CMS
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/admin/landing-sections
router.get("/admin/landing-sections", ...adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM landing_sections ORDER BY "order" ASC');
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/landing-sections
router.post("/admin/landing-sections", ...adminOnly, async (req, res) => {
  try {
    const { slug, type, content, is_published = true, order = 0 } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO landing_sections (slug,type,content,is_published,"order",updated_at) VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING *',
      [slug, type, JSON.stringify(content || {}), is_published, order],
    );
    res.status(201).json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PUT /api/admin/landing-sections/:id
router.put("/admin/landing-sections/:id", ...adminOnly, async (req, res) => {
  try {
    const { slug, type, content, is_published, order } = req.body;
    const { rows } = await pool.query(
      `UPDATE landing_sections SET
        slug=COALESCE($1,slug), type=COALESCE($2,type),
        content=COALESCE($3::JSONB,content),
        is_published=COALESCE($4,is_published),
        "order"=COALESCE($5,"order"), updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [slug, type, content ? JSON.stringify(content) : null, is_published, order, req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/admin/landing-sections/:id
router.delete("/admin/landing-sections/:id", ...adminOnly, async (req, res) => {
  try {
    await pool.query("DELETE FROM landing_sections WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PUT /api/admin/landing-sections/reorder — reorder sections
router.put("/admin/landing-sections/reorder", ...adminOnly, async (req, res) => {
  try {
    const { ids } = req.body as { ids: number[] };
    for (let i = 0; i < ids.length; i++) {
      await pool.query('UPDATE landing_sections SET "order"=$1 WHERE id=$2', [i + 1, ids[i]]);
    }
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/landing — public assembled landing page data
router.get("/landing", async (req, res) => {
  try {
    const [sections, testimonials, faqs, plans, branding] = await Promise.all([
      pool.query('SELECT * FROM landing_sections WHERE is_published=true ORDER BY "order" ASC').catch(() => ({ rows: [] })),
      pool.query("SELECT id, name, role, organization, photo_url, quote, rating, is_verified, is_approved, created_at FROM testimonials WHERE is_approved=true ORDER BY is_verified DESC, created_at DESC LIMIT 6").catch(() => ({ rows: [] })),
      pool.query('SELECT * FROM faqs WHERE is_published=true ORDER BY "order" ASC').catch(() => ({ rows: [] })),
      pool.query(`
        SELECT id, name, type, price_egp, student_limit AS max_students,
          CASE WHEN sort_order = 2 THEN 'POPULAR' WHEN sort_order = 5 THEN 'BEST VALUE' ELSE NULL END AS badge,
          CASE WHEN sort_order IN (2, 5) THEN true ELSE false END AS is_highlighted,
          features
        FROM subscription_plans WHERE is_active=true ORDER BY sort_order ASC, price_egp ASC
      `).catch(() => ({ rows: [] })),
      pool.query("SELECT * FROM branding_settings ORDER BY id DESC LIMIT 1").catch(() => ({ rows: [] })),
    ]);
    res.json({
      sections: sections.rows,
      testimonials: testimonials.rows,
      faqs: faqs.rows,
      plans: plans.rows,
      branding: branding.rows[0] || { primary_color: "#0D9488" },
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/landing/pricing — public pricing data
router.get("/landing/pricing", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM subscription_plans WHERE is_visible_landing=true ORDER BY display_order ASC, price_egp ASC",
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// TESTIMONIALS & FAQs
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/admin/testimonials
router.post("/admin/testimonials", ...adminOnly, async (req, res) => {
  try {
    const { name, role, organization, photo_url, quote, rating, is_approved = false } = req.body;
    const { rows } = await pool.query(
      "INSERT INTO testimonials (name,role,organization,photo_url,quote,rating,is_approved) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
      [name, role, organization, photo_url, quote, rating || 5, is_approved],
    );
    res.status(201).json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/testimonials
router.get("/admin/testimonials", ...adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM testimonials ORDER BY created_at DESC");
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PUT /api/admin/testimonials/:id
router.put("/admin/testimonials/:id", ...adminOnly, async (req, res) => {
  try {
    const { name, role, organization, photo_url, quote, rating, is_approved } = req.body;
    const { rows } = await pool.query(
      `UPDATE testimonials SET
        name=COALESCE($1,name), role=COALESCE($2,role), organization=COALESCE($3,organization),
        photo_url=COALESCE($4,photo_url), quote=COALESCE($5,quote),
        rating=COALESCE($6,rating), is_approved=COALESCE($7,is_approved)
       WHERE id=$8 RETURNING *`,
      [name, role, organization, photo_url, quote, rating, is_approved, req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/faqs
router.post("/admin/faqs", ...adminOnly, async (req, res) => {
  try {
    const { question, answer, category, order, is_published = true } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO faqs (question,answer,category,"order",is_published,updated_at) VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING *',
      [question, answer, category, order || 0, is_published],
    );
    res.status(201).json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/faqs
router.get("/admin/faqs", ...adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM faqs ORDER BY "order" ASC');
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PUT /api/admin/faqs/:id
router.put("/admin/faqs/:id", ...adminOnly, async (req, res) => {
  try {
    const { question, answer, category, order, is_published } = req.body;
    const { rows } = await pool.query(
      `UPDATE faqs SET question=COALESCE($1,question), answer=COALESCE($2,answer),
        category=COALESCE($3,category), "order"=COALESCE($4,"order"),
        is_published=COALESCE($5,is_published), updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [question, answer, category, order, is_published, req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// PRICING CMS (extend plans)
// ══════════════════════════════════════════════════════════════════════════════

router.put("/admin/plans/:id", ...adminOnly, async (req, res) => {
  try {
    const { name, priceEgp, features, type, studentLimit, is_visible_landing, badge, display_order } = req.body;
    const { rows } = await pool.query(
      `UPDATE subscription_plans SET
        name=COALESCE($1,name), price_egp=COALESCE($2::NUMERIC,price_egp),
        features=COALESCE($3::JSONB,features), type=COALESCE($4,type),
        student_limit=COALESCE($5,student_limit),
        is_visible_landing=COALESCE($6,is_visible_landing),
        badge=COALESCE($7,badge), display_order=COALESCE($8,display_order)
       WHERE id=$9 RETURNING *`,
      [name, priceEgp, features ? JSON.stringify(features) : null, type, studentLimit, is_visible_landing, badge, display_order, req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// ANNOUNCEMENTS
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/admin/announcements
router.post("/admin/announcements", ...adminOnly, async (req, res) => {
  try {
    const { title, content, type, target_audience, delivery_channels, scheduled_at, is_published } = req.body;
    const published_at = is_published ? new Date() : null;
    const { rows } = await pool.query(
      `INSERT INTO announcements (title, content, type, is_active, created_at)
       VALUES ($1,$2,$3,$4,NOW()) RETURNING *`,
      [title, content, type || "general", is_published || false],
    );
    res.status(201).json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/announcements
router.get("/admin/announcements", ...adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM announcements ORDER BY created_at DESC LIMIT 100");
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PUT /api/admin/announcements/:id
router.put("/admin/announcements/:id", ...adminOnly, async (req, res) => {
  try {
    const { title, content, type, is_active } = req.body;
    const { rows } = await pool.query(
      `UPDATE announcements SET title=COALESCE($1,title), content=COALESCE($2,content),
        type=COALESCE($3,type), is_active=COALESCE($4,is_active) WHERE id=$5 RETURNING *`,
      [title, content, type, is_active, req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// EVENTS
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/admin/events
router.post("/admin/events", ...adminOnly, async (req, res) => {
  try {
    const { title, description, event_date, registration_url, capacity, speaker_info, type, resources, is_published = true } = req.body;
    const { rows } = await pool.query(
      "INSERT INTO launch_events (title,description,event_date,registration_url,capacity,speaker_info,type,resources,is_published,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW()) RETURNING *",
      [title, description, event_date, registration_url, capacity, JSON.stringify(speaker_info || {}), type || "webinar", JSON.stringify(resources || []), is_published],
    );
    res.status(201).json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/events — public
router.get("/events", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM launch_events WHERE is_published=true ORDER BY event_date ASC",
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/events — admin
router.get("/admin/events", ...adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM launch_events ORDER BY event_date DESC");
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PUT /api/admin/events/:id
router.put("/admin/events/:id", ...adminOnly, async (req, res) => {
  try {
    const { title, description, event_date, registration_url, capacity, type, is_published } = req.body;
    const { rows } = await pool.query(
      `UPDATE launch_events SET title=COALESCE($1,title), description=COALESCE($2,description),
        event_date=COALESCE($3::TIMESTAMPTZ,event_date), registration_url=COALESCE($4,registration_url),
        capacity=COALESCE($5,capacity), type=COALESCE($6,type),
        is_published=COALESCE($7,is_published), updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [title, description, event_date, registration_url, capacity, type, is_published, req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// DEMO & BRANDING
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/admin/demos
router.post("/admin/demos", ...adminOnly, async (req, res) => {
  try {
    const { type, title, content, is_active = true } = req.body;
    const { rows } = await pool.query(
      "INSERT INTO demo_configurations (type,title,content,is_active,updated_at) VALUES ($1,$2,$3,$4,NOW()) ON CONFLICT DO NOTHING RETURNING *",
      [type, title, JSON.stringify(content || {}), is_active],
    );
    res.status(201).json(rows[0] || {});
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/demo/:type — public
router.get("/demo/:type", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM demo_configurations WHERE type=$1 AND is_active=true LIMIT 1", [req.params.type]);
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/demos
router.get("/admin/demos", ...adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM demo_configurations ORDER BY created_at DESC");
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PUT /api/admin/branding
router.put("/admin/branding", ...adminOnly, async (req, res) => {
  try {
    const { logo_url, favicon_url, primary_color, typography_prefs, seasonal_theme } = req.body;
    const existing = await pool.query("SELECT id FROM branding_settings LIMIT 1");
    let rows;
    if (existing.rows[0]) {
      const r = await pool.query(
        `UPDATE branding_settings SET logo_url=COALESCE($1,logo_url), favicon_url=COALESCE($2,favicon_url),
          primary_color=COALESCE($3,primary_color), typography_prefs=COALESCE($4::JSONB,typography_prefs),
          seasonal_theme=COALESCE($5::JSONB,seasonal_theme), updated_at=NOW()
         WHERE id=$6 RETURNING *`,
        [logo_url, favicon_url, primary_color, typography_prefs ? JSON.stringify(typography_prefs) : null, seasonal_theme ? JSON.stringify(seasonal_theme) : null, existing.rows[0].id],
      );
      rows = r.rows;
    } else {
      const r = await pool.query(
        "INSERT INTO branding_settings (logo_url,favicon_url,primary_color,typography_prefs,seasonal_theme) VALUES ($1,$2,$3,$4,$5) RETURNING *",
        [logo_url, favicon_url, primary_color || "#0D9488", JSON.stringify(typography_prefs || {}), JSON.stringify(seasonal_theme || {})],
      );
      rows = r.rows;
    }
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/branding
router.get("/admin/branding", ...adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM branding_settings ORDER BY id DESC LIMIT 1");
    res.json(rows[0] || { primary_color: "#0D9488" });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/branding — public
router.get("/branding", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT logo_url, favicon_url, primary_color, seasonal_theme FROM branding_settings ORDER BY id DESC LIMIT 1");
    res.json(rows[0] || { primary_color: "#0D9488" });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION CAMPAIGNS
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/admin/campaigns
router.post("/admin/campaigns", ...adminOnly, async (req, res) => {
  try {
    const { name, type, audience_filters, message, channels, scheduled_at } = req.body;
    const { rows } = await pool.query(
      "INSERT INTO notification_campaigns (name,type,audience_filters,message,channels,scheduled_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING *",
      [name, type, JSON.stringify(audience_filters || {}), message, JSON.stringify(channels || []), scheduled_at || null],
    );
    res.status(201).json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/campaigns
router.get("/admin/campaigns", ...adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM notification_campaigns ORDER BY created_at DESC");
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PUT /api/admin/campaigns/:id
router.put("/admin/campaigns/:id", ...adminOnly, async (req, res) => {
  try {
    const { name, type, message, channels, scheduled_at, status } = req.body;
    const { rows } = await pool.query(
      `UPDATE notification_campaigns SET name=COALESCE($1,name), type=COALESCE($2,type),
        message=COALESCE($3,message), channels=COALESCE($4::JSONB,channels),
        scheduled_at=COALESCE($5::TIMESTAMPTZ,scheduled_at), status=COALESCE($6,status), updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [name, type, message, channels ? JSON.stringify(channels) : null, scheduled_at || null, status, req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/campaigns/:id/send — trigger send
router.post("/admin/campaigns/:id/send", ...adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM notification_campaigns WHERE id=$1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    // Simulate send (in production: push to queue)
    await pool.query(
      "UPDATE notification_campaigns SET status='sent', sent_at=NOW() WHERE id=$1",
      [req.params.id],
    );
    res.json({ ok: true, sent_at: new Date() });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// CONVERSION ANALYTICS
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/analytics/conversion — track event (frontend calls this)
router.post("/analytics/conversion", async (req, res) => {
  try {
    const { visitor_id, event_type, metadata } = req.body;
    await pool.query(
      "INSERT INTO conversion_events (visitor_id,event_type,metadata) VALUES ($1,$2,$3)",
      [visitor_id || "anonymous", event_type, JSON.stringify(metadata || {})],
    );
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/analytics/conversion
router.get("/admin/analytics/conversion", ...adminOnly, async (req, res) => {
  try {
    const { days = "30" } = req.query as Record<string, string>;
    const safeDays = Math.min(Math.max(parseInt(days) || 30, 1), 365);
    const [funnel, trend, topEvents] = await Promise.all([
      pool.query(`
        SELECT event_type, COUNT(*) AS count
        FROM conversion_events
        WHERE created_at > NOW() - ($1 || ' days')::interval
        GROUP BY event_type ORDER BY count DESC
      `, [safeDays]).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT DATE_TRUNC('day', created_at)::DATE AS date, COUNT(*) AS events
        FROM conversion_events
        WHERE created_at > NOW() - ($1 || ' days')::interval
        GROUP BY 1 ORDER BY 1
      `, [safeDays]).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT event_type, COUNT(*) AS count
        FROM conversion_events
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY event_type ORDER BY count DESC LIMIT 5
      `).catch(() => ({ rows: [] })),
    ]);
    res.json({ funnel: funnel.rows, trend: trend.rows, top_events: topEvents.rows });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/analytics/feature-adoption
router.get("/admin/analytics/feature-adoption", ...adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT fr.id, fr.name, fr.status, fr.category,
        COALESCE((SELECT COUNT(*) FROM feature_waitlist fw WHERE fw.feature_id=fr.id), 0) AS waitlist_count,
        COALESCE((SELECT COUNT(*) FROM beta_testers bt WHERE bt.feature_id=fr.id AND bt.active=true), 0) AS beta_testers,
        COALESCE((SELECT COUNT(*) FROM early_access_program ea WHERE ea.feature_id=fr.id AND ea.revoked_at IS NULL), 0) AS early_access_users,
        fam.activation_rate, fam.retention, fam.satisfaction_score
      FROM feature_registry fr
      LEFT JOIN LATERAL (
        SELECT * FROM feature_adoption_metrics WHERE feature_id=fr.id ORDER BY recorded_at DESC LIMIT 1
      ) fam ON true
      WHERE fr.status NOT IN ('draft','archived')
      ORDER BY fr.status, fr.name
    `).catch(() => ({ rows: [] }));
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/analytics/adoption — record metrics
router.post("/admin/analytics/adoption", ...adminOnly, async (req, res) => {
  try {
    const { feature_id, activation_rate, retention, usage_frequency, completion_rate, satisfaction_score } = req.body;
    const { rows } = await pool.query(
      "INSERT INTO feature_adoption_metrics (feature_id,activation_rate,retention,usage_frequency,completion_rate,satisfaction_score) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [feature_id, activation_rate, retention, usage_frequency, completion_rate, satisfaction_score],
    );
    res.status(201).json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// GROWTH DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════

router.get("/admin/growth", ...adminOnly, async (req, res) => {
  try {
    const [
      userMetrics, waitlistTotal, featureStats, conversionSummary,
      upcomingLaunches, recentEvents, recentReleaseNotes,
    ] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) AS total_users,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') AS new_users_30d,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS new_users_7d,
          COUNT(*) FILTER (WHERE role='teacher') AS teachers,
          COUNT(*) FILTER (WHERE role='student') AS students
        FROM accounts WHERE status='active'
      `),
      pool.query("SELECT COUNT(*) AS total FROM feature_waitlist"),
      pool.query(`
        SELECT
          COUNT(*) AS total_features,
          COUNT(*) FILTER (WHERE status='released') AS released,
          COUNT(*) FILTER (WHERE status='beta') AS beta,
          COUNT(*) FILTER (WHERE status='coming_soon') AS coming_soon,
          COUNT(*) FILTER (WHERE status='scheduled') AS scheduled
        FROM feature_registry
      `),
      pool.query(`
        SELECT event_type, COUNT(*) AS count
        FROM conversion_events WHERE created_at > NOW() - INTERVAL '30 days'
        GROUP BY event_type
      `),
      pool.query(`
        SELECT id, name, status, release_date FROM feature_registry
        WHERE status IN ('scheduled','coming_soon') AND release_date IS NOT NULL
        ORDER BY release_date ASC LIMIT 5
      `),
      pool.query("SELECT * FROM launch_events WHERE is_published=true AND event_date > NOW() ORDER BY event_date ASC LIMIT 3"),
      pool.query("SELECT id, title, type, published_at FROM release_notes WHERE status='published' ORDER BY published_at DESC LIMIT 3"),
    ]);

    res.json({
      users: userMetrics.rows[0],
      waitlist: { total: parseInt(waitlistTotal.rows[0].total) },
      features: featureStats.rows[0],
      conversion: conversionSummary.rows,
      upcoming_launches: upcomingLaunches.rows,
      events: recentEvents.rows,
      release_notes: recentReleaseNotes.rows,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// PLATFORM STATUS
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/platform-status — public
router.get("/platform-status", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM platform_status ORDER BY created_at DESC LIMIT 5");
    res.json({ current: rows[0] || { status: "operational" }, history: rows });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/platform-status
router.post("/admin/platform-status", ...adminOnly, async (req, res) => {
  try {
    const { status, message } = req.body;
    const { rows } = await pool.query(
      "INSERT INTO platform_status (status,message) VALUES ($1,$2) RETURNING *",
      [status, message],
    );
    res.status(201).json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/platform-status
router.get("/admin/platform-status", ...adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM platform_status ORDER BY created_at DESC LIMIT 20");
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// EARLY ACCESS PROGRAM
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/admin/early-access/:featureId — grant access
router.post("/admin/early-access/:featureId", ...adminOnly, async (req, res) => {
  try {
    const { user_ids, access_level = "limited" } = req.body as { user_ids: number[]; access_level: string };
    const results = [];
    for (const uid of user_ids || []) {
      try {
        const { rows } = await pool.query(
          "INSERT INTO early_access_program (feature_id,user_id,access_level) VALUES ($1,$2,$3) ON CONFLICT (feature_id,user_id) DO UPDATE SET revoked_at=NULL, access_level=$3, granted_at=NOW() RETURNING *",
          [req.params.featureId, uid, access_level],
        );
        results.push(rows[0]);
      } catch {}
    }
    res.json({ granted: results.length, results });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/early-access/:featureId
router.get("/admin/early-access/:featureId", ...adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ea.*, a.username, a.display_name, a.email
       FROM early_access_program ea
       LEFT JOIN accounts a ON a.id=ea.user_id
       WHERE ea.feature_id=$1 AND ea.revoked_at IS NULL
       ORDER BY ea.granted_at DESC`,
      [req.params.featureId],
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/admin/early-access/:id — revoke
router.delete("/admin/early-access/:id", ...adminOnly, async (req, res) => {
  try {
    await pool.query("UPDATE early_access_program SET revoked_at=NOW() WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/waitlist/join — public landing page CTA form submission
router.post("/waitlist/join", async (req, res) => {
  try {
    const { name, email, metadata } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }
    await pool.query(
      "INSERT INTO waitlist_submissions (name, email, metadata) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
      [name || null, email.trim().toLowerCase(), JSON.stringify(metadata || {})],
    );
    res.status(201).json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/waitlist/submissions — admin view all submissions
router.get("/admin/waitlist/submissions", ...adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM waitlist_submissions ORDER BY created_at DESC LIMIT 200");
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export { router as launchCmsRouter };
