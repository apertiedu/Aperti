---
name: Phase 5 Final Systems
description: FindWise semantic search, AutoPilot, LiveClass AI session intelligence, ai-config multilingual patterns
---

## FindWise Semantic Search

- **Backend**: `POST /api/search/semantic` in `routes/semantic-search.ts`
- **Legacy GET `/api/search`** is now also served from `semantic-search.ts` (not the old `search.ts` — that file is unused, safe to delete)
- The semantic endpoint groups results by: Topics (knowledge_nodes), Students (misconceptions match), Questions, Resources (lessons), People, Courses
- Student results (weak-in queries) are only returned for teacher/admin roles — checked via `userRole` in the request
- Trigger pattern: `SEMANTIC_TRIGGER` regex in command-palette.tsx fires when query ≥3 chars and contains a space or academic keywords
- **Frontend**: `command-palette.tsx` — auto-detects natural language queries (≥3 chars + trigger pattern), debounces 350ms, calls API, shows grouped results with AI badge

## AutoPilot Automation Engine

- **DB table**: `automation_tasks` (id, teacher_id, type, label, schedule, parameters JSONB, enabled, last_run, run_count)
- **Backend**: `routes/autopilot.ts` — CRUD + `/tasks/:id/run-now` endpoint
- **Background service**: `lib/autopilot-service.ts` — `setInterval(60s)`, started via dynamic `import()` in `index.ts` after migrations
- **Schedule keys**: `every_minute`, `hourly`, `daily`, `weekly`, `monday` — handled by `isDue()` function in service
- **Implemented task types**: `risk_check` (CoreMind scan + notification), `reminder` (bulk student notification); `assignment` and `report` are scaffolded
- **Frontend**: `/automation` page, sidebar under "Manage" group with `Bot` icon from lucide

## LiveClass AI Session Intelligence

- **`summary` column** added to `live_class_rooms` table via migration
- **`POST /live-class/analyse`** — reads `engagement_records` for the session, calls OpenAI for summary, stores in DB, returns cached if already generated
- **`POST /live-class/end`** — marks `ended_at` timestamp
- **`GET /live-class/history`** — teacher's past sessions with participant counts and attention averages
- **Frontend**: `SessionHistoryView` component in `live-class.tsx` — "View Past Sessions" link in lobby, expand/collapse AI summary with ✨ sparkle icon, generate-on-demand button

## AI Config & Multilingual

- **`lib/ai-config.ts`** — single source of truth for model (gpt-4o-mini), base URL, max tokens per use case
- **`openaiChat()`** helper — wraps fetch to OpenAI, returns null on failure (never throws)
- **`withLanguage(systemPrompt, language)`** — appends "Respond entirely in [Language]" instruction when language ≠ "en"
- **`LANG_PHRASES` / `getFallbackPhrase(key, lang)`** — Arabic and French translation maps for common educational phrases
- **Language param wired into**: `mentor.ts` (chat endpoint), `parent-ai.ts` (ai-assistant endpoint), `live-class.ts` (no streaming — uses openaiChat directly)
- Frontend sends `language` in request body; UI language switcher in Settings should pass this through

## Why
**Why ai-config.ts**: Centralising model config means future provider swaps (Gemini, Claude, local models) only change one file. All route files that currently call OpenAI directly can be migrated to `openaiChat()` incrementally.

**Why setInterval over node-cron**: node-cron not installed; setInterval is zero-dependency and sufficient for minute-granularity scheduling. Add node-cron later if cron expressions are needed.
