---
name: Framer Motion spring type
description: TypeScript fix for spring transition type in framer-motion Variants
---

When defining framer-motion `Variants` objects, the `type` property in a `transition` object must be `as const`:

```ts
const item = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { type: "spring" as const, stiffness: 220 } } };
```

**Why:** TypeScript infers `type: "spring"` as `string` not the literal `"spring"`, which fails the `Variants` type constraint.

**How to apply:** Any time you write `type: "spring"` (or any other literal) inside a variant's transition, add `as const`.
