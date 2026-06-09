---
name: Phase 16 Commercialization & Business Operations
description: Deprecated module removals, subscription billing infrastructure, commerce API, and 7 new frontend pages.
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

## New middleware
- `artifacts/api-server/src/middleware/enforce-limit.ts`
  - `enforceLimit(resource)` — Express middleware, returns 403 with `upgradeUrl: "/pricing"` if limit exceeded
  - `getUserLimits(userId)`, `getUserUsage`, `incrementUsage`, `decrementUsage`
  - Default plan limits defined in PLAN_DEFAULTS map

## Frontend pages (all use Liquid Flow 2.0)
- `/pricing` — `pages/pricing.tsx` — public plan grid, teacher + student sections
- `/subscribe/:planId` — `pages/subscribe.tsx` — 4-step wizard (review → payment → proof → confirmed)
- `/account/subscription` — `pages/my-subscription.tsx` — usage bars, invoice history, cancel
- `/coming-soon` — `pages/coming-soon.tsx` — feature cards with waitlist CTA
- `/revision-notes` — `pages/revision-notes.tsx` — two-panel editor with AI generation
- `/admin/commerce` — `pages/admin/admin-commerce.tsx` — 5-tab panel (payments/subs/plans/invoices/coming-soon)
- `/admin/executive` — `pages/admin/executive-dashboard.tsx` — KPI grid + plan bars + recent subs

## Reusable component
- `components/upgrade-modal.tsx` — animated modal with 2 highlight plans; trigger when enforceLimit returns 403

## Key decisions
- **Why no Stripe**: Egypt-first market; InstaPay is the local standard. All payment flow is manual verification.
- **payment_requests.status flow**: `pending` → (user uploads proof) → `paid` → (admin verifies) → `verified`; subscription activated on verify
- **ON CONFLICT for subscriptions**: verify handler uses try/catch fallback because subscriptions table may or may not have a UNIQUE(account_id) constraint
- **Import ordering**: Phase 16 route imports were moved BEFORE `const router = Router()` — dynamic imports after export default are invalid in TypeScript ESM
