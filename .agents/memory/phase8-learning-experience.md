---
name: Phase 8 Learning Experience Ecosystem
description: DB tables, API routes, frontend pages, and wiring decisions for Phase 8
---

# Phase 8 — Learning Experience, Content Delivery & Adaptive Personalization

## DB Tables (9 new, 2 columns added)
- `mastery_records` — per-topic mastery state (not_started → introduced → practicing → developing → mastered → expert) + confidence_score
- `learning_paths` — adaptive path nodes stored as JSONB array; generate via POST /api/learning-path/generate
- `micro_assessments` — AI-generated 4-question quizzes; questions are JSONB; submitting updates mastery_records
- `learning_goals` — student goals with progress 0–100, status active/achieved, xp_reward
- `challenges` — teacher-posted challenges; participations in `challenge_participations`
- `challenge_participations` — join + submit; submit awards XP to ascend profile
- `learning_analytics_snapshots` — daily snapshot of metrics (upserted on /api/analytics/learning)
- `offline_content` — queue/sync for offline work
- `recommendation_feedback` — thumbs up/down on recommendations
- `focus_sessions.productivity_score`, `focus_sessions.distractions_count` — added columns

## API Route File
`artifacts/api-server/src/routes/learning-experience.ts` — registered in routes/index.ts as `router.use(learningExperienceRouter)` (no prefix, routes are self-prefixed)

## Key API Paths
- GET /api/mastery/:courseId (0 = all courses)
- POST /api/learning-path/generate
- GET /api/content/next — adaptive next item
- POST /api/micro-assessment/generate + POST /api/micro-assessment/submit
- GET /api/recommendations — urgency-sorted list driven by exams/mastery/homework
- POST /api/recommendations/feedback — rating: "helpful" | "not_helpful"
- GET /api/learning-goals, POST, PUT /:id, DELETE /:id
- PATCH /api/focus-sessions/:id/complete — enhanced with productivityScore, distractionsCount
- GET /api/focus-analytics — 30-day study stats with byDay, byHour, peakHour, streak
- GET /api/challenges, POST /api/challenges, POST /api/challenges/:id/join, POST /api/challenges/:id/submit
- GET /api/challenges/leaderboard/:id
- GET /api/analytics/learning — full radar data, snapshots, mastery dist
- GET/POST /api/offline/pending, /offline/sync, /offline/queue

## Frontend Pages (all at /student/)
- `/learning-path` → LearningPathPage — path nodes with mastery states, expand to access actions
- `/recommendations` → RecommendationHub — urgency-sorted cards with thumbs feedback
- `/goals` → GoalsDashboard — create/update/delete goals with progress rings
- `/challenges` → ChallengesPage — active challenges + leaderboard tab
- `/learning-analytics` → LearningAnalyticsPage — radar chart + area chart + mastery dist
- `/micro-assessment` → MicroAssessmentPage — 4-question quiz flow (intro → quiz → results)
- `/focus-zone` → FocusZoneV2 — timer + analytics tab, productivity score, distraction detection

## Study Stream 2.0 Enhancements
- Added Recommendations preview section (shows top 3 from /api/recommendations)
- Added Mastery Progress bar section (from /api/mastery/0)
- Expanded Quick Actions grid with Phase 8 pages (12 items now)

## Wiring Decisions
- focusZone route replaces old FocusZone component with FocusZoneV2 (same /focus-zone URL)
- Complete endpoint is /focus-sessions/:id/complete (PATCH) — separate from old /focus-sessions/:id (PATCH) for backward compat
- Mastery update on micro-assessment submit: score >= 90 → mastered, >= 75 → developing, >= 50 → practicing, else → introduced
- onConflictDoNothing() on analytics snapshot insert (safe daily upsert)
