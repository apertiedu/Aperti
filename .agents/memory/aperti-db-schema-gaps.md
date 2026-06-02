---
name: Aperti DB schema gaps fixed in production launch session
description: aperti_courses was missing critical columns; course_enrollments table was absent — both fixed via ALTER/CREATE migration
---

# DB Schema Gaps — aperti_courses & course_enrollments

## The Rule
Before adding new columns to `aperti_courses` or other tables in code, verify with `\d <table>` in psql. The ORM schema and actual DB can drift.

**Why:** During the production-launch finalization session, `aperti_courses` was missing 6 columns the routes expected (`teacher_account_id`, `is_published`, `subject`, `thumbnail_url`, `duration_weeks`, `enrolled_count`) and `course_enrollments` did not exist at all. Both `/courses` and `/auth/stats` returned 500.

**How to apply:** If you see 500s on `/courses` or enrollment routes after a fresh DB provision, run the migration below before debugging application code.

## Migration applied

```sql
ALTER TABLE aperti_courses
  ADD COLUMN IF NOT EXISTS teacher_account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS duration_weeks INTEGER DEFAULT 8,
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS enrolled_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS course_enrollments (
  id                  SERIAL PRIMARY KEY,
  course_id           INTEGER NOT NULL REFERENCES aperti_courses(id) ON DELETE CASCADE,
  student_account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'pending',
  requested_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  approved_by         INTEGER REFERENCES accounts(id),
  approved_at         TIMESTAMP WITH TIME ZONE,
  UNIQUE(course_id, student_account_id)
);
```
