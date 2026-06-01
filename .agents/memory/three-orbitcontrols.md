---
name: Three.js OrbitControls types
description: How to handle missing types for three/examples/jsm imports
---

`@types/three` does not resolve `three/examples/jsm/controls/OrbitControls`. TypeScript reports `Cannot find module`.

**Fix:** Add `// @ts-ignore` on the line before the import:
```ts
// @ts-ignore
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
```

**Why:** The JSM examples directory is not covered by @types/three's type definitions in the version used by this project.

**How to apply:** Any import from `three/examples/jsm/*` needs this treatment.
