---
name: Aperti Phase 43 stability
description: Key patterns and decisions from Phase 43 stability/hardening overhaul
---

# Phase 43 Stability & Trust Overhaul

## Key decisions

**AIErrorBoundary**: Class component at `src/components/ai-error-boundary.tsx`. Classifies errors into network/timeout/quota/unknown. Logs to `/api/ai/log-error`. The HOC `withAIErrorBoundary(Component, featureName)` wraps AI pages. Backend endpoint appends to both `ai_logs` and `error_logs` tables.

**Why:** React Error Boundaries must be class components; function components cannot be error boundaries.

**InstaPay duplicate check**: Added to `artifacts/api-server/src/routes/subscriptions.ts` POST /checkout. Checks `subscriptions.instaPayCode` uniqueness before insert. Returns 409 with `code: "DUPLICATE_INSTAPAY"` on collision.

**Device manager**: Settings backend has DELETE `/settings/sessions/:id` (revoke one) and DELETE `/settings/sessions` (revoke all others, preserving current by `x-device-id` header). Frontend at Settings → Devices tab shows browser/OS detection, "Current" badge on first session, Revoke button on others.

**ServerError route**: `/500` added to all four role routers (student, teacher, admin, parent) AND public router before their respective NotFound catchalls.

**Enrollment audit**: Backend at `/admin/analytics/enrollment-audit` (GET) and `/admin/analytics/enrollment-repair` (POST). Frontend page at `src/pages/admin/enrollment-audit.tsx`. Route added to AdminRouter at `/admin/enrollment-audit`. Module grid card added to admin-command.tsx.

**Analytics endpoints (new)**:
- `/analytics/grade-distribution` — real exam grades grouped by band
- `/analytics/student-scores` — engagement/risk/consistency per student

**Landing hero**: Fallback copy updated to "The platform IGCSE tutors trust to run their class." + "Attendance, grading, AI feedback, parent updates, and student analytics — all in one place. Built for Egyptian IGCSE educators." CMS data still takes precedence over fallback.

**How to apply:** When adding new AI features, wrap in `<AIErrorBoundary featureName="Feature Name">` or use `withAIErrorBoundary`. Always add new admin pages to both: (1) App.tsx AdminRouter, (2) admin-command.tsx modules array.
