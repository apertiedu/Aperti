import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

export async function ensurePerformanceIndexes(): Promise<void> {
  const indexes: { name: string; sql: string }[] = [
    // ── Attendance ────────────────────────────────────────────────────────────
    {
      name: "idx_attendance_student_date",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_student_date
            ON attendance (student_id, created_at DESC)`,
    },
    {
      name: "idx_attendance_session_status",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_session_status
            ON attendance (session_id, status)`,
    },
    {
      name: "idx_attendance_teacher_date",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_teacher_date
            ON attendance (teacher_account_id, created_at DESC)`,
    },
    // ── Student marks ─────────────────────────────────────────────────────────
    {
      name: "idx_student_marks_student_exam",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_student_marks_student_exam
            ON student_marks (student_id, exam_id)`,
    },
    {
      name: "idx_student_marks_created",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_student_marks_created
            ON student_marks (created_at DESC)`,
    },
    {
      name: "idx_student_marks_grading_status",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_student_marks_grading_status
            ON student_marks (grading_status) WHERE grading_status != 'approved'`,
    },
    // ── Homework submissions ──────────────────────────────────────────────────
    {
      name: "idx_hw_submissions_student_hw",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hw_submissions_student_hw
            ON homework_submissions (student_id, homework_id)`,
    },
    {
      name: "idx_hw_submissions_status",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hw_submissions_status
            ON homework_submissions (grading_status, submitted_at DESC)`,
    },
    // ── Students ──────────────────────────────────────────────────────────────
    {
      name: "idx_students_teacher_status",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_teacher_status
            ON students (teacher_account_id, status)`,
    },
    {
      name: "idx_students_account",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_account
            ON students (account_id)`,
    },
    // ── Exams ─────────────────────────────────────────────────────────────────
    {
      name: "idx_exams_teacher_date",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_exams_teacher_date
            ON exams (teacher_account_id, exam_date DESC)`,
    },
    {
      name: "idx_exams_status_date",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_exams_status_date
            ON exams (status, exam_date)`,
    },
    // ── Accounts ──────────────────────────────────────────────────────────────
    {
      name: "idx_accounts_username_lower",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounts_username_lower
            ON accounts (LOWER(username))`,
    },
    {
      name: "idx_accounts_role_status",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounts_role_status
            ON accounts (role, status)`,
    },
    {
      name: "idx_accounts_email_lower",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounts_email_lower
            ON accounts (LOWER(email)) WHERE email IS NOT NULL`,
    },
    // ── Audit & activity logs ─────────────────────────────────────────────────
    {
      name: "idx_audit_logs_account_created",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_account_created
            ON audit_logs (account_id, created_at DESC)`,
    },
    {
      name: "idx_audit_logs_action_severity",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_action_severity
            ON audit_logs (action, severity, created_at DESC)`,
    },
    {
      name: "idx_audit_logs_teacher_created",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_teacher_created
            ON audit_logs (teacher_id, created_at DESC)`,
    },
    // ── Upload registry ───────────────────────────────────────────────────────
    {
      name: "idx_upload_registry_uploader",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_upload_registry_uploader
            ON upload_registry (uploader_id, uploaded_at DESC)`,
    },
    {
      name: "idx_upload_registry_tenant",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_upload_registry_tenant
            ON upload_registry (tenant_id)`,
    },
    // ── Flashcard spaced repetition ───────────────────────────────────────────
    {
      name: "idx_flashcard_progress_review",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_flashcard_progress_review
            ON flashcard_progress (student_id, next_review_at ASC)`,
    },
    // ── Subscriptions ─────────────────────────────────────────────────────────
    {
      name: "idx_subscriptions_account_status",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_account_status
            ON subscriptions (account_id, status)`,
    },
    {
      name: "idx_subscriptions_expires",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_expires
            ON subscriptions (end_date) WHERE status = 'active'`,
    },
    // ── Notifications ─────────────────────────────────────────────────────────
    {
      name: "idx_notifications_recipient_read",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_recipient_read
            ON notifications (recipient_id, read_at) WHERE read_at IS NULL`,
    },
    // ── API metrics (cleanup) ─────────────────────────────────────────────────
    {
      name: "idx_api_metrics_recorded",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_metrics_recorded
            ON api_metrics (recorded_at DESC)`,
    },
    // ── Sessions ──────────────────────────────────────────────────────────────
    {
      name: "idx_sessions_subject_day",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_subject_day
            ON sessions (subject_id, day_of_week)`,
    },
  ];

  let created = 0;
  let skipped = 0;
  let errors = 0;
  const errorDetails: string[] = [];

  for (const idx of indexes) {
    try {
      await pool.query(idx.sql);
      created++;
    } catch (err: any) {
      if (err?.message?.includes("already exists") || err?.code === "42P07") {
        skipped++;
      } else {
        errors++;
        errorDetails.push(`${idx.name}: ${err?.message ?? "unknown"}`);
      }
    }
  }

  logger.info({ created, skipped, errors }, "[db-indexes] Performance indexes ensured");
  if (errorDetails.length > 0) {
    logger.debug({ errorDetails }, "[db-indexes] Skipped indexes (table may not exist yet)");
  }
}
