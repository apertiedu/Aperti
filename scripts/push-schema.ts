import { pushSchema } from "drizzle-kit/api";
import pg from "pg";
import * as schema from "../lib/db/src/schema/index.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

console.log("[push-schema] Pushing schema to database...");

const { apply, warnings } = await pushSchema(schema, pool);

if (warnings.length > 0) {
  for (const w of warnings) console.warn("[push-schema] Warning:", w);
}

await apply();
console.log("[push-schema] Done.");
await pool.end();
