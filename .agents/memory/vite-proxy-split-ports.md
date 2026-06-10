---
name: Vite proxy for split ports
description: How to configure vite.config.ts proxy when frontend (5000) and backend (3001) are on separate ports and backend serves routes at both /api/... and bare paths.
---

## The Problem

The backend serves routes at TWO levels:
1. Via `app.use("/api", router)` — routes like `/api/exams`, `/api/subjects`, `/api/mobile/...`
2. Via bare mounts like `app.use("/flashcards", flashcardsRouter)` — routes like `/flashcards/decks`

The frontend calls BOTH patterns. The Vite proxy must route everything correctly.

## The Rule

Two categories of backend routers:

**Absolute-path routers** (handler includes the resource name, e.g. `router.get("/exams", ...)`):
- Only accessible via `/api/exams` (through routes/index.ts)
- The bare app.ts mount like `app.use("/exams", examsRouter)` creates WRONG routes like `/exams/exams`
- Frontend bare calls to these paths NEED an `/api` prefix rewrite

**Relative-path routers** (handler uses `/`, `/:id`, `/teacher`, etc.):
- Accessible at bare path via `app.use("/flashcards", flashcardsRouter)` → `/flashcards/decks`
- DO NOT need rewrite; adding `/api` prefix BREAKS them

## Vite Proxy Solution

```javascript
proxy: {
  "/socket.io": { target: `http://localhost:${apiPort}`, changeOrigin: true, ws: true },
  "^/": {
    target: `http://localhost:${apiPort}`,
    changeOrigin: true,
    rewrite: (path) => {
      // Whitelist: these routers use relative paths and work at bare level
      const BARE_OK = [
        "/api", "/auth", "/courses", "/parent", "/uploads", "/socket.io",
        "/dashboard", "/flashcards", "/lessons", "/subscriptions",
        "/homework", "/question-bank", "/mentor", "/revisit",
        "/attendance", "/students",
      ];
      if (path === "/" || BARE_OK.some(p => path === p || path.startsWith(p + "/") || path.startsWith(p + "?"))) return path;
      // Everything else (subjects, mobile, portal, exams, push, etc.) needs /api prefix
      return `/api${path}`;
    },
    bypass(req) {
      const url = req.url ?? "";
      if (url.startsWith("/@") || url.startsWith("/__")) return url;
      if (url.match(/\.(tsx?|jsx?|css|scss|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|eot|map)(\?.*)?$/)) return url;
      if ((req.headers.accept ?? "").includes("text/html")) return "/index.html";
    },
  },
}
```

## How to maintain the whitelist

If adding a new router with relative paths (like `GET /`, `GET /:id`):
- Add it to `app.ts` as `app.use("/newpath", newRouter)` 
- Add `/newpath` to `BARE_OK` in vite.config.ts

If adding a new router with absolute paths (like `GET /newpath/resource`):
- Mount only via `router.use(newRouter)` in routes/index.ts  
- Do NOT add to `BARE_OK` — it will automatically get `/api` prefix from proxy rewrite

**Why:** The original backend was designed to run on a single port (Express serving frontend). When migrated to separate ports, the Vite proxy gap was discovered. Bare-path mounts in app.ts use relative handlers and work fine; absolute-path handlers only work through /api mount.
