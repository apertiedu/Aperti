---
name: Drizzle querySchema aliases
description: querySchema in lib/db/src/index.ts has aliases but no relations(); relational API is broken
---

## Rule
`lib/db/src/index.ts` builds `querySchema` as a plain object of table name → table definition. There are NO `relations()` exports in any schema file, so Drizzle's relational query API (`db.query.X.findMany({ with: {...} })`) crashes with:
`TypeError: Cannot read properties of undefined (reading 'referencedTable')`

**Fix:** Use plain `db.select().from(table).where(...)` and do manual joins in JavaScript (fetch related rows by FK, then merge with `map()`).

**Why:** Adding `relations()` requires exporting them from schema files and re-passing them to `drizzle()`. That change is risky and touches shared lib code. Plain selects are safer.

**How to apply:** Every route file must avoid `db.query.X.findMany({ with: {...} })`. Use `db.select()` only.
