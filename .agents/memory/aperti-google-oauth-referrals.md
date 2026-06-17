---
name: Aperti Google OAuth + Referrals
description: Google OAuth implementation details, Vite bypass fix, referral system schema, and login.tsx constant pitfall.
---

## Google OAuth

- Routes: `GET /auth/google` (redirect to Google) + `GET /auth/google/callback` (CSRF check, upsert account, set cookie)
- Uses Node built-in `fetch` — no `google-auth-library` needed
- CSRF: random state stored in cookie `oauth_state`, verified on callback
- New users: redirected to `/onboarding`; existing users: redirected to `/`
- Required env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`; optional `GOOGLE_REDIRECT_URI`
- If vars absent: redirect to `/login?error=google_not_configured`
- `google_id` column added to accounts via psql

**Why:** Node fetch avoids a heavy dependency; state-cookie CSRF is stateless and works across restarts.

## Vite Proxy Bypass Fix

- `bypass()` in `vite.config.ts` must return `undefined` for `/auth/*` paths — NOT `/index.html`
- Added `BACKEND_PREFIXES` array check so all `/auth/...` calls hit the backend, not the SPA
- Without this fix, OAuth callback redirects were intercepted and served as the React app

## Referral System

- DB: `referrals` table + `referral_code` column on `accounts` (added via psql)
- 4 endpoints at `/api/referrals`: `my-code`, `stats`, `apply`, `leaderboard`
- Frontend: `/referrals` page, linked from student layout `allNav` and teacher layout "Marketplace" group
- Referral code auto-filled from URL `?ref=` param in register.tsx
- Code applied in `auth.ts` register route after account creation

## login.tsx Constant Pitfall

- `TEAL_LIGHT` is used in the captcha background style but was NOT defined as a const
- Fix: add `const TEAL_LIGHT = "hsl(var(--primary) / 0.1)";` at the top of the file (after imports)
- This caused a silent runtime `undefined` value for the background style
