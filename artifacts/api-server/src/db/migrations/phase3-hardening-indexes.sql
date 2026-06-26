-- Phase 3 Production Hardening — Database Index Migration
-- Run once; idempotent (uses CREATE INDEX IF NOT EXISTS)
-- Generated: 2025-06

-- ── audit_logs ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS audit_logs_account_id_idx      ON audit_logs (account_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx          ON audit_logs (action);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx      ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_severity_idx        ON audit_logs (severity) WHERE severity IN ('warn','critical');
CREATE INDEX IF NOT EXISTS audit_logs_resource_idx        ON audit_logs (resource, resource_id);

-- ── students ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS students_teacher_account_idx   ON students (teacher_account_id);
CREATE INDEX IF NOT EXISTS students_status_idx            ON students (status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS students_parent_account_idx    ON students (parent_account_id);
CREATE INDEX IF NOT EXISTS students_account_id_idx        ON students (account_id);

-- ── accounts ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS accounts_teacher_account_idx   ON accounts (teacher_account_id);
CREATE INDEX IF NOT EXISTS accounts_role_idx              ON accounts (role);
CREATE INDEX IF NOT EXISTS accounts_email_idx             ON accounts (email) WHERE email IS NOT NULL;

-- ── exams ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS exams_teacher_account_idx      ON exams (teacher_account_id);
CREATE INDEX IF NOT EXISTS exams_subject_idx              ON exams (subject_id);
CREATE INDEX IF NOT EXISTS exams_exam_date_idx            ON exams (exam_date DESC NULLS LAST);

-- ── exam_results ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS exam_results_exam_id_idx       ON exam_results (exam_id);
CREATE INDEX IF NOT EXISTS exam_results_student_id_idx    ON exam_results (student_id);

-- ── homework / submissions ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS homework_teacher_idx           ON homework (teacher_account_id);
CREATE INDEX IF NOT EXISTS homework_submissions_hw_idx    ON homework_submissions (homework_id);
CREATE INDEX IF NOT EXISTS homework_submissions_stu_idx   ON homework_submissions (student_id);

-- ── courses / enrollments ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS courses_teacher_idx            ON courses (teacher_account_id);
CREATE INDEX IF NOT EXISTS enrollments_teacher_idx        ON enrollments (teacher_account_id);
CREATE INDEX IF NOT EXISTS enrollments_student_idx        ON enrollments (student_id);
CREATE INDEX IF NOT EXISTS enrollments_course_idx         ON enrollments (course_id);

-- ── attendance ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS attendance_student_idx         ON attendance (student_id);
CREATE INDEX IF NOT EXISTS attendance_teacher_idx         ON attendance (teacher_account_id);
CREATE INDEX IF NOT EXISTS attendance_date_idx            ON attendance (date DESC);

-- ── upload_registry ───────────────────────────────────────────────────────────
-- (already has filename, uploader, tenant indexes — skipped)

-- ── subscriptions ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS subscriptions_teacher_idx      ON subscriptions (teacher_account_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx       ON subscriptions (status);

-- ── api_metrics ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS api_metrics_endpoint_idx       ON api_metrics (endpoint);
CREATE INDEX IF NOT EXISTS api_metrics_recorded_at_idx    ON api_metrics (recorded_at DESC);

-- ── system_metrics_log ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS system_metrics_log_created_idx ON system_metrics_log (created_at DESC);

-- ── Partial index: active enrollments fast path ───────────────────────────────
CREATE INDEX IF NOT EXISTS enrollments_active_idx
  ON enrollments (teacher_account_id, student_id)
  WHERE status = 'active';
