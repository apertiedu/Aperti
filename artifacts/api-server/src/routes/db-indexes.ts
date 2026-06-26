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
    // NEW: composite for attendance-rate aggregations (student_id + status — avoids seqscan)
    {
      name: "idx_attendance_student_status",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_student_status
            ON attendance (student_id, status)`,
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
    // NEW: covering index for gradebook SUM query — exam_id + marks_scored inline
    {
      name: "idx_student_marks_exam_scored",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_student_marks_exam_scored
            ON student_marks (exam_id, student_id) INCLUDE (marks_scored)`,
    },

    // ── Exam questions ────────────────────────────────────────────────────────
    // NEW: covering index for CTE exam_totals — avoids full table scan on question_bank join
    {
      name: "idx_exam_questions_exam_max",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_exam_questions_exam_max
            ON exam_questions (exam_id) INCLUDE (max_marks)`,
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
    // NEW: covering index for sorted student listing (teacher + status + name)
    {
      name: "idx_students_teacher_status_name",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_teacher_status_name
            ON students (teacher_account_id, status, student_name)`,
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
    // NEW: composite for subject-filtered gradebook exam query
    {
      name: "idx_exams_teacher_subject",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_exams_teacher_subject
            ON exams (teacher_account_id, subject_id, exam_date DESC)`,
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
    // NEW: for teacher_account_id lookups on accounts (joins from students/lessons)
    {
      name: "idx_accounts_teacher_status",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounts_teacher_status
            ON accounts (role, status) WHERE role IN ('teacher','admin','assistant')`,
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
    // NEW: for severity-only security dashboards
    {
      name: "idx_audit_logs_severity_created",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_severity_created
            ON audit_logs (severity, created_at DESC) WHERE severity IN ('critical','warn')`,
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
    // NEW: for expiry-check cron (status + end_date together)
    {
      name: "idx_subscriptions_status_end_date",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_status_end_date
            ON subscriptions (status, end_date) WHERE status IN ('active','grace_period','pending_renewal')`,
    },

    // ── Notifications ─────────────────────────────────────────────────────────
    {
      name: "idx_notifications_recipient_read",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_recipient_read
            ON notifications (recipient_id, read_at) WHERE read_at IS NULL`,
    },

    // ── API metrics ───────────────────────────────────────────────────────────
    {
      name: "idx_api_metrics_recorded",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_metrics_recorded
            ON api_metrics (recorded_at DESC)`,
    },
    // NEW: for slow-endpoint dashboards (endpoint + duration_ms)
    {
      name: "idx_api_metrics_endpoint_duration",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_metrics_endpoint_duration
            ON api_metrics (endpoint, duration_ms DESC, recorded_at DESC)`,
    },

    // ── Sessions / lessons ────────────────────────────────────────────────────
    {
      name: "idx_sessions_subject_day",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_subject_day
            ON sessions (subject_id, day_of_week)`,
    },

    // ── Payment transactions ──────────────────────────────────────────────────
    // NEW: for payment history queries (user_id + status + created_at)
    {
      name: "idx_payment_transactions_user_status",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_transactions_user_status
            ON payment_transactions (user_id, status, created_at DESC)`,
    },
    // NEW: for subscription-scoped payment lookups
    {
      name: "idx_payment_transactions_subscription",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_transactions_subscription
            ON payment_transactions (subscription_id, status, created_at DESC)`,
    },

    // ── Error logs ────────────────────────────────────────────────────────────
    // NEW: for error intelligence dashboards
    {
      name: "idx_error_logs_level_created",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_error_logs_level_created
            ON error_logs (level, created_at DESC)`,
    },

    // ── AI interactions ───────────────────────────────────────────────────────
    // NEW: for per-user AI usage analytics
    {
      name: "idx_ai_interactions_user_created",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_interactions_user_created
            ON ai_interactions (user_id, created_at DESC)`,
    },
    // NEW: for module-level AI cost aggregations
    {
      name: "idx_ai_interactions_module_created",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_interactions_module_created
            ON ai_interactions (module, created_at DESC) INCLUDE (tokens_used)`,
    },

    // ── Question bank ─────────────────────────────────────────────────────────
    // NEW: for subject+difficulty filtering in content validation
    {
      name: "idx_question_bank_subject_difficulty",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_question_bank_subject_difficulty
            ON question_bank (subject_id, difficulty)`,
    },

    // ── Assessment submissions ────────────────────────────────────────────────
    // Covers student-scoped submission lookups (student portal, grading queue)
    {
      name: "idx_assessment_submissions_student_assess",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assessment_submissions_student_assess
            ON assessment_submissions (student_id, assessment_id, submitted_at DESC)`,
    },
    // Covers teacher-scoped grading queue filtered by status
    {
      name: "idx_assessment_submissions_teacher_status",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assessment_submissions_teacher_status
            ON assessment_submissions (teacher_id, status, submitted_at DESC)`,
    },

    // ── Grades ────────────────────────────────────────────────────────────────
    // Covers mobile dashboard "recent grades" query (SELECT … ORDER BY graded_at DESC LIMIT 5)
    {
      name: "idx_grades_student_graded",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grades_student_graded
            ON grades (student_id, graded_at DESC)`,
    },

    // ── Homework ──────────────────────────────────────────────────────────────
    // Covers teacher-scoped homework listing sorted by due date
    {
      name: "idx_homework_teacher_due",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_homework_teacher_due
            ON homework (teacher_account_id, due_date DESC NULLS LAST)`,
    },

    // ── Lessons ───────────────────────────────────────────────────────────────
    // Covers active-lesson lookups per teacher (gradebook filters, session selector)
    {
      name: "idx_lessons_teacher_active",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lessons_teacher_active
            ON lessons (teacher_account_id, is_active) WHERE is_active = TRUE`,
    },

    // ── Student marks (additional) ────────────────────────────────────────────
    // Covering index for per-student sorted mark queries (recent results widget)
    {
      name: "idx_student_marks_student_graded",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_student_marks_student_graded
            ON student_marks (student_id, graded_at DESC) INCLUDE (marks_scored, exam_id)`,
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
