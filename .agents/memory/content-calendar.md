---
name: Content Calendar
description: Admin-only scheduled content feature — announcements, testimonial spotlights, landing page changes.
---

## DB table
`content_calendar` created via raw psql (not in Drizzle schema). Columns: id, title, content_type (announcement|testimonial|landing_change), status (draft|scheduled|published|cancelled), scheduled_at, published_at, payload JSONB, created_by FK→accounts, created_at, updated_at.

## Backend
`artifacts/api-server/src/routes/content-calendar.ts` — all routes require authenticate + requireRole("admin"). Mounted at end of routes/index.ts as `router.use(contentCalendarRouter)`.

## API endpoints
- GET    /api/admin/content-calendar          — list with optional ?status= ?type= filters
- GET    /api/admin/content-calendar/:id      — single item
- POST   /api/admin/content-calendar          — create (auto-sets status=scheduled if scheduled_at provided)
- PUT    /api/admin/content-calendar/:id      — update
- POST   /api/admin/content-calendar/:id/publish — publish now
- POST   /api/admin/content-calendar/:id/cancel  — cancel draft/scheduled
- DELETE /api/admin/content-calendar/:id     — delete (published or cancelled only)
- GET    /api/admin/content-calendar-due      — items with status=scheduled AND scheduled_at <= NOW()

## Frontend
`artifacts/aperti/src/pages/admin/content-calendar.tsx` — lazy-loaded at `/admin/content-calendar` in ADMIN_ROUTES.
Features: stat cards (drafts/scheduled/published), mini calendar with color-coded dots per content type, day-click sidebar drill-down, filterable list, create/edit modal with per-type payload fields, preview modal, publish/cancel/delete action buttons, StatusButton + EmptyState used throughout.

**Why:** content_calendar is NOT in Drizzle schema — the table was created directly via psql. If Drizzle push runs it will skip it (table exists). Do not add it to schema to avoid FK resolution ordering issues.
