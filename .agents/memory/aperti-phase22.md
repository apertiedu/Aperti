---
name: Aperti Phase 22 UX System
description: All Phase 22 UX infrastructure built — tokens, empty states, skeletons, auto-save, error boundaries, sidebar persistence, toasts, page transitions
---

# Phase 22 — UI/UX Perfection System

## What was built

### Core infrastructure (new files)
- `src/lib/api-utils.ts` — authFetch (2x retry, offline detection), handleApiError, OfflineError, safeJson
- `src/hooks/use-auto-save.ts` — debounced 5s auto-save + useUnsavedChanges for beforeunload
- `src/hooks/use-notify.ts` — success/error/info/milestone toast wrappers over sonner
- `src/components/empty-state.tsx` — EmptyState component with icon, title, description, CTA
- `src/components/page-wrapper.tsx` — PageWrapper (prefers-reduced-motion), PageHeader, AutoSaveIndicator

### Enhanced existing components
- `src/components/error-boundary.tsx` — friendly recovery UI with Framer Motion
- `src/components/ui/skeleton.tsx` — added SkeletonCard, SkeletonTable, SkeletonList, SkeletonWidget, SkeletonPage

### Token key bug fixes (10 files)
All 10 files that used `localStorage.getItem("token")` fixed to `getItem("aperti_token")`:
unified-inbox, collaborate, class-channel, announcements, support-tickets, study-rooms,
admin/moderation, admin/communication-analytics, notification-center, admin-os/ContentGovernancePage

### Layout / navigation
- Sidebar collapse persisted: `aperti_sidebar_collapsed` in localStorage (layout.tsx + parent-layout.tsx)
- Skip-to-main-content link added in App.tsx
- Sidebar icon (School) removed — collapsed shows "A." text only

### Page features
- Quick Start guide in core-hub.tsx (shows for new users with 0 students)
- Quality Score gauge widget in FounderControlPage.tsx (fetches /api/admin/quality/score)
- EmptyState upgraded in query-vault, question-studio, subpilot (teacher messaging)

## Key patterns used
- Empty state: teal-tinted icon box (16px opacity), 12px muted description, CTA button with #0D9488
- Sidebar token key: ALWAYS `aperti_token` not `token`
- TEAL constant: `#0D9488`
