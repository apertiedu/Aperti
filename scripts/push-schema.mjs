import { pushSchema } from "drizzle-kit/api";
import pg from "pg";
import * as schema from "../lib/db/src/schema/index.ts";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

console.log("[push-schema] Pushing schema to database...");

try {
  const { apply, warnings } = await pushSchema(schema, pool, {
    tablesFilter: [],
    schemasFilter: ["public"],
    strict: false,
  });

  if (warnings.length > 0) {
    console.warn("[push-schema] Warnings:", warnings);
  }

  await apply();
  console.log("[push-schema] Schema pushed successfully.");
} catch (err) {
  console.error("[push-schema] Error:", err.message || err);
  process.exit(1);
} finally {
  await pool.end();
}
