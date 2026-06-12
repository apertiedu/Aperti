---
name: Aperti Phase 33 — Platform Perfection & UI Consistency
description: Phase 33 features + P33-T1 critical fixes: teal token migration, naming unification, login safety, page backgrounds
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

### Documentation (T009)
- `README.md` rewritten: Phases 1–33, full module table, key endpoints, security, monitoring
- `docs/admin.md`, `docs/teacher.md`, `docs/student.md`, `docs/parent.md`, `docs/founder.md` created

## P33-T1 Critical Fixes & UI Consistency

### Canonical teal token — MIGRATED
- **Old (dead)**: `#00796B` — was scattered across 30+ page files
- **New (canonical)**: `#0D9488` — Liquid Flow 2.0
- CSS variable (light): `--primary: 175 84% 32%`
- CSS variable (dark): `--primary: 175 84% 42%`
- Accent mirrors primary: `--accent: 175 84% 32%`

**Why:** The codebase had a split — components used #0D9488, pages used #00796B. All page TEAL constants and inline hex values were migrated in P33-T1.

**How to apply:** Use `text-primary`, `bg-primary`, `border-primary` Tailwind tokens. For inline styles, use `#0D9488`. Never use `#00796B`.

### Intentional old-teal exclusions (leave as-is)
- `forge-field.tsx` — circuit simulation wire/battery functional colors
- `student-portal/labs/geometric.tsx` — Three.js 3D material color
- `pulse.tsx` — grade color scale (A* = teal is semantically meaningful)
- `subpilot-settings.tsx` — minor discount highlight

### Naming conventions locked in
- **Nav label**: "Assessments" → `/teacher/assessments` (canonical)
- "Assessment Hub" removed from sidebar nav (page at `/assessment-hub` still exists)
- "CoreHub" = teacher dashboard product name (intentional, keep)
- "CoreMind" = AI mentor brand name (intentional, keep)

### Sparkles import in layout.tsx
`Sparkles` is used for: Question Extract, GuardianPulse, Coming Soon nav items.
Always include `Sparkles` in the lucide-react import block in `layout.tsx`.

### Login JSON safety
- `auth.ts` POST /login: `res.setHeader("Content-Type", "application/json")` is the FIRST line inside the handler — before `try {}`
- Rate limiter handler also sets Content-Type explicitly
- `auth.tsx` frontend: wraps `JSON.parse(text)` in try/catch, shows user-friendly strings for 401/403/429/5xx

### Page background tokens
- Authenticated pages inside Layout: use `bg-background` (CSS token)
- Public standalone pages: use `min-h-screen bg-background` (not `bg-gray-50`)
- Skeleton loaders: use `bg-muted/40 animate-pulse` (dark-mode safe), NOT `bg-gray-50 animate-pulse`

## Key patterns

### Route registration pattern (app.ts)
All new routes registered in two places: imports at top AND `app.use()` calls in the middle section.

### Admin nav pattern (AdminLayout.tsx)
New nav items go in the `NAV` array. Use `{ label: "— Section Header", header: true }` for separators.

### Vite proxy
`/api` is in `BARE_OK` — all `/api/*` routes proxy to backend automatically.

**Why:** The proxy rewrites non-BARE_OK paths to `/api/<path>`, so adding `/api` to BARE_OK ensures `/api/admin/db-health` isn't double-prefixed to `/api/api/admin/db-health`.
