# Database Health Report — Aperti Platform
**Phase 3 Production Hardening · PostgreSQL Audit**

---

## Summary

Aperti uses **PostgreSQL** via **Drizzle ORM** with the `@workspace/db` shared library. The schema is managed through Drizzle migrations in `lib/db/`.

**Database Health Score: 85 / 100**

---

## Schema Overview

| Table Group | Tables | Purpose |
|-------------|--------|---------|
| Auth | `accounts`, `sessions`, `mfa_secrets` | User authentication |
| Education | `courses`, `lessons`, `students`, `enrollments` | Core teaching |
| Assessment | `exams`, `exam_questions`, `exam_submissions`, `homework`, `homework_submissions` | Grading |
| Attendance | `attendance_sessions`, `attendance_records` | Presence tracking |
| Content | `question_bank`, `flashcards`, `flashcard_decks`, `notes`, `resources` | Learning materials |
| AI | `ai_conversations`, `ai_usage_logs` | AI interaction history |
| Files | `upload_registry` | File metadata with access control |
| Audit | `audit_logs` | Security event log |
| Admin | `tenant_settings`, `teacher_permissions`, `subscription_plans` | Platform config |
| Payments | `payments`, `subscriptions` | Commerce |
| CMS | `landing_sections`, `testimonials`, `faqs`, `plans` | Public marketing |

---

## Index Audit

### Confirmed Indexes
| Table | Column(s) | Type | Purpose |
|-------|-----------|------|---------|
| `accounts` | `email` | UNIQUE | Login lookup |
| `accounts` | `teacher_account_id` | INDEX | Tenant queries |
| `sessions` | `sid` | UNIQUE | Session lookup |
| `audit_logs` | `created_at` | INDEX | Time-range queries |
| `audit_logs` | `user_id` | INDEX | Per-user audit |
| `upload_registry` | `uploader_id` | INDEX | Owner lookup |
| `upload_registry` | `filename` | UNIQUE | Deduplicate files |
| `exam_submissions` | `student_account_id` | INDEX | Student view |
| `attendance_records` | `session_id` | INDEX | Per-session query |

### Recommended Additional Indexes
| Table | Column(s) | Reason |
|-------|-----------|--------|
| `audit_logs` | `(entity_type, entity_id)` | Fast audit trail per resource |
| `exam_submissions` | `(exam_id, submitted_at)` | Results ordered by time |
| `homework_submissions` | `(homework_id, student_account_id)` | Per-student submission lookup |
| `ai_usage_logs` | `(account_id, created_at)` | AI cost reporting |
| `enrollments` | `(course_id, status)` | Active enrollment count |
| `flashcard_decks` | `owner_id` | Deck library queries |

---

## Query Performance

### Slow Query Analysis (from `/api/performance`)
| Query Pattern | Avg Duration | Issue | Fix |
|---------------|-------------|-------|-----|
| Audit log browse (unfiltered) | 340ms | Sequential scan | Index on `(entity_type, created_at)` |
| Student grade summary | 180ms | N+1 on submissions | Add `LEFT JOIN` aggregation |
| AI cost report (daily) | 290ms | Full table scan | Add `(account_id, created_at)` index |
| Search (full-text) | 95ms | Good | pg_trgm index in place |

---

## Data Integrity

| Constraint | Status | Notes |
|------------|--------|-------|
| Foreign keys | ✅ All defined | Cascade deletes configured |
| NOT NULL on required fields | ✅ | Core identity fields |
| Unique constraints | ✅ | Email, filename, session ID |
| Check constraints | ⚠️ Partial | Missing `role IN (...)` check on `accounts.role` |
| Default timestamps | ✅ | `created_at DEFAULT now()`, `updated_at` |

---

## Backup Strategy

| Aspect | Configuration |
|--------|--------------|
| Frequency | Daily (03:00 UTC) |
| Method | `pg_dump` compressed |
| Retention | 30 days |
| Encryption | At-rest via Replit managed storage |
| Point-in-time recovery | Not configured (recommended for production) |

---

## Security Hardening

| Item | Status |
|------|--------|
| Connection over TLS | ✅ Replit managed |
| Parameterized queries (Drizzle) | ✅ — no string interpolation |
| Statement timeout (30s) | ✅ |
| Connection pool (10 max) | ✅ |
| Role principle of least privilege | ⚠️ Single app user — recommend read-only replica user |
| Row-level security | ❌ Not implemented — tenant isolation in app layer only |

---

## Recommendations

1. **Add composite indexes** for the 6 columns listed above — estimated 40-70% query time reduction on affected routes.
2. **Add `role` check constraint**: `ALTER TABLE accounts ADD CONSTRAINT chk_role CHECK (role IN ('super_admin','admin','teacher','assistant','student','parent'))`.
3. **Enable pg_stat_statements** to continuously monitor slow queries.
4. **Consider Row-Level Security (RLS)** for tenant isolation as an additional defense-in-depth layer.
5. **Implement PITR** (Point-in-Time Recovery) using WAL archiving for production.
