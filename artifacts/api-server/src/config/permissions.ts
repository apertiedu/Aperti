/**
 * Central Permission Policy — Aperti V2
 *
 * This is the single source of truth for role-based access control.
 * Backend middleware imports from here. Frontend uses it to conditionally
 * render UI elements. Admin can override via the role_permissions DB table.
 */

export type Role = "admin" | "super_admin" | "teacher" | "assistant" | "student" | "parent";

export type Permission =
  | "*"
  | "users:view" | "users:create" | "users:edit" | "users:delete" | "users:suspend" | "users:export"
  | "courses:view" | "courses:create" | "courses:manage" | "courses:publish" | "courses:delete"
  | "students:view" | "students:create" | "students:manage" | "students:export"
  | "attendance:view" | "attendance:manage" | "attendance:export"
  | "homework:view" | "homework:create" | "homework:manage" | "homework:grade" | "homework:submit"
  | "exams:view" | "exams:create" | "exams:manage" | "exams:take" | "exams:grade"
  | "grades:view" | "grades:manage" | "grades:export"
  | "analytics:view" | "analytics:export" | "analytics:advanced"
  | "payments:view" | "payments:verify" | "payments:manage"
  | "ai:use" | "ai:manage" | "ai:disable"
  | "settings:view" | "settings:manage"
  | "audit:view" | "audit:export"
  | "children:view" | "reports:view"
  | "features:manage" | "roles:manage";

export const DEFAULT_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: ["*"],
  admin: [
    "users:view", "users:create", "users:edit", "users:delete", "users:suspend", "users:export",
    "courses:view", "courses:create", "courses:manage", "courses:publish", "courses:delete",
    "students:view", "students:create", "students:manage", "students:export",
    "attendance:view", "attendance:manage", "attendance:export",
    "homework:view", "homework:create", "homework:manage", "homework:grade",
    "exams:view", "exams:create", "exams:manage", "exams:grade",
    "grades:view", "grades:manage", "grades:export",
    "analytics:view", "analytics:export", "analytics:advanced",
    "payments:view", "payments:verify", "payments:manage",
    "ai:use", "ai:manage", "ai:disable",
    "settings:view", "settings:manage",
    "audit:view", "audit:export",
    "features:manage", "roles:manage",
  ],
  teacher: [
    "courses:view", "courses:create", "courses:manage", "courses:publish",
    "students:view", "students:manage",
    "attendance:view", "attendance:manage",
    "homework:view", "homework:create", "homework:manage", "homework:grade",
    "exams:view", "exams:create", "exams:manage", "exams:grade",
    "grades:view", "grades:manage",
    "analytics:view",
    "ai:use",
    "settings:view",
  ],
  assistant: [
    "students:view",
    "attendance:view", "attendance:manage",
    "homework:view", "homework:grade",
    "exams:view", "exams:grade",
    "grades:view",
    "ai:use",
  ],
  student: [
    "courses:view",
    "homework:view", "homework:submit",
    "exams:view", "exams:take",
    "grades:view",
    "ai:use",
  ],
  parent: [
    "children:view",
    "attendance:view",
    "grades:view",
    "reports:view",
  ],
};

export const PERMISSION_MODULES: Record<string, Permission[]> = {
  Users: ["users:view", "users:create", "users:edit", "users:delete", "users:suspend"],
  Courses: ["courses:view", "courses:create", "courses:manage", "courses:publish", "courses:delete"],
  Students: ["students:view", "students:create", "students:manage", "students:export"],
  Attendance: ["attendance:view", "attendance:manage", "attendance:export"],
  Homework: ["homework:view", "homework:create", "homework:manage", "homework:grade", "homework:submit"],
  Exams: ["exams:view", "exams:create", "exams:manage", "exams:take", "exams:grade"],
  Grades: ["grades:view", "grades:manage", "grades:export"],
  Analytics: ["analytics:view", "analytics:export", "analytics:advanced"],
  Payments: ["payments:view", "payments:verify", "payments:manage"],
  AI: ["ai:use", "ai:manage", "ai:disable"],
  Settings: ["settings:view", "settings:manage"],
  Audit: ["audit:view", "audit:export"],
  Admin: ["features:manage", "roles:manage"],
};

export function hasPermission(
  role: Role,
  permission: Permission,
  overrides?: Record<string, boolean>,
): boolean {
  if (role === "super_admin") return true;
  const key = `${role}:${permission}`;
  if (overrides && key in overrides) return overrides[key];
  const perms = DEFAULT_PERMISSIONS[role] ?? [];
  return perms.includes("*") || perms.includes(permission);
}
