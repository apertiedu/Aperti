---
name: Aperti Phase 39 motion system
description: Shared motion utilities, living dashboard animations, data integrity audit, animation safety guard
---

## Shared motion library
`artifacts/aperti/src/lib/motion.ts` — canonical source for:
- Standard variants: `fadeUp`, `fadeIn`, `slideFromRight`, `scaleIn`, `staggerContainer`, `staggerItem`, `cardHover`, `buttonPress`
- `useMotionSafety()` — monitors RAF frame time; disables heavy animations if avg > 20ms for 3+ frames. Also reads `prefers-reduced-motion`.
- `useCountUp(target, duration, start)` — easeOutCubic number animation, respects reduced-motion.

## CSS additions (index.css)
- `.attention-pulse` — teal box-shadow ring keyframe, 2.4s, for needs-attention cards
- `.animate-slide-right` — CSS keyframe slide from x:20, for schedule column
- `.number-updated` — brief teal color flash on stat number change
- Progress component: uses `transition: transform 600ms cubic-bezier(0.22,1,0.36,1)` instead of Tailwind transition-all

## CoreHub living animations
- StatsCard: count-up via `useCountUp`, `whileHover` lift (-2px spring), `attention` prop adds `.attention-pulse` when pendingCount > 3
- Schedule: slides in from right (`x: 20 → 0`), each class item staggered (delay: i * 0.06)
- Recharts LineChart: `isAnimationActive animationDuration={800} animationEasing="ease-out"`

## StudyStream living animations
- Homework items: staggered fade-up (delay 0.06 * index)
- Weak topics badges: staggered scale-in (delay 0.08 * index, from scale 0.85)

## Data integrity (backend)
Added two new checks to `admin-data-quality.ts`:
- `attendance_no_session` — orphaned attendance records (fixable: deletes them)
- `lessons_no_teacher` — lessons referencing deleted teacher accounts (not fixable)

## Data Quality Center (frontend)
- "Repair All Fixable" button appears when 2+ fixable issues exist; runs all fixes sequentially
- Issue cards animate in with staggered fade-left-slide
- Severity groups animate in with fade-up

**Why:** All motion uses `transform`/`opacity` only (no layout props) so GPU-composited and jank-free. The `attention-pulse` ring on the grading card helps teachers notice pending work without red alerts.
