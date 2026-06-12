---
name: Aperti Phase 33 — Platform Perfection
description: All Phase 33 features built; key patterns for error capture, DB health, analytics deep dive, skeleton screens, landing trust signals, docs
---

## What was built

### Error Capture (T001 / T002)
- `main.tsx` wraps `<App>` in `<ErrorBoundary>` (default export from `error-boundary.tsx`)
- `main.tsx` adds `window.addEventListener('error', ...)` and `unhandledrejection` listeners that POST to `/api/founder/frontend-errors`
- Global error handler in `app.ts` upgraded: never leaks stack traces in production; logs server errors to `frontend_error_logs` table

### DB Health Admin (T003)
- Backend route: `artifacts/api-server/src/routes/admin-db-health.ts`
  - `GET /api/admin/db-health` — DB size, table stats (top 20), slow queries from `api_metrics`, connection pool stats
  - `POST /api/admin/db-health/vacuum` — runs VACUUM ANALYZE
- Frontend page: `artifacts/aperti/src/pages/admin/admin-os/DBHealthPage.tsx`
- Nav: "Database Health" added to AdminLayout under "— Intelligence & Health" section
- Route: `/admin/os/db-health` in index.tsx

### Analytics Deep Dive (T005)
- Backend: `artifacts/api-server/src/routes/admin-analytics-extended.ts`
  - Endpoints: `/active-users` (DAU/WAU/MAU), `/revenue-growth`, `/retention`, `/error-trends`, `/enrollment-trends`, `/user-growth`
  - All mount at `/api/admin/analytics/extended/`
- Frontend page: `artifacts/aperti/src/pages/admin/admin-os/AnalyticsExtendedPage.tsx`
- Nav: "Analytics Deep Dive" added to AdminLayout
- Route: `/admin/os/analytics-extended` in index.tsx

### Skeleton Screens (T007)
- `artifacts/aperti/src/components/skeleton-layouts.tsx`
- Exports: `SkeletonCard`, `SkeletonStatCard`, `SkeletonTable`, `SkeletonChart`, `SkeletonForm`, `SkeletonDashboardGrid`, `SkeletonPage`
- Used in DBHealthPage, AnalyticsExtendedPage

### Landing Page (T006)
- Added trust signals row below hero CTAs: "No lock-in", "Up in minutes", "IGCSE & IB ready", "AI-powered grading"
- CMSPricingCard already handles `is_highlighted` + badge for recommended plans — no further changes needed

### Password Recovery (T008)
- Already fully hardened: generic SAFE message, 1h token TTL, `used_at IS NULL` one-time use — no changes needed

### Documentation (T009)
- `README.md` rewritten: Phases 1–33, full module table, key endpoints, security, monitoring
- `docs/admin.md`, `docs/teacher.md`, `docs/student.md`, `docs/parent.md`, `docs/founder.md` created

## Key patterns

### Route registration pattern (app.ts)
All new routes registered in two places: imports at top AND `app.use()` calls in the middle section. Phase 33 routes go just after Phase 32 block.

### Admin nav pattern (AdminLayout.tsx)
New nav items go in the `NAV_ITEMS` array. Use `{ label: "— Section Header", header: true }` for separators.

### Vite proxy
`/api` is in `BARE_OK` — all `/api/*` routes proxy to backend automatically. No changes needed for new `/api/admin/*` routes.

**Why:** The proxy rewrites non-BARE_OK paths to `/api/<path>`, so adding `/api` to BARE_OK ensures `/api/admin/db-health` isn't double-prefixed to `/api/api/admin/db-health`.
