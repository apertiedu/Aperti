import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";

export const governanceRouter = Router();
governanceRouter.use(authenticate);
governanceRouter.use(requireRole("admin", "super_admin"));

// ── helper: log governance event ───────────────────────────────────────────
async function auditLog(
  eventType: string,
  userId: number | null,
  targetType: string | null,
  targetId: number | null,
  changes: any,
  ip: string,
  severity = "info"
) {
  await pool
    .query(
      `INSERT INTO gov_audit_enforcement (event_type, user_id, target_type, target_id, changes, ip_address, severity)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [eventType, userId, targetType, targetId, JSON.stringify(changes), ip, severity]
    )
    .catch(() => {});
}

// ═══════════════════════════════════════════════════════════════════════════
// ROLE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

governanceRouter.get("/roles", async (_req, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*,
         pr.name AS parent_name,
         (SELECT COUNT(*) FROM gov_role_permissions rp WHERE rp.role_id = r.id)::int AS permission_count,
         (SELECT COUNT(*) FROM gov_user_roles ur WHERE ur.role_id = r.id)::int AS user_count
       FROM gov_roles r
       LEFT JOIN gov_roles pr ON pr.id = r.parent_role_id
       ORDER BY r.hierarchy_level, r.name`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch roles" });
  }
});

governanceRouter.post("/roles", async (req: AuthRequest, res: Response) => {
  const { name, description, hierarchyLevel, parentRoleId, color, isSystem } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  try {
    const { rows } = await pool.query(
      `INSERT INTO gov_roles (name, description, hierarchy_level, parent_role_id, color, is_system)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, description || null, hierarchyLevel || 10, parentRoleId || null, color || "#0D9488", isSystem || false]
    );
    await auditLog("role.created", req.userId!, "role", rows[0].id, { name }, req.ip || "", "info");
    res.json(rows[0]);
  } catch (err: any) {
    if (err.code === "23505") return res.status(409).json({ error: "Role name already exists" });
    res.status(500).json({ error: "Failed to create role" });
  }
});

governanceRouter.put("/roles/reorder", async (req: AuthRequest, res: Response) => {
  const { order } = req.body as { order: Array<{ id: number; hierarchyLevel: number }> };
  if (!Array.isArray(order)) return res.status(400).json({ error: "order array required" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const { id, hierarchyLevel } of order) {
      await client.query(`UPDATE gov_roles SET hierarchy_level = $1 WHERE id = $2`, [hierarchyLevel, id]);
    }
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Failed to reorder" });
  } finally {
    client.release();
  }
});

governanceRouter.put("/roles/:id", async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const { name, description, hierarchyLevel, parentRoleId, color } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE gov_roles SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         hierarchy_level = COALESCE($3, hierarchy_level),
         parent_role_id = $4,
         color = COALESCE($5, color)
       WHERE id = $6 RETURNING *`,
      [name, description, hierarchyLevel, parentRoleId || null, color, id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Role not found" });
    await auditLog("role.updated", req.userId!, "role", id, req.body, req.ip || "", "info");
    res.json(rows[0]);
  } catch (err: any) {
    if (err.code === "23505") return res.status(409).json({ error: "Role name already exists" });
    res.status(500).json({ error: "Failed to update role" });
  }
});

governanceRouter.delete("/roles/:id", async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  try {
    const check = await pool.query(`SELECT is_system FROM gov_roles WHERE id = $1`, [id]);
    if (!check.rows[0]) return res.status(404).json({ error: "Role not found" });
    if (check.rows[0].is_system) return res.status(403).json({ error: "Cannot delete system roles" });
    await pool.query(`DELETE FROM gov_roles WHERE id = $1`, [id]);
    await auditLog("role.deleted", req.userId!, "role", id, {}, req.ip || "", "warning");
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete role" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PERMISSION ENGINE
// ═══════════════════════════════════════════════════════════════════════════

governanceRouter.get("/permissions", async (_req, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*,
         COUNT(rp.id)::int AS role_count
       FROM gov_permissions p
       LEFT JOIN gov_role_permissions rp ON rp.permission_id = p.id
       GROUP BY p.id ORDER BY p.resource, p.action`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch permissions" });
  }
});

governanceRouter.post("/permissions", async (req: AuthRequest, res: Response) => {
  const { resource, action, scope, description, conditions } = req.body;
  if (!resource || !action) return res.status(400).json({ error: "resource and action required" });
  try {
    const { rows } = await pool.query(
      `INSERT INTO gov_permissions (resource, action, scope, description, conditions)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [resource, action, scope || "self", description || null, conditions ? JSON.stringify(conditions) : null]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to create permission" });
  }
});

governanceRouter.get("/roles/:id/permissions", async (req, res: Response) => {
  const roleId = parseInt(req.params.id);
  try {
    const { rows } = await pool.query(
      `SELECT p.*, rp.scope_override, rp.id AS assignment_id
       FROM gov_role_permissions rp
       JOIN gov_permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = $1
       ORDER BY p.resource, p.action`,
      [roleId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch role permissions" });
  }
});

governanceRouter.post("/roles/:id/permissions", async (req: AuthRequest, res: Response) => {
  const roleId = parseInt(req.params.id);
  const { permissionId, scopeOverride } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO gov_role_permissions (role_id, permission_id, scope_override)
       VALUES ($1,$2,$3)
       ON CONFLICT DO NOTHING RETURNING *`,
      [roleId, permissionId, scopeOverride || null]
    );
    await auditLog("permission.assigned", req.userId!, "role", roleId, { permissionId }, req.ip || "", "info");
    res.json(rows[0] || { ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to assign permission" });
  }
});

governanceRouter.delete("/roles/:id/permissions/:permId", async (req: AuthRequest, res: Response) => {
  const roleId = parseInt(req.params.id);
  const permId = parseInt(req.params.permId);
  try {
    await pool.query(
      `DELETE FROM gov_role_permissions WHERE role_id = $1 AND permission_id = $2`,
      [roleId, permId]
    );
    await auditLog("permission.removed", req.userId!, "role", roleId, { permId }, req.ip || "", "info");
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove permission" });
  }
});

// effective permissions for a role (includes inherited)
governanceRouter.get("/roles/:id/effective", async (req, res: Response) => {
  const roleId = parseInt(req.params.id);
  try {
    const collected: any[] = [];
    const visited = new Set<number>();
    async function collect(rid: number) {
      if (visited.has(rid)) return;
      visited.add(rid);
      const { rows: perms } = await pool.query(
        `SELECT p.resource, p.action, p.scope, rp.scope_override
         FROM gov_role_permissions rp
         JOIN gov_permissions p ON p.id = rp.permission_id
         WHERE rp.role_id = $1`,
        [rid]
      );
      collected.push(...perms);
      const { rows: role } = await pool.query(`SELECT parent_role_id FROM gov_roles WHERE id = $1`, [rid]);
      if (role[0]?.parent_role_id) await collect(role[0].parent_role_id);
    }
    await collect(roleId);
    res.json(collected);
  } catch (err) {
    res.status(500).json({ error: "Failed to compute effective permissions" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// USER ACCESS MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

governanceRouter.get("/users/:userId/access", async (req, res: Response) => {
  const userId = parseInt(req.params.userId);
  try {
    const [userRes, rolesRes] = await Promise.all([
      pool.query(
        `SELECT id, username, display_name, email, role, status FROM accounts WHERE id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT ur.*, r.name AS role_name, r.color, r.hierarchy_level,
           o.name AS org_name
         FROM gov_user_roles ur
         JOIN gov_roles r ON r.id = ur.role_id
         LEFT JOIN organizations o ON o.id = ur.organization_id
         WHERE ur.user_id = $1`,
        [userId]
      ),
    ]);
    if (!userRes.rows[0]) return res.status(404).json({ error: "User not found" });
    res.json({ user: userRes.rows[0], roles: rolesRes.rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user access" });
  }
});

governanceRouter.post("/users/:userId/roles", async (req: AuthRequest, res: Response) => {
  const userId = parseInt(req.params.userId);
  const { roleId, organizationId, courseId } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO gov_user_roles (user_id, role_id, organization_id, course_id, assigned_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [userId, roleId, organizationId || null, courseId || null, req.userId]
    );
    await auditLog("user.role.assigned", req.userId!, "user", userId, { roleId }, req.ip || "", "info");
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to assign role" });
  }
});

governanceRouter.delete("/users/:userId/roles/:roleId", async (req: AuthRequest, res: Response) => {
  const userId = parseInt(req.params.userId);
  const roleId = parseInt(req.params.roleId);
  try {
    await pool.query(`DELETE FROM gov_user_roles WHERE user_id = $1 AND id = $2`, [userId, roleId]);
    await auditLog("user.role.removed", req.userId!, "user", userId, { roleId }, req.ip || "", "info");
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove role" });
  }
});

// bulk user access list
governanceRouter.get("/users/access", async (req, res: Response) => {
  try {
    const { search, page = "1", limit = "50" } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const q = search ? `%${search}%` : null;
    const { rows } = await pool.query(
      `SELECT a.id, a.username, a.display_name, a.email, a.role, a.status,
         (SELECT COUNT(*) FROM gov_user_roles ur WHERE ur.user_id = a.id)::int AS gov_role_count
       FROM accounts a
       WHERE ($1::text IS NULL OR a.username ILIKE $1 OR a.display_name ILIKE $1)
       ORDER BY a.created_at DESC
       LIMIT $2 OFFSET $3`,
      [q, parseInt(limit), offset]
    );
    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM accounts
       WHERE ($1::text IS NULL OR username ILIKE $1 OR display_name ILIKE $1)`,
      [q]
    );
    res.json({ users: rows, total: countRes.rows[0].total });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ASSISTANT GOVERNANCE
// ═══════════════════════════════════════════════════════════════════════════

governanceRouter.get("/assistants", async (req, res: Response) => {
  const { status } = req.query as Record<string, string>;
  try {
    const { rows } = await pool.query(
      `SELECT aa.*,
         t.username AS teacher_username, t.display_name AS teacher_name,
         a.username AS assistant_username, a.display_name AS assistant_name,
         a.email AS assistant_email,
         r.username AS reviewer_username
       FROM gov_assistant_approvals aa
       LEFT JOIN accounts t ON t.id = aa.teacher_id
       LEFT JOIN accounts a ON a.id = aa.assistant_id
       LEFT JOIN accounts r ON r.id = aa.reviewed_by
       WHERE ($1::text IS NULL OR aa.status = $1)
       ORDER BY aa.created_at DESC`,
      [status || null]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch assistants" });
  }
});

governanceRouter.post("/assistants", async (req: AuthRequest, res: Response) => {
  const { teacherId, assistantId, notes, permissions } = req.body;
  if (!teacherId) return res.status(400).json({ error: "teacherId required" });
  try {
    const { rows } = await pool.query(
      `INSERT INTO gov_assistant_approvals (teacher_id, assistant_id, notes, permissions)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [teacherId, assistantId || null, notes || null, permissions ? JSON.stringify(permissions) : JSON.stringify([])]
    );
    await auditLog("assistant.invited", req.userId!, "assistant_approval", rows[0].id, { teacherId }, req.ip || "", "info");
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to create assistant invitation" });
  }
});

governanceRouter.put("/assistants/:id", async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const { status, notes, permissions } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE gov_assistant_approvals
       SET status = COALESCE($1, status),
           notes = COALESCE($2, notes),
           permissions = COALESCE($3::jsonb, permissions),
           reviewed_by = $4,
           reviewed_at = CASE WHEN $1 IN ('approved','rejected') THEN NOW() ELSE reviewed_at END
       WHERE id = $5 RETURNING *`,
      [status, notes, permissions ? JSON.stringify(permissions) : null, req.userId, id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    await auditLog(`assistant.${status}`, req.userId!, "assistant_approval", id, { status }, req.ip || "", "info");
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to update assistant" });
  }
});

governanceRouter.delete("/assistants/:id", async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  try {
    await pool.query(`DELETE FROM gov_assistant_approvals WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ENROLLMENT GOVERNANCE
// ═══════════════════════════════════════════════════════════════════════════

governanceRouter.get("/enrollments", async (req, res: Response) => {
  const { status, courseId, teacherId, page = "1", limit = "50" } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    const { rows } = await pool.query(
      `SELECT ge.*,
         s.username AS student_username, s.display_name AS student_name, s.email AS student_email,
         t.display_name AS teacher_name, t.username AS teacher_username,
         ab.display_name AS approver_name
       FROM gov_enrollments ge
       LEFT JOIN accounts s ON s.id = ge.student_id
       LEFT JOIN accounts t ON t.id = ge.teacher_id
       LEFT JOIN accounts ab ON ab.id = ge.approved_by
       WHERE ($1::text IS NULL OR ge.status = $1)
         AND ($2::int IS NULL OR ge.course_id = $2)
         AND ($3::int IS NULL OR ge.teacher_id = $3)
       ORDER BY ge.created_at DESC
       LIMIT $4 OFFSET $5`,
      [status || null, courseId ? parseInt(courseId) : null, teacherId ? parseInt(teacherId) : null, parseInt(limit), offset]
    );
    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM gov_enrollments
       WHERE ($1::text IS NULL OR status = $1)
         AND ($2::int IS NULL OR course_id = $2)`,
      [status || null, courseId ? parseInt(courseId) : null]
    );
    res.json({ enrollments: rows, total: countRes.rows[0].total });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch enrollments" });
  }
});

governanceRouter.post("/enrollments", async (req: AuthRequest, res: Response) => {
  const { studentId, courseId, courseName, teacherId, notes } = req.body;
  if (!studentId || !courseId) return res.status(400).json({ error: "studentId and courseId required" });
  try {
    const { rows } = await pool.query(
      `INSERT INTO gov_enrollments (student_id, course_id, course_name, teacher_id, notes, status)
       VALUES ($1,$2,$3,$4,$5,'active') RETURNING *`,
      [studentId, courseId, courseName || null, teacherId || null, notes || null]
    );
    await auditLog("enrollment.created", req.userId!, "enrollment", rows[0].id, { studentId, courseId }, req.ip || "", "info");
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to create enrollment" });
  }
});

governanceRouter.put("/enrollments/:id", async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const { status, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE gov_enrollments
       SET status = COALESCE($1, status),
           notes = COALESCE($2, notes),
           approved_by = CASE WHEN $1 = 'approved' THEN $3 ELSE approved_by END,
           approved_at = CASE WHEN $1 = 'approved' THEN NOW() ELSE approved_at END
       WHERE id = $4 RETURNING *`,
      [status, notes, req.userId, id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    await auditLog(`enrollment.${status}`, req.userId!, "enrollment", id, { status }, req.ip || "", "info");
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to update enrollment" });
  }
});

governanceRouter.delete("/enrollments/:id", async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  try {
    await pool.query(`DELETE FROM gov_enrollments WHERE id = $1`, [id]);
    await auditLog("enrollment.deleted", req.userId!, "enrollment", id, {}, req.ip || "", "warning");
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete enrollment" });
  }
});

// ── Conflict Scan ──────────────────────────────────────────────────────────
governanceRouter.post("/enrollments/conflict-scan", async (req: AuthRequest, res: Response) => {
  try {
    const conflicts: any[] = [];

    // 1. Duplicate enrollments
    const { rows: dupes } = await pool.query(
      `SELECT student_id, course_id, COUNT(*)::int AS cnt,
         array_agg(id) AS ids
       FROM gov_enrollments
       WHERE status IN ('active','pending')
       GROUP BY student_id, course_id
       HAVING COUNT(*) > 1`
    );
    for (const d of dupes) {
      conflicts.push({
        type: "duplicate_enrollment",
        description: `Student ${d.student_id} has ${d.cnt} duplicate enrollments in course ${d.course_id}`,
        ids: d.ids,
        severity: "high",
      });
    }

    // 2. Orphaned enrollments (no matching course in aperti_courses)
    const { rows: orphans } = await pool.query(
      `SELECT ge.id, ge.student_id, ge.course_id
       FROM gov_enrollments ge
       LEFT JOIN aperti_courses ac ON ac.id = ge.course_id
       WHERE ac.id IS NULL AND ge.status = 'active'`
    );
    for (const o of orphans) {
      conflicts.push({
        type: "orphaned_enrollment",
        description: `Enrollment ${o.id} references non-existent course ${o.course_id}`,
        severity: "medium",
      });
    }

    // 3. Assistant approvals without a teacher account
    const { rows: badAssistants } = await pool.query(
      `SELECT ga.id, ga.teacher_id
       FROM gov_assistant_approvals ga
       LEFT JOIN accounts a ON a.id = ga.teacher_id
       WHERE a.id IS NULL`
    );
    for (const b of badAssistants) {
      conflicts.push({
        type: "missing_teacher",
        description: `Assistant approval ${b.id} references non-existent teacher ${b.teacher_id}`,
        severity: "high",
      });
    }

    // 4. Users with no primary role in accounts table
    const { rows: noRole } = await pool.query(
      `SELECT id, username FROM accounts WHERE role IS NULL OR role = ''`
    );
    for (const u of noRole) {
      conflicts.push({
        type: "missing_role",
        description: `User "${u.username}" (id ${u.id}) has no role assigned`,
        severity: "medium",
      });
    }

    // Persist new conflicts
    for (const c of conflicts) {
      await pool.query(
        `INSERT INTO gov_conflict_logs (conflict_type, description, status)
         VALUES ($1,$2,'open')`,
        [c.type, c.description]
      ).catch(() => {});
    }

    res.json({ conflicts, scannedAt: new Date().toISOString(), total: conflicts.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Conflict scan failed" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// COURSE ACCESS RULES
// ═══════════════════════════════════════════════════════════════════════════

governanceRouter.get("/courses/:courseId/access", async (req, res: Response) => {
  const courseId = parseInt(req.params.courseId);
  try {
    const { rows } = await pool.query(
      `SELECT * FROM gov_course_access_rules WHERE course_id = $1 ORDER BY role_name`,
      [courseId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch access rules" });
  }
});

governanceRouter.post("/courses/:courseId/access", async (req: AuthRequest, res: Response) => {
  const courseId = parseInt(req.params.courseId);
  const { roleName, permissionLevel } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO gov_course_access_rules (course_id, role_name, permission_level)
       VALUES ($1,$2,$3)
       ON CONFLICT DO NOTHING RETURNING *`,
      [courseId, roleName, permissionLevel || "view"]
    );
    res.json(rows[0] || { ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to create rule" });
  }
});

governanceRouter.put("/courses/access/:id", async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const { permissionLevel } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE gov_course_access_rules SET permission_level = $1 WHERE id = $2 RETURNING *`,
      [permissionLevel, id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to update rule" });
  }
});

governanceRouter.delete("/courses/access/:id", async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  try {
    await pool.query(`DELETE FROM gov_course_access_rules WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete rule" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE ACCESS MATRIX
// ═══════════════════════════════════════════════════════════════════════════

governanceRouter.get("/features", async (_req, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM gov_feature_access_matrix ORDER BY feature_key`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch feature matrix" });
  }
});

governanceRouter.post("/features", async (req: AuthRequest, res: Response) => {
  const { featureKey, featureName, requiredRole, requiredPlan, requiredPermission, visibilityState, description } = req.body;
  if (!featureKey || !featureName) return res.status(400).json({ error: "featureKey and featureName required" });
  try {
    const { rows } = await pool.query(
      `INSERT INTO gov_feature_access_matrix (feature_key, feature_name, required_role, required_plan, required_permission, visibility_state, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [featureKey, featureName, requiredRole || null, requiredPlan || null, requiredPermission || null, visibilityState || "released", description || null]
    );
    await auditLog("feature.created", req.userId!, "feature", rows[0].id, { featureKey }, req.ip || "", "info");
    res.json(rows[0]);
  } catch (err: any) {
    if (err.code === "23505") return res.status(409).json({ error: "Feature key already exists" });
    res.status(500).json({ error: "Failed to create feature" });
  }
});

governanceRouter.put("/features/:id", async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const { featureName, requiredRole, requiredPlan, requiredPermission, visibilityState, description } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE gov_feature_access_matrix
       SET feature_name = COALESCE($1, feature_name),
           required_role = $2,
           required_plan = $3,
           required_permission = $4,
           visibility_state = COALESCE($5, visibility_state),
           description = COALESCE($6, description),
           updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [featureName, requiredRole || null, requiredPlan || null, requiredPermission || null, visibilityState, description, id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Feature not found" });
    await auditLog("feature.updated", req.userId!, "feature", id, req.body, req.ip || "", "info");
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to update feature" });
  }
});

governanceRouter.delete("/features/:id", async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  try {
    await pool.query(`DELETE FROM gov_feature_access_matrix WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete feature" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION → FEATURE GOVERNANCE
// ═══════════════════════════════════════════════════════════════════════════

governanceRouter.get("/subscription-features", async (_req, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT sg.*, sp.name AS plan_display_name
       FROM gov_subscription_governance sg
       LEFT JOIN subscription_plans sp ON sp.id = sg.plan_id
       ORDER BY sg.plan_name, sg.feature_key`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch subscription features" });
  }
});

governanceRouter.post("/subscription-features", async (req: AuthRequest, res: Response) => {
  const { planId, planName, featureKey, accessLevel } = req.body;
  if (!featureKey) return res.status(400).json({ error: "featureKey required" });
  try {
    const { rows } = await pool.query(
      `INSERT INTO gov_subscription_governance (plan_id, plan_name, feature_key, access_level)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [planId || null, planName || null, featureKey, accessLevel || "full"]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to create subscription feature" });
  }
});

governanceRouter.put("/subscription-features/:id", async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const { accessLevel } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE gov_subscription_governance SET access_level = $1 WHERE id = $2 RETURNING *`,
      [accessLevel, id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to update" });
  }
});

governanceRouter.delete("/subscription-features/:id", async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  try {
    await pool.query(`DELETE FROM gov_subscription_governance WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AI ACCESS GOVERNANCE
// ═══════════════════════════════════════════════════════════════════════════

governanceRouter.get("/ai-access", async (_req, res: Response) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM gov_ai_access_rules ORDER BY feature_key`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch AI access rules" });
  }
});

governanceRouter.post("/ai-access", async (req: AuthRequest, res: Response) => {
  const { featureKey, featureName, requiredRole, requiredPlan, dailyLimit, monthlyLimit, enabled } = req.body;
  if (!featureKey) return res.status(400).json({ error: "featureKey required" });
  try {
    const { rows } = await pool.query(
      `INSERT INTO gov_ai_access_rules (feature_key, feature_name, required_role, required_plan, daily_limit, monthly_limit, enabled)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [featureKey, featureName || featureKey, requiredRole || null, requiredPlan || null, dailyLimit || null, monthlyLimit || null, enabled !== false]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to create AI rule" });
  }
});

governanceRouter.put("/ai-access/:id", async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const { featureName, requiredRole, requiredPlan, dailyLimit, monthlyLimit, enabled } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE gov_ai_access_rules
       SET feature_name = COALESCE($1, feature_name),
           required_role = $2, required_plan = $3,
           daily_limit = $4, monthly_limit = $5,
           enabled = COALESCE($6, enabled),
           updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [featureName, requiredRole || null, requiredPlan || null, dailyLimit || null, monthlyLimit || null, enabled, id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to update AI rule" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// COMMUNICATION PERMISSIONS
// ═══════════════════════════════════════════════════════════════════════════

governanceRouter.get("/comm-permissions", async (_req, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM gov_communication_permissions ORDER BY from_role, to_role`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch communication permissions" });
  }
});

governanceRouter.post("/comm-permissions", async (req: AuthRequest, res: Response) => {
  const { fromRole, toRole, channelType, allowed, conditions } = req.body;
  if (!fromRole || !toRole) return res.status(400).json({ error: "fromRole and toRole required" });
  try {
    const { rows } = await pool.query(
      `INSERT INTO gov_communication_permissions (from_role, to_role, channel_type, allowed, conditions)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [fromRole, toRole, channelType || "direct", allowed !== false, conditions ? JSON.stringify(conditions) : null]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to create permission" });
  }
});

governanceRouter.put("/comm-permissions/:id", async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const { allowed, channelType, conditions } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE gov_communication_permissions SET allowed=$1, channel_type=COALESCE($2,channel_type), conditions=COALESCE($3::jsonb, conditions)
       WHERE id = $4 RETURNING *`,
      [allowed, channelType, conditions ? JSON.stringify(conditions) : null, id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to update" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AUDIT ENFORCEMENT LOG
// ═══════════════════════════════════════════════════════════════════════════

governanceRouter.get("/audit", async (req, res: Response) => {
  const { eventType, severity, page = "1", limit = "100" } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    const { rows } = await pool.query(
      `SELECT ae.*,
         a.username AS actor_username, a.display_name AS actor_name
       FROM gov_audit_enforcement ae
       LEFT JOIN accounts a ON a.id = ae.user_id
       WHERE ($1::text IS NULL OR ae.event_type ILIKE $1)
         AND ($2::text IS NULL OR ae.severity = $2)
       ORDER BY ae.created_at DESC
       LIMIT $3 OFFSET $4`,
      [eventType ? `%${eventType}%` : null, severity || null, parseInt(limit), offset]
    );
    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM gov_audit_enforcement
       WHERE ($1::text IS NULL OR event_type ILIKE $1)
         AND ($2::text IS NULL OR severity = $2)`,
      [eventType ? `%${eventType}%` : null, severity || null]
    );
    res.json({ events: rows, total: countRes.rows[0].total });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch audit log" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CONFLICT MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

governanceRouter.get("/conflicts", async (req, res: Response) => {
  const { status } = req.query as Record<string, string>;
  try {
    const { rows } = await pool.query(
      `SELECT cl.*,
         a.username AS resolver_username
       FROM gov_conflict_logs cl
       LEFT JOIN accounts a ON a.id = cl.resolved_by
       WHERE ($1::text IS NULL OR cl.status = $1)
       ORDER BY cl.created_at DESC`,
      [status || null]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch conflicts" });
  }
});

governanceRouter.put("/conflicts/:id/resolve", async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const { resolution } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE gov_conflict_logs
       SET status = 'resolved', resolution = $1, resolved_by = $2, resolved_at = NOW()
       WHERE id = $3 RETURNING *`,
      [resolution || "Manually resolved", req.userId, id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Conflict not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to resolve conflict" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// INTEGRITY VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

governanceRouter.get("/integrity", async (_req, res: Response) => {
  const checks: Array<{ name: string; pass: boolean; details: string }> = [];

  async function check(name: string, query: string, params: any[], expectZero = true) {
    try {
      const { rows } = await pool.query(query, params);
      const count = parseInt(rows[0]?.count || rows[0]?.cnt || "0");
      const pass = expectZero ? count === 0 : count > 0;
      checks.push({ name, pass, details: expectZero ? `${count} violation(s)` : `${count} record(s)` });
    } catch (err: any) {
      checks.push({ name, pass: false, details: `Query error: ${err.message}` });
    }
  }

  await check("No accounts without roles", `SELECT COUNT(*)::int AS count FROM accounts WHERE role IS NULL OR role = ''`, []);
  await check("No duplicate active enrollments", `SELECT COUNT(*)::int AS count FROM (SELECT student_id, course_id FROM gov_enrollments WHERE status='active' GROUP BY student_id, course_id HAVING COUNT(*)>1) x`, []);
  await check("No orphaned enrollments", `SELECT COUNT(*)::int AS count FROM gov_enrollments ge LEFT JOIN aperti_courses ac ON ac.id=ge.course_id WHERE ac.id IS NULL AND ge.status='active'`, []);
  await check("All assistant approvals have teacher", `SELECT COUNT(*)::int AS count FROM gov_assistant_approvals ga LEFT JOIN accounts a ON a.id=ga.teacher_id WHERE a.id IS NULL`, []);
  await check("No suspended users with active sessions", `SELECT COUNT(*)::int AS count FROM device_sessions ds JOIN accounts a ON a.id=ds.user_id WHERE a.status='suspended'`, []);
  await check("Gov roles table populated", `SELECT COUNT(*)::int AS count FROM gov_roles`, [], false);
  await check("Feature matrix populated", `SELECT COUNT(*)::int AS count FROM gov_feature_access_matrix`, [], false);
  await check("No open critical conflicts", `SELECT COUNT(*)::int AS count FROM gov_conflict_logs WHERE status='open'`, []);
  await check("Audit log recording", `SELECT COUNT(*)::int AS count FROM gov_audit_enforcement`, [], false);
  await check("All courses have a teacher", `SELECT COUNT(*)::int AS count FROM aperti_courses WHERE teacher_id IS NULL`, []);

  const passed = checks.filter((c) => c.pass).length;
  const score = Math.round((passed / checks.length) * 100);
  res.json({ checks, score, passed, total: checks.length, timestamp: new Date().toISOString() });
});

// ═══════════════════════════════════════════════════════════════════════════
// STATS OVERVIEW (for governance dashboard widgets)
// ═══════════════════════════════════════════════════════════════════════════

governanceRouter.get("/stats", async (_req, res: Response) => {
  try {
    const [roles, perms, enrollments, assistants, conflicts, features] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS count FROM gov_roles`),
      pool.query(`SELECT COUNT(*)::int AS count FROM gov_permissions`),
      pool.query(`SELECT status, COUNT(*)::int AS count FROM gov_enrollments GROUP BY status`),
      pool.query(`SELECT status, COUNT(*)::int AS count FROM gov_assistant_approvals GROUP BY status`),
      pool.query(`SELECT status, COUNT(*)::int AS count FROM gov_conflict_logs GROUP BY status`),
      pool.query(`SELECT visibility_state, COUNT(*)::int AS count FROM gov_feature_access_matrix GROUP BY visibility_state`),
    ]);
    res.json({
      roles: roles.rows[0]?.count || 0,
      permissions: perms.rows[0]?.count || 0,
      enrollments: enrollments.rows,
      assistants: assistants.rows,
      conflicts: conflicts.rows,
      features: features.rows,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});
