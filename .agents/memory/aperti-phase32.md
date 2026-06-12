---
name: Aperti Phase 32 Zero-Defect Initiative
description: All Phase 32 DB fixes, route mounts, sign-in bug fixes, and 100% route health score
---

## Phase 32 Zero-Defect Summary

### Route Health Score
- Started: 83% (24 pass, 2 fail, 3 warn)
- Final: **100% (32/32 pass, 0 fail, 0 warn, avg 8ms)**

### DB Tables Created (manual SQL, not in push-schema)
- `assessments` — created manually; also added `teacher_id` alias column (routes used `teacher_id` but schema had `teacher_account_id`)
- `assessment_submissions` — created manually
- `feature_registry` — created manually (used by launch-cms.ts)
- `feature_waitlist` — recreated with correct schema: `(id, feature_id, name, email, role, interest_level, organization, status, created_at)`
- `beta_testers` — recreated with correct schema: `(id, feature_id, user_id, active, feedback JSONB, joined_at, UNIQUE(feature_id, user_id))`
- `subscription_plans.discount_pct` — column added (`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS discount_pct NUMERIC DEFAULT 0`)
- `announcement_reads` — already existed

### Route Mount Fixes (routes/index.ts)
- `questionBankRouter` — changed from no-prefix to `"/question-bank"` prefix
- `flashcardsRouter` — changed from no-prefix to `"/flashcards"` prefix
- `coursesRouter` (courses.ts) — **was NOT imported at all** — added import and mount at `"/courses"`
- Route health check paths updated: `/api/plans/public` (was `/api/plans`), `/api/landing` (was `/api/public/courses`)

### Sign-in Bug Fixes
- `force-change-password.tsx`: used `await res.json()` directly (throws "Unexpected token" on non-JSON) → fixed to `text()` then safe `JSON.parse()`
- `force-change-password.tsx`: called `/auth/change-password` (wrong) → fixed to `/api/auth/change-password` (correct — changePasswordRouter is under `/api`)
- `messages.ts` announcements routes: used old schema columns `teacher_account_id` and `subject_id` → fixed to current schema with `sender_id`, `audience_type`, `status`
- `admin-features.ts`: added `PATCH /:key` endpoint for key/name-based toggle (upsert by name)

### Device Session Quirk
- Rate limiter is in-memory (`express-rate-limit`) — cleared by backend restart
- `device_sessions` table is used for 2-device limit — deviceId `web-${Date.now()}` generates new ID each login, so old sessions pile up; clear with `DELETE FROM device_sessions` when blocked during dev

### Key Path Facts
- `/auth/*` routes — mounted directly in `app.ts` at `app.use("/auth", authRouter)` (NOT under `/api`)
- `/api/auth/change-password` — mounted in `routes/index.ts` via `router.use(changePasswordRouter)` (under `/api`)
- Frontend auth context uses `const API = "/auth"` for login/logout/me — correct
- `force-change-password.tsx` must use `/api/auth/change-password` — different from other auth routes
