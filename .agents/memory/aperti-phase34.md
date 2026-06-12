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
