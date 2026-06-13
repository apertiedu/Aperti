---
name: Aperti Phase 36 features
description: Phase 36 — User Journey Certification, Emergency Tools, Platform Health Score, Recently Used Items, Immersive UI/UX Polish
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
- not-found.tsx — orbit rings (Framer Motion rotate), floating dots, 404 WebkitTextStroke, search bar → /search?q=, quick links

### Frontend — Landing Page (Phase 36 continuation)
- CSS-only geometric hero (`landing-3d-hero.tsx`): 12 floating shapes (octagon, torus, box, hexagon wireframes) on dot-grid SVG background
- WebGL/Three.js abandoned — `BindToCurrentSequence failed` error in Replit sandbox (no GPU); useLayoutEffect in R3F bypasses React error boundaries
- `landing-3d-hero-webgl.tsx` exists but is NOT imported anywhere (kept for reference only)
- Hero import is now direct (not lazy/Suspense) since CSS component is synchronous

### Frontend — Core Hub Teacher Dashboard (Phase 36 continuation)
- Smart context line under date: shows classes today, pending grades, attendance %, unread messages
- Notification bell badge gets `badge-urgent` CSS pulse animation when unread > 0
- Stats row gets `stagger-list` class for sequential entry animation
- Smart Insights card gets `stagger-list` on insight items
- Quick action buttons upgraded: icon in teal rounded-lg bg, text below, border hover with teal tint

### Frontend — Admin Pages (Phase 36 continuation)
- `feature-status.tsx`: Feature Adoption Rate progress bar (enabled / total non-archived × 100%)
- `route-health.tsx`: Overall Route Health Score progress bar (green ≥90%, amber ≥70%, red <70%)
- `route-health.tsx`: Export CSV button — downloads all route audit data as CSV file

### Frontend — CSS Micro-interactions (index.css) (Phase 36 continuation)
- `.badge-urgent`: pulsing opacity animation for urgent notification badges
- `.stagger-list`: sequential nth-child entry animation (uses pageIn keyframes)
- `.progress-fill`: animated width fill from 0% on mount
- `.card-shine`: diagonal shimmer sweep on hover via ::after pseudo-element
- `.stat-number`: tabular-nums + color transition
- `input[type="checkbox"]:checked`, `input[type="radio"]:checked`: teal accent-color
- `table tbody tr`: smooth background transition on hover

### Frontend — Route Changes
- /admin/launch → LaunchCertificationPage (added to AdminOS switch)
- FounderControlPage Quick Links: added "Emergency Tools" + "Platform Health" entries

### Frontend — Recently Visited on CoreHub
- RecentlyUsedSection component at bottom of CoreHub
- Reads from `aperti_recent_pages` localStorage key (already populated by Layout's useRecentPages hook)
- Shows last 6 visited pages with time visited + page label
- Auto-hides when empty; "Clear" button to wipe history
- Key: `aperti_recent_pages` — do NOT change to `aperti_recently_used` (different key)

### Phase 36 Additional Suggestions (fully implemented)
- **Animated Student ID Cards**: QRModal in `students.tsx` replaced with premium ID card design — teal gradient header with initials avatar, staggered framer-motion slide-in, large QR code, "Aperti · Student ID" branding, download button
- **Attendance Success Animation**: `checkin.tsx` — `scanFlash` state + `flashTimer` ref; `mark.onSuccess` sets flash for 2400ms; spring-animated centered overlay (fixed, pointer-events-none) shows student name, code, status icon; auto-dismisses; timer cleaned up on unmount
- **Smart Dashboard Welcome**: Already implemented in `core-hub.tsx` — `greeting()` returns Good morning/afternoon/evening; context line shows classes today, pending grades, attendance %, unread messages as smart pills
- **Founder Debug Center**: New `DebugCenterPage.tsx` at `/admin/os/debug-center` — aggregates error intelligence summary, DB health, platform health score, memory usage; route registered in `admin-os/index.tsx`; deep-dive links to route-health, error-intelligence, db-health, stability-score, slow-queries

### Key constraint
- WebGL (Three.js / R3F) cannot be used in Replit dev environment — GPU context creation fails at WebGLRenderer constructor level, which is called inside useLayoutEffect (not React render), so errors bypass ErrorBoundary and show Vite overlay.

### Pattern: JWT Import in founder.ts
- `import jwt from "jsonwebtoken"` added at top of founder.ts
- `const JWT_SECRET_EMERGENCY = process.env.JWT_SECRET || "aperti-dev-secret-change-in-prod"` defined at module level
