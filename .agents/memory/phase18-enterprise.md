---
name: Phase 18 Enterprise Readiness
description: Tables, routes, pages, and key decisions for Phase 18 – Enterprise Readiness & Master Governance
---

## DB tables added (PHASE18_MIGRATIONS in migrate.ts)
- `audit_logs` — added `details jsonb` and `severity` columns (back-fill alter)
- `currencies` — seeded with EGP/USD/EUR defaults
- `languages` — seeded with AR (default) + EN
- `doc_articles` — seeded with 4 onboarding articles
- `ai_interactions` — tracks per-call tokens and model usage
- `system_health_logs` — service/metric/value/status snapshots
- `knowledge_base_articles` — user-facing KB with category + language
- `launch_audit_items` — checklist items with pass/fail/pending status
- `compliance_requests` — GDPR-style deletion/export requests from users
- `automation_tasks` — back-filled here (Phase 10 service uses it but table was never created)

## Route files registered in routes/index.ts
All mounted under `/api/`:
- `adminAuditRouter` → `/admin/audit-logs`
- `adminHealthRouter` → `/admin/health`
- `adminDocsRouter` → `/admin/docs-articles`
- `adminKbRouter` → `/admin/kb`
- `adminAiUsageRouter` → `/admin/ai-usage` (summary + threshold endpoints)
- `adminComplianceRouter` → `/admin/compliance`
- `adminLaunchAuditRouter` → `/admin/launch-audit`
- `i18nRouter` → root (currencies/languages)
- `userExportRouter` → root (`/user/export` POST, `/user/deletion-request` POST)

## Frontend pages (admin-os)
- `AiUsagePage` → `/admin/os/ai-usage` — daily call chart, by-type/by-role breakdown, cost alert threshold
- `LaunchAuditPage` → `/admin/os/launch-audit` — grouped checklist with auto/manual checks, readiness score

Both wired in `admin-os/index.tsx` and `AdminLayout.tsx` sidebar nav.

## Settings page
- Added **Privacy & Data** tab (8th tab) to `settings.tsx`
- Data export calls `POST /api/user/export` → streams JSON blob download
- Account deletion calls `POST /api/user/deletion-request` with confirmation step
- Interface language preference already existed in Appearance tab

## Key decisions
- `logAudit()` helper already lives in `middleware/tenant.ts` — use it for any new auditable admin action; it never throws (swallows errors silently)
- Auth already writes to `login_history` table — no separate audit entry needed for login
- `automation_tasks` was referenced by AutoPilot scheduler since Phase 10 but never migrated — fixed in Phase 18 PHASE18_MIGRATIONS with IF NOT EXISTS + seed rows
- `doc_articles` seeded with 4 real help articles (onboarding, assessment, billing, AI tutor)

**Why automation_tasks in Phase 18:** AutoPilot scheduler ran every 60s querying this table; without it every tick logged a noisy error. Adding IF NOT EXISTS in Phase 18 is safe and idempotent.
