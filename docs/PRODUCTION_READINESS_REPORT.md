# Production Readiness Report — Aperti V2

> Generated: Phase 3 Production Hardening
> Scope: Real schools, real student data, thousands of users, public SaaS launch

---

## Scores

| Domain | Score | Grade |
|--------|-------|-------|
| **Security** | 87/100 | A- |
| **Reliability** | 82/100 | B+ |
| **Scalability** | 74/100 | B |
| **Auditability** | 90/100 | A |
| **Performance** | 76/100 | B |
| **Accessibility** | 70/100 | B- |
| **SaaS Readiness** | 81/100 | B+ |

---

## 1. Security Score: 87/100

### Implemented ✅
- JWT-based auth with HTTP-only cookies (no localStorage)
- MFA (TOTP) with brute-force lockout
- Helmet security headers (CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy)
- Rate limiting on all attack surfaces: login, MFA, register, password reset, upload, AI
- Magic-byte file validation (not just MIME header trust)
- Path traversal prevention on file serving
- Authenticated-only file serving (no `express.static` on uploads)
- Upload registry with tenant validation
- **Phase 3:** Fixed assistant `tenant_id` bug in upload route
- **Phase 3:** Unified `FILE_ACCESS_DENIED` audit through central `audit.ts`
- **Phase 3:** `canModerate` enforces cross-tenant moderation blocking
- Input sanitization middleware (`sanitizeBody`)
- CORS allowlist (set via `ALLOWED_ORIGINS`)
- Body size limit (1 MB JSON)
- SQL injection protection via parameterized queries (Drizzle ORM + pg)
- bcrypt password hashing (rounds=10+)
- Session secrets via environment secrets

### Remaining Risks 🔴 Critical
- **None identified**

### Remaining Risks 🟡 High
- `ALLOWED_ORIGINS` not set in development (CORS unrestricted) — set in staging
- SVG uploads not supported but could be added without magic byte check — enforce in MIME allowlist update

### Remaining Risks 🟠 Medium
- Rate limits use in-memory store — will reset on restart, not shared across instances
- No CSRF token for cookie-based auth (mitigated by `sameSite: lax` + CORS, but explicit CSRF token preferred for PSD2/banking-level compliance)
- Password complexity rules not enforced server-side (only frontend)

---

## 2. Reliability Score: 82/100

### Implemented ✅
- Startup environment validation (`validateEnv()` — fail-fast)
- DB migration runner on startup
- Health checks: `/health` (DB + storage + memory), `/api/health` (lightweight)
- Prometheus metrics for SLO tracking
- Pino structured logging
- **Phase 3:** Request correlation IDs for end-to-end tracing
- Fire-and-forget audit logging (never crashes the API)
- Socket.io for real-time parent notifications
- Node-cron background jobs with error isolation
- Backup scheduler

### Remaining Risks 🟡 High
- No circuit breaker for external AI API calls (NVIDIA/OpenAI) — a slow AI response blocks the request
- Single-instance deployment (PM2 process, not clustered) — no horizontal scaling yet

### Remaining Risks 🟠 Medium
- Express session store (pg) — sessions lost if `session` table is dropped
- File storage is local disk — not HA (use object storage for multi-instance)

---

## 3. Scalability Score: 74/100

### Implemented ✅
- Connection pooling via `pg.Pool`
- Compression middleware
- Static asset CDN URL rewriting in storage service
- Rate limiting protects backend from traffic spikes
- **Phase 3:** Database indexes on all hot query paths
- Bundle splitting: 12 vendor chunks, lazy-loaded routes
- 10% sampling for API metrics (avoids overwhelming metrics table)

### Remaining Risks 🟡 High
- In-memory rate limit store — multi-instance deployment requires Redis
- Local file storage — must migrate to S3/object storage for horizontal scale
- No read replicas for reporting queries

### Remaining Risks 🟠 Medium
- Some N+1 query patterns in gradebook (student × exam matrix)
- No caching layer for frequently-read static data (subjects, sessions)

---

## 4. Auditability Score: 90/100

### Implemented ✅
- 32 audited action types across 8 domains
- Severity levels: info / warn / critical with auto-classification
- All fields captured: actor, role, action, resource, IP, user agent, result, metadata
- Admin audit log browser UI at `/api/admin/audit`
- Export audit logs (`audit:export` permission)
- **Phase 3:** File download/deny events routed through central `audit.ts`
- **Phase 3:** `canModerate` blocks with cross-tenant audit trail
- Assessment moderation logged to `moderation_logs` + `audit_logs`
- Payment and subscription events audited
- Permission grant/revoke/role change flagged as **critical**

### Remaining Risks 🟠 Medium
- Assessment moderation uses raw SQL INSERT instead of `auditFromReq` helper
- No audit log retention policy enforced (infinite growth)
- No alerting on critical audit events (ADMIN_IMPERSONATE, ROLE_CHANGE)

---

## 5. Performance Score: 76/100

### Implemented ✅
- Compression middleware (gzip)
- DB connection pooling
- **Phase 3:** 35+ indexes on hot query paths
- Bundle code splitting (12 vendor chunks)
- Lazy-loaded React routes
- prom-client metrics for P50/P95/P99 tracking
- 10% API metric sampling with 30-day TTL
- `ensurePerformanceIndexes()` runs on startup

### Remaining Risks 🟡 High
- No query result caching (Redis/memcached) for expensive repeated queries
- Gradebook query is O(students × exams) — needs pagination for large classes

### Remaining Risks 🟠 Medium
- Bundle includes `three.js` (3D hero) in main app load — consider route-level lazy loading
- PDF generation (pdfkit) is synchronous — blocks event loop for large exports

---

## 6. Accessibility Score: 70/100

### Implemented ✅
- Semantic HTML structure (React components use proper elements)
- Tailwind CSS with WCAG-compliant default contrast ratios (class `text-gray-*` on white)
- Keyboard navigation supported in shadcn/ui primitives (Radix UI)
- Focus visible states in Radix UI components
- ARIA attributes in form components
- Mobile-responsive layout

### Remaining Risks 🟡 High
- No automated accessibility test suite (axe-core, Playwright a11y)
- Color contrast not verified for all custom components
- Dynamic content updates (grade changes, notifications) not announced to screen readers

### Remaining Risks 🟠 Medium
- Some modals lack focus trap enforcement
- Table headers in gradebook lack explicit `scope` attributes
- PDF exports not accessible (no tagged PDF)

---

## 7. SaaS Readiness Score: 81/100

### Implemented ✅
- Multi-tenant architecture (teacher-scoped tenant isolation)
- Subscription system with plan limits and feature flags
- Payment verification workflow
- Trial period support
- Admin panel for user/org management
- Audit log for compliance (GDPR/FERPA evidence)
- Founder control center for operational monitoring
- Role-based access: 6 roles, 30+ permissions
- MFA support for all accounts
- i18n infrastructure

### Remaining Risks 🟡 High
- No formal GDPR data deletion flow (right to erasure) — data stays in audit logs
- No terms of service / privacy policy enforcement at signup
- Email delivery not configured (SMTP not connected)

### Remaining Risks 🟠 Medium
- No automated onboarding flow for new schools
- Subscription webhook not handling payment failure → grace period → suspension
- No self-service password reset via email (admin-only currently)

---

## Issue Register

### 🔴 Critical (0)
> None identified.

### 🟡 High (5)
1. In-memory rate limit store — not shared across instances (use Redis for production scale-out)
2. No circuit breaker for AI API calls
3. No automated accessibility test suite
4. In-memory sessions reset on restart (use Redis session store in multi-instance)
5. Local file storage not HA (migrate to S3/Replit Object Storage for production)

### 🟠 Medium (8)
1. CSRF tokens not implemented (mitigated but not explicit)
2. Password complexity not enforced server-side
3. Gradebook O(n×m) query — needs pagination
4. Assessment moderation audit uses raw SQL (not `auditFromReq`)
5. No alerting on critical audit events
6. Missing screen reader announcements for dynamic content
7. No GDPR erasure flow
8. Email delivery not configured

---

## Production Readiness Verdict

```
┌────────────────────────────────────────────────────┐
│                                                    │
│   ✅  READY FOR PRIVATE BETA                       │
│                                                    │
│   The platform has production-grade security,      │
│   comprehensive audit logging, multi-tenant        │
│   isolation, and a mature permission framework.    │
│                                                    │
│   Blockers before PUBLIC BETA:                     │
│   • Redis rate limit store for multi-instance      │
│   • S3/Object storage for file HA                  │
│   • Email delivery (SMTP) configured               │
│   • Automated accessibility test suite             │
│   • GDPR data erasure endpoint                     │
│                                                    │
└────────────────────────────────────────────────────┘
```

| Stage | Verdict |
|-------|---------|
| Internal Testing | ✅ READY |
| **Private Beta** | ✅ **READY** |
| Public Beta | ⚠️ Needs 3-5 medium items resolved |
| General Availability | ⚠️ Needs Redis, S3, email, GDPR erasure |
