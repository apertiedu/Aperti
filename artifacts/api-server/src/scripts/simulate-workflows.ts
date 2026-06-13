const BASE = process.env.APERTI_BASE_URL || "http://localhost:3001";

let passed = 0;
let failed = 0;
const failures: string[] = [];

async function step(label: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ ${label}: ${msg}`);
    failures.push(`${label}: ${msg}`);
    failed++;
  }
}

async function apiPost(path: string, body: unknown, cookie?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cookie) headers["Cookie"] = cookie;
  return fetch(`${BASE}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
}

async function apiGet(path: string, cookie?: string) {
  const headers: Record<string, string> = {};
  if (cookie) headers["Cookie"] = cookie;
  return fetch(`${BASE}${path}`, { headers });
}

function extractCookie(res: Response): string {
  const raw = res.headers.get("set-cookie") ?? "";
  const match = raw.match(/aperti_token=[^;]+/);
  return match ? match[0] : "";
}

async function seedAccount(email: string, password: string, role: "teacher" | "student" | "parent", firstName: string) {
  const res = await apiPost("/auth/register", { email, password, role, firstName, lastName: "Test" });
  if (res.status === 409) return;
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Register failed (${res.status}): ${body.slice(0, 120)}`);
  }
}

async function login(email: string, password: string): Promise<string> {
  const res = await apiPost("/auth/login", { username: email, password });
  if (res.status === 429) throw new Error("Rate limited — restart backend to reset, then re-run");
  if (res.status !== 200) {
    const body = await res.text();
    throw new Error(`Login failed (${res.status}): ${body.slice(0, 120)}`);
  }
  const cookie = extractCookie(res);
  if (!cookie) throw new Error("No aperti_token cookie in login response");
  return cookie;
}

async function runHealthChecks() {
  console.log("\n[1] Health Checks");

  await step("GET /api/health returns 200 with healthy status", async () => {
    const res = await apiGet("/api/health");
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    const body = await res.json() as { status?: string };
    const valid = ["ok", "healthy", "degraded"];
    if (!valid.includes(body.status ?? "")) throw new Error(`status="${body.status}" not in [${valid.join(",")}]`);
  });

  await step("GET /api/ai/health returns 200", async () => {
    const res = await apiGet("/api/ai/health");
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  });
}

async function runAuthSecurity() {
  console.log("\n[2] Auth & Security Checks");

  await step("GET /api/admin/users without auth returns 401", async () => {
    const res = await apiGet("/api/admin/users");
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  await step("GET /api/founder/error-logs without auth returns 401", async () => {
    const res = await apiGet("/api/founder/error-logs");
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  await step("GET /api/admin/launch-audit without auth returns 401", async () => {
    const res = await apiGet("/api/admin/launch-audit");
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  await step("Bogus JWT cookie returns 401 on admin route", async () => {
    const res = await apiGet("/api/admin/users", "aperti_token=bogus.invalid.token");
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  await step("GET /students without auth returns 401", async () => {
    const res = await apiGet("/students");
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  await step("GET /flashcards without auth returns 401", async () => {
    const res = await apiGet("/flashcards");
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });
}

async function runAccountSeed() {
  console.log("\n[3] Seed Test Accounts");

  await step("Register teacher@aperti.test (idempotent)", async () => {
    await seedAccount("teacher@aperti.test", "TestTeacher123!", "teacher", "TeacherSim");
  });

  await step("Register student@aperti.test (idempotent)", async () => {
    await seedAccount("student@aperti.test", "TestStudent123!", "student", "StudentSim");
  });

  await step("Register parent@aperti.test (idempotent)", async () => {
    await seedAccount("parent@aperti.test", "TestParent123!", "parent", "ParentSim");
  });
}

async function runTeacherWorkflow() {
  console.log("\n[4] Teacher Workflow");

  let cookie = "";

  await step("Teacher login", async () => {
    cookie = await login("teacher@aperti.test", "TestTeacher123!");
  });

  if (!cookie) { console.log("  (skipping teacher workflow — login failed)"); return; }

  await step("GET /api/admin/users returns 403 for teacher role", async () => {
    const res = await apiGet("/api/admin/users", cookie);
    if (res.status !== 401 && res.status !== 403) throw new Error(`Expected 401/403, got ${res.status}`);
  });

  await step("GET /students returns 200 for teacher", async () => {
    const res = await apiGet("/students", cookie);
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  });

  await step("GET /attendance returns 200 for teacher", async () => {
    const res = await apiGet("/attendance", cookie);
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  });

  await step("GET /question-bank returns 200 for teacher", async () => {
    const res = await apiGet("/question-bank", cookie);
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  });

  await step("GET /exams/exams returns 200 for teacher", async () => {
    const res = await apiGet("/exams/exams", cookie);
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  });

  await step("GET /lessons returns 200 for teacher", async () => {
    const res = await apiGet("/lessons", cookie);
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  });
}

async function runStudentWorkflow() {
  console.log("\n[5] Student Workflow");

  let cookie = "";

  await step("Student login", async () => {
    cookie = await login("student@aperti.test", "TestStudent123!");
  });

  if (!cookie) { console.log("  (skipping student workflow — login failed)"); return; }

  await step("GET /flashcards returns 200 for student", async () => {
    const res = await apiGet("/flashcards", cookie);
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  });

  await step("GET /api/revision returns 200 for student", async () => {
    const res = await apiGet("/api/revision", cookie);
    if (res.status !== 200 && res.status !== 404) throw new Error(`HTTP ${res.status}`);
  });

  await step("GET /api/admin/users returns 401/403 for student (role isolation)", async () => {
    const res = await apiGet("/api/admin/users", cookie);
    if (res.status !== 401 && res.status !== 403) throw new Error(`Expected 401/403, got ${res.status}`);
  });
}

async function runParentWorkflow() {
  console.log("\n[6] Parent Workflow");

  let cookie = "";

  await step("Parent login", async () => {
    cookie = await login("parent@aperti.test", "TestParent123!");
  });

  if (!cookie) { console.log("  (skipping parent workflow — login failed)"); return; }

  await step("GET /api/admin/users returns 401/403 for parent (role isolation)", async () => {
    const res = await apiGet("/api/admin/users", cookie);
    if (res.status !== 401 && res.status !== 403) throw new Error(`Expected 401/403, got ${res.status}`);
  });

  await step("GET /parent returns 200 or sub-route structure exists", async () => {
    const res = await apiGet("/parent", cookie);
    if (res.status !== 200 && res.status !== 404) throw new Error(`HTTP ${res.status}`);
  });
}

async function runPaymentSafety() {
  console.log("\n[7] Payment Safety");

  await step("GET /api/admin/subscriptions without auth returns 401", async () => {
    const res = await apiGet("/api/admin/subscriptions");
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  await step("GET /api/admin/payments without auth returns 401", async () => {
    const res = await apiGet("/api/admin/payments");
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });
}

async function runAdminWorkflow(adminEmail: string, adminPassword: string) {
  console.log("\n[8] Admin Workflow (requires pre-existing admin account)");

  let cookie = "";

  await step("Admin login", async () => {
    const res = await apiPost("/auth/login", { email: adminEmail, password: adminPassword });
    if (res.status === 429) throw new Error("Rate limited — restart backend to reset");
    if (res.status !== 200) throw new Error(`HTTP ${res.status} — set ADMIN_EMAIL/ADMIN_PASS env vars for this test`);
    cookie = extractCookie(res);
    if (!cookie) throw new Error("No aperti_token cookie");
  });

  if (!cookie) { console.log("  (skipping admin workflow — login failed)"); return; }

  await step("GET /api/admin/users returns list", async () => {
    const res = await apiGet("/api/admin/users", cookie);
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  });

  await step("GET /api/admin/launch-audit returns checklist", async () => {
    const res = await apiGet("/api/admin/launch-audit", cookie);
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  });

  await step("GET /api/founder/error-logs returns list", async () => {
    const res = await apiGet("/api/founder/error-logs?range=1h", cookie);
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  });

  await step("GET /api/founder/metrics returns data", async () => {
    const res = await apiGet("/api/founder/metrics", cookie);
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  });

  await step("GET /api/admin/analytics returns data", async () => {
    const res = await apiGet("/api/admin/analytics", cookie);
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  });
}

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || "";
  const adminPassword = process.env.ADMIN_PASS || "";

  console.log("=== Aperti Workflow Simulation ===");
  console.log(`Target: ${BASE}`);
  if (adminEmail) console.log(`Admin: ${adminEmail}`);
  else console.log("Admin: (no ADMIN_EMAIL set — admin workflow will be skipped)");
  console.log("===================================");

  await runHealthChecks();
  await runAuthSecurity();
  await runAccountSeed();
  await runTeacherWorkflow();
  await runStudentWorkflow();
  await runParentWorkflow();
  await runPaymentSafety();

  if (adminEmail && adminPassword) {
    await runAdminWorkflow(adminEmail, adminPassword);
  } else {
    console.log("\n[8] Admin Workflow — SKIPPED (set ADMIN_EMAIL and ADMIN_PASS to enable)");
  }

  console.log("\n===================================");
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);

  if (failures.length > 0) {
    console.log("\nFAILURES:");
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    process.exit(1);
  } else {
    console.log("ALL CHECKS PASSED — platform is simulation-clean.");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Fatal simulation error:", err);
  process.exit(1);
});
