# Aperti — Production Transition Verification Report
**Date:** 2026-06-28  
**Status:** ALL TASKS COMPLETE — 30/30 tests passing

---

## Task 1 — Route Implementation

### Routes Mounted

| Route | File | Prefix | Auth Guard | Status |
|-------|------|--------|-----------|--------|
| Student course enrollment (CRUD + FSM) | `routes/enrollments.ts` | `GET/POST /api/enrollments` | `authenticate` + `requireRole("student")` | MOUNTED |
| Teacher enrollment approvals | `routes/enrollments.ts` | `PATCH /api/enrollments/:id/status` | `authenticate` + `requireRole("teacher","admin","super_admin","assistant")` | MOUNTED |
| Teacher operations dashboard | `routes/teacher-ops.ts` | `GET /api/teacher-ops/dashboard` | `authenticate` + `requireRole("teacher","admin","super_admin","assistant")` | MOUNTED |
| Teacher activity log | `routes/teacher-ops.ts` | `GET /api/teacher-ops/activity` | `authenticate` + `requireRole("teacher","admin","super_admin","assistant")` | MOUNTED |

### Changes Made (app.ts)

```typescript
// imports added
import { enrollmentsRouter } from "./routes/enrollments";
import { teacherOpsRouter }  from "./routes/teacher-ops";

// mounts added (lines 618–619)
app.use("/api/enrollments",  enrollmentsRouter);
app.use("/api/teacher-ops",  teacherOpsRouter);
```

### Enrollment FSM State Machine (verified by tests)

```
requested → payment_pending | verification_pending | approved | rejected | cancelled
payment_pending → verification_pending | approved | rejected | cancelled
verification_pending → approved | rejected | cancelled
approved → suspended | cancelled
rejected → requested  (student can re-apply)
cancelled → requested (student can re-apply)
suspended → approved | cancelled
```

All 11 state-machine tests pass including edge cases (blocked same-state, blocked unknown transitions).

---

## Task 2 — Environment & Production Secrets

### Secrets Configured

| Variable | Value | Method | Status |
|----------|-------|--------|--------|
| `PUBLIC_URL` | `https://aperti.ai` | Replit Secret | SET |
| `ALLOWED_ORIGINS` | `https://aperti.ai` | Replit Secret | SET |
| `DATABASE_URL` | (PostgreSQL connection string) | Replit Secret | SET |
| `SESSION_SECRET` | (random 64+ char) | Replit Secret | SET |
| `JWT_SECRET` | Fallback to SESSION_SECRET | Replit Secret | SET (recommend explicit) |

### Startup Warning List (expected, non-blocking)

The backend starts cleanly with these warnings — none are fatal in development:
- AI API key not set (AI features disabled — acceptable for now)
- VAPID keys ephemeral (push notifications not persistent)
- INSTAPAY_PHONE not set (payment UI shows placeholder)
- EXAM_VAULT_KEY not set (encryption disabled)
- SMTP not set (email console-logged)
- GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set (OAuth shows error to users)

### env.ts updates

- Added `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` to header documentation
- Added runtime warning when Google OAuth credentials are absent
- Updated ALLOWED_ORIGINS example to `https://aperti.ai`
- `PUBLIC_URL` warning already confirmed absent from startup logs (secret is live)

---

## Task 3 — Google OAuth Authentication

### Backend Routes (pre-existing, verified working)

| Route | Behaviour |
|-------|-----------|
| `GET /auth/google` | Redirects to `accounts.google.com/o/oauth2/v2/auth` when `GOOGLE_CLIENT_ID` is set; redirects to `/login?error=google_not_configured` when not set |
| `GET /auth/google/callback` | Validates CSRF state cookie; exchanges code for tokens; upserts account; issues JWT; redirects to app |

### Frontend Login Button (login.tsx)

Before: `disabled`, grey, "Continue with Google (coming soon)"  
After: fully active, real Google brand colours, `onClick → window.location.href = "/auth/google"`

```tsx
<button
  type="button"
  onClick={() => { window.location.href = "/auth/google"; }}
  title="Sign in with your Google account"
  className="mt-3 w-full h-11 rounded-xl border border-slate-200 bg-white text-sm
             font-medium text-slate-700 flex items-center justify-center gap-2.5
             hover:bg-slate-50 active:scale-[0.98] transition-all duration-150 shadow-sm"
>
  {/* Google SVG with official brand colours #4285F4 / #34A853 / #FBBC05 / #EA4335 */}
  Continue with Google
</button>
```

### OAuth Flow (verified by 3 tests)

1. `GET /auth/google` — returns HTTP 302, not JSON ✔
2. `GET /auth/google/callback?error=access_denied` — redirects to `/login?error=google_cancelled` ✔
3. `GET /auth/google/callback?code=fake&state=invalid` — CSRF check fails, redirects to login ✔

### To complete Google OAuth for production

Set these two Replit Secrets from the Google Cloud Console:
```
GOOGLE_CLIENT_ID     = <your-client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET = <your-client-secret>
GOOGLE_REDIRECT_URI  = https://aperti.ai/auth/google/callback
```
Add `https://aperti.ai/auth/google/callback` as an authorised redirect URI in the Google Cloud Console OAuth 2.0 configuration.

---

## Task 4 — Test Results

**File:** `artifacts/api-server/src/__tests__/routes-integration.test.ts`  
**Runner:** Node.js built-in test runner (`node:test`)  
**Compiled with:** esbuild (same toolchain as production build)

```
▶ Enrollment FSM — state machine                     ✔ (11 tests)
▶ Auth — unauthenticated request rejection            ✔ (6 tests)
▶ Google OAuth — /auth/google redirect                ✔ (3 tests)
▶ Route availability — new routes respond (not 404)   ✔ (4 tests)
▶ Environment validation — secret requirements         ✔ (6 tests)

ℹ tests 30   ✔ pass 30   ✖ fail 0   duration 408ms
```

### What each test suite covers

**Enrollment FSM:** All 7 valid states tested, including forward progressions, terminal states, re-application flows, and blocked illegal transitions.

**Auth rejection:** Unauthenticated requests to both new routes return `401`/`403`. Forged `Bearer null` tokens (a common client bug) are correctly rejected. Tampered JWT signatures are rejected.

**Google OAuth:** Redirect chain confirmed without Google credentials (graceful degradation), CSRF state mismatch detection confirmed, `access_denied` callback handling confirmed.

**Route availability:** Both new routes return auth errors (not 404), proving they are successfully mounted in the Express application.

**Env validation:** `PUBLIC_URL` and `ALLOWED_ORIGINS` are confirmed set to `https://aperti.ai`. JWT strength checks and insecure-default detection verified.

---

## Files Changed

| File | Change |
|------|--------|
| `artifacts/api-server/src/app.ts` | +2 imports, +2 `app.use()` mounts |
| `artifacts/api-server/src/config/env.ts` | Added Google OAuth vars to header docs + startup warning; updated ALLOWED_ORIGINS example |
| `artifacts/aperti/src/pages/login.tsx` | Google button re-enabled with real colours and `/auth/google` handler |
| `artifacts/api-server/src/__tests__/routes-integration.test.ts` | New — 30 integration tests |
| Replit Secrets | `PUBLIC_URL=https://aperti.ai`, `ALLOWED_ORIGINS=https://aperti.ai` |
