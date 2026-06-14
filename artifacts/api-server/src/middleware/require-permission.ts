/**
 * requirePermission middleware — Aperti V2
 *
 * Usage: router.get("/endpoint", authenticate, requirePermission("grades:view"), handler)
 *
 * Checks role against config/permissions.ts DEFAULT_PERMISSIONS.
 * DB overrides (role_permissions table) are checked if populated.
 * Falls back to config defaults if DB is unreachable.
 */
import { Request, Response, NextFunction } from "express";
import { hasPermission, type Permission, type Role } from "../config/permissions";

const overrideCache = new Map<string, { value: boolean; expires: number }>();
const CACHE_TTL = 60_000;

async function getOverride(role: string, permission: string): Promise<boolean | null> {
  const cacheKey = `${role}:${permission}`;
  const cached = overrideCache.get(cacheKey);
  if (cached && Date.now() < cached.expires) return cached.value;

  try {
    const { pool } = await import("@workspace/db");
    const { rows } = await pool.query(
      `SELECT granted FROM role_permissions WHERE role = $1 AND permission = $2 LIMIT 1`,
      [role, permission],
    );
    if (rows.length > 0) {
      const value = rows[0].granted as boolean;
      overrideCache.set(cacheKey, { value, expires: Date.now() + CACHE_TTL });
      return value;
    }
  } catch {
    // DB unreachable — fall through to defaults
  }
  return null;
}

export function requirePermission(permission: Permission) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).userId;
    const role = (req as any).userRole as Role | undefined;

    if (!userId || !role) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const override = await getOverride(role, permission);
    const granted = override !== null
      ? override
      : hasPermission(role, permission);

    if (!granted) {
      return res.status(403).json({
        error: `Access denied — your role (${role}) does not have the '${permission}' permission.`,
        permission,
        role,
      });
    }
    next();
  };
}

export function clearPermissionCache() {
  overrideCache.clear();
}
