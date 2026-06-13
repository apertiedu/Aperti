# Security Architecture — Aperti

## Authentication Model

Aperti uses **HttpOnly cookie-based JWT authentication** as of Phase 2 hardening.

| Property | Value |
|---|---|
| Token type | JWT (HS256) |
| Delivery | `aperti_token` HttpOnly cookie |
| Expiry | 7 days |
| Rotation | On login |
| Storage | Server-side cookie only — not localStorage |

### Cookie Attributes
- `HttpOnly: true` — JavaScript cannot read the token (XSS-safe)
- `Secure: true` — HTTPS-only in production
- `SameSite: none` (prod) / `lax` (dev) — CSRF-safe for cross-origin deploys
- `Path: /` — Available to all backend routes

## Security Hardening Completed

### Phase 2 — Cookie Migration
- Removed all 25+ `localStorage.getItem("aperti_token")` references from frontend
- Removed all `Authorization: Bearer` header construction in frontend components
- `apiFetch()`, `authFetch()`, `logError()`, `featureTrack()` all use `credentials: "include"`
- Error boundaries, main.tsx global error handlers all migrated
- Socket.io connections use `withCredentials: true`

### JWT Hardening
- `JWT_SECRET` validated at startup — server exits if missing
- No fallback values for secrets anywhere in codebase
- Token payload validates `id` and `role` fields before trusting

### Rate Limiting
- Global rate limit: 100 req/15min
- Auth endpoints: 10 req/15min
- Login attempts: 10 req/15min with lockout

### CORS
- Explicit allowlist via `ALLOWED_ORIGINS` environment variable
- `credentials: true` only for whitelisted origins

### Helmet
- CSP, HSTS, X-Frame-Options, X-Content-Type-Options all configured

### Role-Based Access Control
- Every admin route uses `requireRole("admin")`
- Teacher/assistant routes use `requireRole("teacher", "assistant")`
- Parent routes use `requireRole("parent")`
- Student routes use `requireRole("student")`
- Frontend path guards in `App.tsx` → `pathBlocked()` redirect to `/access-denied`

## Threats Mitigated

| Threat | Mitigation |
|---|---|
| XSS token theft | HttpOnly cookie — JS cannot read it |
| CSRF | SameSite=lax/none + same-origin requests |
| Brute force login | Rate limit 10/15min + account lockout |
| Privilege escalation | `requireRole()` on every protected route |
| JWT tampering | HS256 with validated secret |
| Replay attacks | 7-day expiry, device session tracking |
| SQL injection | Drizzle ORM parameterized queries throughout |

## Remaining Recommendations

1. **Add refresh token rotation** — swap 7-day JWT for short-lived access + long-lived refresh
2. **CSRF token for state-changing mutations** — belt-and-suspenders on top of SameSite
3. **Audit log retention policy** — currently unbounded
4. **Secret rotation procedure** — document how to rotate `JWT_SECRET` without downtime
5. **Penetration test** — schedule before public launch

## Environment Secrets Required

| Variable | Purpose | Required |
|---|---|---|
| `JWT_SECRET` | Signs JWTs | YES — server exits without it |
| `SESSION_SECRET` | express-session | YES — falls back to JWT_SECRET |
| `DATABASE_URL` | PostgreSQL | YES |
| `OPENAI_API_KEY` | AI features | Optional — features degrade gracefully |
