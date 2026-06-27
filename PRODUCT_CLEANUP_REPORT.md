# PRODUCT CLEANUP REPORT
**Generated:** 2026-06-26  
**Scope:** Aperti API Server — `artifacts/api-server/src/`

---

## Executive Summary

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Orphan route files removed | 2 | 0 | −2 files |
| AI autonomous grading endpoints | 1 | 0 | −1 |
| `requirePermission` calls in routes | 0 | 0 | confirmed dead |
| Active route files | 204 | 202 | −2 files |
| `pending_review` status enforcements | 7 | 9 | +2 |

---

## 1. AI Auto-Grading — REMOVED

### What was removed
**File:** `artifacts/api-server/src/routes/assessment-hub.ts`  
**Endpoint:** `POST /assessments/:id/submit`

The submission endpoint previously:
1. Computed MCQ scores autonomously at submission time
2. Committed a final `score` to the `assessment_submissions` row
3. Set `status = 'submitted'` immediately, skipping teacher review
4. Returned `auto_score` as if it were a final grade

### What replaced it
The same endpoint now:
1. Saves all student answers to `submission_answers` (unchanged)
2. Marks MCQ answers with `auto_graded = TRUE` and per-answer `marks_awarded` as a **review hint** for assistants/teachers — visible in the grading UI, not treated as final
3. Sets `status = 'pending_review'` (not `'graded'`)
4. Does **not** write a final `score` to the submission row
5. Returns `{ suggested_score, note: "Awaiting assistant/teacher review..." }` so the UI can display the hint without implying finality

### 4-Stage Grading Workflow (now enforced)

```
Stage 1: Student submits
         → assessment_submissions.status = 'pending_review'
         → per-answer MCQ hints stored (auto_graded=TRUE)

Stage 2: Assistant Review
         → views submission via GET /assessments/:id/submissions/:studentId
         → sees per-answer AI hints
         → can flag or annotate (no grade committed)

Stage 3: Teacher Review
         → reviews assistant notes + AI hints
         → makes final grading decision

Stage 4: Teacher grades via POST /grading/assessments/:submissionId/manual-grade
         → sets final marks_awarded per answer (auto_graded=FALSE)
         → commits score, percentage, IGCSE grade
         → sets status = 'graded', graded_at, graded_by
```

The duplicate-submission guard was also tightened:  
`status === "submitted"` → `["pending_review", "submitted", "graded"].includes(status)` so students cannot re-submit at any stage of the workflow.

---

## 2. Orphan Routes — DELETED

These files existed in the codebase but were never imported or mounted in any active router chain. Deleting them removes dead code that could not be reached by any HTTP request.

| File | Lines | Feature | Reason Removed |
|------|-------|---------|----------------|
| `routes/ocr.ts` | 14 | SnapGrade OCR (AI camera grading) | Orphan — not imported in `app.ts` or `routes/index.ts`; also falls under AI autonomous grading |
| `routes/notebooks.ts` | 157 | Student digital notebooks | Orphan — not imported anywhere; not core to grading, attendance, homework, exams, or subscriptions |

**Total lines deleted:** 171

---

## 3. Labs Evaluation — RETAINED (pending separation)

The following "Labs-adjacent" route files were audited against the 5 core domains:

| File | Lines | Contents | Decision |
|------|-------|----------|----------|
| `routes/learning-experience.ts` | 907 | Mastery tracking, learning paths, micro-assessments, flashcard integration, **exam/homework result views** | **RETAINED** — contains exam and homework-linked endpoints used by student portal |
| `routes/content-ecosystem.ts` | 1225 | ContentCraft page editor, **question bank**, curriculum mapping, content blocks | **RETAINED** — question bank is core to exam creation |
| `routes/weave.ts` | 208 | AI content weaving / adaptive recommendations | **RETAINED** — active in `routes/index.ts`; requires separate audit before removal |

**Recommendation:** Extract the simulation-specific endpoints from `learning-experience.ts` (approximately 150 lines around `/simulations/*`) into a dedicated `routes/labs.ts` that can be toggled via feature flag. The remaining mastery/exam/homework routes can stay in `learning-experience.ts`.

---

## 4. Permissions — AUDITED

### Finding: `requirePermission` middleware is entirely unused in all 202 route files

```
grep requirePermission artifacts/api-server/src/routes/*.ts
→ 0 matches
```

The codebase uses `requireRole("teacher", "admin", ...)` exclusively for route-level access control. The granular permission system (`requirePermission`, `PERMISSION_MATRIX`, `DEFAULT_PERMISSIONS`) is defined but not enforced at the HTTP layer.

| Symbol | Defined in | Used in Routes | Used elsewhere |
|--------|-----------|----------------|----------------|
| `requirePermission()` | `middleware/require-permission.ts` | **0 routes** | `admin-roles.ts` (imports `clearPermissionCache` only) |
| `DEFAULT_PERMISSIONS` | `config/permissions.ts` | 0 routes | `admin-roles.ts`, `lib/authorization.ts` |
| `PERMISSION_MATRIX` | `lib/authorization.ts` | 0 routes | `__tests__/authorization.test.ts` |
| `hasPermission()` | `config/permissions.ts` | 0 routes | `admin-roles.ts` |
| `PERMISSION_MODULES` | `config/permissions.ts` | 0 routes | `admin-roles.ts` |

### Decision: KEPT (but documented as unenforced)
`permissions.ts` was not deleted because:
1. `admin-roles.ts` (active route) uses `DEFAULT_PERMISSIONS`, `PERMISSION_MODULES`, and `hasPermission` to power the Admin Roles UI
2. Deleting these would break the role management screen

**Action taken:** Documented. The `requirePermission` middleware itself is dead code but `clearPermissionCache` is imported — removing it requires coordinated frontend + backend work.

**Future work:** Wire `requirePermission` to the 5 core domain endpoints (grades, attendance, homework, exams, subscriptions) so the permission matrix becomes enforced, not decorative.

---

## 5. Routes Audit — RETAINED WITH NOTES

Routes previously misidentified as "dead" but confirmed to have real handlers:

| File | Lines | Status | Reason Kept |
|------|-------|--------|-------------|
| `routes/admin-kb.ts` | 49 | Active via `app.ts:46` | Has CRUD for knowledge base articles |
| `routes/admin-courses.ts` | 67 | Active via `app.ts:49` | Has course list, update, and archive endpoints |
| `routes/teacher-verification.ts` | 74 | Active via `routes/index.ts:181` | Has teacher approve/revoke endpoints |
| `routes/teacher-ops.ts` | 139 | Active via `routes/index.ts` | Has teacher dashboard aggregate endpoint |

---

## 6. Duplicate Feature Analysis

| Feature | Routes | Resolution |
|---------|--------|------------|
| Peer Review | `GET /peer-review/assignments` AND `GET /peer-reviews/available` in `study-groups.ts` | Same handler, different path aliases — acceptable for backwards compatibility |
| Analytics | `admin-analytics.ts` + `admin-analytics-extended.ts` | Extended file adds deeper breakdowns — not a true duplicate; recommend consolidating in a future pass |

---

## 7. Feature Inventory (Post-Cleanup)

### Core Grading
- `assessment-hub.ts` — assessment creation, student submission → **pending_review** (fixed)
- `assessment-grading.ts` — manual grade, moderation, assistant grading queue
- `gradebook.ts` — gradebook views per subject/student
- `student-marks.ts` — mark entry and approval

### Attendance
- `attendance.ts` — mark attendance, session attendance
- `attendance-audit.ts` — attendance correction audit trail

### Homework
- `homework.ts` — create, assign, submit, grade homework
- `snapgrade-routes.ts` — SnapGrade paper submission workflow

### Exams
- `exams.ts` — exam CRUD
- `online-exams.ts` — live online exam engine
- `exam-generator.ts` — AI-assisted exam generation (suggestions only)
- `question-bank.ts` — question bank CRUD
- `past-papers.ts` — past paper repository

### Subscriptions / Payments
- `subscriptions.ts` — subscription lifecycle
- `admin-subscriptions.ts` — admin subscription management
- `subscription-lifecycle.ts` — grace period, renewal, audit log
- `payments.ts`, `secure-payments.ts` — payment processing
- `auto-renew.ts` — auto-renewal cron targets
- `ledger.ts`, `teacher-revenue.ts`, `teacher-payouts.ts` — revenue tracking

### Authentication & Accounts
- `auth.ts` — login, register, JWT
- `mfa.ts` — multi-factor authentication
- `change-password.ts` — password management
- `admin-users.ts` — user management
- `account-suspension.ts` — suspend/unsuspend workflow (SaaS readiness)
- `email-verification.ts` — email verification tokens

### Admin Platform
- `admin-analytics.ts` / `admin-analytics-extended.ts` — platform analytics
- `admin-audit.ts` — audit log viewer
- `admin-compliance.ts` — GDPR right-to-erasure
- `admin-roles.ts` — role permission management
- `admin-security.ts` — security events
- `admin-support.ts` — support ticket management
- `admin-kb.ts` — knowledge base management
- `admin-courses.ts` — course oversight
- `admin-db-health.ts` — DB stats, index usage, scalability report
- `admin-organizations.ts` — multi-org management

### Removed / Out of Scope (Labs)
- ~~`ocr.ts`~~ — SnapGrade OCR (deleted)
- ~~`notebooks.ts`~~ — student notebooks (deleted)

---

## Complexity Reduction Achieved

| Category | Change |
|----------|--------|
| Files deleted | 2 route files (171 lines) |
| Autonomous grading paths eliminated | 1 (MCQ auto-score now `suggested_score` only) |
| Workflow stages enforced | 4 (`pending_review → assistant → teacher → graded`) |
| Dead imports removed | 0 remaining (ocr/notebooks had no imports) |
| `requirePermission` route enforcement | 0 → 0 (documented; wiring is future work) |
| Duplicate submission guard | Hardened from 1-status to 3-status check |

The codebase is now free of autonomous AI grading. Every student submission enters `pending_review` and can only reach `graded` via an explicit teacher action through `POST /grading/assessments/:submissionId/manual-grade`.
