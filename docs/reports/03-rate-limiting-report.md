# Rate Limiting Report — Aperti Platform
**Phase 3 Production Hardening · Security Layer Audit**

---

## Summary

All critical API surfaces are now rate-limited. The implementation uses **express-rate-limit** with a per-user key generator (`user:{id}` for authenticated users, `ip:{addr}` for anonymous) and falls back to IP for unauthenticated endpoints.

**Coverage: 100% of sensitive endpoints**

---

## Rate Limiter Inventory

| Limiter | Window | Limit | Key | Admin Skip | Endpoint(s) |
|---------|--------|-------|-----|:----------:|-------------|
| `loginLimiter` | 15 min | 10 | IP | ❌ | `POST /api/auth/login` |
| `registerLimiter` | 60 min | 10 | IP | ❌ | `POST /api/auth/register` |
| `passwordResetLimiter` | 15 min | 5 | IP | ❌ | `POST /api/auth/reset-password` |
| `mfaLimiter` | 10 min | 5 | user | ❌ | `POST /api/mfa/verify` |
| `searchLimiter` | 60 sec | 120 | user | ❌ | `GET /api/search` |
| `uploadLimiter` | 60 min | 30 | user | ✅ | `POST /api/upload` |
| `fileDownloadLimiter` | 60 sec | 60 | user | ❌ | `GET /api/files/:filename` |
| `exportLimiter` | 60 min | 20 | user | ✅ | `GET /api/*/export` |
| `reportLimiter` | 60 min | 60 | user | ✅ | `GET /api/*/report` |
| `aiStreamLimiter` | 60 sec | 20 | user | ✅ | `POST /api/ai/*` |
| `aiBatchLimiter` | 60 min | 50 | user | ✅ | `POST /api/ai/batch*` |
| `webhookLimiter` | 60 sec | 100 | IP | ❌ | Incoming webhooks |
| Global limiter | 15 min | 500 | IP | ❌ | All routes |

---

## Phase 3 Additions

The following limiters were **added in this phase**:

| Limiter | Reason |
|---------|--------|
| `aiStreamLimiter` | Prevent token-cost abuse via rapid AI generation |
| `aiBatchLimiter` | Protect against bulk AI content generation |
| `passwordResetLimiter` | Prevent account enumeration attacks |
| `loginLimiter` | Prevent credential stuffing |
| `mfaLimiter` | Prevent brute-force on TOTP codes |
| `registerLimiter` | Prevent account creation abuse |
| `webhookLimiter` | Protect inbound integration webhooks |

---

## Headers

All limiters emit **RFC 7231-compliant headers**:
```
RateLimit-Limit: 20
RateLimit-Remaining: 18
RateLimit-Reset: 1704067200
```
Legacy `X-RateLimit-*` headers are disabled (`legacyHeaders: false`).

---

## Design Decisions

### Per-User vs Per-IP
- **Authenticated endpoints**: keyed by `user:{id}` to prevent IP-sharing abuse (e.g. shared school networks).
- **Auth endpoints** (login, register, reset): keyed by IP because user ID is unknown at that point.
- **Admin skip**: export/report/upload limiters skip for `admin` and `super_admin` roles.

### Window Strategy
- **Burst protection** (AI, files): 60-second windows catch sudden bursts.
- **Sustained abuse** (export, report): 60-minute windows catch sustained over-use.
- **Security-critical** (login, MFA): 15-minute windows with hard limits to balance UX against security.

---

## Recommendations

1. **Distribute rate state** — the current in-memory store resets on server restart. For multi-instance deployments, switch to `rate-limit-redis` with the existing Redis connection.
2. **Custom rate limit per subscription** — teachers on paid plans could receive higher limits for AI and exports.
3. **Honeypot endpoint** — add a `/api/ping` endpoint with a 1-req/min limiter to detect scanners.
4. **Exponential back-off headers** — for login failures, return `Retry-After` with exponential back-off to slow automated attacks.
