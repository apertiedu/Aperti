---
name: Aperti AI config
description: How NVIDIA/OpenAI AI is configured in the backend; common pitfalls around duplicate exports and provider priority.
---

## Rule
`ai.ts` is the single source of truth for AI provider config. `ai-gateway.ts` must mirror the same priority order.

Priority order (must match in both files):
```
API_KEY = NVIDIA_KEY ?? (REPLIT_KEY && REPLIT_BASE ? REPLIT_KEY : null) ?? OPENAI_KEY ?? null
```

`AI_CONFIG` is exported at the **bottom** of `ai.ts` (around line 206). Do not add a second export of the same name — it will cause `TS2451 Cannot redeclare block-scoped variable` and break the build.

The `OPENAI_MODEL` env var (`openai/gpt-oss-20b`) overrides the default model when set.

**Why:** ai-gateway.ts was originally written with REPLIT_KEY first, so NVIDIA was never used even when set. This was caught during Replit migration (June 2026).

**How to apply:** When adding new AI routes, import `AI_AVAILABLE`, `AI_CONFIG` from `../services/ai` — never re-read env vars directly.
