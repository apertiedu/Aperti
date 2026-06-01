import bcrypt from "bcryptjs";
import { db, accountsTable } from "@workspace/db";

async function seed() {
  console.log("Checking for existing accounts...");
  const existing = await db.select().from(accountsTable).limit(1);
  if (existing.length > 0) {
    console.log("Accounts already exist. Skipping seed.");
    console.log("To reset, manually delete the accounts table rows.");
    process.exit(0);
  }

  console.log("Creating default admin account...");
  const passwordHash = await bcrypt.hash("admin123", 12);
  const [admin] = await db.insert(accountsTable).values({
    username: "admin",
    passwordHash,
    displayName: "Admin",
    role: "admin",
    status: "active",
  }).returning();

  console.log("✅ Admin account created:");
  console.log("   Username: admin");
  console.log("   Password: admin123");
  console.log("   Role:     admin");
  console.log("");
  console.log("⚠️  Change the password after first login!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
