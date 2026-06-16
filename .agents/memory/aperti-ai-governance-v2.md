---
name: Aperti AI Governance v2
description: 3-tier confidence system, AI quality score, teacher analytics, learning loop, rubric generator — all additive, no breaking changes.
---

## Confidence Tier Logic
- ≥ 0.85 → "high" — auto-approve, no review required
- ≥ 0.65 → "medium" — soft review recommended (`softReview: true`)
- < 0.65 → "low" — required review (`requiresReview: true`)

Both `snapgrade.ts` and `ai-gateway.ts` share this logic (duplicated helpers — keep in sync if thresholds change).

## New DB Tables (created via psql, NOT Drizzle schema)
- `ai_grade_reviews` — stores full override audit trail; new cols: `override_reason_category`, `override_tags JSONB`, `grade_delta NUMERIC`
- `ai_learning_events` — structured prediction/decision log for every review; future ML input
- `teacher_ai_stats` — materialized teacher behavior stats; refresh via POST /api/ai-governance/refresh-teacher-stats

## New Columns on snapgrade_submissions (psql migration)
`confidence_level TEXT`, `requires_review BOOLEAN`, `rubric_match_score NUMERIC(4,3)`, `reasoning_summary TEXT`, `uncertainty_factors JSONB`

## New Routes (mounted at /api/ai-governance)
- GET  /teacher-stats — per-teacher override rate, delta, strictness
- GET  /hardest-questions — top 10 by teacher–AI disagreement rate
- GET  /subject-confidence — avg confidence + tier breakdown per subject
- GET  /override-rate-trend — daily override rate for N days
- GET  /failure-rate-trend — daily AI failure rate for grade calls
- GET  /summary — 30-day governance KPIs
- POST /generate-rubric — AI suggests rubric; always `approved: false`
- POST /refresh-teacher-stats — upserts teacher_ai_stats from live reviews

## Smart Fallback Shape
When AI unavailable, always return structured object (never empty):
```json
{ "status": "degraded", "message": "AI temporarily unavailable", "fallback_mode": "heuristic_scoring", "requiresReview": true }
```

## AI Quality Score Engine
`computeAIQualityScore({ confidence, rubricMatchScore, ocrQuality, consistencyScore })` — weights: 0.40/0.30/0.15/0.15. Score < 0.50 forces requiresReview regardless of confidence tier.

**Why:** Production-grade grading needs layered trust signals, not just a single confidence float.
**How to apply:** Call in analyzeWithAI after parsing AI response; include quality_factors in every grading response payload.
