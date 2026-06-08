---
name: DiscussButton component
description: Reusable contextual discussion panel wired to Phase 7 thread API; placement and token key gotchas
---

## Rule
Token key is `aperti_token` (not `token`). Component lives at `@/components/discuss-button.tsx`.

**Why:** `localStorage.getItem("token")` returns null; the app stores its JWT under `aperti_token`.

## Placement constraint
Never nest `<DiscussButton>` inside a `<button>` element — invalid HTML (interactive content inside interactive content). Assignment and homework cards use a `<button>` that wraps the entire header row (expand/collapse toggle). The button must go in the **expanded content section**, not the header.

**How to apply:** For any page with a card that uses a full-row `<button>` for expand/collapse, add DiscussButton at the top of the AnimatePresence expanded body (after the header button closes). For cards with standalone action buttons (not a wrapping button), it can go inline next to those buttons.

## Pages wired
- `student-portal/assignment-center.tsx` — top of expanded section
- `student-portal/my-homework.tsx` — top of expanded section
- `student-portal/my-exams.tsx` — next to Start/Resume buttons (in-progress + available tabs)
- `course-detail.tsx` — next to course title in hero card

## Thread creation
POST `/api/messages/threads` with `{ type, title, context_type, context_id, recipient_ids: [] }`. Component auto-creates a thread on first open, then reuses the existing one on subsequent opens (looked up by context_type + context_id match against GET /api/messages/threads).

## AI Hint button
Calls `/api/coremind/chat` with a prompt referencing the contextType + contextTitle. Has a graceful fallback string if the endpoint is unavailable.
