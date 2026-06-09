---
name: Public routes must be registered before main router
description: Any truly public API endpoint must be registered in app.ts BEFORE app.use("/api", router) to avoid the qaRouter's global authenticate middleware.
---

## Rule
Public API endpoints (no auth required) must be registered as `app.use("/api", myPublicRouter)` **before** `app.use("/api", router)` in `app.ts`.

**Why:** `qa.ts` uses `qaRouter.use(authenticate, requireRole(...))` as a global top-level middleware and is mounted in `routes/index.ts` WITHOUT a path prefix via `router.use(qaRouter)`. In Express, `router.use(middleware)` without a path runs for ALL requests that flow through the router, even if no route in that sub-router matches the path. So every request reaching the main `router` gets hit with `authenticate` from `qaRouter`, returning 401 "Missing token".

**How to apply:**
- New public endpoints: create a separate router file (e.g. `phase14-public.ts`), and register it in `app.ts` BEFORE the main router line: `app.use("/api", phase14PublicRouter)`.
- The existing pattern `launchCmsRouter` works because it's after the main router but has no paths that collide with qaRouter's catch.
- If you ever need to add truly public routes into `routes/index.ts`, you'd need to fix qaRouter to use per-route auth instead of the global `router.use(authenticate)`.
