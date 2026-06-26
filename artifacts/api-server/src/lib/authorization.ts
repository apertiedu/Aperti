/**
 * Unified Authorization Framework — Aperti V2
 *
 * A single, composable API for all permission decisions across the platform.
 * Combines role-based, ownership-based, and tenant-aware checks in one place.
 *
 * Usage:
 *   const ok = await canAccess(req, "exam", examRow);
 *   const ok = await canGrade(req, homeworkRow);
 *   const ok = await canModerate(req, submissionRow);
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
  | "subscription" | "payment" | "audit" | "user" | "setting"
  | "assessment" | "submission";

export interface ResourceRecord {
  teacher_account_id?: number;
  uploader_id?: number;
  tenant_id?: number;
  student_account_id?: number;
  account_id?: number;
  created_by?: number;
  owner_id?: number;
  /** For assessment submissions: the teacher who owns the assessment */
  assessment_teacher_id?: number;
  /** The tenant root of the assessment's teacher */
  assessment_teacher_tenant?: number | null;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function isAdmin(ctx: AuthContext): boolean {
  return ctx.role === "admin" || ctx.role === "super_admin";
}

function isSuperAdmin(ctx: AuthContext): boolean {
  return ctx.role === "super_admin";
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

async function getActorTenantId(ctx: AuthContext): Promise<number | null> {
  if (!ctx.userId) return null;
  const { rows } = await pool.query(
    "SELECT teacher_account_id FROM accounts WHERE id=$1 LIMIT 1",
    [ctx.userId],
  );
  return rows[0]?.teacher_account_id ?? null;
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
    assessment: "exams:view",
    submission: "exams:view",
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
    assessment: "exams:manage",
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
    assessment: "exams:manage",
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
  resourceType: "exam" | "homework" | "assessment",
  resource?: ResourceRecord,
): Promise<boolean> {
  if (isAdmin(ctx)) return true;

  const perm: Permission = resourceType === "homework" ? "homework:grade" : "exams:grade";
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

/**
 * canModerate — moderation permission for assessment submissions.
 *
 * Rules:
 *   - super_admin: always allowed.
 *   - admin (scoped): may moderate within their own tenant only.
 *   - teacher: may moderate only their own assessments.
 *   - assistant / student / parent: never.
 *
 * The resource record must include `assessment_teacher_id` (who owns the
 * assessment) and `assessment_teacher_tenant` (that teacher's tenant root).
 */
export async function canModerate(
  ctx: AuthContext,
  resource: ResourceRecord,
): Promise<boolean> {
  if (!ctx.userId) return false;

  // super_admin always passes
  if (isSuperAdmin(ctx)) return true;

  // Only teachers and admins can moderate
  if (ctx.role !== "teacher" && ctx.role !== "admin") return false;

  if (ctx.role === "teacher") {
    // Teacher must own the assessment
    return ctx.userId === resource.assessment_teacher_id;
  }

  // Admin (scoped) — must be in the same tenant
  const actorTenant = await getActorTenantId(ctx);
  const resourceTenant = resource.assessment_teacher_tenant;

  // Platform-level admins (no tenant) can moderate anything
  if (actorTenant === null) return true;

  // Scoped admins can only moderate within their tenant
  return actorTenant === resourceTenant;
}

// ── Permission Matrix export (for reporting) ─────────────────────────────────

export const PERMISSION_MATRIX = {
  super_admin: { access: true,  modify: true,  delete: true,  export: true,  grade: true,  moderate: true  },
  admin:       { access: true,  modify: true,  delete: true,  export: true,  grade: true,  moderate: "same_tenant" },
  teacher:     { access: "own", modify: "own", delete: "own", export: "own", grade: "own", moderate: "own" },
  assistant:   { access: "tenant", modify: false, delete: false, export: false, grade: "if_permitted", moderate: false },
  student:     { access: "self",   modify: false, delete: false, export: false, grade: false, moderate: false },
  parent:      { access: "child",  modify: false, delete: false, export: false, grade: false, moderate: false },
} as const;
