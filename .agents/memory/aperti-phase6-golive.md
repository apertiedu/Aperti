---
name: Aperti Phase 6 Go-Live Certification
description: Landing page rebuild, checkout screenshot fix, admin payments history, production readiness cert
---

## Key Decisions

**Landing page (landing.tsx):**
- Was 2223 lines with CMS dependency; rebuilt to ~650 focused conversion lines
- Removed: 3D WebGL hero (performance), CMS-only testimonials (empty), SimVerse
- Added: HeroDashboardMockup (illustrative hardcoded UI), useCountUp stats, FAQ accordion, PricingSection with /api/plans/public + fallback
- Pricing section uses fallback hardcoded plans if API returns empty (prevents blank section)
- No CMS dependency — all sections render even with no backend data

**Checkout screenshot upload (checkout.tsx):**
- Bug: FormData was created but `apiFetch` was called with JSON body — screenshot never sent
- Fix: `uploadScreenshot()` calls `POST /api/upload` with FormData first, gets back URL, then passes `screenshotUrl` in JSON body to `/api/subscriptions/checkout`
- If /api/upload fails, toast error and halt (don't submit without proof)

**PaymentsPage (PaymentsPage.tsx):**
- Added "Approval History" tab — calls `/api/secure-payments/history` (already existed but wasn't exposed in UI)
- History shows: transaction #, user, amount, reference, decision, decided-by actor+role, date, notes
- Rejection now shows a required-reason form before confirming (not just silent reject)
- Alert banner shown when pending count > 0 and user is on a different tab

**Production Readiness Certificate:**
- Located at: `docs/LAUNCH_READINESS.md`
- Score: 85/100 (B+) — Conditional Go for private beta
- 3 critical blockers before public: AI key, INSTAPAY_PHONE/NAME, explicit JWT_SECRET
- 201 API routes audited, 65 frontend routes audited, all 5 roles flow-tested

**Why:**
- Checkout fix: users were submitting payments without screenshots being stored — admin had no proof to verify against
- Landing rebuild: CMS-dependent sections silently disappeared if API call failed; conversion loss
- History tab: admins had no way to audit past decisions without accessing DB directly
