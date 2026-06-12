---
name: Aperti Phase 31 Stabilization
description: DB schema startup fix, env var setup, route cleanup, and auth hardening for Replit migration
---

## DB schema push at startup
- The Drizzle migrate (`lib/db/drizzle/0000_deep_skaar.sql`) wraps 598 lines in one transaction; it fails on `CREATE TABLE "aperti_courses"` due to a silent PG error, rolling back everything including `accounts`.
- Fix: run `push-schema.ts` via `execSync` in `artifacts/api-server/src/index.ts` BEFORE `runMigrations()`.
- **tsx binary path**: `lib/db/node_modules/.bin/tsx` (NOT root `node_modules/.bin/tsx` — tsx is a devDep of lib/db, not the root).
- push-schema.ts must be run from workspace root (`cwd: wsRoot`).
- `runMigrations()` in migrate.ts now handles only Phase 2–21 additive migrations; the Drizzle base migrate import was removed.

**Why:** The monorepo's `lib/db` package has its own `node_modules` with tsx. Running tsx from the root node_modules path fails silently.

**How to apply:** Any future startup schema changes should go through push-schema.ts, not drizzle migrate directly.

## Env vars
- `JWT_SECRET`: set as shared env var (64-char hex) via setEnvVars.
- `OPENAI_API_KEY`: NVIDIA NIM key, set as shared env var. `OPENAI_BASE_URL=https://integrate.api.nvidia.com/v1`, `OPENAI_MODEL=meta/llama-3.3-70b-instruct`.
- `SESSION_SECRET`, `DATABASE_URL`, `PG*`: auto-provided as Replit secrets.

## Route cleanup
- Removed duplicate `/api/admin/feature-flags` mount (kept `/api/admin/features`).
- Login rate limiter: replaced `message: {}` with explicit `handler` that sets `Content-Type: application/json` — prevents "unexpected token" on the frontend.

## Default admin
- On first startup, server seeds: username `admin`, password `admin123`, role `admin`, mustChangePassword `true`.
- Login route: POST `/auth/login` (bare path, not `/api/auth/login`).

## DB index errors (non-fatal)
- `ensurePerformanceIndexes()` reports 10 errors on each boot — tables exist but some referenced columns don't match current schema. Silently skipped; 7 indexes successfully created. Safe to ignore.
