/**
 * Centralized Audit Logger — Aperti V2
 *
 * Single entry point for all security-sensitive audit events.
 * Writes to both audit_logs (security events) and activity_logs (behavioral).
 *
 * Sensitive actions audited:
 *   - Grade changes
 *   - Report exports
 *   - Student profile access
 *   - File downloads
 *   - Enrollment actions
 *   - Admin actions
 *   - Permission changes
 *   - Authentication events
 */

import { pool } from "@workspace/db";
import { Request } from "express";
import { dispatchAlert } from "./alert-dispatch";

export type AuditAction =
  // Authentication
  | "AUTH_LOGIN" | "AUTH_LOGOUT" | "AUTH_FAILED" | "AUTH_MFA_SUCCESS" | "AUTH_MFA_FAILED"
  | "AUTH_PASSWORD_CHANGE" | "AUTH_TOKEN_REFRESH"
  // Grade events
  | "GRADE_CREATE" | "GRADE_UPDATE" | "GRADE_DELETE" | "GRADE_APPROVE" | "GRADE_REJECT"
  // Student events
  | "STUDENT_VIEW" | "STUDENT_CREATE" | "STUDENT_UPDATE" | "STUDENT_SUSPEND" | "STUDENT_DELETE"
  // Enrollment events
  | "ENROLL_CREATE" | "ENROLL_UPDATE" | "ENROLL_CANCEL" | "ENROLL_APPROVE" | "ENROLL_REJECT"
  // File events
  | "FILE_UPLOAD" | "FILE_DOWNLOAD" | "FILE_DELETE" | "FILE_ACCESS_DENIED"
  // Export events
  | "EXPORT_GRADES" | "EXPORT_ATTENDANCE" | "EXPORT_STUDENTS" | "EXPORT_ANALYTICS" | "EXPORT_AUDIT"
  | "EXPORT_REPORT"
  // Admin actions
  | "ADMIN_USER_CREATE" | "ADMIN_USER_EDIT" | "ADMIN_USER_SUSPEND" | "ADMIN_USER_DELETE"
  | "ADMIN_IMPERSONATE" | "ADMIN_SETTING_CHANGE" | "ADMIN_PLAN_CHANGE"
  // Permission events
  | "PERMISSION_GRANT" | "PERMISSION_REVOKE" | "ROLE_CHANGE"
  // Attendance
  | "ATTENDANCE_MARK" | "ATTENDANCE_UPDATE" | "ATTENDANCE_BULK"
  // Payment/billing
  | "PAYMENT_VERIFY" | "PAYMENT_REFUND" | "SUBSCRIPTION_CREATE" | "SUBSCRIPTION_CANCEL"
  // AI
  | "AI_REQUEST" | "AI_COST_EXCEEDED"
  // Homework
  | "HOMEWORK_CREATE" | "HOMEWORK_SUBMIT"
  // Curriculum
  | "LESSON_CREATE" | "COURSE_CREATE"
  // Assessment
  | "EXAM_CREATE" | "QUESTION_CREATE"
  // Parent-student linking
  | "PARENT_LINK_CREATE" | "PARENT_LINK_APPROVE";

export type AuditSeverity = "info" | "warn" | "critical";

export interface AuditEntry {
  actorId: number;
  actorRole: string;
  action: AuditAction;
  resource: string;
  resourceId?: number | string;
  tenantId?: number;
  ip?: string;
  userAgent?: string;
  result?: "success" | "blocked" | "error";
  metadata?: Record<string, unknown>;
  severity?: AuditSeverity;
}

function severityFor(action: AuditAction): AuditSeverity {
  const critical: AuditAction[] = [
    "AUTH_FAILED", "AUTH_MFA_FAILED", "FILE_ACCESS_DENIED",
    "ADMIN_IMPERSONATE", "ADMIN_USER_DELETE", "PERMISSION_GRANT",
    "PERMISSION_REVOKE", "ROLE_CHANGE",
  ];
  const warn: AuditAction[] = [
    "ADMIN_USER_SUSPEND", "ADMIN_SETTING_CHANGE", "GRADE_DELETE",
    "STUDENT_SUSPEND", "ENROLL_CANCEL", "PAYMENT_REFUND",
    "SUBSCRIPTION_CANCEL", "EXPORT_AUDIT",
  ];
  if (critical.includes(action)) return "critical";
  if (warn.includes(action)) return "warn";
  return "info";
}

/**
 * Primary audit logging function. Fire-and-forget — never throws.
 */
export async function audit(entry: AuditEntry): Promise<void> {
  const severity = entry.severity ?? severityFor(entry.action);
  try {
    await pool.query(
      `INSERT INTO audit_logs
         (account_id, teacher_id, action, resource, resource_id, details, ip_address, user_agent, severity, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
      [
        entry.actorId,
        entry.tenantId ?? null,
        entry.action,
        entry.resource,
        typeof entry.resourceId === "number" ? entry.resourceId : null,
        JSON.stringify({
          result: entry.result ?? "success",
          actorRole: entry.actorRole,
          resourceId: entry.resourceId,
          ...entry.metadata,
        }),
        entry.ip ?? null,
        entry.userAgent ?? null,
        severity,
      ],
    );
  } catch {
    // Audit logging must never crash the application
  }

  // Fire-and-forget alert for critical events
  if (severity === "critical") {
    dispatchAlert({
      type: entry.action,
      severity: "critical",
      message: `[${entry.action}] actor=${entry.actorId}(${entry.actorRole}) resource=${entry.resource}${entry.resourceId ? `/${entry.resourceId}` : ""} result=${entry.result ?? "success"}`,
      meta: {
        actorId: String(entry.actorId),
        actorRole: entry.actorRole,
        ip: entry.ip ?? "unknown",
        resource: entry.resource,
        resourceId: String(entry.resourceId ?? ""),
      },
    }).catch(() => {});
  }
}

/**
 * Extract client IP from request (handles proxy headers).
 */
export function getIp(req: Request): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    (req.headers["x-real-ip"] as string) ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

/**
 * Extract user agent.
 */
export function getUa(req: Request): string {
  return (req.headers["user-agent"] as string) || "unknown";
}

/**
 * Audit helper for Express routes — pulls actor info automatically.
 */
export function auditFromReq(
  req: any,
  action: AuditAction,
  resource: string,
  opts: Partial<Omit<AuditEntry, "actorId" | "actorRole" | "action" | "resource">> = {},
): void {
  audit({
    actorId: req.userId ?? 0,
    actorRole: req.role ?? "unknown",
    action,
    resource,
    ip: getIp(req),
    userAgent: getUa(req),
    ...opts,
  }).catch(() => {});
}
