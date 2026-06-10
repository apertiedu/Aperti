---
name: Aperti Phase 21 Features
description: All Phase 21 "Experience, Delight, Conversion & Product Excellence" features and key implementation patterns
---

## Features built

### ContentCraft Studio (teacher/contentcraft-studio.tsx)
- Slash command palette: "/" key (or "Add Block" click) opens categorized floating menu with search + arrow-key navigation
- New block types: video (YouTube embed via regex), quiz (MCQ with answer reveal), flashcard (3D CSS flip animation), equation (formula display), timeline (chronological events)
- Categories: content / education / media — each styled separately in the picker
- Block type label tooltip appears on hover via absolute positioning

### Landing page (pages/landing.tsx)
- `GetStartedSteps` section: 3-step visual (Create workspace → Invite students → Teach & track) with inView animation
- `ComparisonSection`: feature comparison table (Aperti ✓ / pen & paper ✗ / spreadsheet ✗) — 12 features, uses Check/Minus/X icons
- Both sections inserted between InteractiveDemo and FAQ in the main Landing JSX
- Fix: /api/landing was 500 due to `is_visible_landing` column missing; fixed by making each Promise.all query use .catch(() => ({ rows: [] }))

### Achievements (student-portal/achievements.tsx)
- Canvas-based confetti: useConfetti hook draws 120 particles on a fixed-position full-viewport canvas; fires on new badge unlock
- UnlockModal: animated spring-scale modal with 3D emoji wiggle, XP badge, multi-badge pagination dots
- Check Progress flow: calls /api/portal/achievements/check → if newlyEarned > 0, fires confetti + shows modal

### Keyboard shortcuts (components/keyboard-shortcuts-help.tsx)
- Floating dark circle button bottom-right, always visible
- "?" key toggles the overlay (blocked if focus is on input/textarea)
- Three groups: Navigation, ContentCraft, General
- Integrated in App.tsx inside TooltipProvider, outside AuthProvider

**Why:**
Phase 21 goal was experience, delight, and conversion. Slash commands reduce friction for teachers creating content. Confetti/modal creates delight moments for students. Comparison table and 3-step section improve landing conversion. Keyboard shortcuts give power-user feel.
