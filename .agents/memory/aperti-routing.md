---
name: Aperti routing architecture
description: How App.tsx splits routing by role, role override system, and inkspace route mounting pattern
---

## Role-based routing
- `AdminRouter` → `"/" = AdminCommand`, also exposes `/corehub` and all teacher/admin routes
- `TeacherRouter` → `"/" = CoreHub`, teacher routes only
- `StudentRouter` → `"/" = StudyStream`, student portal
- `ParentRouter` → `"/" = GuardianHub`

## Role override
- Key: `localStorage.aperti_role_override`
- Functions `getRoleOverride()` / `setRoleOverride(role|null)` exported from `App.tsx`
- `QuickSwitch` page at `/admin/quick-switch` uses these to preview as any role
- `RoleOverrideBanner` shows a teal banner when override is active with "Exit Preview" button

## Admin nav
- Core group shows "Command Center" at "/" for admin, "CoreHub" for teacher/assistant
- Admin group shows "Admin Overview" at "/admin/command" (same page, different slug)
- All role badge colors use `text-primary` (teal) — no purple

## InkSpace backend routes
- Mounted as `router.use("/inkspace", inkspaceRouter)` in routes/index.ts
- Inside inkspaceRouter: `GET /load` and `POST /save` (relative paths, not full /inkspace/load)
- Table: `inkspace_notes` with `account_id UNIQUE`, `strokes JSONB`
- Frontend calls `/api/inkspace/load` and `/api/inkspace/save`

**Why:** Router nesting — if inkspaceRouter uses full `/inkspace/load` path while mounted at `/inkspace`, it becomes `/api/inkspace/inkspace/load`. Always use relative paths inside subrouters.

## Admin credentials
- Username: `admin`, Password: `admin123` (bcrypt hashed in DB)
- Seeder in `app.ts` only runs if NO accounts exist — update DB directly for resets
