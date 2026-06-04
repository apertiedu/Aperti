---
name: Phase 5 AI Layer Patterns
description: CoreMind/Weave integration patterns, fallback rules, and AI-enriched routes
---

## Key Rules

- **All CoreMind/Weave calls must be wrapped in try/catch** — the app must work without them. Pattern: `try { const analysis = await analyzeStudent(id); ... } catch { /* best-effort */ }`
- **Import CoreMind/Weave via dynamic import inside routes** when the route file doesn't natively import them. This avoids circular dependency issues.
- **Weave table names**: `knowledge_nodes`, `knowledge_edges` (Drizzle: `knowledgeNodesTable`, `knowledgeEdgesTable`)
- **AI tables**: `ai_interactions`, `misconceptions` — created via raw SQL migration (not drizzle-kit push)
- **Backend workflow**: `artifacts/api-server: API Server` (port 8080), NOT the old `Backend API` workflow (which clashes on 3001)

## Enriched Routes

| Route | Enrichment |
|-------|-----------|
| `tutorcraft.ts` `/generate-syllabus` | Weave: registers unit/topic nodes, links prerequisite chains, returns `weavePrerequisites` per unit |
| `tutorcraft.ts` `/chat` | CoreMind: injects at-risk student data into system prompt when teacher asks about struggling/at-risk students |
| `risk-engine.ts` `/analytics/risk-report` | CoreMind: top 8 high/critical students get `coremindInsights` field with examReadiness + weakTopics |
| `exam-generator.ts` `/exams/generate` | Weave: in "predicted" mode, fetches high-edge-count topics from `knowledge_nodes`, biases question selection toward them |
| `student-home-summary.ts` `/student/home-summary` | CoreMind: `analyzeStudent()` blends readiness score (40% CoreMind, 60% local), returns `coremindInsights` in `academicSnapshot` |
| `mentor.ts` | CoreMind: `enhanceMentor()` called for each session |
| `grading.ts` | CoreMind: `enhanceGrading()` + misconception check on each grade |
| `revisit.ts` | Weave: prerequisite topics injected into revisit session |
| `trial-vault.ts` | Weave: `getRecommendations()` adds prerequisite topics to weak-topic bias |

## New Routes (Phase 5)

- `GET/POST /api/weave/*` — knowledge graph CRUD
- `POST /api/coremind/*` — AI orchestration (analyze, enhance-mentor, enhance-grading, generate-content)
- `GET /api/coremind/analytics/stats` — AI usage/acceptance stats
- `GET /api/coremind/analytics/impact` — Student Impact Score (Mentor users vs non-users grade delta)
- `GET /api/coremind/safety/pending` + `POST /api/coremind/safety/review/:id`
- `GET /api/admin/misconceptions` + `POST /api/admin/misconceptions/seed`
- `POST /api/parent/ai-assistant/:studentId` — parent AI backed by CoreMind data
- `GET /api/parent/ai-snapshot/:studentId` — quick structured AI snapshot for parent

## Why
**Why:** All integrations use dynamic imports + try/catch so the app degrades gracefully if Weave is empty or CoreMind has no student data. This was intentional — Phase 5 enriches but never blocks.
