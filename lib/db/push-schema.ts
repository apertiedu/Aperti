import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import pg from "pg";
import * as schema from "./src/schema/index.ts";

const { Client } = pg;

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL! });
  await client.connect();
  console.log("[push-schema] Generating migration SQL from schema...");
  try {
    const prevSnapshot = await generateDrizzleJson({});
    const curSnapshot = await generateDrizzleJson(schema);
    const statements = await generateMigration(prevSnapshot, curSnapshot);
    console.log(`[push-schema] ${statements.length} SQL statements to execute.`);

    for (const stmt of statements) {
      const preview = stmt.slice(0, 80).replace(/\n/g, " ");
      console.log(`[push-schema] Running: ${preview}...`);
      try {
        await client.query(stmt);
      } catch (e: any) {
        if (e.code === "42P07" || e.message?.includes("already exists")) {
          console.log(`  → skipped (already exists)`);
        } else if (e.code === "42P01") {
          console.log(`  → skipped (table not found for ALTER)`);
        } else {
          console.warn(`  → warning: ${e.message}`);
        }
      }
    }
    console.log("[push-schema] Done.");
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
