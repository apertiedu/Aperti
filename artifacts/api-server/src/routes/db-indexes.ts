import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

export async function ensurePerformanceIndexes(): Promise<void> {
  const indexes: { name: string; sql: string }[] = [
    // Attendance lookups (most common query pattern)
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
    // Student marks lookups
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
    // Homework submissions
    {
      name: "idx_hw_submissions_student_hw",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hw_submissions_student_hw
            ON homework_submissions (student_id, homework_id)`,
    },
    {
      name: "idx_hw_submissions_status",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hw_submissions_status
            ON homework_submissions (status, graded)`,
    },
    // Students by course
    {
      name: "idx_students_course_status",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_course_status
            ON students (course_id, status)`,
    },
    // Exams by course and date
    {
      name: "idx_exams_course_date",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_exams_course_date
            ON exams (course_id, exam_date)`,
    },
    {
      name: "idx_exams_status_date",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_exams_status_date
            ON exams (status, exam_date)`,
    },
    // Flashcard next review (spaced repetition)
    {
      name: "idx_flashcards_student_review",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_flashcards_student_review
            ON flashcards (student_id, next_review)`,
    },
    // Messages unread
    {
      name: "idx_messages_recipient_read",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_recipient_read
            ON messages (recipient_id, read_at)`,
    },
    // Sessions by subject and day
    {
      name: "idx_sessions_subject_day",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_subject_day
            ON sessions (subject_id, day_of_week)`,
    },
    // Courses by teacher
    {
      name: "idx_courses_teacher_status",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_courses_teacher_status
            ON aperti_courses (teacher_id, status)`,
    },
    // Accounts lookup
    {
      name: "idx_accounts_username_lower",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounts_username_lower
            ON accounts (LOWER(username))`,
    },
    {
      name: "idx_accounts_role",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounts_role
            ON accounts (role, status)`,
    },
    // API metrics (trim old ones)
    {
      name: "idx_api_metrics_recorded",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_metrics_recorded
            ON api_metrics (recorded_at DESC)`,
    },
    // User feedback
    {
      name: "idx_user_feedback_feature_rating",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_feedback_feature_rating
            ON user_feedback (feature, rating) WHERE rating IS NOT NULL`,
    },
  ];

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const idx of indexes) {
    try {
      await pool.query(idx.sql);
      created++;
    } catch (err: any) {
      // "already exists" is fine — CONCURRENTLY IF NOT EXISTS handles it,
      // but some PG versions may still throw on constraint errors
      if (err?.message?.includes("already exists")) {
        skipped++;
      } else if (err?.code === "42P07") {
        // Duplicate index
        skipped++;
      } else {
        // Table might not exist yet — skip gracefully
        errors++;
      }
    }
  }

  logger.info({ created, skipped, errors }, "[db-indexes] Performance indexes ensured");
}
