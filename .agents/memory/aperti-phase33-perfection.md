---
name: Aperti Phase 33 Platform Perfection
description: Key decisions and patterns from Phase 33 that must be preserved in future work
---

## Sidebar: No icon next to "Aperti."
The sidebar logo is pure text "Aperti." — never add an SVG, image, or icon next to it.
Confirmed in layout.tsx `SidebarContent` component.
**Why:** Design requirement confirmed by user; any icon creates visual clutter and was rejected.

## Search system (search.ts)
- Uses ILIKE with `%term%` wrapping; pg_trgm similarity as an optional enhancement
- pg_trgm extension enabled via migration — falls back gracefully if not available
- Syllabus code detection: `SYLLABUS_MAP` maps 0625→Physics, 9709→Math, etc.
- Question text content is searched in addition to topic
- Natural language parsing strips stop words and detects intents (weak_topics, recent, etc.)
- `/api/search/weak-topics` returns cards where mastery_level IN ('struggling','new')
**How to apply:** Always check both topic and question_text columns when searching the question bank.

## Flashcard confidence (flashcards.ts)
- Three levels: easy (SM-2 quality=5), okay (quality=3), hard (quality=1)
- Old "know/unsure" strings still supported via `confidenceToQuality()`
- `GET /flashcards/decks/:id/mastery` returns total, studied, masteryPercent, breakdown, nextDue
- Session complete screen shows easy/okay/hard breakdown and mastery %
**Why:** SM-2 requires a quality score; mapping named confidence levels to SM-2 quality is the standard UX pattern.

## Analytics: Retention & Engagement
- `GET /api/admin/analytics/retention` — 30/60/90-day retention, cohort data from accounts+audit_logs
- `GET /api/admin/analytics/engagement` — funnel: students → used flashcards → took assessment → used AI
- AnalyticsPage.tsx has a 4th tab "retention" with bars, funnel, and cohort table
**Why:** Phase 33 requirement for real-world readiness; uses audit_logs for activity detection (no separate events table needed).

## Health endpoint (/api/health, /api/health)
- Returns: status, dbLatencyMs, dbTables, memoryMb, uptime, version, env, timestamp
- Status is "degraded" if dbLatencyMs > 800, "critical" if DB unreachable
- /health returns 503 when critical (Railway compatibility)
**How to apply:** Both /health and /api/health are publicly accessible with no auth.

## Conversion / feature-adoption analytics
- These routes query conversion_events and feature_adoption_metrics which may not exist
- All queries now use `.catch(() => ({ rows: [] }))` for graceful degradation
**Why:** Table absence must never cause a 500 error on an admin analytics endpoint.

## Migrations: Phase 33 additions
Added to PHASE33_MIGRATIONS:
- `CREATE EXTENSION IF NOT EXISTS pg_trgm`
- GIN indexes on accounts.display_name, aperti_courses.title, subjects.name, question_bank.topic, revision_notes.title
- `subjects.syllabus_code` column
- `flashcard_progress.last_confidence` column
- `retention_snapshots` table
- `platform_feature_flags` table (with 3 default flags seeded)
- `search_logs.intent` and `search_logs.syllabus_code` columns

## requireRole usage
- `requireRole` accepts spread args: `requireRole("admin","teacher","assistant")`
- Do NOT pass an array: `requireRole(["admin","teacher"])` — this is a TypeScript error

## Loading states
- Pages with full-page loading should use skeleton screens not spinners
- Key components: `SkeletonPage`, `SkeletonDashboardGrid`, `SkeletonChart`, `SkeletonTable` from `@/components/skeleton-layouts`
- Spinner (Loader2/animate-spin) is acceptable only for inline actions (buttons, mutations)

## Course coverage endpoint
- `GET /api/course-health/:courseId/coverage` — per-subject syllabus coverage report
- Returns: totalSubjects, coverage[] per subject (hasAssessments/hasNotes/hasQuestions/hasHomework), gaps[], summary with coveragePct
- `CourseCoverageBadge` component in my-courses.tsx shows pct badge with tooltip on each course card
**Why:** Teaches detect content gaps by subject without a separate curriculum/units table.

## AI content review gate (revision notes)
- `revision_notes.teacher_reviewed` column (bool) — false for AI-generated, true for manual or reviewed
- New endpoints: `PATCH /api/revision-notes/:id/approve`, `PATCH /api/revision-notes/:id/reject`
- `GET /api/revision-notes/pending-review` lists AI notes awaiting teacher review
- AI-generated notes created with teacher_reviewed=false; manual notes with teacher_reviewed=true
**Why:** Teachers must be able to review and approve/reject AI-generated content before students see it.

## Question bank (question-bank.ts)
- POST/PUT now accept: commandWord, paper, sessionName, variant, board, qualification, sourceYear, questionType
- Zod validation on POST (createQuestionSchema) — rejects missing subjectId or short questionText
- `GET /question-bank/duplicate-check?text=...` — returns similar questions above 0.5 SIMILARITY threshold
**Why:** Multi-tagging uses existing DB columns (command_word, paper, board, etc.) that were already in migrate.ts but not wired to the route.

## Password reset security
- `forgotPasswordLimiter`: 5 requests per 15 min per IP on `/auth/forgot-password`
- Login limiter already existed (10/10min); forgot-password was previously unprotected
**Why:** Unrated forgot-password allows email flooding; added same rateLimit pattern as loginLimiter.

## Device login log
- `device_login_log` table created in Phase 33 migrations: account_id, device, browser, ip, user_agent, created_at
- Every successful login writes to this table (async, non-blocking .catch)
**Why:** Provides per-login history separate from session tracking; enables "new device" notifications.

## .env.example
- Removed NVIDIA API reference; now shows standard OpenAI key with Replit integration note
- SMTP config added as commented-out optional block
**How to apply:** Never add provider-specific API base URLs to .env.example without commenting them out.
