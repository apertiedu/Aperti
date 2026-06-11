---
name: Aperti Phase 26 Stability
description: Phase 26 stability fixes, new tables, components, and QA patterns added to the platform
---

## Session Table
connect-pg-simple requires a `session` table in PostgreSQL. It must be created manually (not via Drizzle push-schema). Standard SQL in Drizzle push-schema or psql. Without it, session-based auth fails silently.

**Why:** Drizzle schema does not include connect-pg-simple's session table; it has to be created separately.

## problem_reports Table Schema
The backend (`problem-reports.ts`) uses columns: `account_id`, `page_url`, `user_agent`, `ip_address`. The manual DB migration created `reporter_id` instead. Fix: `ALTER TABLE problem_reports ADD COLUMN IF NOT EXISTS account_id int REFERENCES accounts(id) ON DELETE SET NULL` plus the three other columns.

**Why:** Mismatch between auto-created backend schema and manual migration schema caused INSERT failures.

## New Tables (Phase 26)
- `problem_reports` — user-submitted bug reports (backend auto-creates, also manually created)
- `frontend_error_logs` — JS crashes logged from ErrorBoundary
- `launch_blockers` — pre-launch issue tracker (seeded with 6 rows)

## Backend Routes
- `GET/POST/PATCH/DELETE /api/founder/launch-blockers` — added to `artifacts/api-server/src/routes/founder.ts`
- `POST /api/founder/frontend-errors` — frontend error log ingestion (also in founder.ts)
- `founderRouter` is mounted at `/api/founder` in `app.ts`
- Health endpoint is at `/api/health` (not `/health` or `/healthz`)

## Auth Context: sessionExpired
`auth.tsx` now exports `sessionExpired` boolean and `clearSessionExpired()`. Set to `true` when `/auth/me` returns 401 AND user was previously set (mid-session expiry). `SessionExpiryGate` component in `App.tsx` reads this and renders `SessionExpiryModal`.

**Why:** Previously session expiry silently cleared state; users saw login page with no explanation.

## ErrorBoundary
`error-boundary.tsx` now calls `POST /api/founder/frontend-errors` in `componentDidCatch`. Fire-and-forget, never throws.

## Admin OS
- `LaunchBlockersPage.tsx` at `/admin/os/launch-blockers` — full CRUD for blockers, grouped by severity
- Added to `AdminLayout.tsx` NAV under "— Founder Control" with `ShieldAlert` icon
- Route registered in `admin-os/index.tsx`

## QA Script
`scripts/qa-agents.mjs` — runs 13 checks covering health, auth, problem reports, launch blockers, frontend errors, founder overview, and DB health. Run with `node scripts/qa-agents.mjs`. Exit code 0 = all pass, 1 = failures.

## DB Constraints
`accounts.role` now has `NOT NULL` constraint and `DEFAULT 'teacher'`. Applied via `ALTER TABLE`.
