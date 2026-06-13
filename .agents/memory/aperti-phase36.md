---
name: Aperti Phase 36 features
description: Phase 36 — User Journey Certification, Emergency Tools, Platform Health Score, Recently Used Items
---

## Phase 36 Deliverables

### Backend — Emergency Tools (all at /api/founder/emergency/*)
All protected by `requireRole("admin","super_admin")` + full audit logging to audit_logs table.
- POST /impersonate — generates a 1h JWT for target user; logs to audit_logs
- POST /force-logout — deletes device_sessions + session table rows for user
- POST /reset-device-limit — deletes device_sessions for user
- POST /unlock-account — sets failed_login_attempts=0, locked_until=NULL, status→active if locked
- POST /repair-enrollments — cleans orphan students, expired password tokens, 90d stale device sessions
- GET /audit-trail — last 50 emergency actions (joins accounts for actor username)

### Backend — Platform Health Score
- GET /api/founder/platform-health-score — composite 0-100 from 4 dimensions:
  - Security: critical bugs × 15, auth errors × 10
  - Performance: avg API latency (0/10/20/40 deduction for <500ms/<1s/<2s/2s+)
  - Reliability: frontend errors (last 24h) × 3, capped at 60
  - Database: table count (193=100, ≥100=100, ≥50=80, else=60)
- Returns: composite, grade (A-F), label, dimensions{}, generatedAt

### Frontend — New Pages
- FounderEmergencyPage.tsx at /admin/os/emergency — 4 tools + repair + audit trail
- PlatformHealthScorePage.tsx at /admin/os/platform-health — arc gauge + 4 ring charts

### Frontend — Route Changes
- /admin/launch → LaunchCertificationPage (added to AdminOS switch)
- FounderControlPage Quick Links: added "Emergency Tools" + "Platform Health" entries

### Frontend — Recently Visited on CoreHub
- RecentlyUsedSection component at bottom of CoreHub
- Reads from `aperti_recent_pages` localStorage key (already populated by Layout's useRecentPages hook)
- Shows last 6 visited pages with time visited + page label
- Auto-hides when empty; "Clear" button to wipe history
- Key: `aperti_recent_pages` — do NOT change to `aperti_recently_used` (different key)

### Frontend — useRecentlyUsed Hook (created but not used in CoreHub)
- Created src/hooks/use-recently-used.ts with track()/clear() + storage event listener
- Key: `aperti_recently_used` (DIFFERENT from the Layout's `aperti_recent_pages`)
- Used when you want to explicitly track entity views (e.g. course viewed)

### User Journey Audit — All Complete
- Teacher: /register → /subscribe/:planId → /admin/teacher-verification → /my-courses → /students → /attendance → /teacher/assessments → /grade-flow
- Student: /student-register → /subscribe/:planId → /my-attendance → /submit-flow → /student-portal
- Parent: /register → /parent/link-student → /parent/guardian-link → GuardianHub → /parent/attendance → /parent/billing
- Admin: /admin/os/* (40+ routes all verified)

### Pattern: JWT Import in founder.ts
- `import jwt from "jsonwebtoken"` added at top of founder.ts
- `const JWT_SECRET_EMERGENCY = process.env.JWT_SECRET || "aperti-dev-secret-change-in-prod"` defined at module level
