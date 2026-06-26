# Rate Limiting Report — Aperti V2

> Generated: Phase 3 Production Hardening
> System: `artifacts/api-server/src/middleware/rate-limit.ts` + `app.ts`

## Strategy Overview

Layered rate limiting with three tiers:
1. **Global IP limiter** — 200 req/min per IP (applied in `app.ts`)
2. **Route-specific limiters** — per-user (authenticated) or per-IP (unauthenticated)
3. **Burst protection** — tight `windowMs` windows on authentication and AI endpoints

Key design decisions:
- **Per-user key** (`user:{id}`) used for authenticated users — prevents NAT bypass from shared school IPs
- **Per-IP key** for unauthenticated flows where userId is unknown (login, register, password reset)
- **Double enforcement** on uploads: `user:{id}::ip:{addr}` — both user and IP must be within limits

## Limiter Inventory

| Limiter | Window | Max | Key | Skip Condition |
|---------|--------|-----|-----|----------------|
| Global | 1 min | 200 | IP | `/api/health`, `/metrics` |
| Login | 15 min | 10 | IP | — |
| Register | 1 hr | 10 | IP | — |
| MFA | 10 min | 5 | User | — |
| Password Reset | 15 min | 5 | IP | — |
| AI Chat | 24 hr | 200 | User | — |
| AI Stream | 1 min | 20 | User | admin, super_admin |
| AI Batch | 1 hr | 50 | User | admin, super_admin |
| Upload | 1 hr | 30 | User+IP | — |
| File Download | 1 min | 60 | User | — |
| Export | 1 hr | 20 | User | admin, super_admin |
| Report | 1 hr | 60 | User | admin, super_admin |
| Search | 1 min | 120 | User | — |
| Subscription Init | 1 hr | 10 | User | — |
| Webhook | 1 min | 100 | IP | — |
| Grading | 1 min | 60 | User | — |
| Admin Actions | 1 min | 30 | User | — |

## Phase 3 Improvements

| Change | Reason |
|--------|--------|
| Upload limiter now uses `user+IP` double key | Prevents teachers sharing accounts from bypassing per-user limits |
| Added `gradingLimiter` (60/min) | Prevents automated mass-grading scripts |
| Added `adminActionLimiter` (30/min) | Burst protection for destructive admin operations |
| `fileDownloadLimiter` applied in `files.ts` | Previously download endpoint had no per-user limit |

## Authentication Attack Surface

| Attack Vector | Mitigation |
|--------------|-----------|
| Credential stuffing | Login: 10 attempts/15min per IP |
| MFA brute-force | MFA: 5 attempts/10min, then lockout |
| Account enumeration (password reset) | Reset: 5 attempts/15min per IP |
| Registration spam | Register: 10/hr per IP |
| Token replay | JWT expiry + httpOnly cookie |

## Burst Protection Analysis

The following endpoints have tight 1-minute windows specifically to catch burst abuse:
- **AI Stream:** 20/min — prevents prompt injection loops
- **File Download:** 60/min — prevents bulk scraping of student documents
- **Search:** 120/min — prevents content harvesting
- **Admin Actions:** 30/min — prevents scripted destructive operations

## Remaining Recommendations

| Recommendation | Priority |
|---------------|----------|
| Add Redis-backed store for rate limits in multi-instance deployment | High for scale-out |
| Add rate limit exceeded audit events for `AUTH_FAILED` correlation | Medium |
| Implement progressive backoff (1s, 2s, 4s, 8s) instead of flat window for login | Medium |
