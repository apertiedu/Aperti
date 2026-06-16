---
name: Aperti Phase 51 AI Intelligence Suite
description: Personal Tutor, Smart Study Plan, Grade Prediction — routes, pages, nav, and fallback patterns.
---

# Phase 51 — AI Intelligence Suite

## Routes (backend)
- `artifacts/api-server/src/routes/ai-personal-tutor.ts` → mounted at `/api/ai-tutor`
- `artifacts/api-server/src/routes/smart-study-plan.ts` → mounted at `/api/study-plan`
- `artifacts/api-server/src/routes/grade-prediction.ts` → mounted at `/api/grade-prediction`

## Pages (frontend)
- `artifacts/aperti/src/pages/student/ai-personal-tutor.tsx` → `/ai-tutor`
- `artifacts/aperti/src/pages/student/smart-study-plan.tsx` → `/smart-study-plan`
- `artifacts/aperti/src/pages/student/grade-prediction.tsx` → `/grade-prediction`

## Key constraints
- Study plan: hard constraint — no day scheduled on or after exam_date; returns `EXAM_DATE_REQUIRED_FROM_ADMIN` error if missing
- Study plan: last 20–30% of days are revision-only; `/regenerate` endpoint only touches future days
- Grade prediction: always includes disclaimer; framed as prediction not final grade
- All three routes have graceful no-AI fallback (data-only response when API_KEY is null)
- Personal tutor: adaptive follow-up loop reduces difficulty + switches style when student answers wrong

**Why:** Inlined AI provider config (same NVIDIA→Replit→OpenAI priority) to avoid circular import from services/ai.ts — each route is self-contained. parseJSON helper handles both raw JSON and ```json code-fence wrapping from LLM.
