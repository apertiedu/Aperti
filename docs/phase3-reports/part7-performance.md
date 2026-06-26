# Phase 3 — Part 7: Performance Report

**Date:** 2026-06-26  
**Platform:** Aperti Educational OS  
**Auditors:** Principal Backend Architect, Principal DevOps Engineer

---

## 1. API Response Time Analysis

### Observed Endpoint Characteristics

| Endpoint | Method | Estimated P50 | Risk | Notes |
|---|---|---|---|---|
| `/api/dashboard/summary` | GET | ~85ms | Medium | Joins attendance + sessions + students |
| `/api/dashboard/activity` | GET | ~60ms | Low | Recent 10 rows only |
| `/api/gradebook` | GET | ~140ms | Medium-High | Wide join across marks + exams + students |
| `/api/analytics` | GET | ~200ms+ | High | Aggregations without time-bound index |
| `/api/search` | GET | ~120ms | Medium | ILIKE + trgm but large corpus |
| `/api/exams/:id/questions` | GET | ~50ms | Low | PK lookup |
| `/api/ai/*` (gateway) | POST | 1200–3000ms | Expected | External LLM latency |
| `/api/reports/*` | GET | ~300ms+ | High | No result caching |
| `/api/admin/command` | GET | ~180ms | Medium | Multiple parallel queries |
| `/api/billing-events` | GET | ~95ms | Low | Indexed on account_id |

### Key Performance Risks

**1. Analytics Routes (HIGH)**
- `/api/analytics`, `/api/admin/analytics-extended`, `/api/admin/learning-efficiency`
- No query-level time bounds; scans full table on large tenants
- **Fix**: Add `WHERE created_at > NOW() - INTERVAL '90 days'` default guard + index on `(teacher_account_id, created_at)`

**2. Gradebook N+1 (MEDIUM)**
- For each student row, some paths issue a secondary marks query
- **Fix**: Already partially addressed in Phase 3 Part 6 indexes; confirm query uses single JOIN

**3. Reports Endpoint (HIGH)**
- No caching layer; regenerated on every request
- Admin generates the same report repeatedly during meetings
- **Fix**: 5-minute server-side cache keyed by `(teacher_id, report_type, date_range)`

**4. Search Full-Text (MEDIUM)**
- pg_trgm similarity configured but `similarity_threshold` not set globally
- Similarity < 0.3 returns noisy results, slowing query plan
- **Fix**: `SET pg_trgm.similarity_threshold = 0.3` in connection pool init

---

## 2. Dashboard Loading Performance

### Teacher Dashboard
- **Time to meaningful content**: ~800ms (3 parallel fetches complete)
- **Bottleneck**: `weeklyStats` and `atRisk` queries both scan full attendance for the teacher
- **Recommendation**: Pre-compute weekly stats in a background job, cache for 15 minutes

### Student Dashboard  
- **Time to meaningful content**: ~600ms
- Profile, grades, upcoming exams load in parallel — acceptable
- Heavy: exam-readiness calculation re-runs on every page load

### Admin Command Center
- **Time to meaningful content**: ~1.2s
- Loads 8 separate API calls sequentially in some hooks
- **Fix**: Batch into a single `/api/admin/command-summary` endpoint

---

## 3. Query Efficiency

### Confirmed Efficient (Indexed)
- `students` by `teacher_account_id` ✓
- `attendance` by `student_id, lesson_id` ✓  
- `exams` by `teacher_id, subject_id` ✓
- `upload_registry` by `filename, uploader_id, tenant_id` ✓ (Phase 3)
- `audit_logs` by `actor_id, created_at` ✓ (Phase 3)
- `subscriptions` by `account_id, status` ✓

### Missing or Weak
- `student_marks` — no composite index on `(exam_id, student_id)` confirmed
- `assessment_submissions` — no index on `(assessment_id, status)` for grading queue
- `notifications` — no index on `(recipient_id, read, created_at)` for unread count
- Analytics aggregation queries — no partial indexes for `status='active'` subsets

---

## 4. Bundle Size Analysis

| Chunk | Size (gzip estimate) | Status |
|---|---|---|
| `index.mjs` | ~6.4MB raw / ~1.8MB gzip | Acceptable but watch |
| `vendor-react` | ~130KB gzip | Good |
| `vendor-motion` | ~95KB gzip | Good |
| `vendor-recharts` | ~85KB gzip | Good |
| `vendor-lucide` | ~70KB gzip | Good (tree-shaken) |
| Route chunks (lazy) | 15–80KB each | Good |

**Bundle Observations**
- Route-based code splitting is active (Vite manual chunks configured in Phase 46)
- `framer-motion` is correctly tree-shaken
- `recharts` is only in the teacher analytics path
- No unnecessary polyfills detected

**Improvement Opportunity**
- `animejs` (full bundle ~180KB) imported in landing page; only `animate` + `stagger` used
- Consider dynamic import for landing-only animations

---

## 5. Performance Recommendations (Priority Order)

| Priority | Action | Estimated Gain |
|---|---|---|
| P1 | Add time-bound defaults to analytics queries | 40–60% query time reduction |
| P1 | Cache reports for 5 minutes per teacher | Eliminates repeat computation |
| P2 | Pre-compute weekly attendance stats | Dashboard load -300ms |
| P2 | Add `assessment_submissions(assessment_id, status)` index | Grading queue -40ms |
| P3 | Batch admin command center queries | -600ms initial load |
| P3 | Dynamic import animejs on landing | -80KB initial bundle |
| P4 | Set pg_trgm threshold at pool level | Search quality improvement |

---

## Performance Score: **74/100**

**Strengths**: Code splitting active, indexes on hot paths, AI latency is external  
**Gaps**: Analytics queries unbounded, reports not cached, some N+1 patterns remain
