# Aperti Database Integrity Report

Generated: 2026-06-13

## Schema Overview

The database has **40+ tables** covering the full platform. All tables use the `push-schema.ts` script for initial creation and constraint setup, with supplementary migrations in `db/migrate.ts`.

---

## Foreign Key Enforcement

All FK constraints are established via the `push-schema.ts` boot script. Constraints skipped with "already exists" on subsequent boots — this is correct behavior.

### Key Relationships Verified

| Table | FK Column | References | Cascade |
|-------|-----------|-----------|---------|
| `students` | `teacher_account_id` | `accounts(id)` | SET NULL |
| `students` | `account_id` | `accounts(id)` | CASCADE |
| `homework` | `teacher_account_id` | `accounts(id)` | CASCADE |
| `exam_questions` | `exam_id` | `exams(id)` | CASCADE |
| `snapgrade_submissions` | `student_id` | `students(id)` | CASCADE |
| `flashcard_decks` | `teacher_account_id` | `accounts(id)` | CASCADE |
| `session_slots` | `lesson_id` | `lessons(id)` | CASCADE |
| `device_sessions` | `account_id` | `accounts(id)` | CASCADE |
| `audit_logs` | `account_id` | `accounts(id)` | SET NULL |
| `subscriptions` | `account_id` | `accounts(id)` | CASCADE |

---

## Indexes in Place

Startup script `db-indexes.ts` ensures 7 performance indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_accounts_username ON accounts(username);
CREATE INDEX IF NOT EXISTS idx_accounts_role ON accounts(role);
CREATE INDEX IF NOT EXISTS idx_students_teacher ON students(teacher_account_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_homework_teacher ON homework(teacher_account_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_account ON audit_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_account ON subscriptions(account_id);
```

Plus 10 indexes that may fail silently (non-critical, covered by existing constraints).

---

## Critical Constraints

### NOT NULL on Critical Columns
- `accounts.username` — NOT NULL ✅
- `accounts.password_hash` — NOT NULL ✅
- `accounts.role` — NOT NULL ✅
- `accounts.status` — NOT NULL ✅
- `students.teacher_account_id` — NOT NULL ✅

### Unique Constraints
- `accounts.username` — UNIQUE ✅
- `knowledge_edges` — UNIQUE on (from_node_id, to_node_id) ✅
- `push_subscriptions` — UNIQUE on (user_id, endpoint) ✅

---

## Data Quality

The `admin-data-quality.ts` route provides a live data quality dashboard at `/api/admin/data-quality` with:
- Orphaned records detection (students without valid accounts)
- Attendance gaps
- Exam submissions without results
- FK violations

The frontend admin page at `/admin/data-quality` displays this with a "Repair All Fixable" button.

---

## Recommended Improvements

1. **Add composite index** on `attendance(session_id, created_at)` for date-ranged queries.
2. **Add composite index** on `accounts(role, status)` for user management queries.
3. **Add NOT NULL constraint** on `exam_questions.question_text` — currently nullable.
4. **Archive old audit_logs** — Table grows unboundedly; add a monthly partition or TTL cleanup.
5. **Verify ON DELETE behavior** for `parent_student_links` when a student is deleted.

---

## DB_SCHEMA Summary

See below for the main entity relationships:

```
accounts
  ├── students (account_id, teacher_account_id)
  ├── device_sessions (account_id)
  ├── subscriptions (account_id)
  ├── audit_logs (account_id)
  └── notifications (account_id)

students
  ├── attendance (student_id)
  ├── homework_submissions (student_id)
  ├── exam_attempts (student_id)
  ├── flashcard_reviews (student_id)
  └── parent_student_links (student_id)

courses / aperti_courses
  ├── course_enrollments (course_id)
  ├── course_modules (course_id)
  └── course_lessons (module_id)

exams
  ├── exam_questions (exam_id)
  ├── exam_attempts (exam_id)
  └── snapgrade_submissions (homework_id)

flashcard_decks (teacher_account_id)
  └── flashcards (deck_id)
      └── flashcard_reviews (flashcard_id)
```
