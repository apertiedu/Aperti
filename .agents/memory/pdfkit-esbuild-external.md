---
name: pdfkit esbuild external
description: pdfkit and fontkit must be marked as external in esbuild or the build fails at runtime
---

**Rule:** When using `pdfkit` in the api-server, always add both `"pdfkit"` and `"fontkit"` to the `external` array in `build.mjs`.

**Why:** pdfkit's dependency chain (`fontkit` → `brotli` → `@swc/helpers`) requires `@swc/helpers/cjs/_define_property.cjs` at runtime. Even though `@swc/*` is already external, esbuild still bundles `fontkit` and `brotli` inline, which then fail to resolve `@swc/helpers` at runtime. Marking `pdfkit` + `fontkit` external makes Node.js load them from `node_modules` directly, resolving the whole chain correctly.

**How to apply:** Any time pdfkit (or fontkit) is added to api-server, ensure `build.mjs` externals include both `"pdfkit"` and `"fontkit"`.
