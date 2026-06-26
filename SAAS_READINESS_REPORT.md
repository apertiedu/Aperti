# Aperti — SaaS Readiness Report

**Generated:** 2026-06  
**Scope:** Compliance, Onboarding, Subscription, Email, Operational Readiness

---

## Executive Summary

| Domain | Status | Coverage |
|---|---|---|
| GDPR / Compliance | ✅ Complete | Request + Execution + Audit |
| Terms of Service | ✅ Complete | Version-pinned, per-user, IP-stamped |
| Privacy Policy | ✅ Complete | Version-pinned, per-user, IP-stamped |
| Subscription Grace Period | ✅ Complete | FSM + nightly cron |
| Account Suspension | ✅ Complete | Admin workflow + notify + audit |
| School Onboarding | ✅ Complete | 6-step wizard with checklist |
| Email Verification | ✅ Complete | Token flow + expiry + redirect |
| Subscription Lifecycle Audit | ✅ Complete | FSM audit log + paginated viewer |

**Overall SaaS Readiness: 8 / 8 domains complete**

---

## 1. GDPR Right-to-Erasure Workflow

### Coverage
- **Request intake:** `POST /api/user/deletion-request` — requires confirmation phrase "delete my account"; checks for duplicate pending requests; stores in `compliance_requests` table.
- **Status check:** `GET /api/user/deletion-request-status` — returns current status and requestedAt.
- **Admin review queue:** `GET /api/admin/compliance/requests` — lists all requests with user profile data.
- **Admin status update:** `PUT /api/admin/compliance/requests/:id` — move to `in_review` or `rejected`.
- **🆕 GDPR execution:** `POST /api/admin/compliance/requests/:id/execute` — requires `super_admin`; irreversibly anonymises:
  - `username` → `deleted_user_<id>`
  - `display_name` → `"Deleted User"`
  - `email` → `deleted_<id>@deleted.aperti.app`
  - `password_hash` → bcrypt of random 32-byte secret (account cannot be logged into)
  - `bio`, `avatar_url`, `google_id`, `phone` → `NULL`
  - `status` → `'deleted'`
  - Active sessions invalidated
  - `consent_records` IP/UA stripped
  - `email_verification_tokens` + `password_reset_tokens` deleted
  - Compliance request marked `completed` with executor identity
  - `audit_logs` entry at severity `critical`

### Compliance coverage
| GDPR Article | Implementation |
|---|---|
| Art. 17 — Right to erasure | Execute endpoint + full PII anonymisation |
| Art. 20 — Right to portability | `POST /api/user/export` (JSON download) |
| Art. 7 — Consent records | `consent_records` table, version-pinned |
| Art. 30 — Records of processing | `audit_logs` + `compliance_requests` |

---

## 2. Terms of Service Acceptance Tracking

### Coverage
- **Current policy version:** `v2026.06` (constant in `compliance-consent.ts`)
- **Authenticated users:** `POST /api/compliance/consent` — records `consent_type: 'terms_of_service'` with policy version, IP, user-agent, and timestamp
- **Pre-registration (public):** `POST /api/compliance/consent/public` — captures consent with session fingerprint before account creation
- **User consent viewer:** `GET /api/compliance/consent` — latest consent per type for the authenticated user
- **Admin stats:** `GET /api/admin/compliance/consent-stats` — breakdown by type with granted/denied counts
- **Version enforcement:** Changing `POLICY_VERSION` constant forces re-acceptance since `DISTINCT ON (consent_type)` always surfaces the most recent record; middleware can compare `policy_version` against current constant
- **Onboarding gate:** Step 6 of the onboarding checklist (`GET /api/onboarding/checklist`) requires ToS accepted before marking onboarding complete

---

## 3. Privacy Policy Acceptance Tracking

### Coverage
- **Same infrastructure as ToS** — `consent_type: 'privacy_policy'` uses identical storage, versioning, and retrieval path
- **Both policies tracked in one atomic call:** Frontend sends `[{ type: 'terms_of_service', granted: true }, { type: 'privacy_policy', granted: true }]` in a single POST
- **Public banner support:** Pre-login visitors tracked via session fingerprint
- **Audit-ready:** `ip_address`, `user_agent`, `policy_version`, `granted_at` all stored per record
- **Revocation support:** `granted: false` entries are stored; latest record wins per type

---

## 4. Subscription Grace-Period Workflow

### Coverage
State machine (`lib/subscription-fsm.ts`) defines:
```
active → grace_period (on payment failure or end_date passed)
       → expired       (on grace_period_ends_at passed)
```

- **Grace period length:** Configurable per subscription via `grace_period_days` column (default: 3 days)
- **Access during grace:** `accessGranted(status)` returns `true` for both `active` and `grace_period`
- **Payment failure path:** `POST /api/subscriptions/lifecycle/payment-failure` (admin/system) — moves `active → grace_period` or `grace_period → expired` atomically with audit log and ops alert
- **🆕 Nightly cron:** Runs at **01:00 UTC** daily via `node-cron`, calls `runGraceAndExpiryCheck()`:
  - Moves all `active` subs whose `end_date < NOW()` into `grace_period` (sets `grace_period_ends_at`)
  - Moves all `grace_period` subs whose `grace_period_ends_at < NOW()` into `expired`
  - Uses `FOR UPDATE SKIP LOCKED` — safe for multi-process deployments
  - All transitions written to `subscription_audit_log`
- **Auto-renewal path:** Subs with `auto_renew = true` generate a `pending_payment` transaction instead of expiring
- **Admin restore:** `POST /api/subscriptions/lifecycle/restore/:id` — revive an expired sub with new end date

---

## 5. Account Suspension Workflow

### Coverage
- **Login guard (pre-existing):** `POST /api/auth/login` returns `403 Account suspended` for any account with `status = 'suspended'`
- **JWT guard (pre-existing):** `authenticate` middleware rejects sessions for suspended accounts on every request
- **🆕 Admin suspend:** `POST /api/admin/accounts/:id/suspend`
  - Validates actor can suspend the target (admin cannot suspend super_admin)
  - Updates `accounts.status = 'suspended'`
  - Writes to `account_suspension_log` (new table, auto-created)
  - Writes to `audit_logs` at severity `high`
  - Sends suspension notification email with reason (if email configured)
- **🆕 Admin unsuspend:** `POST /api/admin/accounts/:id/unsuspend`
  - Restores `accounts.status = 'active'`
  - Writes to `account_suspension_log`
  - Sends reinstatement email
- **🆕 Suspended list:** `GET /api/admin/accounts/suspended` — all suspended accounts with reason + who suspended them
- **🆕 Suspension history:** `GET /api/admin/accounts/:id/suspension-history` — full audit trail per account

### New DB table
```sql
account_suspension_log (
  id, account_id, action (suspended|unsuspended),
  reason, actor_id, actor_role, created_at
)
```

---

## 6. School Onboarding Flow

### Coverage
- **Progress persistence:** `onboarding_progress` table tracks `current_step`, `completed`, and arbitrary JSONB data
- **🆕 6-step structured checklist:** `GET /api/onboarding/checklist` — live completion status for each required step:

| Step | Key | Required Action |
|---|---|---|
| 1 | `profile` | Set display_name + email |
| 2 | `email_verified` | Verify email address |
| 3 | `first_subject` | Create ≥1 subject |
| 4 | `first_student` | Enrol ≥1 active student |
| 5 | `first_lesson` | Create ≥1 lesson |
| 6 | `terms_accepted` | Accept ToS via consent_records |

- **Response includes:** `completionPct`, `isComplete`, `currentStep`, `onboardingCompleted`
- **Auto-complete:** When all 6 steps are done, checklist endpoint auto-marks `onboarding_progress.completed = true`
- **🆕 Wizard step saver:** `POST /api/onboarding/school-setup` — saves step data with JSONB merge (subsequent saves merge not overwrite)
- **Pre-existing endpoints:** `GET /api/onboarding/progress`, `POST /api/onboarding/save-step`, `POST /api/onboarding/complete`

---

## 7. Email Verification Workflow

### Coverage
- **New token flow** (`email-verification.ts`):

| Endpoint | Description |
|---|---|
| `POST /api/auth/send-verification-email` | Generates 32-byte hex token, stores in `email_verification_tokens` (24h TTL), sends HTML email |
| `GET /api/auth/verify-email?token=X` | Validates token → marks `accounts.email_verified = true` → redirects to frontend |
| `GET /api/auth/email-verification-status` | Returns verified status + pending token info |

- **Rate limiting:** 1 send per 5 minutes per account (in-process cooldown map)
- **Token security:** 32-byte cryptographically random hex; single-use; 24h expiry; previous tokens invalidated on re-send
- **Graceful redirects:** 
  - `?success=1` — verified successfully
  - `?error=invalid_token` — token not found
  - `?error=token_used` — token already consumed
  - `?error=token_expired` — past 24h window
- **Google OAuth bypass:** Accounts created via Google OAuth have `email_verified = true` set automatically (pre-existing in `auth.ts`)
- **SMTP fallback:** Without `SMTP_HOST/USER/PASS`, link is printed to stdout (development mode)

### New DB table
```sql
email_verification_tokens (
  id, account_id, token (unique), expires_at, used_at, created_at
)
```

---

## 8. Subscription Lifecycle Auditing

### Coverage
- **`subscription_audit_log` table** — every FSM state transition written atomically within the same transaction as the status update
- **FSM transitions audited:** `active → grace_period`, `grace_period → expired`, `→ active` (restore), `→ suspended`
- **Triggered-by field:** `system | admin | payment | user` — full provenance on every entry
- **Actor tracking:** `actor_id` + `actor_role` on admin-initiated transitions
- **Metadata JSON:** Arbitrary context (payment references, amounts, admin notes) stored per transition
- **🆕 Paginated viewer:** `GET /api/subscriptions/lifecycle/audit-log`
  - Query params: `page`, `limit` (10–100), `userId` filter
  - Joins `accounts` for user and actor names + emails
  - Returns `{ entries, total, page, limit, pages }`
- **Financial audit:** `financial-audit.ts` writes to `audit_logs` in parallel for payment-related events
- **`GET /api/subscriptions/lifecycle/overview`** — aggregate counts by status (admin)

---

## Compliance Coverage Matrix

| Requirement | Endpoint | DB Record | Audit Trail | Notification |
|---|---|---|---|---|
| GDPR data export | `POST /api/user/export` | — | — | — |
| GDPR erasure request | `POST /api/user/deletion-request` | `compliance_requests` | ✅ | — |
| GDPR erasure execution | `POST /api/admin/compliance/requests/:id/execute` | Updated `accounts` | `audit_logs` (critical) | — |
| ToS acceptance | `POST /api/compliance/consent` | `consent_records` | ✅ | — |
| Privacy Policy acceptance | `POST /api/compliance/consent` | `consent_records` | ✅ | — |
| Pre-signup consent | `POST /api/compliance/consent/public` | `consent_records` (fingerprint) | ✅ | — |
| Account suspension | `POST /api/admin/accounts/:id/suspend` | `accounts.status` + `suspension_log` | `audit_logs` (high) | ✅ email |
| Account reinstatement | `POST /api/admin/accounts/:id/unsuspend` | `accounts.status` + `suspension_log` | `audit_logs` (medium) | ✅ email |
| Email verification | `POST /api/auth/send-verification-email` + `GET /verify-email` | `email_verification_tokens` | — | ✅ email |
| Grace period entry | Nightly cron / payment-failure | `subscriptions.status` | `subscription_audit_log` | ✅ alert |
| Grace period expiry | Nightly cron | `subscriptions.status` | `subscription_audit_log` | — |
| Sub lifecycle events | FSM transitions | `subscription_audit_log` | ✅ | ✅ alerts |
| School onboarding | `GET /api/onboarding/checklist` | `onboarding_progress` | — | — |

---

## Onboarding Readiness

| Check | Status |
|---|---|
| Multi-step wizard with checklist | ✅ 6 steps |
| Completion percentage tracking | ✅ |
| Auto-complete detection | ✅ |
| Wizard step data persistence | ✅ JSONB merge |
| ToS gate in onboarding | ✅ Step 6 |
| Email verification gate | ✅ Step 2 |
| API for frontend progress bar | ✅ `completionPct` field |

---

## Subscription Readiness

| Check | Status |
|---|---|
| Subscription FSM with valid transitions | ✅ |
| Grace period on expiry | ✅ configurable per sub |
| Grace period cron (nightly, 01:00 UTC) | ✅ |
| Multi-process safe (SKIP LOCKED) | ✅ |
| Payment failure path | ✅ |
| Auto-renewal transaction creation | ✅ |
| Restore / reinstate endpoint | ✅ |
| Lifecycle audit log with pagination | ✅ |
| Fraud detection (code reuse, rapid loops) | ✅ |
| Lifecycle overview for admin dashboard | ✅ |

---

## Email Readiness

| Check | Status |
|---|---|
| SMTP transport (nodemailer) | ✅ SMTP_HOST/USER/PASS |
| Dev fallback (stdout) | ✅ |
| Password reset emails | ✅ (pre-existing) |
| Email verification emails | ✅ |
| Suspension / reinstatement notifications | ✅ |
| Ops alerts (payment failure etc.) | ✅ via `dispatchAlert` |
| Configurable FROM address | ✅ `SMTP_FROM` env var |

**Environment variables required for live email:**
```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=<secret>
SMTP_FROM=noreply@aperti.app   # optional, defaults to SMTP_USER
```

---

## Operational Readiness

| Check | Status |
|---|---|
| Nightly grace/expiry cron (01:00 UTC) | ✅ |
| Nightly VACUUM ANALYZE (04:00 UTC, 16 tables) | ✅ |
| pg_stat_statements auto-enabled | ✅ |
| Redis rate limiting (all limiters) | ✅ |
| Redis session storage with PG fallback | ✅ |
| Subscription audit log retention | ✅ (indefinite, no TTL) |
| GDPR erasure idempotent | ✅ (completed check) |
| Suspension duplicate prevention | ✅ (status check) |
| Email verification token single-use | ✅ |
| Email verification rate limit | ✅ (5 min cooldown) |
| Graduated severity audit logs | ✅ (low/medium/high/critical) |
| Account deletion cascade | ✅ (ON DELETE CASCADE on FK) |

---

## New API Endpoints Summary

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/send-verification-email` | user | Generate + send verification token |
| `GET` | `/api/auth/verify-email?token=X` | none | Consume token + mark verified |
| `GET` | `/api/auth/email-verification-status` | user | Verification status + pending info |
| `POST` | `/api/admin/accounts/:id/suspend` | admin | Suspend account with reason + email |
| `POST` | `/api/admin/accounts/:id/unsuspend` | admin | Reinstate account + email |
| `GET` | `/api/admin/accounts/suspended` | admin | List all suspended accounts |
| `GET` | `/api/admin/accounts/:id/suspension-history` | admin | Per-account suspension audit |
| `POST` | `/api/admin/compliance/requests/:id/execute` | super_admin | Execute GDPR PII erasure |
| `GET` | `/api/onboarding/checklist` | user | 6-step school setup wizard status |
| `POST` | `/api/onboarding/school-setup` | user | Save wizard step data |
| `GET` | `/api/subscriptions/lifecycle/audit-log` | admin | Paginated subscription audit log |

---

## Recommendations

1. **Set `SMTP_*` environment variables** — until then, verification and suspension emails are logged to stdout only.
2. **Set `PUBLIC_URL`** — email verification links use this as the base URL. Without it, the Replit dev domain is used (correct for development, wrong for production emails).
3. **Run `POST /api/admin/compliance/requests/:id/execute`** only after legal review has confirmed the 30-day GDPR window has elapsed.
4. **Add a frontend `/verify-email` page** to handle the `?success=1`, `?error=...` query parameters from the token redirect.
5. **Policy version bump** — when updating ToS or Privacy Policy, update `POLICY_VERSION` in `compliance-consent.ts`. Existing users with older versions will need to re-accept.
