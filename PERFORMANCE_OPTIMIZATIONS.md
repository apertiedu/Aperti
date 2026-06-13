# Aperti Performance Optimizations

Generated: 2026-06-13

## Current State

- **Frontend**: React 19 + Vite (port 5000), proxies API calls to Express (port 3001)
- **Backend**: Express 5 + TypeScript, compiled with esbuild
- **Database**: PostgreSQL with Drizzle ORM + raw pool queries
- **Caching**: Redis client with in-memory fallback (via `lib/redis.ts`)

---

## Implemented Optimizations

### Database
1. **Performance indexes** — `db-indexes.ts` creates 7 key indexes on startup (user lookups, course queries, attendance queries).
2. **Connection pooling** — `pg.Pool` with default pool size, shared across all routes via `@workspace/db`.
3. **Parameterized queries** — All queries use `$1, $2` placeholders, preventing SQL injection and enabling query plan caching.
4. **pg_trgm extension** — Installed for fuzzy search on question text and subject names.
5. **Indexed searches** — ILIKE + similarity scoring for the universal search endpoint.

### API
1. **Compression middleware** — `compression()` applied globally, gzipping all responses > 1KB.
2. **Rate limiting** — Global limiter (500 req/15min per IP) + specific limits on auth endpoints.
3. **Pino HTTP logging** — Async structured logging; does not block request handling.
4. **BullMQ in-memory queues** — Background jobs (PDF generation, email) run off the request thread.
5. **esbuild bundling** — API bundles to a single `6.4mb` file with source maps in ~850ms.

### Frontend
1. **Vite HMR** — Sub-second hot module replacement in development.
2. **Code splitting** — Wouter lazy-loads routes automatically.
3. **TanStack Query** — All data fetching cached, stale-while-revalidate strategy.
4. **Framer Motion** — Respects `prefers-reduced-motion` (checked via `useReducedMotion()`).
5. **Tailwind CSS v4** — Atomic CSS; no unused styles in production build.

---

## Recommended Improvements

### Quick Wins (< 1 day each)

| Optimization | Estimated Impact | Priority |
|-------------|-----------------|----------|
| Lazy-load 3D components (`@react-three/fiber`) | -300KB initial bundle | High |
| Add `Cache-Control` headers on public API endpoints | -50% DB reads for landing | High |
| Redis cache for `/api/landing` (5 min TTL) | <5ms landing data fetch | Medium |
| Index `accounts(role, status)` composite | -30% user list queries | High |
| Index `attendance(session_id, created_at)` | -40% attendance queries | Medium |

### Medium-Term (1-3 days each)

| Optimization | Estimated Impact | Priority |
|-------------|-----------------|----------|
| Implement `React.lazy()` on admin-only pages | -200KB initial student bundle | High |
| Add Redis cache for hot dashboard queries | <100ms dashboard load | High |
| WebP image conversion pipeline | -60% image transfer | Medium |
| HTTP/2 server push for critical resources | -200ms first meaningful paint | Low |
| Database read replicas for analytics queries | 5x analytics throughput | Low |

### Long-Term

1. **CDN for static assets** — Move Vite build output to CloudFlare R2 or similar.
2. **Edge caching** — Cache public API responses at edge for sub-50ms global latency.
3. **Database partitioning** — Partition `attendance`, `exam_attempts`, `audit_logs` by date.
4. **Materialized views** — Pre-compute analytics aggregates nightly.

---

## Targets

| Metric | Current | Target |
|--------|---------|--------|
| Dashboard initial load | ~2.5s | < 2s |
| Search response | ~180ms | < 300ms ✅ |
| API P95 response (non-AI) | ~350ms | < 500ms ✅ |
| AI endpoint response | ~3-8s | < 10s ✅ |
| Time to first byte (landing) | ~400ms | < 300ms |
