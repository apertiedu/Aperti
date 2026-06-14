/**
 * require-role.ts — named re-export for path-based imports
 *
 * `requireRole` lives in middleware/auth.ts (alongside authenticate).
 * This file re-exports it so routes that prefer the semantic import path
 * `import { requireRole } from "../middleware/require-role"` work without
 * duplication.
 *
 * Usage:
 *   import { requireRole } from "../middleware/require-role";
 *   router.use(requireRole("admin", "teacher"));
 */
export { requireRole } from "./auth";
