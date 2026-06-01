---
name: Wouter Route component props
description: Route component prop in wouter cannot accept custom props
---

Wouter's `<Route component={Foo} />` requires `Foo` to be `JSXElementConstructor<RouteComponentProps<...>>`. Components with custom props fail this check.

**Fix:** Remove custom props from page components used as route targets. Use internal defaults, URL search params, or `useLocation()` to get dynamic values instead.

```tsx
// Bad — causes TS2322
export default function GradeFlow({ examId }: { examId: number }) { ... }

// Good
export default function GradeFlow() {
  const examId = 0; // or read from useLocation / useParams
  ...
}
```

**Why:** The `component` prop of wouter's `Route` is typed to receive `RouteComponentProps`, not arbitrary props.
