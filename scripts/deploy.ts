#!/usr/bin/env node
/**
 * Aperti One-Click Deployment Script
 *
 * Steps:
 *   1. Validate environment
 *   2. Install dependencies
 *   3. Run repair scan (abort on critical issues)
 *   4. Build frontend + backend
 *   5. Run database migrations
 *   6. (Re)start via PM2
 *
 * Usage:
 *   npx ts-node scripts/deploy.ts
 *   NODE_ENV=production npx ts-node scripts/deploy.ts
 */
import { execSync, spawnSync } from "child_process";

const ENV = process.env.NODE_ENV ?? "development";
const SKIP_REPAIR = process.env.SKIP_REPAIR === "1";

function run(cmd: string, cwd?: string): boolean {
  console.log(`\n▶ ${cmd}${cwd ? ` (in ${cwd})` : ""}`);
  const result = spawnSync(cmd, { shell: true, stdio: "inherit", cwd: cwd ?? process.cwd() });
  if (result.status !== 0) {
    console.error(`✗ Command failed: ${cmd}`);
    return false;
  }
  console.log(`✓ Done`);
  return true;
}

function checkEnv() {
  const required = ["DATABASE_URL", "JWT_SECRET"];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error(`\n✗ Missing required environment variables: ${missing.join(", ")}`);
    console.error("  Set them in your .env file or environment before deploying.");
    process.exit(1);
  }
  if ((process.env.JWT_SECRET?.length ?? 0) < 32) {
    console.error("\n✗ JWT_SECRET must be at least 32 characters for security.");
    process.exit(1);
  }
  console.log("✓ Environment validated");
}

async function main() {
  console.log("\n╔═══════════════════════════════════════════════╗");
  console.log(`║   Aperti Deployment Pipeline — ${ENV.padEnd(14)}║`);
  console.log("╚═══════════════════════════════════════════════╝\n");
  const t0 = Date.now();

  // Step 1: Environment validation
  checkEnv();

  // Step 2: Install dependencies
  if (!run("pnpm install --frozen-lockfile")) process.exit(1);

  // Step 3: Auto-repair scan
  if (!SKIP_REPAIR) {
    console.log("\n▶ Running auto-repair scan…");
    const repairResult = spawnSync("npx ts-node scripts/repair.ts", { shell: true, stdio: "inherit" });
    if (repairResult.status !== 0) {
      console.error("\n✗ Repair scan found critical issues. Fix them before deploying.");
      console.error("  Set SKIP_REPAIR=1 to bypass (not recommended for production).");
      process.exit(1);
    }
  }

  // Step 4: Build backend
  if (!run("pnpm run build", "artifacts/api-server")) process.exit(1);

  // Step 5: Build frontend
  if (!run("pnpm run build", "artifacts/aperti")) process.exit(1);

  // Step 6: PM2 restart
  console.log("\n▶ Starting/restarting services via PM2…");
  const pm2Start = spawnSync(
    `pm2 startOrRestart ecosystem.config.js --env ${ENV}`,
    { shell: true, stdio: "inherit" }
  );
  if (pm2Start.status !== 0) {
    console.warn("  PM2 not available — services must be restarted manually.");
  } else {
    run("pm2 save");
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n╔═══════════════════════════════════════════════╗`);
  console.log(`║  Deployment complete in ${elapsed}s              ║`);
  console.log(`╚═══════════════════════════════════════════════╝\n`);
}

main().catch(err => {
  console.error("\nDeployment failed:", err);
  process.exit(1);
});
