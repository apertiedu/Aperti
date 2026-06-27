---
name: Aperti DB audit fixes 2026-06
description: Full database validation audit and all P0/P1/P2 fixes applied — tables, indexes, route guards, attendance bridge.
---

## What was fixed

### P0 — Blockers
- `certificates` table was missing from the DB entirely; created via psql + added to migrate.ts
- `transcripts` table was also missing (referenced in certifications.ts); created + added to migrate.ts
- `parent_notifications(parent_id, created_at DESC)` index added — was doing full table scan on every parent dashboard load
- `guardian_links(parent_account_id, status)` and `guardian_links(student_id)` indexes added

### P1 — Pre-launch
- attendance.ts: `notifyParentOfAbsence()` fires async on both `/mark` and `/mark-by-code` when status=Absent; looks up guardian_links for parent_account_id then INSERTs into parent_notifications
- certifications.ts: scope guard added (student must belong to issuing teacher); assessment validation added (must have `approved_at IS NOT NULL` mark ≥50% on the assessment before cert is issued); revoke now sets `revoked_at`/`revoked_by`
- certifications.ts transcript endpoint rewritten to use `student_marks + exams` (the fictional `assessment_submissions` + `assessments` tables do not exist)
- 16 additional high-traffic FK indexes: flashcard_progress.card_id, flashcard_items.deck_id, course_enrollments.course_id/student_account_id, checkin_tokens.lesson_id, session_slots.lesson_id, announcement_reads.announcement_id, student_marks.question_id, subscriptions.coupon_id/pending_invoice_id, students.lesson1/2/3_session_id, room_members.room_id, room_messages.room_id

### P2 — Backlog
- `homework.due_date` partial index `WHERE is_published = true` for student calendar queries
- `mastery_records.student_id` index
- All new tables + indexes added to migrate.ts for future deploys

### AI Tutor → echo_memory (P2 — N/A)
- Phase 51 AI tutor routes (`/api/ai-tutor`, `/api/study-plan`, `/api/grade-prediction`) do not exist in the codebase as of 2026-06; memory entry referencing them was a planned feature never implemented. Skip this P2 item.

## Key patterns
- `pool` (not Drizzle) must be imported in routes that use raw SQL — attendance.ts now imports both `db` and `pool`
- Absent status strings can be "Absent" or "absent" — notifyParentOfAbsence checks both
- certificates route uses `requireRole("teacher","admin")` for issue/revoke; verify endpoint is public (no auth)
- 9 startup index errors in db-indexes.ts are pre-existing and benign — the routine skips indexes on tables that don't exist yet, logs them at debug level

**Why:** Certificates table was never in the Drizzle schema or migrate.ts — it was written with raw pool.query but the table was never created. Every issuance returned a 500. transcripts was the same pattern. Both are now in migrate.ts so restarts won't regress.
