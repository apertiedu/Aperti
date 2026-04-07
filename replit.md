# Workspace

## Overview

Aperti Attendance System — a web app for tracking student attendance across sessions.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS (artifacts/aperti)
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Features

- Student database (add/bulk import/delete, unique student codes)
- Session setup (lesson 1/2/3, date, time slot)
- Attendance marking (big input, one-click)
- Auto-absence marking (end of week)
- CSV export of attendance records
- Dashboard with stats (total students, attendance rate, absent count)

## Database Schema

- `students` — id, student_code (unique), student_name, time_slot, created_at
- `sessions` — id, lesson_number, date, time_slot, created_at
- `attendance` — id, student_id (FK), session_id (FK), status, marked_at

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
