---
name: Aperti DB runtime gaps — courses and landing stats
description: aperti_courses table missing at runtime; students has no status column; both fixed
---

# DB Runtime Gaps — courses & landing stats

## The Rules

**`aperti_courses` doesn't exist by default** — only `teacher_courses` exists in the schema. The `courses.ts` router has an idempotent migration (CREATE TABLE IF NOT EXISTS) that runs on startup, but it must be the FIRST migration step — ALTER TABLE fails silently if the table doesn't exist.

**`students` table has no `status` column** — the table only has: id, account_id, teacher_account_id, enrollment_date, grade, notes, xp, streak, last_active_at, parent_phone. Any query using `WHERE status='active'` on students will fail with "column does not exist".

**Why:** The schema drifted over many phases — students table was created early without a status column, and aperti_courses was never pushed to the DB (teacher_courses was used instead).

## Fixes applied
1. `artifacts/api-server/src/routes/courses.ts` — Added `CREATE TABLE IF NOT EXISTS aperti_courses (...)` as first entry in COURSE_MIGRATIONS array before the ALTER TABLE commands.
2. `artifacts/api-server/src/routes/phase14-public.ts` — Changed landing stats queries from `WHERE status='active'` (students) and `WHERE role='teacher' AND status='active'` (accounts) to remove the status filter.

## How to apply
- If you see 500 on `/courses` after DB reset → courses.ts migration runs on server start, just restart the backend
- If you see 500 on `/api/landing/stats` → never use `WHERE status` on the `students` table
- If you need to add a status concept to students → add the column explicitly first via ALTER TABLE
