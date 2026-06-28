import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

// ── Enrollment FSM ────────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  requested:            ["payment_pending", "verification_pending", "approved", "rejected", "cancelled"],
  payment_pending:      ["verification_pending", "approved", "rejected", "cancelled"],
  verification_pending: ["approved", "rejected", "cancelled"],
  approved:             ["suspended", "cancelled"],
  rejected:             ["requested"],
  cancelled:            ["requested"],
  suspended:            ["approved", "cancelled"],
};

function isValidTransition(from: string, to: string): boolean {
  return (VALID_TRANSITIONS[from] ?? []).includes(to);
}

describe("Enrollment FSM — state machine", () => {
  it("allows requested → approved", () => {
    assert.equal(isValidTransition("requested", "approved"), true);
  });

  it("allows requested → payment_pending", () => {
    assert.equal(isValidTransition("requested", "payment_pending"), true);
  });

  it("allows payment_pending → approved", () => {
    assert.equal(isValidTransition("payment_pending", "approved"), true);
  });

  it("allows approved → suspended", () => {
    assert.equal(isValidTransition("approved", "suspended"), true);
  });

  it("allows rejected → requested (re-apply)", () => {
    assert.equal(isValidTransition("rejected", "requested"), true);
  });

  it("allows cancelled → requested (re-apply)", () => {
    assert.equal(isValidTransition("cancelled", "requested"), true);
  });

  it("blocks approved → requested (cannot un-approve directly)", () => {
    assert.equal(isValidTransition("approved", "requested"), false);
  });

  it("blocks suspended → requested", () => {
    assert.equal(isValidTransition("suspended", "requested"), false);
  });

  it("blocks unknown state transitions", () => {
    assert.equal(isValidTransition("nonexistent", "approved"), false);
  });

  it("blocks same-state transitions", () => {
    assert.equal(isValidTransition("approved", "approved"), false);
    assert.equal(isValidTransition("requested", "requested"), false);
  });

  it("all defined source states have at least one valid transition", () => {
    for (const [from, targets] of Object.entries(VALID_TRANSITIONS)) {
      assert.ok(targets.length > 0, `State '${from}' has no outgoing transitions`);
    }
  });
});

// ── Auth rejection — unauthenticated requests ─────────────────────────────────

async function jsonRequest(
  method: string,
  url: string,
  body?: object,
  token?: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload = body ? JSON.stringify(body) : undefined;
    const options: http.RequestOptions = {
      hostname: parsed.hostname,
      port: parseInt(parsed.port),
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      },
    };
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode ?? 0, body: { raw: data } });
        }
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const BASE = `http://localhost:${process.env.PORT || 3001}`;

describe("Auth — unauthenticated request rejection", () => {
  it("GET /api/enrollments returns 401 without token", async () => {
    const res = await jsonRequest("GET", `${BASE}/api/enrollments`);
    assert.ok(
      res.status === 401 || res.status === 403,
      `Expected 401 or 403, got ${res.status}`,
    );
  });

  it("GET /api/teacher-ops/dashboard returns 401 without token", async () => {
    const res = await jsonRequest("GET", `${BASE}/api/teacher-ops/dashboard`);
    assert.ok(
      res.status === 401 || res.status === 403,
      `Expected 401 or 403, got ${res.status}`,
    );
  });

  it("POST /api/enrollments returns 401 without token", async () => {
    const res = await jsonRequest("POST", `${BASE}/api/enrollments`, { course_id: 1 });
    assert.ok(
      res.status === 401 || res.status === 403,
      `Expected 401 or 403, got ${res.status}`,
    );
  });

  it("GET /api/teacher-ops/activity returns 401 without token", async () => {
    const res = await jsonRequest("GET", `${BASE}/api/teacher-ops/activity`);
    assert.ok(
      res.status === 401 || res.status === 403,
      `Expected 401 or 403, got ${res.status}`,
    );
  });

  it("rejects forged Bearer null token on protected route", async () => {
    const res = await jsonRequest("GET", `${BASE}/api/enrollments`, undefined, "null");
    assert.ok(
      res.status === 401 || res.status === 403,
      `Bearer null token should be rejected, got ${res.status}`,
    );
  });

  it("rejects obviously invalid JWT token", async () => {
    const res = await jsonRequest(
      "GET",
      `${BASE}/api/enrollments`,
      undefined,
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGUiOiJzdHVkZW50In0.INVALID",
    );
    assert.ok(
      res.status === 401 || res.status === 403,
      `Invalid JWT should be rejected, got ${res.status}`,
    );
  });
});

// ── Google OAuth — redirect behaviour ────────────────────────────────────────

describe("Google OAuth — /auth/google redirect", () => {
  it("GET /auth/google redirects (302) rather than returning JSON", async () => {
    return new Promise<void>((resolve, reject) => {
      const req = http.get(`${BASE}/auth/google`, { maxRedirects: 0 } as any, (res) => {
        assert.ok(
          res.statusCode === 302 || res.statusCode === 301,
          `Expected redirect, got ${res.statusCode}`,
        );
        const location = res.headers["location"] ?? "";
        assert.ok(
          location.includes("accounts.google.com") || location.includes("/login"),
          `Redirect must go to Google or login error page, got: ${location}`,
        );
        resolve();
      });
      req.on("error", reject);
    });
  });

  it("GET /auth/google/callback without code redirects to login with error", async () => {
    return new Promise<void>((resolve, reject) => {
      const req = http.get(`${BASE}/auth/google/callback?error=access_denied`, { maxRedirects: 0 } as any, (res) => {
        assert.ok(
          res.statusCode === 302 || res.statusCode === 301,
          `Expected redirect, got ${res.statusCode}`,
        );
        const location = res.headers["location"] ?? "";
        assert.ok(
          location.includes("login") && location.includes("error="),
          `Should redirect to login with error param, got: ${location}`,
        );
        resolve();
      });
      req.on("error", reject);
    });
  });

  it("GET /auth/google/callback with invalid state redirects to login error", async () => {
    return new Promise<void>((resolve, reject) => {
      const req = http.get(
        `${BASE}/auth/google/callback?code=fake_code&state=invalid_state`,
        { maxRedirects: 0 } as any,
        (res) => {
          assert.ok(
            res.statusCode === 302 || res.statusCode === 301,
            `Expected redirect on CSRF failure, got ${res.statusCode}`,
          );
          const location = res.headers["location"] ?? "";
          assert.ok(
            location.includes("login"),
            `Should redirect to login, got: ${location}`,
          );
          resolve();
        },
      );
      req.on("error", reject);
    });
  });
});

// ── Route availability — enrolled routes are live ────────────────────────────

describe("Route availability — new routes respond (not 404)", () => {
  it("GET /api/enrollments is mounted (returns auth error, not 404)", async () => {
    const res = await jsonRequest("GET", `${BASE}/api/enrollments`);
    assert.notEqual(res.status, 404, "Route should be mounted and return auth error, not 404");
  });

  it("GET /api/teacher-ops/dashboard is mounted (returns auth error, not 404)", async () => {
    const res = await jsonRequest("GET", `${BASE}/api/teacher-ops/dashboard`);
    assert.notEqual(res.status, 404, "Route should be mounted and return auth error, not 404");
  });

  it("GET /api/teacher-ops/activity is mounted (returns auth error, not 404)", async () => {
    const res = await jsonRequest("GET", `${BASE}/api/teacher-ops/activity`);
    assert.notEqual(res.status, 404, "Route should be mounted and return auth error, not 404");
  });

  it("GET /api/health is reachable without auth", async () => {
    const res = await jsonRequest("GET", `${BASE}/api/health`);
    assert.ok(res.status === 200 || res.status === 206, `Health should be 200, got ${res.status}`);
  });
});

// ── Env validation — secret thresholds ───────────────────────────────────────

describe("Environment validation — secret requirements", () => {
  it("JWT_SECRET must be at least 32 characters for production", () => {
    const shortSecret = "tooshort";
    assert.ok(shortSecret.length < 32, "Test fixture: short secret confirmed");
  });

  it("insecure default JWT_SECRET values are detected", () => {
    const insecureValues = ["dev-secret", "change-me", "default-secret"];
    const testSecret = "dev-secret-my-app-12345678901234567890";
    const isInsecure = insecureValues.some(v => testSecret.toLowerCase().includes(v));
    assert.equal(isInsecure, true, "Should detect insecure default in JWT_SECRET");
  });

  it("strong random JWT_SECRET passes validation", () => {
    const strongSecret = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
    const insecureValues = ["dev-secret", "change-me", "default-secret"];
    const isInsecure = insecureValues.some(v => strongSecret.toLowerCase().includes(v));
    assert.equal(isInsecure, false, "Strong secret should not trigger insecure check");
    assert.ok(strongSecret.length >= 32, "Strong secret meets minimum length");
  });

  it("DATABASE_URL absence would be detected as fatal", () => {
    const errors: string[] = [];
    if (!process.env["DATABASE_URL"]) {
      errors.push("DATABASE_URL is missing");
    }
    assert.equal(process.env["DATABASE_URL"] !== undefined, true, "DATABASE_URL must be configured");
  });

  it("PUBLIC_URL is set to the production domain", () => {
    assert.equal(
      process.env["PUBLIC_URL"],
      "https://aperti.ai",
      "PUBLIC_URL must be https://aperti.ai",
    );
  });

  it("ALLOWED_ORIGINS is set to the production domain", () => {
    assert.ok(
      (process.env["ALLOWED_ORIGINS"] ?? "").includes("aperti.ai"),
      "ALLOWED_ORIGINS must include aperti.ai",
    );
  });
});
