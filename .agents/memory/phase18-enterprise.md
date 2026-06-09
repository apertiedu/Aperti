---
name: Phase 18 Enterprise Readiness
description: Tables, routes, pages, and key decisions for Phase 18 – Enterprise Readiness & Master Governance
---

## DB tables added (PHASE18_MIGRATIONS in migrate.ts)
- `audit_logs` — added `details jsonb`, `severity text DEFAULT 'info'`, `user_agent text` columns (back-fill alter)
- `currencies` — seeded with EGP/USD/EUR defaults
- `languages` — seeded with AR (default) + EN
- `doc_articles` — seeded with 4 onboarding articles
- `ai_interactions` — tracks per-call tokens and model usage
- `system_health_logs` — service/metric/value/status snapshots
- `knowledge_base_articles` — user-facing KB with category + language
- `launch_audit_items` — columns: id, check_key, status, notes, checked_manually, updated_at (NO category column — category is runtime-derived from AUTO_CHECKS constant)
- `compliance_requests` — GDPR-style deletion/export requests from users
- `automation_tasks` — back-filled here (Phase 10 service uses it but table was never created)

## Route registration in app.ts (Phase 18 additions)
**BEFORE** `app.use("/api", router)` — public routes:
- `i18nRouter` → `/api/i18n/currencies` and `/api/i18n/languages` (public, no auth)

**AFTER** main router — admin routes (auth provided by pass-through):
- `adminAiUsageRouter` → `app.use("/api/admin/ai-usage", ...)`
- `adminDocsRouter` → `app.use("/api/admin/docs", ...)`
- `adminLaunchAuditRouter` → `app.use("/api/admin/launch-audit", ...)`
- `userExportRouter` → `app.use("/api", ...)` handles `/user/export` POST and `/user/deletion-request` POST

Already registered from earlier phases:
- `adminAuditRouter` → `/api/admin/audit-logs`
- `adminHealthRouter` → `/api/admin/health`
- `adminKbRouter` → `/api/admin/kb`
- `adminComplianceRouter` → `/api/admin/compliance` (root 404 expected — use `/compliance/requests`)

## Frontend pages (admin-os)
- `AiUsagePage` → `/admin/os/ai-usage`
- `LaunchAuditPage` → `/admin/os/launch-audit`
- `AuditPage` → `/admin/os/audit` — upgraded with severity stat cards (info/warning/error/critical), severity filter dropdown, stats endpoint
Both wired in `admin-os/index.tsx` and `AdminLayout.tsx` sidebar.

## Settings page
- **Privacy & Data** tab: data export → `POST /api/user/export`, account deletion → `POST /api/user/deletion-request`
- Language picker in Appearance tab

## Deprecation cleanup (Phase 18 completion)
- FlexSeats: removed from `subpilot.tsx` (tab, TabsContent, flexMutation, flexQty state, display row)
- InkSpace: "InkSpace notes" → "Revision Notes" in `checkout.tsx`
- LiveClass: → "CourseBuilder" in `landing-settings.ts`; text refs updated in `onboarding-wizard`, `landing`, `student-register`, `admin-command`
- DB tables already dropped Phase 16 migrate.ts (twin_control_sessions, live_class_rooms, flex_seats)

## Key gotchas
- `launch_audit_items` has NO `category` column — ORDER BY must use `check_key` only
- `i18nRouter` must be registered BEFORE `app.use("/api", router)` — same rule as other public routers (phase14, commerce, mobile)
- `logAudit()` helper in `middleware/tenant.ts` — use for any new auditable action; swallows errors silently

**Why:** Public i18n endpoints placed before main auth-gated router. Admin routes placed after, relying on pass-through authenticate.
