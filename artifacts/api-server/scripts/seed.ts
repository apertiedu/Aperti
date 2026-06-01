import bcrypt from "bcryptjs";
import { db, accountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("Running seed script...");

  const existing = await db.select().from(accountsTable).where(eq(accountsTable.username, "admin"));
  const passwordHash = await bcrypt.hash("admin123", 10);

  if (existing.length === 0) {
    await db.insert(accountsTable).values({
      username: "admin",
      passwordHash,
      displayName: "Admin",
      role: "admin",
      status: "active",
    });
    console.log("✓ Admin account created: admin / admin123");
  } else {
    await db.update(accountsTable)
      .set({ passwordHash, displayName: "Admin" })
      .where(eq(accountsTable.username, "admin"));
    console.log("✓ Admin account updated: admin / admin123");
  }

  console.log("Seed complete.");
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
