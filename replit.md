# Aperti — Intelligent Educational Operating System

Multi-tenant EdTech platform for teachers, students, parents, and administrators. Phases 1–33 complete.

## Architecture

- **Frontend**: React 19 + Vite + Tailwind CSS v4 + shadcn/ui (port 5000)
- **Backend**: Express 5 + TypeScript + esbuild (port 3001)
- **Database**: PostgreSQL via Drizzle ORM + raw pool queries
- **Auth**: JWT (7d) + PostgreSQL session store + TOTP MFA
- **AI**: OpenAI GPT-4o via Replit integration
- **Search**: ILIKE + pg_trgm fuzzy similarity + syllabus code lookup

## Workflows

| Name | Command |
|---|---|
| Start application | `cd artifacts/aperti && pnpm run dev` |
| Backend API | `cd artifacts/api-server && PORT=3001 pnpm run dev` |

## Key Paths

- Frontend source: `artifacts/aperti/src/`
- Backend source: `artifacts/api-server/src/`
- Database migrations: `artifacts/api-server/src/db/migrate.ts`
- DB schema: `packages/db/src/schema/`

## Required Secrets

Set in Replit Secrets:
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — JWT signing key
- `SESSION_SECRET` — express-session secret
- `OPENAI_API_KEY` — OpenAI key (set via Replit AI integration)

## Design System

- Font: Inter
- Primary color: teal `#0D9488`
- Cards: `bg-white rounded-xl shadow-sm border border-gray-100`
- Animations: Framer Motion with `ease: [0.22, 1, 0.36, 1]`
- Loading states: skeleton screens via `@/components/skeleton-layouts`

## Phase 33 Features

- **Search**: fuzzy matching with pg_trgm, syllabus code detection (0625→Physics), question text search, natural language intent parsing
- **Flashcards**: Easy/Okay/Hard confidence ratings, SM-2 spaced repetition, per-deck mastery endpoint, session complete summary
- **Analytics**: retention (30/60/90-day), engagement funnel, cohort retention table
- **Health endpoint**: `/api/health` returns db latency, table count, memory usage
- **Migrations**: pg_trgm extension, retention_snapshots, platform_feature_flags, syllabus_code column on subjects
- **Error boundary**: logs to `/api/errors/log` and `/api/founder/frontend-errors` with fallback UI

## User Preferences

- No emojis in code or responses unless requested
- No comments in code unless asked
- Keep sidebar just "Aperti." text (no icon)
- Use "Assessment Hub" consistently (not "Assessment Center")
