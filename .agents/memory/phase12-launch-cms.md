---
name: Phase 12 Launch CMS
description: Dynamic Launch Management, Feature Release Control, Landing CMS & Growth Experience — key constraints and wiring decisions
---

## DB Tables (17)
feature_registry, feature_waitlist, beta_testers, release_notes, roadmap_items, landing_sections, testimonials, faqs, events, demo_configurations, branding_settings, notification_campaigns, conversion_events, feature_adoption_metrics, platform_status, early_access_program, subscription_plans (ALTER: is_visible_landing, badge, display_order)

## Key Constraints
- `release_notes.type` CHECK: `major | minor | bugfix | security | announcement` (NOT "feature" — this caused seed failures)
- `announcements` table already existed from Phase 7 — launch-cms.ts reuses it directly

## Backend
- All routes in `artifacts/api-server/src/routes/launch-cms.ts`, registered at `/api` prefix in `app.ts`
- Public endpoints (no auth): `/api/landing`, `/api/features/public`, `/api/roadmap`, `/api/release-notes`, `/api/platform-status`, `/api/faqs/public`, `/api/testimonials/public`
- `/api/landing` returns: `{ sections, testimonials, faqs, plans, branding }` — full assembly for CMS-driven landing

## Frontend — Admin (17 pages at /admin/os/)
feature-registry, waitlist, beta, release-notes, roadmap-admin, landing-cms, testimonials, faqs-admin, events, demo-branding, campaigns, growth-dashboard, conversion-analytics, platform-status, announcements, adoption + AdminLayout "Growth & Launch" nav section

## Frontend — Public (5 pages + detail)
- `/features` → features-showcase.tsx — searchable grid, 15 features, waitlist modal
- `/features/:id` → features-detail.tsx — full detail: status badge, countdown timer, waitlist/beta CTA, dependencies list
- `/roadmap` → roadmap-public.tsx — grouped by status (planned/in_progress/completed)
- `/release-notes` → release-notes-public.tsx — changelog with type badges
- `/status` → status-public.tsx — component status grid + incident feed

## Countdown Timer
- Self-contained in features-detail.tsx, not a shared component
- Reads `launch_countdown_seconds` from `/api/features/:id` (EXTRACT EPOCH, null for released)
- Shows days/hrs/min/sec tiles in teal; hides if 0 or null

## CTA logic in features-detail.tsx
- released → "Use This Feature" → /login
- coming_soon or scheduled → "Join Waitlist" modal → POST /api/features/:id/waitlist
- beta → "Apply for Beta" modal (reuses WaitlistModal) → same endpoint

## Landing CMS Rewrite (landing.tsx)
- Fully CMS-driven via `useLandingCMS()` hook fetching `/api/landing`
- Hero copy, feature list, pricing plans, testimonials, FAQs, stats, contact CTA all come from CMS
- Graceful fallback to hardcoded defaults if CMS data unavailable
- Added Testimonials section (CMS), FAQ accordion (CMS), Roadmap teaser section
- Footer now includes links to /features, /roadmap, /release-notes, /status
- Early Access form POSTs to `/api/waitlist/join`

**Why:** The `<Link>` component in wouter renders as `<a>` — never put `<a>` as a direct child of `<Link>`, move className directly onto `<Link>` instead.
