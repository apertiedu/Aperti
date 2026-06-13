---
name: Aperti Phase 37 TypeScript fixes
description: Key patterns fixed during Phase 37 stability sweep — queryFn typing, icon prop types, error boundaries, QueryClient config
---

## QueryFn pattern (critical)
`apiFetch()` returns `Promise<Response>`, not the parsed JSON. Every `useQuery` with a typed generic MUST chain `.then(r => r.json())` or TypeScript reports the return type mismatch.

**Rule:** `queryFn: () => apiFetch("/path").then(r => r.json())` — always.

Files fixed: core-hub.tsx, session-slots.tsx, route-health.tsx, notification-center.tsx, student/my-qr.tsx, attendance-audit.tsx, enrollment-timeline.tsx, data-quality.tsx, feature-status.tsx.

## Icon ComponentType style prop
Lucide icons accept `style?: React.CSSProperties` but if the icon is typed as `React.ComponentType<{ className?: string }>` (no style), passing a style prop causes TS2769. Fix: include `style?: React.CSSProperties` in the type.

Files fixed: smart-empty-state.tsx, revision-modes-selector.tsx, landing.tsx (PLAN_ICONS).

## React.ElementType vs ComponentType
`React.ElementType` is too broad — rendering it as JSX gives `Type 'string' is not assignable to type 'never'`. Use `React.ComponentType<{ className?: string }>` for icon props instead.

Files fixed: plans-admin.tsx (StatCard, PLAN_ICONS), payments.tsx (STATUS_STYLE), my-invoices.tsx (STATUS_CONFIG).

## statusMap indexing pattern
Object literal `{ pass: ..., fail: ..., warn: ... }[someString]` gives `Type 'string' is not assignable to type 'never'` when TypeScript can't narrow the key. Fix: extract to a typed `Record<string, ...>` variable, then index with `as string`.

## ErrorBoundary improvements
- error-boundary.tsx (default export, used by main.tsx): added "Report issue" button with `reported` state.
- ErrorBoundary.tsx (named export, inline use): added "Go back", "Report issue", "Try again" buttons.
- New `components/inline-error.tsx`: compact/full modes with retry button.

## QueryClient defaults
Changed from `retry: false` to `retry: 1, retryDelay: 1000` and added `staleTime: 30_000` as global defaults in App.tsx.
