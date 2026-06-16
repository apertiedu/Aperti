---
name: Aperti AI reliability overhaul
description: Schema pitfall in ai_interactions and the full human-override pattern for SnapGrade.
---

## ai_interactions schema dual-format

Old rows use `user_id` / `module` / `action` columns. New gateway rows use `account_id` / `interaction_type` / `model` / `status` (TEXT). There is NO `success` (BOOLEAN) column.

**Why:** The gateway was added later and reused the same table with a different column set. Any query that references `success = false` or `success = true` returns a PostgreSQL error silently swallowed by `.catch(() => ({ rows: [] }))` — appearing as all-zeros in dashboards.

**How to apply:** Always filter on `status = 'error'` for failures and `status != 'error'` for successes in `admin-ai-usage.ts` and any new analytics query over `ai_interactions`.

## Human override pattern for SnapGrade

- `snapgrade_submissions` has: `teacher_reviewed BOOLEAN`, `ai_confidence NUMERIC`, `ai_source TEXT`, `teacher_override_grade`, `teacher_override_feedback`, `reviewed_by`, `reviewed_at`.
- `ai_grade_reviews` audit table stores: original AI grade/feedback/confidence/source, override values, decision (approved/modified/rejected), notes.
- Route: `PUT /api/snapgrade/submissions/:id/review` (teacherGuard). Frontend at `/teacher/snapgrade/:id/review`.
- Confidence threshold for "review required" badge: < 0.65. Pending reviews sorted by `ai_confidence ASC NULLS FIRST`.

## trackFailure in ai-gateway.ts

`trackFailure(userId, type, model, latencyMs)` must be called in every `catch` block of the three gateway handlers (chat SSE, grade, generate). Omitting it means failures are invisible in the health dashboard.
