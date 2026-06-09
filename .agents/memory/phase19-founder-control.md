---
name: Phase 19 Founder Control Center
description: DB tables, route files, frontend pages, and key decisions for Phase 19 operational layer.
---

## DB Tables Created (via executeSql)
platform_metrics, content_quality_scores, user_lifecycle_stages, search_logs, notification_rules, founder_alerts, releases (with is_published boolean column), feature_retirement_log, revision_smart_packs

## Route Files (all pre-built, registered in app.ts)
- `founder.ts` → /api/founder/* (overview, revenue, growth, academic, ai-usage, readiness, subscriptions, user-lifecycle, alerts, content-quality)
- `launch-releases.ts` → /api/releases (public) + /api/admin/releases (protected) + /api/launch/*
- `notification-rules-admin.ts` → /api/admin/notification-rules
- `search.ts` → /api/search (PUBLIC — registered before main router)
- `founder-alerts-worker.ts` → exports startFounderAlertsWorker()
- `content-quality-admin.ts` → /api/admin/content-quality/*
- `revision-v3.ts` → /api/revision/* (smart-pack, generate-smart-pack)
- `flashcard-v3.ts` → /api/flashcards/v3/* (learning-modes/:deckId)

## Public Route Registration Pattern
searchRouter at `/api/search` and releasesRouter at `/api` (for /api/releases) must be registered in app.ts BEFORE `app.use("/api", router)` — same rule as qaRouter.

## Frontend Pages (admin-os/)
FounderControlPage, FounderRevenuePage, FounderGrowthPage, ContentQualityPage, AiCostsPage, NotificationRulesPage, FounderAlertsPage, LaunchCommandPage — all wired in admin-os/index.tsx under "Founder Control" sidebar section.

## Student-Facing Enhancements
- `revision-notes.tsx`: Smart Pack button (purple, calls POST /api/revision/generate-smart-pack with subject param); generatedPack display inline.
- `flashcard-swipe.tsx`: Learning Mode selector pill in header; 5 modes (classic/exam/rapid_review/weakness_recovery/mastery_challenge); dropdown with check marks; state local only (no backend call needed to select mode).

**Why:** Learning mode is purely a client-side session preference that shapes which cards are shown; no persistence needed unless integrated with /api/flashcards/v3/learning-modes/:deckId save endpoint.
