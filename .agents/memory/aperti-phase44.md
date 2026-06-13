---
name: Aperti Phase 44 zero-friction
description: Zero-Friction Experience, Data Integrity & Error Eradication — all changes made in Phase 44
---

## Course Archive System
- Backend: `PATCH /courses/:id/archive` and `PATCH /courses/:id/unarchive` appended to `artifacts/api-server/src/routes/courses.ts`. Each endpoint idempotently adds `is_archived` column via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
- Frontend `teacher/my-courses.tsx`: `is_archived: boolean` added to Course interface; `archiveMutation` useMutation; archive/restore buttons (with Tooltip) in course card; `AlertDialog` confirm before archiving.
- Icons used: `Archive` (amber) and `ArchiveRestore` (amber-500) from lucide-react.

## Platform Health Dashboard
- New page at `artifacts/aperti/src/pages/admin/platform-health.tsx` — `/admin/health` route.
- Shows: overall status banner, API errors/DB latency/active users/AI calls metric cards, top errors list, slow endpoints, failed logins, DB overview (size/connections/top tables), and pending enrollment/payment counters.
- Linked from admin-command.tsx modules array as `highlight2` (purple gradient card).

## Landing FAQ Fallback
- `FALLBACK_FAQS: CMSFAQ[]` constant with 8 real IGCSE-relevant Q&As defined in `landing.tsx` before the Testimonials section.
- `faqs` variable changed from `cms?.faqs ?? []` to `cms?.faqs?.length ? cms.faqs : FALLBACK_FAQS`.

## SaveIndicator in Content Craft
- `SaveIndicator` imported and rendered next to the Save button in `FullScreenEditor` component.
- Status maps: `mutation.isPending → "saving"`, `saved → "saved"`, otherwise `"idle"`.

## Notification Date Grouping
- `notification-center.tsx` now groups items into: Today / Yesterday / This week / This month / Older.
- `getDateGroup()` helper computes group from timestamp diff in days. `GROUP_ORDER` array controls render order.

## TutorCraft AI Reliability
- `send()` catch block in `tutorcraft.tsx` now detects timeout vs general error and returns different user-facing messages.

**Why:** Phase 44 goal was eliminating lost work, duplicate submissions, infinite loading, dead buttons, and missing feedback across all roles.

**How to apply:** Course archive pattern uses `(c as any)` → now uses typed `c.is_archived` after interface update. Always add new boolean columns to the Course interface.
