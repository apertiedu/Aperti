/**
 * Unified Authorization Framework — Aperti V2
 *
 * A single, composable API for all permission decisions across the platform.
 * Combines role-based, ownership-based, and tenant-aware checks in one place.
 *
 * Usage:
 *   const ok = await canAccess(req, "exam", examRow);
 *   const ok = await canGrade(req, homeworkRow);
 */

import { pool } from "@workspace/db";
import { hasPermission, DEFAULT_PERMISSIONS, type Role, type Permission } from "../config/permissions";

export interface AuthContext {
  userId?: number;
  role?: string;
}

export type ResourceType =
  | "exam" | "homework" | "student" | "grade" | "report"
  | "upload" | "course" | "attendance" | "enrollment" | "analytics"
  | "subscription" | "payment" | "audit" | "user" | "setting";

export interface ResourceRecord {
  teacher_account_id?: number;
  uploader_id?: number;
  tenant_id?: number;
  student_account_id?: number;
  account_id?: number;
  created_by?: number;
  owner_id?: number;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function isAdmin(ctx: AuthContext): boolean {
  return ctx.role === "admin" || ctx.role === "super_admin";
}

function isSameUser(ctx: AuthContext, ownerId?: number): boolean {
  return !!ctx.userId && ctx.userId === ownerId;
}

function resourceOwner(resource: ResourceRecord): number | undefined {
  return resource.teacher_account_id
    ?? resource.uploader_id
    ?? resource.created_by
    ?? resource.owner_id;
}

async function isSameTenant(ctx: AuthContext, resource: ResourceRecord): Promise<boolean> {
  if (!ctx.userId || !resource.tenant_id) return false;
  // Allow if the requesting user belongs to the same teacher/tenant
  const { rows } = await pool.query(
    `SELECT 1
     FROM accounts WHERE id=$1 AND teacher_account_id=$2
     UNION ALL
     SELECT 1 FROM students WHERE account_id=$1 AND teacher_account_id=$2
     LIMIT 1`,
    [ctx.userId, resource.tenant_id],
  );
  return rows.length > 0;
}

async function roleHasPermission(ctx: AuthContext, permission: Permission): Promise<boolean> {
  const role = ctx.role as Role | undefined;
  if (!role || !DEFAULT_PERMISSIONS[role]) return false;
  return hasPermission(role, permission);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * canAccess — read/view permission.
 * Admins always pass. Owners pass. Same-tenant members pass for shared resources.
 */
export async function canAccess(
  ctx: AuthContext,
  resourceType: ResourceType,
  resource?: ResourceRecord,
): Promise<boolean> {
  if (isAdmin(ctx)) return true;

  const permMap: Partial<Record<ResourceType, Permission>> = {
    exam: "exams:view",
    homework: "homework:view",
    student: "students:view",
    grade: "grades:view",
    report: "reports:view",
    upload: "courses:view",
    course: "courses:view",
    attendance: "attendance:view",
    enrollment: "students:view",
    analytics: "analytics:view",
    subscription: "payments:view",
    payment: "payments:view",
    audit: "audit:view",
    user: "users:view",
    setting: "settings:view",
  };

  const perm = permMap[resourceType];
  if (perm && !(await roleHasPermission(ctx, perm))) return false;

  if (!resource) return true;

  // Students can only access their own resources
  if (ctx.role === "student") {
    return isSameUser(ctx, resource.student_account_id ?? resource.account_id);
  }

  // Parents can only access children's resources
  if (ctx.role === "parent") {
    if (!ctx.userId || !resource.student_account_id) return false;
    const { rows } = await pool.query(
      `SELECT 1 FROM students WHERE account_id=$1 AND parent_account_id=$2 LIMIT 1`,
      [resource.student_account_id, ctx.userId],
    );
    return rows.length > 0;
  }

  const owner = resourceOwner(resource);
  if (isSameUser(ctx, owner)) return true;
  if (await isSameTenant(ctx, resource)) return true;

  return false;
}

/**
 * canModify — write/edit permission.
 * Stricter than canAccess: ownership required for non-admins.
 */
export async function canModify(
  ctx: AuthContext,
  resourceType: ResourceType,
  resource?: ResourceRecord,
): Promise<boolean> {
  if (isAdmin(ctx)) return true;

  const permMap: Partial<Record<ResourceType, Permission>> = {
    exam: "exams:manage",
    homework: "homework:manage",
    student: "students:manage",
    grade: "grades:manage",
    course: "courses:manage",
    attendance: "attendance:manage",
    subscription: "payments:manage",
    payment: "payments:manage",
    setting: "settings:manage",
    user: "users:edit",
  };

  const perm = permMap[resourceType];
  if (perm && !(await roleHasPermission(ctx, perm))) return false;
  if (!resource) return true;

  const owner = resourceOwner(resource);
  return isSameUser(ctx, owner);
}

/**
 * canDelete — destructive delete permission.
 * Only admins or the direct owner.
 */
export async function canDelete(
  ctx: AuthContext,
  resourceType: ResourceType,
  resource?: ResourceRecord,
): Promise<boolean> {
  if (isAdmin(ctx)) return true;

  const permMap: Partial<Record<ResourceType, Permission>> = {
    course: "courses:delete",
    user: "users:delete",
    exam: "exams:manage",
    homework: "homework:manage",
  };

  const perm = permMap[resourceType];
  if (perm && !(await roleHasPermission(ctx, perm))) return false;
  if (!resource) return false;

  return isSameUser(ctx, resourceOwner(resource));
}

/**
 * canExport — export/download permission.
 * Teachers can export their own data; admins can export everything.
 */
export async function canExport(
  ctx: AuthContext,
  resourceType: ResourceType,
  resource?: ResourceRecord,
): Promise<boolean> {
  if (isAdmin(ctx)) return true;

  const permMap: Partial<Record<ResourceType, Permission>> = {
    student: "students:export",
    grade: "grades:export",
    attendance: "attendance:export",
    analytics: "analytics:export",
    audit: "audit:export",
    user: "users:export",
  };

  const perm = permMap[resourceType];
  if (perm && !(await roleHasPermission(ctx, perm))) return false;
  if (!resource) return true;

  return isSameUser(ctx, resourceOwner(resource));
}

/**
 * canGrade — grading permission.
 * Teachers can grade their own assessments; assistants need the can_grade_exams permission.
 */
export async function canGrade(
  ctx: AuthContext,
  resourceType: "exam" | "homework",
  resource?: ResourceRecord,
): Promise<boolean> {
  if (isAdmin(ctx)) return true;

  const perm: Permission = resourceType === "exam" ? "exams:grade" : "homework:grade";
  if (!(await roleHasPermission(ctx, perm))) return false;
  if (!resource) return true;

  if (ctx.role === "assistant") {
    if (!ctx.userId) return false;
    const { rows } = await pool.query(
      `SELECT 1 FROM assistant_permissions
       WHERE assistant_account_id=$1 AND can_grade_exams=true LIMIT 1`,
      [ctx.userId],
    );
    return rows.length > 0;
  }

  const owner = resourceOwner(resource);
  return isSameUser(ctx, owner);
}

// ── Permission Matrix export (for reporting) ─────────────────────────────────

export const PERMISSION_MATRIX = {
  super_admin: { access: true,  modify: true,  delete: true,  export: true,  grade: true  },
  admin:       { access: true,  modify: true,  delete: true,  export: true,  grade: true  },
  teacher:     { access: "own", modify: "own", delete: "own", export: "own", grade: "own" },
  assistant:   { access: "tenant", modify: false, delete: false, export: false, grade: "if_permitted" },
  student:     { access: "self",   modify: false, delete: false, export: false, grade: false },
  parent:      { access: "child",  modify: false, delete: false, export: false, grade: false },
} as const;
