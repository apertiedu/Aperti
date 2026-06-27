/**
 * Role & Permission Matrix — Aperti V2
 *
 * Provides the backend for the visual permission matrix editor.
 * Reads DEFAULT_PERMISSIONS from config/permissions.ts and layers
 * DB overrides (role_permissions table) on top.
 *
 * Routes:
 *   GET  /api/admin/roles                    — list roles with descriptions
 *   GET  /api/admin/roles/permissions         — permission module map
 *   GET  /api/admin/roles/matrix             — full matrix (role × permission × granted)
 *   PUT  /api/admin/roles/matrix             — toggle a single permission for a role
 *   POST /api/admin/roles/matrix/reset       — reset a role to default permissions
 */
import { Router, Request, Response } from "express";
import { audit } from "../lib/audit";
import { requireRole } from "../middleware/auth";
import { DEFAULT_PERMISSIONS, PERMISSION_MODULES, hasPermission, type Role, type Permission } from "../config/permissions";
import { pool } from "@workspace/db";
import { clearPermissionCache } from "../middleware/require-permission";

export const adminRolesRouter = Router();
adminRolesRouter.use(requireRole("admin", "super_admin"));

const ROLES: { id: Role; name: string; description: string; color: string }[] = [
  { id: "admin",     name: "Admin",     description: "Full platform access", color: "#DC2626" },
  { id: "teacher",   name: "Teacher",   description: "Manage own classes, students, content", color: "#0D9488" },
  { id: "assistant", name: "Assistant", description: "Limited teaching capabilities", color: "#7C3AED" },
  { id: "student",   name: "Student",   description: "Access learning content", color: "#2563EB" },
  { id: "parent",    name: "Parent",    description: "Monitor child progress", color: "#D97706" },
];

// ── GET /api/admin/roles ──────────────────────────────────────────────────────
adminRolesRouter.get("/", (_req: Request, res: Response) => {
  res.json(ROLES);
});

// ── GET /api/admin/roles/permissions ─────────────────────────────────────────
adminRolesRouter.get("/permissions", (_req: Request, res: Response) => {
  res.json(PERMISSION_MODULES);
});

// ── GET /api/admin/roles/matrix ───────────────────────────────────────────────
adminRolesRouter.get("/matrix", async (_req: Request, res: Response) => {
  try {
    const { rows: overrides } = await pool.query(
      `SELECT role, permission, granted FROM role_permissions`
    );
    const overrideMap: Record<string, boolean> = {};
    for (const row of overrides) {
      overrideMap[`${row.role}:${row.permission}`] = row.granted;
    }

    const matrix: Record<string, Record<string, boolean>> = {};
    for (const role of ROLES) {
      matrix[role.id] = {};
      for (const perms of Object.values(PERMISSION_MODULES)) {
        for (const perm of perms) {
          const key = `${role.id}:${perm}`;
          if (key in overrideMap) {
            matrix[role.id][perm] = overrideMap[key];
          } else {
            matrix[role.id][perm] = hasPermission(role.id, perm as Permission);
          }
        }
      }
    }

    res.json({ roles: ROLES, modules: PERMISSION_MODULES, matrix, overrideCount: overrides.length });
  } catch (err: any) {
    console.error("matrix fetch error:", err);
    const matrix: Record<string, Record<string, boolean>> = {};
    for (const role of ROLES) {
      matrix[role.id] = {};
      for (const perms of Object.values(PERMISSION_MODULES)) {
        for (const perm of perms) {
          matrix[role.id][perm] = hasPermission(role.id, perm as Permission);
        }
      }
    }
    res.json({ roles: ROLES, modules: PERMISSION_MODULES, matrix, overrideCount: 0, dbError: true });
  }
});

// ── PUT /api/admin/roles/matrix ───────────────────────────────────────────────
adminRolesRouter.put("/matrix", async (req: Request, res: Response) => {
  const { role, permission, granted } = req.body;
  if (!role || !permission || typeof granted !== "boolean") {
    return res.status(400).json({ error: "role, permission (string), and granted (boolean) are required" });
  }
  if (!ROLES.find(r => r.id === role)) {
    return res.status(400).json({ error: "Invalid role" });
  }
  try {
    await pool.query(
      `INSERT INTO role_permissions (role, permission, granted, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (role, permission) DO UPDATE SET granted = $3, updated_at = NOW()`,
      [role, permission, granted]
    );
    clearPermissionCache();
    const actor = (req as any);
    audit({ actorId: actor.userId ?? 0, actorRole: actor.role ?? "admin", action: "ROLE_CHANGE", resource: "role_permissions", metadata: { role, permission, granted } }).catch(() => {});
    res.json({ ok: true, role, permission, granted });
  } catch (err: any) {
    console.error("matrix update error:", err);
    res.status(500).json({ error: "Failed to update permission" });
  }
});

// ── POST /api/admin/roles/matrix/reset ────────────────────────────────────────
adminRolesRouter.post("/matrix/reset", async (req: Request, res: Response) => {
  const { role } = req.body;
  if (!role) return res.status(400).json({ error: "role is required" });
  try {
    await pool.query(`DELETE FROM role_permissions WHERE role = $1`, [role]);
    clearPermissionCache();
    res.json({ ok: true, message: `Permissions for role '${role}' reset to defaults` });
  } catch (err: any) {
    console.error("matrix reset error:", err);
    res.status(500).json({ error: "Failed to reset permissions" });
  }
});
