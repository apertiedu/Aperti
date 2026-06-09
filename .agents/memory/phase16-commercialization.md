---
name: Phase 16 Commercialization & Business Operations
description: Deprecated module removals, subscription billing infrastructure, commerce API, enforced plan limits, and frontend pages.
---

## Deprecated modules removed (Phase 16)
- **Deleted files**: live-class.tsx, twin-control.tsx, inkspace.tsx, live-class-session.tsx (student), student/inkspace.tsx, use-live-class.ts, whiteboard.tsx, routes/live-class.ts, routes/inkspace.ts, socket/signaling.ts, schema/Flex-seats.ts
- **Live-class.ts schema** replaced with empty stub (kept because engagement.ts still imports it — the FK reference removed, just integer column now)
- **engagement.ts** — `liveClassId` is now a plain integer (no FK) since live_class_rooms table is dropped
- **index.ts** (api-server) — `setupSignaling` import and call both removed
- **dashboard.ts** — liveClassRoomsTable query replaced with `activeSessionCount = 0`
- **class-forge.ts** — liveClassRoomsTable import removed
- **content-ecosystem.ts** — inkspace AI convert + templates routes removed
- **schema/index.ts** — Flex-seats export removed

## New DB tables (PHASE16_MIGRATIONS in migrate.ts)
- `payment_requests` — InstaPay reference codes, proof URL, status
- `billing_invoices` — issued invoices per user
- `usage_tracking` — per-user resource counters (UNIQUE on user_id+resource)
- `coming_soon_items` — upcoming features with waitlist flag
- `revision_notes` — user notes with AI generation support

## New ALTER TABLE columns
- `lessons.meeting_link TEXT`
- `accounts.verified_for_commerce BOOLEAN`
- `subscription_plans.limits JSONB`, `visibility BOOLEAN`
- `subscriptions.payment_reference`, `payment_proof_url`, `verified_by`, `verified_at`

## New API routes (all in routes/commerce.ts + routes/revision-notes.ts)
- `GET /api/plans/public` — public pricing (no auth)
- `POST /api/commerce/subscribe` — creates payment_request + InstaPay instructions
- `POST /api/commerce/upload-proof` — user uploads screenshot URL
- `GET /api/commerce/my` — subscription + usage + invoices
- `POST /api/commerce/cancel`
- `GET/POST/PUT/DELETE /api/admin/commerce/plans`
- `GET /api/admin/commerce/subscriptions?status=`
- `GET /api/admin/commerce/payment-requests?status=`
- `PUT /api/admin/commerce/payment-requests/:id/verify` — activates subscription, issues invoice
- `PUT /api/admin/commerce/payment-requests/:id/reject`
- `GET /api/admin/commerce/invoices`
- `GET /api/billing/invoices`
- `GET /api/admin/commerce/analytics/revenue`
- `GET /api/admin/commerce/analytics/subscriptions`
- `GET /api/admin/commerce/analytics/executive`
- `GET /api/coming-soon` — public
- `CRUD /api/admin/commerce/coming-soon`
- `GET /api/flashcards/smart-stats`
- `POST /api/flashcards/track`
- `GET /api/practice/modes`, `GET /api/practice/start`, `POST /api/practice/submit`
- `CRUD /api/revision-notes`, `POST /api/revision-notes/generate`

## enforceLimit wired to creation routes
`enforceLimit(resource)` middleware + `incrementUsage` + `decrementUsage` wired to:
- `routes/courses.ts` — POST `/` (creates aperti_courses) + DELETE (decrements)
- `routes/teacher-courses.ts` — POST `/teacher-courses`
- `routes/students.ts` — POST `/` (single) + POST `/bulk` (delta = inserted.length)
- `routes/question-bank.ts` — POST `/`
- `routes/assessment-hub.ts` — POST `/assessments`

**Why**: Subscription plan limits (e.g. Free = 2 courses, 30 students) are enforced at creation. Returns HTTP 403 with `{ code: "LIMIT_EXCEEDED", resource, limit, current, upgradeUrl }`.

## New middleware
- `artifacts/api-server/src/middleware/enforce-limit.ts`
  - `enforceLimit(resource)` — Express middleware, returns 403 with `upgradeUrl: "/pricing"` if limit exceeded
  - `getUserLimits(userId)`, `getUserUsage`, `incrementUsage(userId, resource, delta=1)`, `decrementUsage`
  - Default plan limits defined in PLAN_DEFAULTS map (free/essential/plus/pro/elite)

## Frontend pages (all use Liquid Flow 2.0)
- `/pricing` — `pages/pricing.tsx` — public plan grid, teacher + student sections
- `/subscribe/:planId` — `pages/subscribe.tsx` — 4-step wizard (review → payment → proof → confirmed)
- `/account/subscription` — `pages/my-subscription.tsx` — usage bars, invoice history, cancel
- `/coming-soon` — `pages/coming-soon.tsx` — feature cards with waitlist CTA
- `/revision-notes` — `pages/revision-notes.tsx` — two-panel editor with AI generation
- `/admin/commerce` — `pages/admin/admin-commerce.tsx` — 6-tab panel (payments/subs/plans/invoices/analytics/coming-soon)
- `/admin/executive` — `pages/admin/executive-dashboard.tsx` — KPI grid + plan bars + recent subs

## Analytics tab in admin-commerce (recharts)
- AnalyticsPanel component (added after ComingSoonPanel in admin-commerce.tsx)
- Fetches `/api/admin/commerce/analytics/revenue` (MRR/ARR/history) and `.../subscriptions` (byPlan/byStatus)
- Charts: BarChart (monthly revenue), PieChart (plan distribution), BarChart horizontal (status breakdown), LineChart (new subs/month)

## Upgrade modal wiring (frontend 403 handling)
- `components/upgrade-modal.tsx` — animated modal with 2 highlight plans; navigates to /pricing
- `hooks/use-plan-limits.ts` — `usePlanLimits()` hook; calls `/api/commerce/my`; provides `isAtLimit(resource)`, `getUsagePercent(resource)`, `getRemaining(resource)`
- 403 `LIMIT_EXCEEDED` handled in: `pages/students.tsx`, `pages/teacher/my-courses.tsx`, `pages/assessment-hub.tsx`, `pages/query-vault.tsx`
- Pattern: check `res.status === 403 && json.code === "LIMIT_EXCEEDED"` → `setUpgradeMsg(json.error); setUpgradeOpen(true)`

## Flashcard Hub smart stats
- `pages/student-portal/my-cardstack.tsx` decks view — shows 4-KPI strip (Total Cards / Mastery % / Due Review / Weak Cards) from `/api/flashcards/smart-stats`
- Stats only shown when data is available (conditional render)

## Key decisions
- **Why no Stripe**: Egypt-first market; InstaPay is the local standard. All payment flow is manual verification.
- **payment_requests.status flow**: `pending` → (user uploads proof) → `paid` → (admin verifies) → `verified`; subscription activated on verify
- **ON CONFLICT for subscriptions**: verify handler uses try/catch fallback because subscriptions table may or may not have a UNIQUE(account_id) constraint
- **Import ordering**: Phase 16 route imports were moved BEFORE `const router = Router()` — dynamic imports after export default are invalid in TypeScript ESM
- **commerceRouter must be mounted BEFORE main router**: `app.use("/api", commerceRouter)` must appear before `app.use("/api", router)` in app.ts. The main router has a global `authenticate` middleware (via qaRouter) that blocks all unmatched requests — public routes in commerceRouter will get 401 if mounted after. See public-routes-before-main-router.md.
- **Default subscription plans**: seeded via executeSql on first setup — 4 teacher plans (Free/Starter/Pro/Elite) and 2 student plans (Student Free/Student Plus) in EGP; use `ON CONFLICT DO NOTHING` to be idempotent.
