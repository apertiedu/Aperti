---
name: Aperti credentials recovery
description: Root cause and scope of the systemic missing credentials:"include" bug fixed in recovery session.
---

## Rule
Every local `apiFetch` / `fetchJSON` / `authFetch` function in any Aperti frontend page that uses cookie-based JWT auth MUST include `credentials: "include"` in the fetch options. Without it, auth cookies are silently dropped and the call returns 401.

**Why:** Aperti uses cookie-based JWT (`httpOnly` cookies). The browser will NOT attach cookies cross-origin or to same-origin requests that don't explicitly request credentials. The global `apiFetch` in `src/lib/api.ts` already has this, but many pages define their own local wrapper — those local wrappers were the source of all the silent 401s.

**How to apply:** When adding or reviewing any page that defines a local fetch helper, grep for `credentials` in that function block. If missing, add `credentials: "include"` immediately after the URL argument.

## Files fixed in recovery session (June 2026)
- pages/student/link-parent.tsx
- pages/checkin.tsx
- pages/plan-grid.tsx
- pages/tutorcraft.tsx
- pages/content-craft.tsx
- pages/grade-flow.tsx
- pages/messages.tsx
- pages/scheme-craft.tsx
- pages/submit-flow.tsx
- pages/cardstack.tsx
- pages/student-portal/the-mentor.tsx (3 fetch calls)
- pages/admin/landing-editor.tsx
- pages/admin/plans-admin.tsx (4 fetch functions)
- pages/admin/assistant-permissions.tsx
- pages/admin/subpilot-settings.tsx
- pages/admin/enrollment-audit.tsx
- pages/teacher/teacher-courses.tsx

## Files already correct (have credentials in their local wrapper)
- pages/platform-health.tsx
- pages/class-forge.tsx
- pages/insight-stream.tsx
- pages/lab-builder.tsx
- pages/marker-mind.tsx
- pages/pulse.tsx
- All pages using global apiFetch from src/lib/api.ts
