---
name: Aperti Phase 50 Production Overhaul
description: Full production hardening — security, payment UX, graceful shutdown, mobile safety, state system, route progress bar
---

## Security hardening applied
- `registerLimiter` (10/hr per IP) added to `/auth/register` and `/auth/student-register` — was missing while `/auth/login` already had one
- `subscribeLimiter` (8/15min per IP) added to `POST /api/commerce/subscribe` in commerce.ts — import `rateLimit from 'express-rate-limit'` directly, do NOT use a custom keyGenerator or ERR_ERL_KEY_GEN_IPV6 warning fires
- `sanitizeBody` middleware (artifacts/api-server/src/middleware/sanitize-body.ts) strips `<script>`, inline event handlers, `javascript:` from all request body fields — wired in app.ts after cookieParser
- Explicit headers added in app.ts after helmet: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`

## Deployment readiness
- `setupGracefulShutdown(httpServer)` added in index.ts — listens for SIGTERM/SIGINT, calls `server.close()` then `pool.end()`, 15s force-kill timeout with `.unref()` so it doesn't block event loop
- Call `setupGracefulShutdown` BEFORE `httpServer.listen`

## Payment UX (subscribe.tsx)
- Was using local `fetchJSON`/`postJSON` without `credentials:"include"` — now imports from `@/lib/api` which always sends cookies
- Added `subscribeMut.isError` and `proofMut.isError` inline error states with retry support
- Added skeleton loading state for plan loading (instead of bare spinner)
- Step connector lines now teal-colored for completed steps

## Frontend additions
- `route-progress-bar.tsx` — thin 2.5px teal top bar, tracks wouter location changes, uses shimmer animation, auto-completes after 600ms
- `network-status-banner.tsx` — slides down from top on offline/reconnect events, auto-dismisses after 3s on reconnect
- Both wired into App.tsx: place OUTSIDE ErrorBoundary/AuthProvider so they always render

## Mobile CSS
- `@media (max-width: 768px)` safety net added to index.css: `#root { overflow-x: hidden }`, iOS zoom prevention (`font-size: max(16px, 1rem)` on inputs), 44px min tap targets for buttons
- `prefers-reduced-motion` block added — collapses all animations to 0.01ms
- `prefers-contrast: high` support added
- `html { scroll-behavior: smooth }` added globally

**Why:** The subscribe.tsx missing `credentials:"include"` was the root cause of silent 401s during the payment flow. The registerLimiter was a genuine security gap (login was protected but register wasn't). The subscribeLimiter custom keyGenerator caused an IPv6 validation error — use the default IP keying instead.
