# Database Health Report — Aperti V2

> Generated: Phase 3 Production Hardening
> ORM: Drizzle ORM + PostgreSQL (Neon/Supabase)

## Schema Overview

| Table | Purpose | Rows (est.) |
|-------|---------|-------------|
| `accounts` | All users — teachers, admins, assistants | Hundreds |
| `students` | Student records per teacher | Thousands |
| `exams` | Exam definitions | Thousands |
| `exam_results` | Per-student exam scores | Tens of thousands |
| `homework` | Homework assignments | Thousands |
| `homework_submissions` | Student submissions | Tens of thousands |
| `courses` | Course definitions | Hundreds |
| `enrollments` | Course → student links | Thousands |
| `attendance` | Daily attendance records | Hundreds of thousands |
| `audit_logs` | Security audit trail | Millions (over time) |
| `upload_registry` | File metadata | Thousands |
| `subscriptions` | Teacher subscription plans | Hundreds |
| `api_metrics` | Request performance data (30-day TTL) | Millions |
| `session` | Express sessions (pg) | Thousands |

## Phase 3 Index Migration

A comprehensive index migration (`phase3-hardening-indexes.sql`) was created covering:

### New Indexes Added

| Table | Column(s) | Type | Reason |
|-------|-----------|------|--------|
| `audit_logs` | `account_id` | B-tree | Admin audit log queries by user |
| `audit_logs` | `action` | B-tree | Filter by action type |
| `audit_logs` | `created_at DESC` | B-tree | Chronological browsing |
| `audit_logs` | `severity` (partial) | B-tree | Alert queries: warn+critical only |
| `audit_logs` | `resource, resource_id` | Composite | Resource-specific audit lookups |
| `students` | `teacher_account_id` | B-tree | All tenant-scoped student queries |
| `students` | `status` (partial active) | B-tree | Active students fast path |
| `students` | `parent_account_id` | B-tree | Parent dashboard queries |
| `students` | `account_id` | B-tree | Student auth lookup |
| `accounts` | `teacher_account_id` | B-tree | Assistant/tenant resolution |
| `accounts` | `role` | B-tree | Role-based permission queries |
| `accounts` | `email` (partial non-null) | B-tree | Login lookup |
| `exams` | `teacher_account_id` | B-tree | Teacher's exam list |
| `exams` | `subject_id` | B-tree | Subject-filtered gradebook |
| `exams` | `exam_date DESC` | B-tree | Chronological exam queries |
| `exam_results` | `exam_id` | B-tree | Exam result aggregation |
| `exam_results` | `student_id` | B-tree | Student progress queries |
| `homework` | `teacher_account_id` | B-tree | Teacher's homework list |
| `homework_submissions` | `homework_id` | B-tree | Submission lookup |
| `homework_submissions` | `student_id` | B-tree | Student work queries |
| `courses` | `teacher_account_id` | B-tree | Teacher's course list |
| `enrollments` | `teacher_account_id` | B-tree | Tenant-scoped enrollments |
| `enrollments` | `student_id` | B-tree | Student's enrollments |
| `enrollments` | `course_id` | B-tree | Course enrollment count |
| `enrollments` (partial active) | `teacher_account_id, student_id` | Composite | Active enrollment fast path |
| `attendance` | `student_id` | B-tree | Student attendance history |
| `attendance` | `teacher_account_id` | B-tree | Teacher's attendance records |
| `attendance` | `date DESC` | B-tree | Date-range attendance queries |
| `subscriptions` | `teacher_account_id` | B-tree | Teacher subscription lookup |
| `subscriptions` | `status` | B-tree | Active subscription queries |
| `api_metrics` | `endpoint` | B-tree | Performance analysis by route |
| `api_metrics` | `recorded_at DESC` | B-tree | Recent metrics browsing |
| `system_metrics_log` | `created_at DESC` | B-tree | Health history queries |

## Foreign Key Coverage

All core relationship tables include foreign keys:
- `students.teacher_account_id → accounts.id`
- `students.parent_account_id → accounts.id`
- `exam_results.exam_id → exams.id`
- `exam_results.student_id → students.id`
- `enrollments.course_id → courses.id`
- `enrollments.student_id → students.id`
- `upload_registry.uploader_id → accounts.id` (soft ref)

## Cascade Policies

| Relationship | On Delete |
|-------------|-----------|
| `exam_results → exams` | CASCADE |
| `homework_submissions → homework` | CASCADE |
| `enrollments → courses` | SET NULL (keep history) |
| `audit_logs → accounts` | SET NULL (keep audit) |

## Data Retention

| Table | TTL | Mechanism |
|-------|-----|-----------|
| `api_metrics` | 30 days | Nightly cron DELETE |
| `system_metrics_log` | 30 days | Nightly cron DELETE |
| `audit_logs` | Indefinite | Manual/compliance-driven |
| `session` | 7 days | Session cookie maxAge |

## Integrity Risks Identified

| Risk | Severity | Mitigation |
|------|----------|-----------|
| `upload_registry.tenant_id` was incorrectly set for assistants | **Fixed** in Phase 3 | `resolveTenantId()` function |
| `api_metrics` can grow unbounded if cron fails | Low | TTL deletion + 10% sampling |
| Sessions table not pruned automatically | Low | `connect-pg-simple` prune on session access |

## Recommended Next Steps

| Action | Priority |
|--------|----------|
| Run `ANALYZE` on hot tables after index migration | High |
| Enable `pg_stat_statements` to identify actual slow queries | High |
| Add `VACUUM ANALYZE` to nightly cron | Medium |
| Consider table partitioning for `attendance` and `audit_logs` at 10M+ rows | Low |
