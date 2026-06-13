---
name: Aperti B4–B12 Stabilization
description: Key decisions and file locations for the B4–B12 system stabilization phase.
---

## What was implemented

**B4 — Deployment compatibility**: Already solid before this phase. `PORT` env var required at startup; `DATABASE_URL` required, `JWT_SECRET`/`SESSION_SECRET`/`OPENAI_API_KEY` warned. `/health` and `/api/health` endpoints existed. `app.ts` already serves built React frontend from `artifacts/aperti/dist/public` in production mode.

**B5 — Route safety**: `src/lib/route-registry.ts` exports `isRouteValid(path)` and `assertRouteValid(path, label)`. Layout.tsx imports `assertRouteValid` and calls it inside the `filteredGroups` filter — logs console.warn in dev for any nav item pointing to an unregistered route. New routes must be added to the registry.

**B6 — Data integrity**: Backend at `/api/admin/data-quality` (router: `admin-data-quality.ts`). Individual fixes: `POST /fix` with `{ issueId }`. Bulk fix: `POST /repair-all` (added) — runs all 4 fixable issues in one call. Frontend data-quality page already had a "Repair All Fixable" button from Phase 39.

**B7 — Error handling**: 
- Frontend `logError`: `src/lib/log-error.ts` — fires to `/api/errors/log`
- Backend `logError`: `artifacts/api-server/src/lib/log-error.ts` — inserts to `error_logs` table
- `ApiError` class added to `src/lib/api.ts`
- Error boundary already existed at `src/components/error-boundary.tsx`

**B8 — API consistency**: `src/lib/api.ts` `fetchJSON` now detects `{ success, data, error }` envelope and throws `ApiError` on `success: false`. Existing functions (`postJSON`, `putJSON`, `patchJSON`, `deleteJSON`) already threw errors on non-ok responses. Full route retrofit not done — too many routes; utility handles both old and new formats transparently.

**B11 — Test runner**: `src/pages/admin/test-runner.tsx` at `/admin/test-runner`. 15 test cases across 4 groups (Infrastructure, Public API, Auth, Admin API, Error Handling). Each test makes real API calls. Individual re-run per test. Added to ADMIN_ROUTES and layout.tsx sidebar Admin group.

**Landing page (B-landing)**:
- MarqueeStrip component added after hero section; respects `prefers-reduced-motion`; 32s loop, 12 items doubled for seamless scroll
- Hero CTAs: primary = `Link /register "Get Started Free"`, secondary = `a #how-it-works "See How It Works"`
- How It Works section has `id="how-it-works"`
- Removed: InteractiveDemo, CoursePreview, GetStartedSteps sections

## Why
- `assertRouteValid` in filter (not render) to avoid re-computation on deep renders
- Backend `logError` wraps pool.query in try/catch so it never throws even if DB is down
- `ApiError` extends `Error` so instanceof checks work in catch blocks
