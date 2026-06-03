---
name: Framer-motion import trap
description: React hooks cannot be imported from framer-motion
---

Never write `import { useState } from "framer-motion"`. Only import motion-specific exports from framer-motion (motion, AnimatePresence, useInView, useScroll, useTransform, etc.).

All React hooks (useState, useEffect, useRef, useCallback, useMemo) must come from "react".

**Why:** This caused a full app crash — Vite bundled the wrong module and threw a runtime error blocking the entire app.
**How to apply:** Always keep two separate import lines when using both framer-motion and react hooks in the same file.
