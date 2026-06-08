---
name: Phase 9 Admin OS
description: Full admin command centre built in Phase 9 — routes, schema, frontend pages, and wiring decisions
---

## DB Schema
New file: `lib/db/src/schema/admin-phase9.ts` — exported via `lib/db/src/schema/index.ts`.
Tables: organization_settings, payment_transactions, revenue_records, platform_analytics, system_health_logs, feature_flags, knowledge_base_articles, compliance_requests, backup_logs, assistant_invitations, platform_settings, content_moderation.
`organizations` table extended with: type, logo_url, branding, contact_info, address, country, language, timezone, subscription_plan_id, updated_at.
`audit_logs` extended with: entity_type, entity_id, changes, user_agent.
Applied via raw SQL (NOT drizzle push — interactive prompt issue).

## API Routes — all mounted in app.ts
All routes require `requireRole("admin", "super_admin")` middleware.
Mount prefix pattern: `/api/admin/<resource>`:
- `/api/admin/users` → admin-users.ts (list, CRUD, suspend/restore, impersonate, bulk import, export CSV)
- `/api/admin/organizations` → admin-organizations.ts
- `/api/admin/subscriptions` → admin-subscriptions.ts (plans + subscriptions)
- `/api/admin/payments` → admin-payments.ts (transactions, verify/reject, revenue report)
- `/api/admin/analytics` → admin-analytics.ts (users, courses, AI, dashboard)
- `/api/admin/health` → admin-health.ts (live metrics, history, scaling)
- `/api/admin/feature-flags` → admin-features.ts
- `/api/admin/audit-logs` → admin-audit.ts (list + CSV export)
- `/api/admin/security` → admin-security.ts (sessions, recovery)
- `/api/admin/support` → admin-support.ts (tickets, analytics)
- `/api/admin/kb` → admin-kb.ts (knowledge base articles)
- `/api/admin/compliance` → admin-compliance.ts (requests, backups, platform-settings)
- `/api/admin/roles` → admin-roles.ts (static RBAC matrix)
- `/api/admin/courses` → admin-courses.ts

## Frontend — Admin OS
Entry: `artifacts/aperti/src/pages/admin/admin-os/index.tsx` — self-contained SPA with its own sidebar layout.
Layout: `AdminLayout.tsx` — collapsible sidebar, 20 nav items, no dependency on main Layout component.
All pages live in `artifacts/aperti/src/pages/admin/admin-os/`.
Pages: Dashboard, UsersPage, OrgsPage, RolesPage, CoursesAdminPage, SubscriptionsPage, PaymentsPage, AnalyticsPage, HealthPage, FeaturesPage, AuditPage, SecurityPage, SupportPage, KBPage, CompliancePage.

## App.tsx Wiring
AdminOS is imported and wired BEFORE other admin routes so `/admin/os/:rest*` is matched first:
```
<Route path="/admin/os/:rest*" component={AdminOS} />
<Route path="/admin/os" component={AdminOS} />
```
AdminOS handles its own internal routing via wouter Switch — no prefix stripping needed since the full path is used.

## API Utilities (lib/api.ts)
Added fetchJSON, postJSON, putJSON, deleteJSON helpers to `artifacts/aperti/src/lib/api.ts`.
All auto-attach `aperti_token` Bearer header from localStorage.

**Why:** Admin OS uses React Query + these helpers for all data fetching. The existing apiFetch was fetch-only; typed async helpers reduce boilerplate.

## Feature Flags Seed
8 flags seeded on first migration run: ai_mentor, live_classes, parent_portal, advanced_analytics, question_bank, exam_vault, inkspace, study_groups.

## Payments (Egypt-first)
Egypt EGP, methods: instapay, bank_transfer. Manual verification flow:
1. User submits transaction with screenshot URL + reference number → status=pending
2. Admin reviews in `/admin/os/payments` → calls `/api/admin/payments/verify` or `/reject`
3. Verify sets subscription status=active and inserts revenue_record automatically.

## Access
Admin OS accessible at `/admin/os` after login as admin/super_admin.
Link added to existing AdminCommand page as the first module card ("Admin OS ✦ New").
