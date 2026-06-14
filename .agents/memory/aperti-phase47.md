---
name: Aperti Phase 47 — Unified V2 System Upgrade
description: Permission matrix, AI Teaching Assistant, repair script, deploy pipeline, launch certification — all delivered within existing monorepo structure (no restructure to aperti-v2/).
---

## Items 6/7/8 additions

### Env validation (`config/env.ts`)
`validateEnv()` called in `app.ts` immediately after Express app + PgSession constants are defined (before `isProduction`). Exits process if DATABASE_URL or JWT_SECRET missing or JWT_SECRET < 32 chars. Warns on SESSION_SECRET absence and missing AI key. Call must stay before any middleware or route registration.

### Repair system
- `routes/admin-repair.ts` — orphan detection (7 types), one-click fix, launch score, route check, repair log
- `pages/admin/repair-panel.tsx` — full UI with score gauge, orphan table, fix buttons, repair log viewer
- `repair_log` table — appended to migrate.ts, populated by `scripts/repair.ts --fix` via psql and by `POST /api/admin/repair/fix-orphans`
- Registered: `app.use("/api/admin/repair", adminRepairRouter)` in app.ts, route `/admin/repair` in App.tsx, "Repair Panel" in layout.tsx Admin group

### Launch Readiness Score
- `GET /api/admin/repair/launch-score` — 6 dimensions: route_health(20), db_integrity(20), permission_integrity(15), ai_stability(15), build_quality(15), data_integrity(15) → total 0-100
- `certified = score >= 95 AND no "fail" dimensions`
- FounderControlPage.tsx now queries `/api/admin/repair/launch-score` (queryKey "founder-launch-score") and renders live score replacing hardcoded 95

### Scripts repair.ts V2
New capabilities vs V1: `--fix` flag for actual auto-patch (unsafe role access, JWT fallbacks), route consistency check (compares route-registry.ts vs App.tsx), psql-based repair_log writes, `--json` for CI-friendly output

## Key decisions

### No V2 monorepo restructure
The phase brief mentioned a V2 monorepo at `aperti-v2/`. This was NOT done — it would break the live running system. All V2 substance was delivered within the existing structure (`artifacts/api-server`, `artifacts/aperti`, `lib/`).

### Permission system architecture
- **Why:** Permissions were scattered across `requireRole()` calls with no single source of truth.
- **How to apply:** `artifacts/api-server/src/config/permissions.ts` is the SSOT. Use `requirePermission("permission:action")` middleware on new V2 routes. Defaults come from `DEFAULT_PERMISSIONS`. DB table `role_permissions` stores admin overrides (60s in-memory cache via `overrideCache` Map in `require-permission.ts`). Clear cache with `clearPermissionCache()` after DB writes.

### AI Teaching Assistant — 4 modules
Routes at `/api/ai-teach/{lesson,grade,analyze-student,copilot}`. All use `generateAIText` from `services/ai.ts`. All have in-memory response cache (10-min TTL, 500-entry cap). Graceful fallback if AI unavailable. Usage tracked to `ai_usage_log` table (fire-and-forget, `.catch(()=>{})`).

### New DB tables (Phase 47)
- `role_permissions` — role + permission + granted + updated_at, UNIQUE(role, permission)
- `ai_usage_log` — account_id + module + created_at

Both added to `artifacts/api-server/src/db/migrate.ts` migration array (IF NOT EXISTS).

### New frontend route
`/admin/roles-matrix` → `artifacts/aperti/src/pages/admin/roles-matrix.tsx`. Registered in `ADMIN_ROUTES` block in App.tsx, added to route-registry.ts static routes, added to Admin nav group in layout.tsx.

### Repair script
`scripts/repair.ts` — scans `.ts`/`.tsx` files for critical issues. Exits 1 on critical findings. Run automatically by `scripts/deploy.ts` (bypassed with `SKIP_REPAIR=1`). Generates `repair_report.json`.

### Deploy pipeline
`scripts/deploy.ts` — validates env → pnpm install → repair scan → backend build → frontend build → PM2 restart. `ecosystem.config.js` has two apps: `aperti-api` (dist/index.mjs) and `aperti-web` (vite preview).
