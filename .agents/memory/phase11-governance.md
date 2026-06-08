---
name: Phase 11 Governance
description: Role architecture, access control, workflow governance & platform integrity — all tables, routes, and frontend pages
---

## Key decisions

All governance tables use the `gov_` prefix to avoid clashing with existing tables.

**DB tables (13 total):**
gov_roles, gov_permissions, gov_role_permissions, gov_user_roles, gov_assistant_approvals, gov_enrollment_workflows, gov_enrollments, gov_course_access_rules, gov_subscription_governance, gov_feature_access_matrix, gov_audit_enforcement, gov_conflict_logs, gov_communication_permissions, gov_ai_access_rules

**Schema file:** `lib/db/src/schema/governance.ts` (exported from schema/index.ts)

**API:** Single comprehensive route file at `artifacts/api-server/src/routes/governance.ts`, registered at `/api/admin/governance` in `app.ts`.

**Middleware:** `artifacts/api-server/src/middleware/ownership.ts` — `requireOwnership` for teacher isolation, `requireSelf` for self-scoped routes.

**Frontend pages (all in admin-os/):**
- RolesPage.tsx — Role Hierarchy Tree, Permission Matrix (checkbox toggle), Custom Role Builder, Effective Permissions Viewer
- EnrollmentsPage.tsx — Full enrollment governance with conflict scan
- AssistantsPage.tsx — Invite/approve/reject assistants with permission profiles
- FeaturesMatrixPage.tsx — Feature Access Matrix + Subscription Grid + AI Access Rules + Comm Permissions (4-tab)
- ConflictPage.tsx — Conflict detection center with resolve workflow
- IntegrityPage.tsx — Runs integrity validation, shows score ring + checklist
- UserAccessPage.tsx — Per-user role/permission management panel

**AdminLayout.tsx** updated: v11.0, grouped nav with section headers, 5 new nav items added.

**Initial seeded data:** 6 system roles, 26 permissions, 20 features, 8 AI rules, 16 comm rules, 20 sub-feature entries.

**Why:** Uses `pool.query()` directly for all governance routes (consistent with admin-* routes pattern, avoids Drizzle schema rebuild).

**How to apply:** Tables already created via `executeSql`; no migration file needed since the schema is also in `lib/db/src/schema/governance.ts` for type safety in other consumers.
