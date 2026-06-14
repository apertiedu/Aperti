---
name: Aperti Phase 48 — Final Production Stack
description: SSE streaming AI gateway, safeUser normalization, cost tracking, LAUNCH_CHECKLIST.md, ARCHITECTURE.md, deploy.sh
---

## Deliverables

### AI Gateway (`routes/ai-gateway.ts`)
Fully replaced previous stub. Provides:
- `POST /api/ai/chat` — SSE streaming via `text/event-stream`; chunks as `data: {"text":"..."}\\n\\n`; done signal `data: {"done":true}\\n\\n`
- `POST /api/ai/grade` — non-streaming, JSON, cached, returns `{ ok, cached, result }`
- `POST /api/ai/generate` — lesson/quiz/flashcard/lesson-plan/exam-predictor types, cached
- `GET /api/ai/health` — service status, today's cost, call count, budget cap status
- Mounted at `/api/ai` in app.ts (separate from `/api/ai-teach`)

### Prompt cache
In-memory Map; TTL = 10 min; 500-entry cap; LRU eviction on overflow.

### Cost tracking
`trackInteraction()` inserts to `ai_interactions` table. Columns `estimated_cost_usd` and `latency_ms` added via Phase 48 migration (ALTER TABLE IF NOT EXISTS). Budget cap from `platform_settings` where key = 'ai_daily_budget_usd'.

### safeUser()
Added to `routes/auth.ts` before `authRouter` definition. Normalises account object to `{ id, username, displayName, email, role, status, mfaEnabled, mustChangePassword }` — guarantees all fields always present. Applied to login response (`res.json({ token, user: safeUser(account) })`).

### useAIStream hook (`hooks/use-ai-stream.ts`)
- `stream(endpoint, body)` — fetch SSE, parse `data:` lines, accumulate into `text` state
- `abort()` — cancels in-flight request via AbortController
- `reset()` — clears text/error/isStreaming
- Falls back to JSON response if Content-Type is not `text/event-stream`

### Documents
- `LAUNCH_CHECKLIST.md` — root level, 10 sections, 50+ items, [BLOCK] tags on launch-blockers
- `ARCHITECTURE.md` — root level, ASCII system diagram, data flow examples (login/AI grade/QR), deployment topology, V1-V2 coexistence table
- `deploy.sh` — bash, `set -euo pipefail`, validates env, pnpm install, repair scan, build backend + frontend, PM2 restart; `SKIP_REPAIR=1` bypass

## Key decisions
**Why separate `/api/ai` from `/api/ai-teach`:** ai-teach routes are teacher-only generation tools; ai gateway is the public-facing real-time interface (chat, grade, generate) accessible by any authenticated role.

**Why in-memory cache (not Redis):** No Redis dependency required. Aperti uses pg session store. In-memory cache is sufficient for a single-process deployment and avoids adding infrastructure.
