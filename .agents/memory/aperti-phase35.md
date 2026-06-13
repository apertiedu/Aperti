---
name: Aperti Phase 35 features
description: All Phase 35 features built — Zero-Error Certification, UI/UX Master Polish & Production Excellence
---

## Phase 35 Deliverables

### Backend — New Endpoints
- `GET /api/founder/user-activity-metrics` — DAU/WAU/MAU, stickiness ratio (DAU/MAU %), 30d retention chart, WAU/MAU ratio
- Search updated: recordings now included via `SELECT r.id, r.title AS name, s.name AS subtitle FROM recordings r LEFT JOIN subjects s ON s.id = r.subject_id`

### Backend — Security Hardening
- Auth login: `typeof username !== "string" || username.length > 200` → 400; same for password >500
- Auth student-register: same guards + `password.length < 6` → 400
- CORS: `ALLOWED_ORIGINS` env var (comma-separated) restricts origins in production; undefined = allow all (dev)
- `extractErrorMessage()` in `api.ts`: parses JSON `error`/`message` fields from API responses cleanly

### Frontend — FounderControlPage
- Added `useQuery` for `/api/founder/user-activity-metrics` with 5-min refetch
- DAU/WAU/MAU/Stickiness section rendered with StatCard grid

### Frontend — Command Palette
- `buildEntityHref()` helper maps semantic result types → nav hrefs
- `TYPE_ICONS` updated: recording (Video), flashcard_deck (Book), revision_note (FileText), assessment (CheckSquare2)
- Semantic results navigate on click (was broken before)
- Category grouping when query is active (groups routes by `category` field)
- aria-label + aria-autocomplete on search input

### Frontend — Forms (maxLength everywhere)
- login.tsx: FloatField inputs get `maxLength={type === "password" ? 500 : 200}`
- student-register.tsx: displayName(150), username(80), password(500), confirmPassword(500)
- settings.tsx: all 3 password inputs (500)
- change-password-modal.tsx: current+confirm (500)
- students.tsx: createAccountPassword (500)
- SecurityPage.tsx: recoveryPassword (500)

### Frontend — CSS / Accessibility
- `overscroll-behavior-y: none` on html/body
- Focus-visible ring: `outline: 2px solid #0D9488; outline-offset: 2px; border-radius: 4px`
- Touch targets scoped to `nav button` only (not all buttons — avoids breaking shadcn h-8/h-9)
- Skip link in layout.tsx (`<a href="#main-content" className="skip-link">`)
- `prefers-reduced-motion` block in index.css
- `id="main-content"` on main layout element

### Frontend — index.html
- Title: "Aperti — Intelligent Educational Operating System"
- theme-color: `#0D9488` (was #00796B)
- OG + Twitter Card meta tags added
- `color-scheme: light` meta added

### api.ts Upgrades
- `extractErrorMessage()` helper: parses JSON `error`/`message`, falls back to text slice
- `patchJSON()` helper added (PATCH method)
- All helpers (fetchJSON, postJSON, putJSON, patchJSON, deleteJSON) use extractErrorMessage

### .env.example
- Added `ALLOWED_ORIGINS` comment for production CORS configuration
