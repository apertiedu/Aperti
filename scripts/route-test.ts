#!/usr/bin/env tsx
/**
 * Automated Route Health Check Script
 * Run: pnpm exec tsx scripts/route-test.ts
 * 
 * Tests all critical API routes and reports status + latency.
 * Use before deployments or as a nightly CI health check.
 */

interface RouteTest {
  path: string;
  method?: string;
  role: "public" | "auth";
  expectStatus?: number;
  label?: string;
}

const BASE_URL = process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`;

const ROUTES: RouteTest[] = [
  // Public / health
  { path: "/health", role: "public", label: "Health endpoint" },
  { path: "/api/landing", role: "public", label: "Landing data" },
  { path: "/api/landing/stats", role: "public", label: "Landing stats" },
  { path: "/api/courses", role: "public", label: "Course list" },

  // Auth (no token — expect 401)
  { path: "/api/dashboard", role: "auth", expectStatus: 401, label: "Dashboard (unauth)" },
  { path: "/api/admin/health", role: "auth", expectStatus: 401, label: "Admin health (unauth)" },
  { path: "/question-bank", role: "auth", expectStatus: 401, label: "Question bank (unauth)" },
  { path: "/api/admin/error-intelligence/summary", role: "auth", expectStatus: 401, label: "Error intelligence (unauth)" },
  { path: "/api/admin/learning-efficiency", role: "auth", expectStatus: 401, label: "Learning efficiency (unauth)" },
  { path: "/api/admin/content-validation/summary", role: "auth", expectStatus: 401, label: "Content validation (unauth)" },
  { path: "/api/questions/extract", role: "auth", expectStatus: 401, label: "Question extraction (unauth)" },
  { path: "/api/founder/metrics", role: "auth", expectStatus: 401, label: "Founder metrics (unauth)" },
];

type Result = {
  label: string;
  path: string;
  method: string;
  expectedStatus: number;
  actualStatus: number;
  latencyMs: number;
  ok: boolean;
  error?: string;
};

async function testRoute(route: RouteTest): Promise<Result> {
  const method = route.method ?? "GET";
  const expectedStatus = route.expectStatus ?? 200;
  const label = route.label ?? route.path;
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${BASE_URL}${route.path}`, {
      method,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
    const latencyMs = Date.now() - start;
    const ok = res.status === expectedStatus;
    return { label, path: route.path, method, expectedStatus, actualStatus: res.status, latencyMs, ok };
  } catch (err: any) {
    return {
      label, path: route.path, method, expectedStatus,
      actualStatus: 0,
      latencyMs: Date.now() - start,
      ok: false,
      error: err.name === "AbortError" ? "TIMEOUT (>8s)" : err.message,
    };
  }
}

async function main() {
  console.log(`\n🧪 Aperti Route Health Check`);
  console.log(`   Target: ${BASE_URL}`);
  console.log(`   Routes: ${ROUTES.length}`);
  console.log(`   Time:   ${new Date().toISOString()}\n`);

  const results = await Promise.all(ROUTES.map(testRoute));

  const passed = results.filter(r => r.ok);
  const failed = results.filter(r => !r.ok);
  const avgLatency = Math.round(results.reduce((s, r) => s + r.latencyMs, 0) / results.length);

  // Print results
  for (const r of results) {
    const icon = r.ok ? "✅" : "❌";
    const status = r.error ? `ERR:${r.error}` : `${r.actualStatus}`;
    const latency = `${r.latencyMs}ms`;
    const slow = r.latencyMs > 1000 ? " ⚠️ SLOW" : "";
    console.log(`  ${icon} ${r.label.padEnd(38)} ${status.padEnd(8)} ${latency}${slow}`);
  }

  console.log(`\n  ─────────────────────────────────────────────────`);
  console.log(`  Passed:   ${passed.length}/${results.length}`);
  console.log(`  Failed:   ${failed.length}`);
  console.log(`  Avg lat:  ${avgLatency}ms`);

  if (failed.length > 0) {
    console.log(`\n  Failed routes:`);
    for (const r of failed) {
      console.log(`    • ${r.path} — expected ${r.expectedStatus}, got ${r.actualStatus}${r.error ? ` (${r.error})` : ""}`);
    }
    console.log("");
    process.exit(1);
  }

  console.log(`\n  All routes healthy! ✨\n`);
  process.exit(0);
}

main().catch(err => {
  console.error("Route test crashed:", err);
  process.exit(1);
});
