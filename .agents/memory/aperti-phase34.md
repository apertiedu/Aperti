---
name: Aperti Phase 34 features
description: Anti-Cheat V2, GradeFlow AI confidence, flashcard AI generation, teacher interventions, ShieldCore V2 upgrade
---

## Phase 34 — UX Polish, AI Accuracy, Assessment Intelligence, Anti-Cheat V2

### DB Migrations (PHASE34_MIGRATIONS array in migrate.ts)
- `question_bank`: added `cognitive_level` TEXT, `exam_style` TEXT columns
- `exam_sessions`: added `paste_attempts` INT, `copy_attempts` INT, `risk_score` INT, `answer_time_ms` JSONB
- New table: `ai_grade_log` (id, submission_id, model, prompt, response, confidence, created_at)

### Anti-Cheat V2
- Risk score formula: paste×12 + tab_switch×8 + focus_loss×4 + copy×3, capped 0–100
- Heartbeat route (`POST /exam-session/heartbeat`) updated to accept paste_attempt/copy_attempt
- Frontend `take-exam.tsx` fully rewritten: per-question answer timing (navigateQuestion records elapsed ms), copy/paste event blocking + counting, 30s heartbeat, violation modal (tab/paste/copy variants with different messaging), submission payload includes `integrityData`
- `ShieldCore` upgraded to V2: paste/copy/tab breakdown columns, risk score with Progress bar, color-coded rows (red≥60, amber≥25), 30s auto-refetch

### GradeFlow AI Confidence Badge
- `grade-flow.tsx` rewritten with `ConfidenceBadge` component (high/medium/low + score %)
- Low confidence triggers: mandatory feedback before submit, red border on textarea, orange banner warning
- Misconceptions array from AI response displayed in amber panel
- AI confidence inferred from response `confidence` field; fallback: marks ratio estimate

### Flashcard AI Generation
- `POST /flashcards/decks/:id/generate` added to flashcards.ts (teacher/admin only)
- Accepts: text (≥20 chars), optional topic, count (1–30, default 8)
- AI generates front/back/difficulty JSON; validates ownership before inserting

### Teacher Interventions
- New route file: `teacher-interventions.ts` (POST /suggest, POST /class/:id/suggest)
- Registered in app.ts at `/api/teacher/interventions`
- Uses openaiChat (not callAI — that doesn't exist); null-safe match with `(aiResponse ?? "")`
- Frontend: new "AI Interventions" tab in content-analytics.tsx with staggered motion entry

### Question Extraction Upgrades
- `ExtractedQuestion` interface extended with cognitiveLevel + examStyle
- AI prompt updated with Bloom's taxonomy guide
- Rule-based fallback: inferCognitiveLevel + inferExamStyle helpers
- INSERT saves cognitive_level + exam_style to question_bank

**Why:** Phase 34 was entirely refinement — no new modules. All existing routes/patterns reused.
**How to apply:** requireRole uses spread args only: `requireRole("teacher", "admin")`. AI calls use `openaiChat` from `../lib/ai-config`.

## Phase 34 Items 18–20 (Polish, Stability, Enhancements)

**Ctrl+K OmniBar** — already worked via `command-palette.tsx` + `useCommandPalette()` hook; no changes needed.

**Quick Student Lookup** — `QuickStudentLookup` component in `core-hub.tsx`; fires on ≥2 chars via `/api/students?search=...&limit=6`; navigate-on-click.

**Customizable CoreHub Widgets** — gear icon opens `WidgetTogglePanel`; 7 widgets toggled via Switch; state persisted in `localStorage` key `aperti_corehub_widgets`.

**Notification Center** — rewrote `/pages/notification-center.tsx` as aggregated inbox; backend `notifications-inbox.ts` at `/api/notifications/inbox`; aggregates messages/submissions/alerts/tickets/enrollment.

**Platform Stability Dashboard** — `PlatformStabilitySection` + `StabilityMetricCard` in `FounderControlPage.tsx`; endpoint `GET /api/founder/platform-stability-metrics`; 6 live counters + circular score ring; inserted before Launch Readiness section.

**Attendance Audit Trail** — table `attendance_audit` (manual psql); routes `attendance-audit.ts` at `/api/attendance-audit`; page `/attendance-audit`.

**Enrollment Timeline** — table `enrollment_timeline` (manual psql); routes `enrollment-timeline.ts` at `/api/enrollment-timeline`; page `/enrollment-timeline`.

**Course Codes** — `course_code TEXT UNIQUE` added to `subjects` table; exported in db schema.

**Nav additions** — `History` icon added to layout.tsx imports; nav items wired for both new pages. App.tsx routes added in the first router block (lines ~518–519).
