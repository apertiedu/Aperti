---
name: Phase 7 Communication Ecosystem
description: Tables, routes, pages, and gotchas for the Communication, Collaboration & Community phase of Aperti
---

## Tables (15, created via executeSql — NOT drizzle-kit push)
message_threads_ext, thread_participants, thread_messages,
announcements, announcement_reads,
collaboration_rooms, room_members, room_messages, shared_resources,
support_tickets, ticket_responses, notification_preferences,
moderation_logs, class_channels, channel_messages

## Route files (all registered in routes/index.ts at the TOP with other imports)
- comm-threads.ts — /messages/threads, /channels, /announcements, /messages/translate
- comm-rooms.ts — /rooms, /rooms/:id, /rooms/:id/join, /rooms/:id/messages, /rooms/:id/share
- comm-support.ts — /tickets, /notifications/preferences, /analytics/communication, /moderation

## Frontend pages (all in aperti/src/pages/)
- unified-inbox.tsx → /inbox — threaded messaging with AI summary + translation
- class-channel.tsx → /channels/:courseId — per-course discussion channel
- announcements.tsx → /announcements — broadcast announcements with read-tracking
- study-rooms.tsx → /rooms — collaboration room discovery and creation
- collaborate.tsx → /collaborate/:roomId — live chat + members + resources + AI assistant
- support-tickets.tsx → /support — ticket filing, replies, AI self-help suggestions

## Critical gotcha
`drizzle-kit push` enters interactive mode for new tables (prompts "renamed or new?"). 
**Always use executeSql() directly** to create Phase 7 tables in future sessions.

**Why:** drizzle push sees the new table names and asks if they were renamed from existing tables — it can't auto-detect. The interactive prompt blocks CI/scripted runs.

## Route imports must be at top of routes/index.ts
ESM `import` statements cannot appear inline inside module body. 
If you add imports mid-file you'll get a SyntaxError at build time.
