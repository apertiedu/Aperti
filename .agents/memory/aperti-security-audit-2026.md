---
name: Aperti Security Audit June 2026
description: IDOR fixes, error sanitization sweep, DB indexes, UX gaps closed — all implemented
---

## IDOR Vulnerabilities Fixed

- **homework.ts `GET /:id/submissions`** — ownership verified via `db.query.homework.findFirst({teacherAccountId})` before returning submissions
- **homework.ts `POST /:id/submissions/:subId/grade`** — ownership of homework verified before grading; subId also checked against homeworkId
- **homework.ts `GET /student`** — was returning ALL published homework system-wide; now filters by `students.teacher_account_id` for the requesting student
- **courses.ts `PUT /enrollments/:id`** — now joins `course_enrollments` → `aperti_courses` to verify requesting teacher owns the course (admin bypasses)
- **grading.ts `POST /submission/:submissionId/grade`** — checks `exams.teacher_account_id = req.userId` before auto-grading; pool import added to grading.ts

## Error Message Sanitization

All `res.status(500).json({ error: err.message })` and `res.status(500).json({ error: e.message })` patterns replaced with safe strings across **~27 route files**. Some patterns had template literals or `details` fields — handled case-by-case.

**Why:** Raw DB errors leak table names, constraint names, SQL syntax — fingerprinting aid for attackers.

## DB Indexes Added

17 critical FK indexes added via psql (separate from the startup db-indexes worker which adds its own set). Total 158 custom indexes now in DB.

## UX Gaps Closed

- `take-exam.tsx`: `isError` added to useQuery; full error card with "Try Again" + "Back to Exams" buttons; `credentials: "include"` added to fetch (was missing!)
- `exam-room.tsx`: `isError: examsError` added; error state with retry button shown when assessment list fails to load
- `course-builder.tsx`: Save button now validates all unit/topic titles before calling saveStructure.mutate(); toast with actionable description
- `AnalyticsPage.tsx`: All 4 useQuery calls now have `isError`; tab-aware error banner with retry shown above content

## How to Apply

When adding new routes: always check resource ownership server-side before returning or mutating. Pattern: query with `AND teacher_account_id = req.userId` before the main operation. Admin role skips ownership check via `req.role === "admin"` guard.
