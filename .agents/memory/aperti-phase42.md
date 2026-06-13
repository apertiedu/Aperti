---
name: Aperti Phase 42 Component Library & Design Polish
description: New shared components, feature registry, breadcrumb enhancement, CSS design polish added in Phase 42.
---

## New shared components (all in src/components/)

- **app-button.tsx** — `AppButton` with primary/secondary/danger/ghost/outline variants, loading spinner, icon slots, fullWidth. Uses forwardRef.
- **app-card.tsx** — `AppCard` (default/hoverable/analytics/flat/tinted), `AppCardHeader`, `StatCard`. Framer Motion animate prop available.
- **app-modal.tsx** — `AppModal` with Framer Motion backdrop + panel, Escape key close, body overflow lock, title/description/footer slots, 4 sizes.
- **app-table.tsx** — `AppTable<T>` with sortable columns, client-side pagination, skeleton loading (uses SkeletonTable), empty state slot, row click handler. All type-safe via ColumnDef<T>.
- **app-error-state.tsx** — `AppErrorState` with compact/full modes, retry callback, "Report this problem" (fires to /api/errors/log), 404 role-based suggestions (5 roles mapped). No new backend endpoint needed.

## New skeleton variants (added to existing skeleton-layouts.tsx)
- `SkeletonList` — avatar + text + badge rows
- `SkeletonProfile` — avatar + grid fields
- `SkeletonAnalytics` — 3 stat cards + chart placeholder + table

## Feature Registry (src/lib/feature-registry.ts)
- 60+ `FeatureEntry` records with id, name, description, route, status, roles[], category
- Helpers: `getFeaturesByCategory()`, `getFeaturesByRole(role)`, `getFeatureByRoute(path)`, `getFeaturesByStatus(status)`
- `STATUS_LABELS`, `STATUS_COLORS` exported for badge rendering
- Admin page at `/admin/feature-registry` (FeatureRegistryPage) — search, status filter, role filter, card grid grouped by category

## Layout.tsx breadcrumb enhancement
- Added `breadcrumbGroup` computation (finds the nav group matching current route)
- Top bar breadcrumb now shows: `Aperti / {Group} / {Page}` (group hidden on < md, fallback graceful)

## CSS (index.css — Phase 42 additions)
- Touch targets: ≥ 44×44px on `pointer: coarse` devices; `.touch-compact` escape hatch
- `content-fade-in` (150ms) and `content-fade-in-slow` (200ms) utilities
- `responsive-table` class: thead hidden on mobile, rows become stacked flex cards with `data-label` attribute for field labels
- `.shadow-level-1/2/3` — three explicit shadow levels
- `overflow-x: hidden` on body and #root to eliminate horizontal scroll
- `contentFadeOut` animation for exits (ease-out)

## Wiring
- `/admin/feature-registry` added to: ADMIN_ROUTES in App.tsx, STATIC_ROUTES in route-registry.ts, sidebar Admin group in layout.tsx

## Why
- AppButton/AppCard/AppModal/AppTable reduce per-page boilerplate and enforce consistent visual patterns.
- feature-registry.ts is the authoritative source of platform module metadata (replaces scattered ad-hoc feature lists).
- Breadcrumb group gives deeper context than just page name.
- `responsive-table` class enables mobile card view without refactoring every existing table individually.
