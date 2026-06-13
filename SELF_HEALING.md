# Self-Healing System Design

**Platform:** Aperti — Intelligent Educational Operating System  
**Date:** June 2026  
**Design Goal:** Every component degrades gracefully; no user-visible crash propagates beyond its origin.

---

## 1. Frontend Self-Healing

### 1.1 Error Boundary Hierarchy

```
<QueryClientProvider>
  <ThemeProvider>
    <AuthProvider>
      <ErrorBoundary>           ← catches all render errors
        <AppContent />          ← all routes
        <SessionExpiryGate />
      </ErrorBoundary>
      <Toaster />               ← outside boundary (won't crash app)
      <OfflineDetector />       ← outside boundary
    </AuthProvider>
  </ThemeProvider>
</QueryClientProvider>
```

On any render error, `ErrorBoundary` shows a recovery UI and posts to `/api/errors/log`.

### 1.2 API Retry Strategy

`fetchJSON` (GET requests):
- **Attempt 1**: immediate
- **Attempt 2** (on network error or 5xx): after 600ms delay
- **No retry** on 4xx (client errors — retrying won't help)
- On final failure: TanStack Query cache serves stale data with "Data may be stale" indicator

Mutation requests (`postJSON`, `putJSON`, `patchJSON`, `deleteJSON`):
- No automatic retry (mutations must be intentional)
- Error toast displayed; user can manually retry

### 1.3 TanStack Query Resilience

```typescript
{
  retry: 1,              // 1 automatic retry
  retryDelay: 600,       // 600ms
  staleTime: 60_000,     // serve cache for 60s before refetch
  gcTime: 5 * 60_000,    // keep in memory 5 min after unmount
  refetchOnWindowFocus: false,  // avoid aggressive refetch
}
```

### 1.4 Dynamic Import Failure

Route components use `React.lazy()`. If a chunk fails to load:
- `<Suspense>` fallback shows skeleton
- `ErrorBoundary` catches the rejection
- User sees recovery page, not a white screen

---

## 2. Backend Self-Healing

### 2.1 Route-Level Fault Isolation

Every route handler is wrapped in try/catch:
```typescript
router.get("/endpoint", async (req, res) => {
  try {
    // ... business logic
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
```

Failures are isolated to the single request — the server process continues.

### 2.2 Global Express Error Middleware

Catches any error thrown in middleware or route handlers that isn't caught locally:
```typescript
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err, path: req.path, method: req.method }, "Unhandled express error");
  logErrorToDb({ level: "error", message: err.message, stack: err.stack, route: req.path });
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal server error" });
  }
});
```

### 2.3 Process-Level Capture

```typescript
process.on("uncaughtException", (err) => { /* log + continue */ });
process.on("unhandledRejection", (reason) => { /* log + continue */ });
```

The server never crashes on a single bad request.

### 2.4 Database Fault Tolerance

Every DB query follows the pattern:
```typescript
const { rows } = await pool.query(sql, params).catch(() => ({ rows: [] }));
```

On DB failure: returns empty dataset, not 500. The API remains responsive even during DB instability.

### 2.5 AI Service Fault Tolerance

All OpenAI calls wrapped with circuit breaker pattern:
- On failure: returns a canned "fallback" response (pre-written explanations, generic feedback)
- Logged as `warn` to error_logs
- `/api/ai/health` endpoint monitors availability

---

## 3. Payment State Protection

```
User submits payment → status: "pending"
  ↓
Admin verifies → status: "verified"
  ↓
Subscription activated
```

If verification API fails at any step:
- Subscription remains `pending`
- Admin receives in-app alert
- No double-charge: duplicate reference number check (409 Conflict)
- No lost payment: transaction record persists regardless

---

## 4. Session Self-Healing

| Scenario | Healing Action |
|---|---|
| Token expired (401) | `<SessionExpiryGate>` modal — prompts re-login |
| Token missing | Redirect to `/auth/login` |
| Device limit reached | Clear message + link to device manager |
| Suspended account | Specific error (not generic 401) |
| Rate limit (429) | User-friendly message with wait time |

---

## 5. Data Integrity Self-Healing

### 5.1 Startup Validation
- `startup-validator.ts` exits if `JWT_SECRET` or `DATABASE_URL` missing
- `db-indexes.ts` ensures performance indexes on every boot
- Schema push runs on every boot (idempotent migrations)

### 5.2 Background Repair
- Admin Data Quality Center → "Repair All Fixable" button
- Repairs: orphaned enrollments, missing student records, broken FK references
- Logs repair actions to audit trail

### 5.3 Orphan Detection
Route: `GET /api/admin/data-quality/scan`
Checks:
- Students without teacher
- Enrollments without course
- Submissions without exam
- Payments without subscription
- Sessions without course

---

## 6. Health Monitoring

| Endpoint | Checks | Response |
|---|---|---|
| `GET /api/health` | DB connectivity, memory usage, table count, uptime | 200 JSON |
| `GET /api/ai/health` | OpenAI reachability | 200 / 503 |
| `GET /api/founder/error-logs` | Error count, trends | Admin only |
| `GET /api/admin/route-health` | 120+ route status | Admin only |

---

## 7. Deployment Self-Healing

| Mechanism | Behavior |
|---|---|
| Health check endpoint | Railway/Spaceship uses `/api/health` for zero-downtime deploys |
| Schema push on boot | Migrations run automatically — never manual |
| Startup fail-fast | Missing `JWT_SECRET` or `DATABASE_URL` → process exits immediately |
| Bundle cache headers | JS/CSS bundles cached 1 year (content-hashed filenames) |
