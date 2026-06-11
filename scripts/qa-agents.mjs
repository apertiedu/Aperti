#!/usr/bin/env node
/**
 * Aperti QA Agents — Phase 26 Health Check Script
 * Usage: node scripts/qa-agents.mjs
 *
 * Tests all critical API endpoints and reports pass/fail.
 */

import http from "http";
import https from "https";

const BASE_URL = process.env.API_URL || "http://localhost:3001";
const ADMIN_USER = process.env.QA_ADMIN_USER || "admin";
const ADMIN_PASS = process.env.QA_ADMIN_PASS || "admin123";

let passed = 0;
let failed = 0;
let token = null;

const results = [];

function fetch(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;
    const reqOpts = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: opts.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(opts.headers || {}),
      },
    };
    const req = lib.request(reqOpts, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

async function test(label, fn) {
  try {
    const result = await fn();
    if (result.pass) {
      passed++;
      results.push({ label, status: "PASS", note: result.note || "" });
      console.log(`  ✓  ${label}${result.note ? ` — ${result.note}` : ""}`);
    } else {
      failed++;
      results.push({ label, status: "FAIL", note: result.note || "" });
      console.log(`  ✗  ${label} — ${result.note || "unexpected failure"}`);
    }
  } catch (err) {
    failed++;
    results.push({ label, status: "ERROR", note: err.message });
    console.log(`  !  ${label} — ERROR: ${err.message}`);
  }
}

async function main() {
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║  Aperti QA Agents — Phase 26          ║`);
  console.log(`╚══════════════════════════════════════╝\n`);
  console.log(`Target: ${BASE_URL}\n`);

  /* ── 1. Health ─────────────────────────────────────────────────────── */
  console.log("[ Health & Connectivity ]");
  await test("Backend health endpoint (/api/health)", async () => {
    const r = await fetch(`${BASE_URL}/api/health`);
    return { pass: r.status === 200, note: `status=${r.status}` };
  });

  /* ── 2. Auth ─────────────────────────────────────────────────────── */
  console.log("\n[ Authentication ]");
  await test("Admin login (POST /auth/login)", async () => {
    const r = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS, deviceId: "qa-agent" }),
    });
    if (r.status === 200 && r.body?.token) {
      token = r.body.token;
      return { pass: true, note: `role=${r.body.user?.role}` };
    }
    return { pass: false, note: `status=${r.status} body=${JSON.stringify(r.body).slice(0, 100)}` };
  });

  await test("GET /auth/me with token", async () => {
    if (!token) return { pass: false, note: "No token from login" };
    const r = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { pass: r.status === 200 && r.body?.user?.role === "admin", note: `status=${r.status}` };
  });

  await test("GET /auth/me without token returns 401", async () => {
    const r = await fetch(`${BASE_URL}/auth/me`);
    return { pass: r.status === 401, note: `status=${r.status}` };
  });

  /* ── 3. Problem Reports ───────────────────────────────────────────── */
  console.log("\n[ Problem Reports ]");
  await test("POST /api/problem-reports (submit report)", async () => {
    if (!token) return { pass: false, note: "No token" };
    const r = await fetch(`${BASE_URL}/api/problem-reports`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ category: "QA Test", description: "QA automated test report", pageUrl: "/qa-test" }),
    });
    return { pass: r.status === 200 && r.body?.ok, note: `status=${r.status}` };
  });

  await test("GET /api/admin/problem-reports", async () => {
    if (!token) return { pass: false, note: "No token" };
    const r = await fetch(`${BASE_URL}/api/admin/problem-reports`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { pass: r.status === 200 && Array.isArray(r.body), note: `count=${Array.isArray(r.body) ? r.body.length : "?"}` };
  });

  /* ── 4. Launch Blockers ───────────────────────────────────────────── */
  console.log("\n[ Launch Blockers ]");
  await test("GET /api/founder/launch-blockers", async () => {
    if (!token) return { pass: false, note: "No token" };
    const r = await fetch(`${BASE_URL}/api/founder/launch-blockers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { pass: r.status === 200 && Array.isArray(r.body), note: `count=${Array.isArray(r.body) ? r.body.length : "?"}` };
  });

  let blockerId = null;
  await test("POST /api/founder/launch-blockers (create)", async () => {
    if (!token) return { pass: false, note: "No token" };
    const r = await fetch(`${BASE_URL}/api/founder/launch-blockers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: "QA Test Blocker", severity: "minor", category: "qa" }),
    });
    if (r.status === 200 && r.body?.id) {
      blockerId = r.body.id;
      return { pass: true, note: `id=${blockerId}` };
    }
    return { pass: false, note: `status=${r.status}` };
  });

  await test("PATCH /api/founder/launch-blockers/:id (resolve)", async () => {
    if (!token || !blockerId) return { pass: false, note: "No token or blocker id" };
    const r = await fetch(`${BASE_URL}/api/founder/launch-blockers/${blockerId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: "resolved" }),
    });
    return { pass: r.status === 200 && r.body?.ok, note: `status=${r.status}` };
  });

  await test("DELETE /api/founder/launch-blockers/:id", async () => {
    if (!token || !blockerId) return { pass: false, note: "No token or blocker id" };
    const r = await fetch(`${BASE_URL}/api/founder/launch-blockers/${blockerId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    return { pass: r.status === 200 && r.body?.ok, note: `status=${r.status}` };
  });

  /* ── 5. Frontend Error Logging ────────────────────────────────────── */
  console.log("\n[ Frontend Error Logging ]");
  await test("POST /api/founder/frontend-errors", async () => {
    if (!token) return { pass: false, note: "No token" };
    const r = await fetch(`${BASE_URL}/api/founder/frontend-errors`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        message: "QA test error",
        stack: "Error: QA test error\n  at qa-agents.mjs:1",
        route: "/qa-test",
        browserInfo: "QA Agent/1.0",
      }),
    });
    return { pass: r.status === 200 && r.body?.ok, note: `status=${r.status}` };
  });

  /* ── 6. Founder Overview ──────────────────────────────────────────── */
  console.log("\n[ Founder Control Center ]");
  await test("GET /api/founder/overview", async () => {
    if (!token) return { pass: false, note: "No token" };
    const r = await fetch(`${BASE_URL}/api/founder/overview`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { pass: r.status === 200 && r.body?.users, note: `students=${r.body?.users?.students ?? "?"}` };
  });

  /* ── 7. DB integrity ──────────────────────────────────────────────── */
  console.log("\n[ DB Integrity ]");
  await test("GET /api/admin/health (system health)", async () => {
    if (!token) return { pass: false, note: "No token" };
    const r = await fetch(`${BASE_URL}/api/admin/health`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { pass: r.status === 200, note: `status=${r.status}` };
  });

  /* ── Summary ──────────────────────────────────────────────────────── */
  console.log(`\n${"─".repeat(44)}`);
  const total = passed + failed;
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0;
  console.log(`Results: ${passed}/${total} passed (${pct}%)`);
  if (failed > 0) {
    console.log(`\nFailed checks:`);
    results.filter(r => r.status !== "PASS").forEach(r => {
      console.log(`  • [${r.status}] ${r.label} — ${r.note}`);
    });
  } else {
    console.log(`\n✓ All checks passed — system is healthy!`);
  }
  console.log();

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error("QA agent crashed:", err);
  process.exit(1);
});
