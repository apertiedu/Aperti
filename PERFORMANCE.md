# Performance Architecture — Aperti

## Database Indexes (db-indexes.ts)

Automatically applied on startup via `ensureIndexes()`:

| Index | Table | Columns | Purpose |
|---|---|---|---|
| idx_accounts_username | accounts | username | Login lookup |
| idx_accounts_email | accounts | email | Email-based auth |
| idx_accounts_role | accounts | role | Role filtering |
| idx_lessons_teacher | lessons | teacher_id | Teacher dashboards |
| idx_lessons_class | lessons | class_id | Class timetables |
| idx_homework_student | homework_submissions | student_id | Student portals |
| idx_enrollments_student | enrollments | student_id | Course lists |
| pg_trgm extension | — | — | Fuzzy search |

## Query Optimization Patterns

### Pagination
All list endpoints use `LIMIT + OFFSET` with a `count` return:
```sql
SELECT *, COUNT(*) OVER() as total FROM table WHERE ... LIMIT $1 OFFSET $2
```

### Soft Deletes
Courses use `status = 'archived'` not hard deletes — preserves referential integrity.

### Connection Pooling
PostgreSQL `pg.Pool` with default pool size (10 connections). Suitable for current scale.

## Caching Strategy

| Layer | TTL | Scope |
|---|---|---|
| React Query | 60s stale, 5min GC | Client-side data cache |
| Plan limits | 60s | Per-session |
| Admin live stats | 30s refetch | Admin dashboards |
| AI responses | Not cached | Always fresh |

## Frontend Performance

### Code Splitting
Vite produces per-route chunks via dynamic `import()` in App.tsx.

### Asset Optimization
- Tailwind CSS v4 purges unused styles at build time
- Framer Motion tree-shakes unused animation code
- Lucide React imports individual icons (no full bundle)

### Network
- All API calls use relative URLs (no cross-origin overhead)
- `credentials: "include"` adds cookie overhead (~50 bytes/request)
- Compression middleware (gzip) on all JSON responses

## Key Metrics to Monitor

| Metric | Target | Alert Threshold |
|---|---|---|
| API p95 latency | < 200ms | > 500ms |
| DB query time | < 50ms | > 200ms |
| Error rate | < 0.1% | > 1% |
| Memory (Node) | < 256MB | > 512MB |

## Recommended Next Steps

1. **Redis caching** — cache `/api/dashboard` responses per user (5min TTL)
2. **CDN** — serve static assets from edge (Cloudflare or Replit CDN)
3. **Read replicas** — separate read-heavy analytics queries
4. **Query analysis** — run `EXPLAIN ANALYZE` on the top 10 slowest endpoints
5. **Web Workers** — offload heavy client-side data processing
