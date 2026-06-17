---
name: Aperti streak daily gate pattern
description: How the daily streak increment is triggered from the study stream and how double-incrementing is prevented.
---

## Streak Update Pattern

- Study stream (`src/pages/student-portal/study-stream.tsx`) calls `POST /api/ascend/update-streak` on mount
- Gated by `localStorage.getItem("aperti_streak_updated")` compared to today's ISO date (`new Date().toISOString().slice(0, 10)`)
- On success: stores today's date under key `aperti_streak_updated`
- This prevents double-incrementing on re-renders, page refreshes, or multiple visits in same day

**Why:** The backend `/api/ascend/update-streak` has no idempotency guard, so the frontend must gate calls.

## Streak Display

- Streak shown in study stream header as an orange pill: `{summary?.streakDays ?? 0} day streak`
- `streakDays` comes from the `home-summary` endpoint (not from a separate streak endpoint)
- XP and Level shown as animated stat cards using `useAnimeCounter`
