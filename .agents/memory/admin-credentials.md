---
name: Admin password seeding
description: Admin bcrypt hash may mismatch at runtime; how to reset it
---

## Rule
`seedDefaultAdmin()` in `artifacts/api-server/src/app.ts` hashes `admin123` with bcryptjs rounds=10 and inserts into `accounts`. If the server has run before with a different hash (e.g. seeded from a different env or truncated), login returns 401.

**Fix:** Generate fresh hash and update DB directly:
```bash
node -e "const b=require('./artifacts/api-server/node_modules/bcryptjs'); b.hash('admin123',10).then(h=>console.log(h))"
psql "$DATABASE_URL" -c "UPDATE accounts SET password_hash='<hash>' WHERE username='admin';"
```

**Why:** The `seedDefaultAdmin` function uses `INSERT … ON CONFLICT DO NOTHING` — it won't update an existing row with a bad hash.

**How to apply:** Any time `POST /auth/login` with `admin/admin123` returns 401, run the two commands above.
