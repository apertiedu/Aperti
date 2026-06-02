---
name: API routing structure
description: How routes are mounted across the two-server setup (port 3001 vs 8080)
---

## Route mounting (port 3001 — Backend API, what frontend uses)
- `app.use("/auth", authRouter)` — login, me, stats, register
- `app.use("/courses", coursesRouter)` — course CRUD
- `app.use("/api", router)` — all other routes (subscriptions, tutorial, landing-settings, lessons, etc.)
- `/api/subscriptions/...` → subscriptionsRouter
- `/api/tutorial/progress` → tutorialRouter
- `/api/landing-settings` → landingSettingsRouter

## Vite proxy
Frontend (port 5000) proxies `/api` → `localhost:3001`. So frontend calls `/api/X` → backend `/api/X`.
Auth calls `/auth/login` → backend `/auth/login`.
Courses calls `/courses` → backend `/courses`.

## Second server (port 8080 — artifacts/api-server: API Server)
Same package, different port. Has `/api/auth/login` (prefixed). NOT used by the frontend proxy.
