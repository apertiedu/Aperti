---
name: Aperti auth null-token pattern
description: useAuth() returns token:null always; pages using Bearer ${token} send "Bearer null"; cookie credentials are the only real auth path.
---

## Rule
`useAuth()` provides `token: null` in the auth context (line 110 of auth.tsx). Any frontend page that does `Authorization: Bearer ${token}` is sending `"Bearer null"` — the server's auth middleware ignores this and falls back to the `aperti_token` HttpOnly cookie.

**The only working auth mechanism is the cookie**, which requires `credentials: "include"` on every non-same-origin or production `fetch()` call.

**Why:** The app moved to HttpOnly-cookie-only JWT auth in Phase 35. The `token` field in the auth context was intentionally nulled to prevent JS from accessing it. Pages written before that change still reference `token` for Bearer headers.

**How to apply:**
- When editing or creating any page that calls a protected API, use `credentials: "include"` — never `Authorization: Bearer ${token}`.
- When reviewing admin-os pages for auth issues, grep for `Bearer.*token` and replace with `credentials: "include"`.
- Always check new registration/onboarding pages for `localStorage.setItem("aperti_token", ...)` — the server sets the cookie; storing in localStorage is redundant and exposes the token to XSS.
- Password minimum is **8 characters** across all registration paths (register.tsx, student-register.tsx, reset-password.tsx, settings.tsx, students.tsx teacher-create-account flow).
