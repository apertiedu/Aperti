---
name: Aperti Launch Blocker Remediation
description: 11-item remediation sprint — security, a11y, email, AI reliability, CSRF, subscriptions
---

## Items implemented

1. **ALLOWED_ORIGINS** — env.ts now fatally errors in production if neither ALLOWED_ORIGINS nor REPLIT_DOMAINS is set. Documents SMTP_* vars too.
2. **Password complexity** — `validatePasswordComplexity()` in auth.ts: uppercase + lowercase + digit + special char + 8 chars min; applied to /student-register, /register, /reset-password.
3. **SMTP email delivery** — email.ts rewritten with nodemailer; falls back to console-log when SMTP not configured. `SMTP_CONFIGURED` boolean exported.
4. **Password reset email flow** — /auth/forgot-password sends tokenised email when SMTP_CONFIGURED + account has email; falls back to admin-assisted flow otherwise. Tokens stored in `password_reset_tokens` table.
5. **Accessibility tests** — artifacts/aperti/tests/accessibility.spec.ts + playwright.config.ts; axe-core + Playwright, WCAG 2.1 AA, tests public pages.
6. **AI circuit breaker** — artifacts/api-server/src/lib/ai-circuit-breaker.ts: CLOSED/OPEN/HALF_OPEN, 5 failures in 60s window opens, 30s reset timeout, single probe slot (probe slot consumed immediately in OPEN→HALF_OPEN transition to prevent double-probe). Wired into generateAIResponse. Status exported via aiCircuitStatus().
7. **Critical audit alerting** — audit.ts now calls dispatchAlert() for every audit event with severity="critical". /api/ai/health shows circuitBreaker status.
8. **CSRF protection** — double-submit cookie pattern in middleware/csrf.ts; GET /api/auth/csrf-token issues token; exempts /auth/* + /api/errors/* + /api/webhooks/* + OAuth. Frontend api.ts sends x-csrf-token header on POST/PUT/PATCH/DELETE. Prefetched in main.tsx.
9. **Screen-reader announcements** — live-announcer.tsx: LiveAnnouncerProvider (polite + assertive aria-live regions), useLiveAnnouncer() hook, RouteChangeAnnouncer (MutationObserver on <title>). Mounted in App.tsx.
10. **Moderation audit logging** — admin-content-validation.ts routes now call auditFromReq("EXPORT_REPORT") on all three endpoints.
11. **Subscription payment failure** — POST /api/subscriptions/lifecycle/payment-failure: active→grace_period, grace_period→expired; fires dispatchAlert with "warning" severity; records to billing_events.

## Key patterns

- **Why audit.ts calls dispatchAlert:** critical events (ADMIN_IMPERSONATE, PERMISSION_GRANT, etc.) need out-of-band notification beyond DB rows.
- **Why CSRF exempts /auth/*:** public auth endpoints are protected by rate-limiting + SameSite=lax; CSRF is most valuable for authenticated state-changing calls.
- **Why circuit breaker probe consumed immediately in OPEN case:** prevents two concurrent requests both being admitted as "probe" when OPEN timeout elapses.
