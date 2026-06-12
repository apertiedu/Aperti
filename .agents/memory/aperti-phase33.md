---
name: Aperti Phase 33 — Platform Perfection & UI Consistency
description: Phase 33 features + P33-T1 fixes (teal, naming, login) + P33-T2 Error System, Zod validation, perf tracker
---

## What was built in Phase 33

### Error Capture (T001 / T002)
- `main.tsx` wraps `<App>` in `<ErrorBoundary>` (default export from `error-boundary.tsx`)
- `main.tsx` adds `window.addEventListener('error', ...)` and `unhandledrejection` listeners that POST to `/api/founder/frontend-errors`
- Global error handler in `app.ts` upgraded: never leaks stack traces in production; logs server errors to `frontend_error_logs` table

### DB Health Admin (T003)
- Backend route: `artifacts/api-server/src/routes/admin-db-health.ts`
  - `GET /api/admin/db-health` — DB size, table stats (top 20), slow queries from `api_metrics`, connection pool stats
  - `POST /api/admin/db-health/vacuum` — runs VACUUM ANALYZE
- Frontend page: `artifacts/aperti/src/pages/admin/admin-os/DBHealthPage.tsx`

### Analytics Deep Dive (T005)
- Backend: `artifacts/api-server/src/routes/admin-analytics-extended.ts`
- Frontend page: `artifacts/aperti/src/pages/admin/admin-os/AnalyticsExtendedPage.tsx`
- Route: `/admin/os/analytics-extended`

### Skeleton Screens (T007)
- `artifacts/aperti/src/components/skeleton-layouts.tsx`

### Landing Page (T006)
- Added trust signals row below hero CTAs

### Documentation (T009)
- `README.md` rewritten; `docs/admin.md`, `docs/teacher.md`, `docs/student.md`, `docs/parent.md`, `docs/founder.md` created

## P33-T1 Critical Fixes & UI Consistency

### Canonical teal token — MIGRATED
- **Old (dead)**: `#00796B`
- **New (canonical)**: `#0D9488` — Liquid Flow 2.0
- CSS: `--primary: 175 84% 32%` (light), `--primary: 175 84% 42%` (dark)
- **How to apply:** Use `text-primary`, `bg-primary`, `border-primary` Tailwind tokens. For inline styles, use `#0D9488`. Never use `#00796B`.

### Naming conventions locked in
- "Assessments" → `/teacher/assessments` (canonical); "CoreHub" and "CoreMind" = intentional brand names

### Login JSON safety
- `auth.ts` POST /login: `res.setHeader("Content-Type", "application/json")` is the FIRST line inside the handler

## P33-T2 — Error System, Validation & Performance

### New DB tables (PHASE33_MIGRATIONS in `artifacts/api-server/src/db/migrate.ts`)
- `error_logs` — level, message, stack, route, user_id, role, device, browser, created_at
- `route_perf_log` — route+method primary key (UPSERT), hit_count, avg_ms, p95_ms, max_ms, last_slow_at

### Public Error Endpoint — CRITICAL: registration order matters
- `POST /api/errors/log` — no auth, rate-limited 30/min; in `artifacts/api-server/src/routes/errors-log.ts`
- **MUST be registered BEFORE `app.use("/api", router)` in app.ts** — the main router intercepts all `/api/*` and applies authenticate, blocking public endpoints if registered after
- Current position: after launchCmsRouter, before main router (line ~247 in app.ts)
- `logErrorToDb()` helper exported for use anywhere in backend

### Performance Tracker
- `artifacts/api-server/src/lib/perf-tracker.ts` — in-memory ring buffer, flushes to `route_perf_log` every 5 min
- `recordRequest(method, path, durationMs)` — called from perf middleware in app.ts on `res.on("finish")`
- `startPerfFlushInterval()` — called at bottom of app.ts after seedDefaultAdmin

### Zod Validation Middleware
- `artifacts/api-server/src/middleware/validate-body.ts` — `validateBody(schema)` returns 422 `{ error, fields }` on failure
- **Zod is symlinked**: `artifacts/api-server/node_modules/zod` → `lib/api-zod/node_modules/zod`; import as `from "zod"` directly
- Applied to: accounts.ts (POST+PATCH), admin-users.ts (POST+PUT+reset-password), courses.ts (POST)
- Pattern: define schema at top of route file, add `validateBody(schema)` as middleware before async handler

### Founder Endpoints Added
- `GET /api/founder/error-logs` — last 500 rows from error_logs
- `GET /api/founder/performance` — historical from route_perf_log + live from api_metrics (last 1h)

### Frontend Error Capture (updated)
- `error-boundary.tsx` + `main.tsx`: POST to `/api/errors/log` (public) first, then optionally to `/api/founder/frontend-errors` if token present
- `process.on` handlers in index.ts use `import("@workspace/db")` dynamic ESM import (NOT require — ESM module)

### Admin UI Added
- `ErrorLogsPage.tsx` at `/admin/os/error-logs` — sortable/filterable table
- Nav item: "Error Logs" with Bug icon under Founder Control section in AdminLayout.tsx
- PerformancePage.tsx: added "Top Slowest Endpoints (p95)" section from `GET /api/founder/performance`

## Key patterns

### Route registration pattern (app.ts)
All new routes registered in two places: imports at top AND `app.use()` calls in the middle section.
Public routes MUST come before `app.use("/api", router)`.

### Admin nav pattern (AdminLayout.tsx)
New nav items go in the `NAV` array. Use `{ label: "— Section Header", header: true }` for separators.

### Vite proxy
`/api` is in `BARE_OK` — all `/api/*` routes proxy to backend automatically.
