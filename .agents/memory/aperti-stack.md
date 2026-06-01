---
name: Aperti stack & API wiring
description: Monorepo structure, Vite proxy, JWT auth, and how frontend API calls reach the Express server
---

## Monorepo
- Frontend: `artifacts/aperti` (React + Vite + Wouter, port 5000)
- API: `artifacts/api-server` (Express, port 3001)
- DB lib: `lib/db` (Drizzle ORM + PostgreSQL)
- Start: `pnpm --filter @workspace/aperti run dev` and `pnpm --filter @workspace/api-server run dev`

## API Connectivity (dev)
- `VITE_API_URL=/api` set in shared Replit env
- Vite proxy in `vite.config.ts`: `/api` → `http://localhost:{API_PORT}` (no path rewrite)
- Express mounts all routes under `/api` via `app.use("/api", router)` in `app.ts`
- Frontend pages: `const API = import.meta.env.VITE_API_URL || ""; fetch(\`\${API}/some/path\`)`
- Auth context: `fetch(\`\${import.meta.env.VITE_API_URL}/auth/me\`)`

**Why:** Browser can't reach `localhost:3001` from the Replit-proxied iframe; Vite dev server acts as the proxy. `/api` prefix keeps API calls separate from SPA frontend routes to avoid conflicts.

## Auth
- JWT tokens: `localStorage.getItem("aperti_token")` → `Authorization: Bearer <token>`
- Default admin: `admin / aperti2024`
- `authRouter` handles `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`

## Three.js
- `three` and `@types/three` must be installed in `artifacts/aperti` (not root)
- Import path: `import * as THREE from "three"` and `import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"`

## Design System
- Font: Inter (Google Fonts, `--app-font-sans`)
- Primary teal: `173 100% 24%` (#00796B light) / `174 100% 30%` (#009688 dark)
- Background light: `0 0% 96%` (#F5F5F5), dark: `240 9% 5%` (#0B0B0D)
- Card light: `0 0% 100%` (#FFFFFF), dark: `0 0% 10%` (#1A1A1A)
- Accent theme overrides via `data-theme` attribute on root
