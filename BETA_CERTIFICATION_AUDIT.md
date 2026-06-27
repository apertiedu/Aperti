# PUBLIC BETA CERTIFICATION AUDIT
**Aperti Educational Operating System**  
**Audit Date:** 2026-06-27  
**Auditor:** Automated Security & Readiness Review  
**Verdict:** See Section 3

---

## 1. FINAL SCORECARD

| Domain | Score | Grade | Blocking? |
|--------|-------|-------|-----------|
| Security | 68/100 | C+ | ⚠️ YES — 2 HIGH issues |
| Reliability | 74/100 | B- | ⚠️ YES — missing try/catch in admin routes |
| Scalability | 80/100 | B+ | No |
| Auditability | 78/100 | B+ | No |
| Performance | 82/100 | B+ | No |
| Accessibility | 62/100 | C | ⚠️ YES — missing focus trap |
| SaaS Readiness | 55/100 | F | ⚠️ YES — subscription enforcement absent |

**Composite Score: 68.4 / 100**

---

## 2. REMAINING RISKS

### 🔴 HIGH — Blocks Public Beta

---

#### H-1: Subscription Enforcement Is Completely Absent from All Routes
**File:** `middleware/subscription-guard.ts` — middleware exists but is used 0 times  
**Evidence:**
```bash
grep -rn "requireActiveSubscription" src/routes/*.ts
# → 0 matches
```
`requireActiveSubscription()` is defined, implements grace-period logic, and integrates with the subscription FSM — but it has never been applied to a single route handler. Every paid feature (exams, homework, gradebook, AI, recordings, question bank, analytics) is accessible to any authenticated user regardless of subscription status.

**Impact:** A free or expired user can access all premium features indefinitely. Subscription revenue is not enforced at the API layer.  
**Fix:** Apply `requireActiveSubscription()` to all premium routes. Estimated scope: ~25-40 router files.

---

#### H-2: Mass-Assignment Vulnerability in Homework Update
**File:** `routes/homework.ts`, line 60  
**Evidence:**
```typescript
// Line 58: Ownership check only verifies the record CURRENTLY belongs to the teacher
const existing = await db.query.homework.findFirst({ where: ... eq(h.teacherAccountId, teacherId) });
if (!existing) return res.status(404).json({ error: "Not found" });

// Line 60: DANGEROUS — raw req.body passed to Drizzle update with no field allowlist
await db.update(homeworkTable).set(req.body).where(eq(homeworkTable.id, id));
```
A teacher who owns homework assignment #42 can send `{ "teacherAccountId": 99 }` in the PUT body. The ownership check passes (they own it now), then the update reassigns it to teacher #99's tenant, breaking multi-tenancy isolation.

**Impact:** Cross-tenant data injection. A teacher can move their homework into any other teacher's account, causing data leakage and manipulation.  
**Fix:** Explicitly allowlist fields in the update: `{ title, description, dueDate, subjectId, points, isPublished }` — never accept `teacherAccountId` from the client.

---

#### H-3: Email Delivery Non-Operational — Password Reset and Verification Are Broken
**File:** `lib/email.ts`, lines 19-35  
**Evidence:** SMTP_HOST, SMTP_USER, SMTP_PASS are not configured. All transactional email falls through to `console.info()`:
- Password reset links: printed to server logs (users can never reset passwords)
- Email verification tokens: printed to server logs (verification flow silently fails)
- Account suspension notifications: printed to server logs
- Grace period warning emails: printed to server logs

**Impact:** These are not optional features — they are core SaaS flows. Users who forget their password cannot recover their account. The email verification onboarding step cannot complete.  
**Fix:** Configure SMTP credentials before any public beta. Resend, Postmark, or AWS SES integration takes ~30 minutes.

---

### 🟡 MEDIUM — Fix Before GA

---

#### M-1: CORS Unrestricted in Production Without Explicit Configuration
**File:** `app.ts`, lines 249-262  
When `ALLOWED_ORIGINS` env var is unset, CORS origin check returns `true` — any domain can make credentialed cross-origin requests. A `console.warn` is logged but does not prevent the permissive behavior.  
**Fix:** Set `ALLOWED_ORIGINS` in the deployment environment. Add a startup assertion that fails boot in `NODE_ENV=production` if ALLOWED_ORIGINS is not set.

---

#### M-2: Password Changes Not Written to Audit Log
**File:** `routes/change-password.ts`  
Password changes are only written to `activity_logs`, not `audit_logs`. For a SaaS platform handling student data, password changes are a security-sensitive action that must be in the tamper-evident audit trail with IP, actor, and timestamp.  
**Fix:** Add `INSERT INTO audit_logs ... severity='warning' action='PASSWORD_CHANGED'` to the change-password route.

---

#### M-3: AppModal Lacks Focus Trap — Keyboard Accessibility Broken
**File:** `components/app-modal.tsx`  
The modal sets `aria-modal="true"` correctly but contains no focus trap. Tab key cycles through the entire background page while the modal is open, making it unusable for keyboard and screen reader users. Radix UI `Dialog` components (used elsewhere) handle this automatically; `AppModal` does not.  
**Fix:** Wrap modal content in a Radix `FocusScope` with `trapped` prop, or add `inert` attribute to the background.

---

#### M-4: Route Handlers Missing Try/Catch — Admin Routes Silently Fail
**Files:** `routes/admin-users.ts` (0 try/catch blocks for 13+ async handlers), `routes/search.ts` (universal search, autocomplete), `routes/i18n.ts`  
The global error handler only catches errors passed to `next(err)`. Unhandled async rejections in these routes produce empty responses or kill the request silently.  
**Fix:** Wrap all async route handlers in try/catch or use a `asyncHandler(fn)` wrapper utility that automatically calls `next(err)`.

---

#### M-5: N+1 Query Patterns Under Load
**Files:**
- `routes/exam.ts` lines 38-51: question insertion loop (1 DB call per question)
- `routes/exam-generator.ts` lines 106-116: question insertion loop  
- `routes/flashcards.ts` lines 285-296: card generation loop  
**Fix:** Replace per-row inserts with bulk `INSERT ... VALUES ($1,$2), ($3,$4)...` or Drizzle's `.insertMany()`.

---

#### M-6: Color Contrast Risks in Primary Theme Colors
**Files:** `components/ui/button.tsx`, `PlanStatusStrip`, status badge components  
`bg-primary/10` with colored text and `text-primary-foreground/70` opacity variants are likely to fail WCAG AA 4.5:1 contrast ratio. These appear on subscription badges, plan status indicators, and CTAs — high-traffic UI surfaces.  
**Fix:** Verify all interactive text against WCAG AA using Figma or browser DevTools accessibility inspector. Replace `/10` background + colored text combinations with fully opaque, pre-tested alternatives.

---

### 🟢 LOW — Post-GA Housekeeping

| # | Issue | File |
|---|-------|------|
| L-1 | Custom HTML sanitization regex (bypassable) vs. DOMPurify | `middleware/sanitize-body.ts` |
| L-2 | In-memory permission/auth status caches without key eviction | `middleware/require-permission.ts`, `routes/auth.ts` |
| L-3 | No request timeout middleware — long DB queries hold connections | `app.ts` (missing `connect-timeout`) |
| L-4 | Background cron jobs run on main API process (scaling risk) | `app.ts` lines 340-399 |
| L-5 | Unbounded queries in `founder.ts` analytics (no LIMIT) | `routes/founder.ts` |
| L-6 | DB connection pool capped at 25 (may saturate under burst) | `lib/db/src/index.ts:92` |

---

## 3. PUBLIC BETA RECOMMENDATION

```
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║           ⛔  NOT READY FOR PUBLIC BETA                  ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
```

**3 HIGH issues block certification:**

| # | Issue | Criterion Failed |
|---|-------|-----------------|
| H-1 | Subscription enforcement absent from all routes | "subscription enforcement tested" |
| H-2 | Homework mass-assignment (cross-tenant injection) | "no high issues" |
| H-3 | Email delivery non-operational | "email delivery tested" |

**5 of 9 Beta Certification Criteria Not Met:**

| Criterion | Status |
|-----------|--------|
| No critical issues | ✅ Pass |
| No high issues | ❌ Fail — 3 HIGH issues |
| Authentication flows tested | ✅ Code verified (JWT, MFA, session, bcrypt 12 rounds) |
| Payment flows tested | ✅ Code verified (FOR UPDATE SKIP LOCKED, role-aware approvals) |
| Subscription enforcement tested | ❌ Fail — 0 routes gated |
| Onboarding tested | ✅ Code verified (live-count checklist, 6 steps) |
| Accessibility tested | ❌ Fail — AppModal focus trap absent, contrast unverified |
| Email delivery tested | ❌ Fail — SMTP not configured, emails go to console.log |
| Audit logging verified | ⚠️ Partial — password changes not in audit_logs |

---

## 4. GA RECOMMENDATION

**Not evaluated.** GA certification requires Public Beta to be achieved and operated for a minimum period with real traffic. However, the following additional items would need to be resolved before GA:

- M-4 through M-6 resolved
- Load test confirming 25-connection pool holds under concurrent user peaks
- WCAG AA contrast audit completed and remediated
- Penetration test or external security review
- GDPR data processing agreements in place for EU schools
- SLA-backed SMTP/email delivery provider configured
- Subscription enforcement coverage verified by QA regression suite

---

## 5. TOP 10 POST-LAUNCH PRIORITIES

After the 3 HIGH issues are resolved and public beta is achieved, prioritize in this order:

| Priority | Task | Impact |
|----------|------|--------|
| **1** | Apply `requireActiveSubscription()` to all premium routes and write a regression test per route | Revenue integrity |
| **2** | Replace `homework.ts:60` raw `req.body` update with an explicit field allowlist | Security |
| **3** | Configure SMTP (Resend or Postmark recommended) and smoke-test password-reset + email-verify end-to-end | Core UX |
| **4** | Add focus trap to `AppModal` (Radix `FocusScope`) and run WCAG AA contrast audit | Accessibility / Legal |
| **5** | Wrap all admin route handlers in a `safeAsync()` utility to guarantee try/catch coverage | Reliability |
| **6** | Add `audit_logs` entry to password-change route (severity: warning) | Auditability |
| **7** | Replace N+1 question/flashcard insert loops with bulk inserts | Performance under load |
| **8** | Set `ALLOWED_ORIGINS` in deployment config and add production startup assertion | Security |
| **9** | Add `connect-timeout` middleware (15s) and increase DB pool to 50 for production deployment | Scalability |
| **10** | Move background cron jobs (VACUUM, grace checks, backup) to a separate worker process | Reliability at scale |

---

## APPENDIX: WHAT IS WORKING WELL

These areas require no action and are production-quality:

| Area | Strength |
|------|----------|
| JWT configuration | Signed, 7d expiry, httpOnly cookies, secure in production |
| MFA implementation | 5-minute pre-auth token, rejected by protected routes |
| Rate limiting | Login (10/15min), register (10/hr), MFA (5/10min), global (200/min) |
| bcrypt rounds | 12 rounds for registration/admin setup, 10 for admin-created users |
| CSRF protection | Double-submit cookie with `timingSafeEqual` comparison |
| Tenant isolation | `tenantFilter` Drizzle helper + `requireTenantAccess` middleware |
| SQL injection | Parameterized queries throughout; Drizzle ORM for complex queries |
| GDPR erasure | Complete PII anonymization, session invalidation, audit logged as critical |
| Coupon anti-abuse | Per-user uniqueness check + atomic `max_uses` decrement |
| Payment race conditions | `FOR UPDATE SKIP LOCKED` prevents double-approval |
| Database timeouts | 30s statement timeout at pool level |
| Health check | Tests DB connectivity + storage writeability, returns 503 on failure |
| Compression | Gzip enabled via `compression()` middleware |
| Caching | Redis-backed with memory fallback; gradebook (20s), plans (300s) |
| Composite indexes | Phase-3 hardening applied; VACUUM scheduled on write-heavy tables |
| Audit logging | Login, MFA, GDPR, payments, suspensions, impersonation all covered |
| Subscription FSM | Grace period, renewal, expiry correctly modeled and scheduled |
| Onboarding checklist | 6-step live-count verification (not flag-based) |

---

*This audit covers static code analysis and architecture review. It does not constitute a full penetration test. Runtime testing and load testing are required before General Availability.*
