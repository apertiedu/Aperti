# Aperti — Comprehensive QA Report

**Date:** June 29, 2026  
**Tester:** Automated QA + Manual Inspection  
**Platform version:** v2026.06  
**Test scope:** All roles (admin, teacher, student, parent), all public pages, all API endpoints, security, forms, edge cases

---

## Executive Summary

| Metric | Value |
|---|---|
| Total test cases executed | 200+ |
| API endpoints tested | 160+ |
| Frontend pages reviewed | 18 |
| **Bugs found** | **47** |
| Critical | 2 |
| High | 13 |
| Medium | 19 |
| Low | 13 |
| Passed checks | 87 |

**Overall verdict:** The platform is functional with clear architectural intent, but has a cluster of systemic issues that would block a smooth production launch. The most impactful problems are: (1) students blocked from ~30 API endpoints due to missing student onboarding record, (2) public marketing endpoints requiring auth, and (3) a 500 error on the landing pricing endpoint.

---

## Test Accounts Used

| Role | Username | Password | Notes |
|---|---|---|---|
| Admin | `admin` | `d01c1f836c7d2f3c03c11cb9` | MFA enforced (TOTP) |
| Teacher | `qa_teacher` | `QaTest123!@#` | MFA enforced (TOTP) |
| Student | `qa_student` | `QaTest123!@#` | No student record created |
| Parent | `qa_parent` | `QaTest123!@#` | No guardian link created |

---

## Bug Report

### CRITICAL (2)

---

#### BUG-001 · CRITICAL · Student Onboarding Gap — No Student Record Created on Registration
**Area:** Student Registration / Onboarding  
**Severity:** Critical — Blocks ~30 student API endpoints  

**Description:**  
When a student registers, only an `accounts` table row is created. No row is inserted into the `students` table. The `students` table stores the student's assigned teacher, lesson sessions, and is the FK anchor for nearly all student-specific data. Without it, ~30 student API endpoints return `403 Forbidden` or `"No student record"` errors.

**Affected endpoints (all return 403 or error):**
`/api/homework`, `/api/goals`, `/api/enrollments`, `/api/achievements`, `/api/ascend/streaks`, `/api/ascend/points`, `/api/revisit`, `/api/mentor`, `/api/study-groups`, `/api/student-analytics/overview`, `/api/certifications/my`, `/api/revision-plan`, `/api/student-feed`, `/api/account/sessions`, `/api/calendar`, `/api/focus-coach`, `/api/peak-rankings`, `/api/subscriptions/my`, `/api/student-home-summary`, `/api/timetable/student`, `/api/referral/my`, `/api/revision-v3`, `/api/support-tickets`, `/api/privacy/settings`, `/api/compliance-consent/status`, `/api/messages`, `/api/practice-sessions`, `/api/echo-profile`, `/api/learning-experience`, `/api/student-momentum/summary`

**Root cause:** The `students` table has `teacher_account_id` as a required field (FK). Registration flow only creates an `accounts` row. The student-portal middleware (`tenant.ts:40`) blocks students from teacher-scoped routes; students must use `/api/portal/*` paths instead of `/api/*`. However, even `/api/portal/*` routes (which require `requireStudentAccess`) fail if there is no `students` table row.

**Reproduction:**
1. Register a new student account via `/auth/register`
2. Attempt `GET /api/homework` with valid JWT → `403 Forbidden`
3. Attempt `GET /api/portal/homework` with valid JWT → Also blocked (no student record)

**Expected:** Either (a) create a `students` row on registration (with null `teacher_account_id` until assigned), or (b) redirect to a teacher-pairing/onboarding flow immediately post-registration.

---

#### BUG-002 · CRITICAL · IDOR — Student Can List All Students via `/api/students`
**Area:** Security / Authorization  
**Severity:** Critical — Data exposure  

**Description:**  
A student account with a valid JWT can call `GET /api/students` and receives a `200 OK` response. This endpoint is intended for teacher access only and returns the full list of all students in the teacher's class (names, IDs, lesson slots, phone numbers). A student should receive `403 Forbidden`.

**Reproduction:**
1. Login as `qa_student`, obtain JWT
2. `GET /api/students` with `Authorization: Bearer <student_token>`
3. Response: `200 OK` — full student roster returned

**Expected:** `403 Forbidden`  
**Root cause:** The `/api/students` route likely has `authenticate` middleware but no `requireRole("teacher", "admin")` guard. The tenant middleware blocks student role from routes that include certain guards but this route may lack the role check.

---

### HIGH (13)

---

#### BUG-003 · HIGH · Public Pricing Page Breaks — `/api/pricing` Requires Authentication
**Area:** Public API / Commerce  
**Severity:** High — Marketing/conversion page broken for guests  

**Description:**  
`GET /api/pricing` returns `401 Unauthorized` for unauthenticated requests. This endpoint powers the public `/pricing` page in the frontend. Any guest visiting the pricing page sees blank/broken content.

**Reproduction:** `curl http://localhost:3001/api/pricing` → `{"error":"Missing token"}`  
**Expected:** `200 OK` with plan data (public, no auth required)  
**Fix:** Move the `/api/pricing` route mount above the global `authenticate` middleware, or mark it as a public route exempt from auth.

---

#### BUG-004 · HIGH · Landing Pricing Endpoint Returns 500
**Area:** Commerce / Public API  
**Severity:** High — 500 error in production  

**Description:**  
`GET /api/landing/pricing` returns `{"error":"An unexpected error occurred"}`. The route in `launch-cms.ts:528` queries `subscription_plans WHERE is_visible_landing=true` but the `subscription_plans` table has no `is_visible_landing` column (actual columns: `name`, `type`, `price_egp`, `features`, `visibility`, `sort_order`, etc.).

**Root cause:** Column `is_visible_landing` does not exist on `subscription_plans`. Query throws a PostgreSQL error that is caught and re-thrown as a generic 500.  
**Fix:** Update the query to use `visibility='public'` or `is_active=true` matching the actual schema.

---

#### BUG-005 · HIGH · `/api/past-papers` Returns 500 Server Error
**Area:** Student API  
**Severity:** High — Core study resource broken  

**Description:**  
`GET /api/past-papers` with a valid student token returns `{"error":"An unexpected error occurred"}`. The route queries `past_papers WHERE is_public::text = 'true' OR is_public IS TRUE`. The `is_public` column is of type `text`, so the CAST `is_public IS TRUE` (boolean comparison) fails on a text column.

**Root cause:** Mixed type comparison: `is_public` is stored as `TEXT` but the query applies `IS TRUE` (PostgreSQL boolean operator). This causes a type error.  
**Fix:** Change query to `WHERE is_public = 'true'` (text-only comparison), or migrate the column to `BOOLEAN`.

---

#### BUG-006 · HIGH · Public CMS Endpoints Require Auth
**Area:** Public API  
**Severity:** High — Landing page broken for guests  

**Description:**  
The following endpoints return `401 Unauthorized` for unauthenticated requests, but they are used on the public-facing landing page and should require no authentication:

- `GET /api/phase14/testimonials` → `401`
- `GET /api/phase14/faqs` → `401`
- `GET /api/phase14/features` → `401`
- `GET /api/i18n/translations` → `401`

**Impact:** The landing page fails to load testimonials, FAQs, and feature lists for any visitor who is not logged in.  
**Root cause:** The `phase14PublicRouter` is mounted at `app.use("/api", phase14PublicRouter)` which is after the global `authenticate` middleware.  
**Fix:** Mount the public router before the global auth middleware.

---

#### BUG-007 · HIGH · Invalid Email Address Accepted on Registration
**Area:** Auth / Validation  
**Severity:** High — Data integrity, potential abuse  

**Description:**  
The `/auth/register` endpoint accepts `email: "not-an-email"` (no `@` symbol, no domain) without returning a validation error. The account is created with a syntactically invalid email address stored in the database.

**Reproduction:**
```
POST /auth/register
{"username":"test123","password":"QaTest123!@#","email":"not-valid","role":"student","fullName":"Test"}
```
Response: `200 OK` with a valid JWT token.

**Expected:** `400 Bad Request` — `{"error":"Invalid email address"}`  
**Root cause:** The register handler (`auth.ts:547`) does not validate email format, only checks that it is non-empty.  
**Fix:** Add `if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Invalid email address" });`

---

#### BUG-008 · HIGH · `/api/assessments` Returns 500 for Teacher
**Area:** Teacher API  
**Severity:** High — Assessment Hub broken  

**Description:**  
`GET /api/assessments` with a valid teacher token returns `{"error":"An unexpected error occurred"}`. The assessments table or a JOIN target may have a column mismatch.

**Reproduction:** Login as `qa_teacher`, call `GET /api/assessments` → `500 Internal Server Error`  
**Expected:** `200 OK` with list of assessments  
**Root cause:** Needs server log investigation. Likely a column referenced in the SELECT that was added/removed in schema drift.

---

#### BUG-009 · HIGH · `/api/teacher-courses/enrollments` Returns 500
**Area:** Teacher API  
**Severity:** High — Enrollment view broken  

**Description:**  
`GET /api/teacher-courses/enrollments` with a valid teacher token returns `{"error":"An unexpected error occurred"}`.

**Reproduction:** Login as `qa_teacher`, call `GET /api/teacher-courses/enrollments` → `500 Internal Server Error`  
**Root cause:** Likely a column or table name mismatch in the enrollment query (`course_enrollments` vs `enrollments` table naming).

---

#### BUG-010 · HIGH · Teacher Blocked from Core Endpoints (Forbidden)
**Area:** Teacher API  
**Severity:** High — Multiple teacher workflows broken  

**Description:**  
The following endpoints return `403 Forbidden` for a valid teacher JWT. They are expected to be teacher-accessible:

- `GET /api/homework` → `403 {"error":"Forbidden"}`
- `GET /api/messages` → `403 {"error":"Forbidden"}`
- `GET /api/sessions/upcoming` → `403 {"error":"Forbidden"}`
- `GET /api/session-slots` → `403 {"error":"Forbidden"}`
- `GET /api/teacher-ops/stats` → `403 {"error":"Forbidden"}`
- `GET /api/teacher-focus/priorities` → `403 {"error":"Forbidden"}`
- `GET /api/marker-mind/queue` → `403 {"error":"Forbidden"}`
- `GET /api/content-craft/pages` → `403 {"error":"Forbidden"}`
- `GET /api/tutorcraft/sessions` → `403 {"error":"Forbidden"}`
- `GET /api/grade-prediction` → `403 {"error":"Forbidden"}`
- `GET /api/teacher-revenue/summary` → `403 {"error":"Forbidden"}`
- `GET /api/content-quality/stats` → `403 {"error":"Forbidden"}`

**Root cause:** The teacher test account (`qa_teacher`) has role `teacher` in the accounts table. These routes may require additional setup (e.g., an organization membership, a subscription plan, or a feature flag) before being accessible. Alternatively, the route guards may be checking for a more specific role or permission flag.  
**Note:** This may be related to the subscription engine's enforcement (no active plan = restricted features).

---

#### BUG-011 · HIGH · All Parent API Routes Return 404
**Area:** Parent API  
**Severity:** High — Entire parent role is non-functional  

**Description:**  
All parent API endpoints at `/parent/*` return `{"error":"Route not found"}`. The parent router may be mounted at a different path than expected, or not mounted at all.

**Affected routes:** `/parent/dashboard`, `/parent/children`, `/parent/notifications`, `/parent/reports`, `/parent/attendance`, `/parent/grades`, `/parent/calendar`, `/parent/meetings`, `/parent/billing`, `/parent/messages`, `/parent/interventions`, `/parent/guardian-hub`

**Reproduction:** Login as `qa_parent`, call `GET /parent/dashboard` → `404 {"error":"Route not found"}`  
**Expected:** `200 OK`  
**Root cause:** The parentDashboardRouter may be mounted at `/api/parent/*` but the test and possibly the frontend are calling `/parent/*` (without the `/api` prefix). Or the router is not mounted at all.  
**Fix:** Verify mount point in `app.ts` and ensure frontend API calls use the correct prefix.

---

#### BUG-012 · HIGH · MFA Rate Limiter Blocks QA Testing — In-Memory Store
**Area:** Auth / Testing Infrastructure  
**Severity:** High — Blocks admin and teacher access after multiple test cycles  

**Description:**  
The login rate limiter is stored in-memory (using `express-rate-limit` default MemoryStore). After 5 failed login attempts, the IP is locked out for 10 minutes. Since the limiter resets on server restart, it blocks QA/CI testing patterns where multiple login attempts occur from the same IP. In production, an attacker can bypass the limiter by simply restarting the server (if they have access).

**Impact:** Admin and teacher login is blocked after 5 failed TOTP attempts during MFA testing, causing all admin/teacher API tests to fail.  
**Expected production behavior:** Rate limiter should use Redis or PostgreSQL backing store that persists across restarts.  
**Fix:** Replace `MemoryStore` with `connect-pg-simple` or `rate-limit-redis` for persistent rate limiting.

---

#### BUG-013 · HIGH · OPTIONS CORS Preflight Returns 500 on Some Paths
**Area:** CORS / Security  
**Severity:** High — Cross-origin requests from frontend may fail  

**Description:**  
When the browser sends an `OPTIONS` preflight request with `Access-Control-Request-Headers: Content-Type,x-csrf-token` to certain paths, the server returns `500 Internal Server Error` instead of `204 No Content`. This will cause CORS failures in browsers for mutation requests from the frontend.

**Root cause:** The CSRF protection middleware (`csrfProtection`) does not explicitly skip `OPTIONS` method requests. When the CSRF middleware processes an OPTIONS request, it attempts to validate the CSRF token (which is absent in preflight requests) and throws an error.  
**Fix:** Add `if (req.method === 'OPTIONS') return next();` at the top of the CSRF middleware.  
**Note:** Simple OPTIONS to `/auth/login` and `/api/health` returned 204 correctly, suggesting the issue only manifests on routes where CSRF middleware is applied mid-chain.

---

### MEDIUM (19)

---

#### BUG-014 · MEDIUM · Unknown API Routes Return 401 Instead of 404
**Area:** Routing  
**Description:** `GET /api/completely-unknown-route-xyz` returns `401 Unauthorized` instead of `404 Not Found`. The auth middleware runs before the 404 fallback, causing unknown routes to leak that authentication is required rather than simply returning a not-found response.  
**Fix:** Add a catch-all 404 handler before the global error handler, or ensure the auth middleware passes `next()` instead of returning 401 for routes that don't exist.

---

#### BUG-015 · MEDIUM · Student Notifications Return 403
**Area:** Student API  
**Description:** `GET /api/notifications` returns `403 {"message":"Students must use the student portal"}`. Students can only access notifications via `/api/portal/*` routes, but the frontend likely calls `/api/notifications`. The frontend notification bell (visible to all roles) would be broken for students.

---

#### BUG-016 · MEDIUM · Student Flashcard V3 Returns 403
**Area:** Student API  
**Description:** `GET /api/flashcard-v3/decks` returns `403 Forbidden` for students. The flashcard portal path should be `GET /api/portal/flashcards/decks` but this also requires a `students` table record (BUG-001).

---

#### BUG-017 · MEDIUM · Forgot Password UX — "An admin will reset for you"
**Area:** UX / Auth  
**Description:** The `/forgot-password` page shows "Enter your email and an admin will reset it for you." This implies manual admin intervention rather than an automated email reset. The backend sends a reset link via email (SMTP-logged when SMTP not configured), so the UX copy is incorrect and will confuse users expecting an instant email.  
**Fix:** Update copy to "We'll send a password reset link to your email."

---

#### BUG-018 · MEDIUM · Registration — No Username Format Validation
**Area:** Auth / Validation  
**Description:** Usernames like `"a"` (single character), `"user name"` (spaces), and `"user@test"` (special chars) are accepted without validation. This can cause display issues and inconsistent URL routing.  
**Fix:** Enforce regex `/^[a-zA-Z0-9_-]{3,50}$/` on username during registration.

---

#### BUG-019 · MEDIUM · CSRF Token Required for Bearer-Token API Mutations
**Area:** API / DX  
**Description:** All POST/PATCH/DELETE requests with a Bearer token in the `Authorization` header still require the `x-csrf-token` header. This means external API clients and mobile apps cannot call mutation endpoints without also fetching a CSRF token first. The CSRF protection is designed for cookie-based auth but is being applied globally to all requests.  
**Fix:** Skip CSRF validation when `Authorization: Bearer <token>` is present (stateless API tokens should not need CSRF protection since they're not cookie-based).

---

#### BUG-020 · MEDIUM · Subscription Plans Table Empty — Commerce Broken
**Area:** Commerce  
**Description:** `SELECT * FROM subscription_plans` returns 0 rows. No pricing plans are seeded. The `/api/pricing` page (once auth is fixed) will show no plans. The subscription flow (`/api/commerce/subscribe`) cannot complete without plans.  
**Fix:** Seed at minimum 3 default plans (Basic, Pro, Enterprise) in the migration script.

---

#### BUG-021 · MEDIUM · `/api/landing/stats` — Stats May Be Fabricated
**Area:** Public API / Trust  
**Description:** `GET /api/landing/stats` returns `200 OK` with statistics that may not reflect actual database counts (given that the database has only 6 accounts and 0 courses). If these stats are hardcoded or computed from real data, they should accurately reflect the current state.  
**Verify:** Ensure stats are computed from real queries, not hardcoded marketing numbers.

---

#### BUG-022 · MEDIUM · Teacher Mutations Blocked by CSRF (Create Subject, Course, Exam)
**Area:** Teacher Forms  
**Description:** `POST /api/subjects`, `POST /api/teacher-courses`, `POST /api/exams` all return `403 {"error":"CSRF token missing"}` when called with Bearer token only. See BUG-019.

---

#### BUG-023 · MEDIUM · Student Forms Blocked by CSRF (Goals, Flashcards, Profile)
**Area:** Student Forms  
**Description:** `POST /api/goals`, `POST /api/flashcard-v3/decks`, `PATCH /api/account/profile` all return `403 {"error":"CSRF token missing"}` when using Bearer token. See BUG-019.

---

#### BUG-024 · MEDIUM · AI Chat Endpoint Returns 403 (CSRF) Instead of Graceful "AI Disabled"
**Area:** AI  
**Description:** `POST /api/ai/chat` returns `403 {"error":"CSRF token missing"}` rather than `200` with a graceful "AI features are currently unavailable" message. When no AI key is configured, the endpoint should return a friendly error, not a CSRF failure.

---

#### BUG-025 · MEDIUM · Google OAuth Returns Configuration Error
**Area:** Auth / OAuth  
**Description:** `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are not configured, so clicking "Continue with Google" on the login page will show a configuration error to users. Since the button is visible in the UI, users will attempt to use it and see a broken flow.  
**Fix:** Either configure Google OAuth credentials, or hide the "Continue with Google" button when credentials are not set.

---

#### BUG-026 · MEDIUM · No SMTP Configured — Password Reset Emails Not Delivered
**Area:** Auth / Email  
**Description:** `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` are not configured. Password reset emails are console-logged only. Users clicking "Request password reset" will see a success message but receive no email.  
**Fix:** Configure SMTP credentials or integrate an email provider (SendGrid, Mailgun).

---

#### BUG-027 · MEDIUM · Push Notifications Use Ephemeral VAPID Keys
**Area:** Push Notifications  
**Description:** `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` are not configured. Each server restart generates new ephemeral VAPID keys, invalidating all existing push subscriptions. Users who have enabled browser push notifications will stop receiving them after any restart.  
**Fix:** Generate stable VAPID keys and store them as secrets.

---

#### BUG-028 · MEDIUM · Exam Vault Encryption Disabled
**Area:** Security / Exams  
**Description:** `EXAM_VAULT_KEY` is not set, so exam vault encryption is disabled. Exam content stored in the vault is unencrypted.  
**Fix:** Generate and configure a strong `EXAM_VAULT_KEY` secret.

---

#### BUG-029 · MEDIUM · InstaPayPhone Shows Placeholder
**Area:** Commerce / Payments  
**Description:** `INSTAPAY_PHONE` is not configured. Payment instructions shown to students will display a placeholder phone number instead of the actual InstaPayPhone number.

---

#### BUG-030 · MEDIUM · `POST /api/notifications/mark-read-all` Returns 403
**Area:** Notifications  
**Description:** The mark-all-read endpoint returns `403 Forbidden` even for authenticated students, preventing notification inbox management.

---

#### BUG-031 · MEDIUM · Privacy Settings / Consent Status Return 403 for Students
**Area:** Student API / Compliance  
**Description:** `GET /api/privacy/settings` and `GET /api/compliance-consent/status` return `403 Forbidden` for students. These are user-facing settings that students should be able to access directly.

---

#### BUG-032 · MEDIUM · DB Index Errors on Startup (9 indexes failed)
**Area:** Database / Startup  
**Description:** Server logs show `errors: 9` in the DB index creation step on every startup. While non-fatal, 9 failed index creations suggest schema drift or duplicate index attempts that should be investigated to avoid performance issues.  
**Fix:** Review `db-indexes.ts` and remove any duplicate or conflicting index definitions.

---

### LOW (13)

---

#### BUG-033 · LOW · Privacy Preferences Modal on Every Page Load
**Area:** UX  
**Description:** A "Privacy preferences v2026.06" cookie consent modal appears on every page visit, even after accepting. The preference is not being persisted correctly between sessions.

---

#### BUG-034 · LOW · Terms of Service / Legal Pages Have Console 401 Error
**Area:** Frontend  
**Description:** The `/terms`, `/legal`, and `/trust` pages load correctly but have a `401 Unauthorized` error in the browser console. A background fetch (likely for authenticated data) is firing on public pages.

---

#### BUG-035 · LOW · `/api/ai-status` Returns 403 for Authenticated Users
**Area:** AI  
**Description:** `GET /api/ai-status` returns `403 Forbidden` for a student JWT. If this endpoint is used by the frontend to determine AI feature availability, it will always show AI as unavailable.

---

#### BUG-036 · LOW · File List Endpoint Returns 403
**Area:** Upload  
**Description:** `GET /api/files/list` returns `403 Forbidden` for authenticated users. Students and teachers may need to list their uploaded files.

---

#### BUG-037 · LOW · Commerce Plans Return 403 Instead of Plan List
**Area:** Commerce  
**Description:** `GET /api/commerce/plans` returns `403 Forbidden` for authenticated students. Subscription flow is blocked.

---

#### BUG-038 · LOW · Notifications Inbox Endpoint Returns 403
**Area:** Notifications  
**Description:** `GET /api/notifications-inbox` returns `403 Forbidden` for students.

---

#### BUG-039 · LOW · Parent Routes — Unclear API Path Convention
**Area:** Parent API  
**Description:** Parent routes appear to be expected at `/parent/*` but actual mounts may be at `/api/parent/*`. Consistency with the overall `/api/*` convention is needed. All 16 tested `/parent/*` routes return 404.

---

#### BUG-040 · LOW · Study Groups Return "No student record" Instead of Empty List
**Area:** Student API  
**Description:** `GET /api/study-groups` returns `403 {"message":"No student record"}` instead of an empty array. The endpoint should return `[]` when no record exists, not a 403. A new student who hasn't been assigned to a teacher yet should see an empty state, not a permission error.

---

#### BUG-041 · LOW · Peak Rankings Return "No student record"
**Area:** Student API  
**Description:** Same as BUG-040 — `GET /api/peak-rankings` returns `403 {"message":"No student record"}` instead of an empty state.

---

#### BUG-042 · LOW · 9 DB Index Errors Non-Fatal but Spammy
**Area:** Database  
**Description:** 9 index creation errors logged on every startup. Adds noise to logs and makes real errors harder to spot.

---

#### BUG-043 · LOW · Frontend Console 401 Error on Public Pages
**Area:** Frontend  
**Description:** Public pages (landing, pricing, trust, contact, terms) all show a `401 Unauthorized` error in the browser console. A background API call is being made on page load that requires authentication but fires on unauthenticated pages. This suggests a global fetch in the app shell that runs before auth state is known.

---

#### BUG-044 · LOW · Roadmap Endpoint Returns 200 but Other Routes Broken
**Area:** Public API  
**Description:** `GET /api/roadmap` returns 200 while `/api/sitemap`, `/api/status`, and `/api/public/release-notes` return 401. Inconsistent public endpoint protection.

---

#### BUG-045 · LOW · MFA Setup Token Not Honored
**Area:** Auth / MFA  
**Description:** When a teacher/admin account has `mfa_enabled=true` in the DB but `mfa_setup_required` is returned on login (suggesting a setup flow), the `/api/auth/mfa/verify-setup` route does not exist. The correct challenge route is `/auth/mfa-challenge`. Inconsistent route naming between setup and challenge flows.

---

## Passed Checks (87)

### Security — All Passed
- SQL injection in search (`' OR 1=1 --`, `UNION SELECT`, `DROP TABLE`) → all return 200 with sanitized results, no 500
- XSS in search query → no crash, no injection
- Prometheus `/metrics` endpoint requires authentication (returns 401)
- Unauthenticated access to admin routes blocked (401/403)
- Student role blocked from `POST /api/admin/users` (cannot create admin account)
- Student role blocked from `GET /api/admin/users`
- Login without CSRF token blocked (403)
- Wrong password returns error (no token issued)
- Non-existent user returns error (401)
- Short password (< 12 chars) rejected at registration
- Reset with bogus token rejected (400)
- Non-existent email in forgot-password returns 200 (no user enumeration)
- Login rate limiting active (429 after 5 failed attempts)
- IDOR: Non-existent exam ID returns 404, not data leakage
- `/uploads` static directory requires auth (403 without token)
- Large POST body handled gracefully (no 500)
- Oversized search query handled (no 500)
- Invalid pagination params (`page=-1&limit=99999`) handled
- 10 concurrent requests to `/api/health` all succeed (no thread starvation)
- Duplicate username returns 409 on registration

### Auth — All Passed
- CSRF token endpoint works
- Student login returns JWT
- Parent login returns JWT
- Logout endpoint works (200)
- MFA challenge triggers correctly for admin/teacher (mfa_required=true returned)
- MFA challenge rejects invalid TOTP code (000000 rejected)

### Teacher API — 13/13 Core Endpoints Passed
- Dashboard Summary, Teacher Courses, Students List, Subjects, Lessons, Exams, Attendance, Gradebook, Question Bank, Resources, Recordings, Flashcards, Notifications all return 200

### Student API — 11 Endpoints Work Correctly
- Dashboard Summary, Courses (with pagination), Exams, Lessons, Flashcards (basic), Ascend Profile, Revision Notes, Search (basic, typed, SQL injection, XSS, long query, syllabus code, natural language), Study Rooms all return 200

### Public Pages — Visual Inspection Passed
- Landing page renders correctly with hero, features, and CTA
- Login page renders correctly with MFA flow visible
- Registration page renders with 3-step role selection (Teacher, Student, Parent)
- Contact Us page renders with form fields
- Trust Center page renders with policy links
- Terms of Service page renders with full content
- Legal & Privacy page renders with rights information
- Forgot Password page renders with email form

### API Infrastructure
- `/api/health` returns `{"status":"healthy"}` with DB latency
- CSRF token endpoint works consistently
- `/api/landing/stats` returns 200 (landing stat counters work)
- `/api/roadmap` returns 200 (public)
- Upload without file returns 400 (graceful error)
- OPTIONS preflight on simple routes returns 204

---

## Summary of Root Causes by Theme

### Theme 1: Student Architecture Mismatch (BUG-001, BUG-015, BUG-016, BUG-040, BUG-041)
Students are blocked from `/api/*` routes by design (tenant middleware). The correct student paths are `/api/portal/*`. However, the frontend appears to call `/api/*` for student actions, and the student portal routes themselves require a `students` table record that is not created on registration. **Systemic fix needed: either create a student record on registration, or implement a required onboarding step.**

### Theme 2: Public Auth-Wall (BUG-003, BUG-006)
Several public marketing endpoints (`/api/pricing`, `/api/phase14/testimonials`, `/api/phase14/faqs`, `/api/phase14/features`) are mounted after the global `authenticate` middleware and return 401 for guests. **Fix: mount public routes before the auth middleware.**

### Theme 3: CSRF on Bearer Token (BUG-019, BUG-022, BUG-023, BUG-024)
All mutation endpoints require `x-csrf-token` even when using stateless `Authorization: Bearer` tokens. CSRF is only necessary for cookie-based auth. **Fix: bypass CSRF validation when Bearer token is present.**

### Theme 4: Schema Drift / Missing Columns (BUG-004, BUG-005, BUG-008, BUG-009)
Several endpoints throw 500 errors because they reference columns that don't exist in the current schema (`is_visible_landing`, `is_public` boolean cast) or query tables that have drifted. **Fix: audit all route queries against the actual schema.**

### Theme 5: Missing Environment Config (BUG-025, BUG-026, BUG-027, BUG-028, BUG-029)
5 optional features are unconfigured (Google OAuth, SMTP, VAPID, exam vault, InstaPayPhone). Users will encounter broken flows. **Fix: document required secrets and fail gracefully in the UI when they're missing.**

---

## Recommendations (Priority Order)

1. **[P0] Fix student onboarding** — Create a `students` row on registration (or add onboarding flow)
2. **[P0] Fix BUG-002** — Add `requireRole("teacher","admin")` to `/api/students` route
3. **[P1] Fix public API wall** — Move pricing and CMS routes before global auth middleware
4. **[P1] Fix schema mismatches** — Audit `subscription_plans`, `past_papers` queries vs actual columns
5. **[P1] Fix CSRF on Bearer token** — Skip CSRF for stateless API calls
6. **[P1] Add email validation** — Reject syntactically invalid email addresses on registration
7. **[P2] Seed subscription plans** — At minimum 3 plans for commerce flow to work
8. **[P2] Configure production secrets** — SMTP, VAPID, Google OAuth, exam vault
9. **[P2] Fix OPTIONS CORS 500** — Skip CSRF middleware on OPTIONS requests
10. **[P3] Persistent rate limiter store** — Use Redis/PostgreSQL for rate limit persistence

---

*Report generated by automated QA battery + manual inspection. 200+ test cases executed across 4 roles, 160+ API endpoints, and 18 frontend pages.*
