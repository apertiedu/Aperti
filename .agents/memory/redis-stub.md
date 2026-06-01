---
name: Redis stub for Replit
description: In-memory Redis stub used instead of real Redis in api-server
---

Replit does not provide Redis. The api-server has a stub at `artifacts/api-server/src/lib/redis.ts` that implements the needed Redis methods (get, set, del, setex) using an in-memory Map.

**Why:** The api-server uses Redis for session/cache but Replit has no Redis service. The stub makes the server boot without errors.

**How to apply:** If new Redis calls are needed (hget, hset, etc.), add them to the stub file — don't try to connect to real Redis.
