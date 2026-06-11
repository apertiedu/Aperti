---
name: Aperti Phase 30 production
description: All Phase 30 features completed — deployment stability, Error Intelligence Center, AI Content Validation, Resource Relationship Mapping, Learning Efficiency Analytics, theory self-marking, and route test script.
---

## Phase 30 Completed Features

### Backend routes (all registered in app.ts)
- `POST /grading/self-mark` — student AI self-marking (in assessment-grading.ts)
- `GET /api/admin/error-intelligence/summary|failed-logins|route-errors|trends` + `POST .../run-route-test`
- `GET /api/admin/learning-efficiency` — activity efficiency analytics
- `GET /api/admin/content-validation/summary|mark-schemes|relationships`

### Admin OS pages (all registered in index.tsx + nav in AdminLayout.tsx)
- `ErrorIntelligencePage` → `/admin/os/error-intelligence` — real-time error/login tracking, route tester
- `LearningEfficiencyPage` → `/admin/os/learning-efficiency` — activity vs score analytics
- `AiContentValidationPage` → `/admin/os/ai-content-validation` — flag missing marks/answers/topics, duplicates
- `ResourceRelationshipPage` → `/admin/os/resource-relationships` — question → mark scheme linkage map

### Frontend enhancements
- `TheoryAnswerEditor` component inlined in take-exam.tsx — word count bar, mark-based guidance (1 mark = "one point", 6+ marks = "structured response"), quality indicator (too-short → developing → good → detailed), rows scale with marks
- AdminLayout imports `Network` icon from lucide-react for Resource Relationships nav

### Route test script
- `scripts/route-test.sh` — runs 12 curl tests (4 public 200 + 8 auth 401) in parallel, exits 1 on failure
- Run: `bash scripts/route-test.sh [BASE_URL]`

**Why:** Deployment stability — know immediately if a route breaks after merge/deploy.

**How to apply:** Run before every deployment. All 12/12 routes pass as of Phase 30 completion.

### Key patterns
- Admin-only routes use `requireRole("admin", "super_admin")` as middleware cast `as any` since Express 5 types differ
- Self-mark endpoint has graceful AI fallback (word-count estimate) when OPENAI_API_KEY absent
- Assessment-grading router is in `routes/index.ts` at line 200 as `router.use(assessmentGradingRouter)` (no prefix)
- Content validation uses `SIMILARITY()` postgres function for duplicate detection
