import { Router } from "express";
import { pool } from "@workspace/db";
import { requireRole } from "../middleware/auth";
import http from "http";

export const adminRouteHealthRouter = Router();
adminRouteHealthRouter.use(requireRole("admin", "super_admin"));

interface RouteCheck {
  path: string;
  method: string;
  category: string;
  status: "pass" | "fail" | "warn";
  httpCode: number | null;
  isProtected: boolean;
  protectionOk: boolean;
  latencyMs: number | null;
  note: string;
}

function checkRoute(path: string, method: string, token?: string): Promise<{ code: number; latencyMs: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const options: http.RequestOptions = {
      hostname: "localhost",
      port: parseInt(process.env.PORT || "3001"),
      path,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
    const req = http.request(options, (res) => {
      res.resume();
      resolve({ code: res.statusCode || 0, latencyMs: Date.now() - start });
    });
    req.on("error", () => resolve({ code: 0, latencyMs: Date.now() - start }));
    req.setTimeout(5000, () => { req.destroy(); resolve({ code: 0, latencyMs: 5000 }); });
    req.end();
  });
}

const ROUTE_CHECKS: { path: string; method: string; category: string; isProtected: boolean; expectedPublic?: number[] }[] = [
  // Public endpoints
  { path: "/api/health", method: "GET", category: "System", isProtected: false, expectedPublic: [200] },
  { path: "/auth/login", method: "POST", category: "Auth", isProtected: false, expectedPublic: [400, 401, 429] },
  { path: "/auth/register", method: "POST", category: "Auth", isProtected: false, expectedPublic: [400, 409] },
  { path: "/api/plans/public", method: "GET", category: "Public", isProtected: false, expectedPublic: [200] },
  { path: "/api/landing", method: "GET", category: "Public", isProtected: false, expectedPublic: [200, 404] },

  // Protected — Admin
  { path: "/api/admin/health", method: "GET", category: "Admin", isProtected: true },
  { path: "/api/admin/users", method: "GET", category: "Admin", isProtected: true },
  { path: "/api/admin/analytics", method: "GET", category: "Admin", isProtected: true },
  { path: "/api/admin/payments", method: "GET", category: "Admin", isProtected: true },
  { path: "/api/admin/subscriptions", method: "GET", category: "Admin", isProtected: true },
  { path: "/api/admin/features", method: "GET", category: "Admin", isProtected: true },
  { path: "/api/admin/organizations", method: "GET", category: "Admin", isProtected: true },
  { path: "/api/admin/roles", method: "GET", category: "Admin", isProtected: true },
  { path: "/api/admin/audit", method: "GET", category: "Admin", isProtected: true },
  { path: "/api/admin/security", method: "GET", category: "Admin", isProtected: true },
  { path: "/api/admin/launch-dashboard", method: "GET", category: "Admin", isProtected: true },

  // Protected — Core
  { path: "/api/students", method: "GET", category: "Core", isProtected: true },
  { path: "/api/subjects", method: "GET", category: "Core", isProtected: true },
  { path: "/api/homework", method: "GET", category: "Core", isProtected: true },
  { path: "/api/exams", method: "GET", category: "Core", isProtected: true },
  { path: "/api/attendance", method: "GET", category: "Core", isProtected: true },
  { path: "/api/notifications", method: "GET", category: "Core", isProtected: true },
  { path: "/api/announcements", method: "GET", category: "Core", isProtected: true },

  // Protected — Courses & Commerce
  { path: "/api/courses", method: "GET", category: "Courses", isProtected: false, expectedPublic: [200] },
  { path: "/api/teacher-courses", method: "GET", category: "Courses", isProtected: true },
  { path: "/api/courses/teacher/my", method: "GET", category: "Courses", isProtected: true },
  { path: "/api/admin/commerce/plans", method: "GET", category: "Commerce", isProtected: true },
  { path: "/api/question-bank", method: "GET", category: "Assessment", isProtected: true },
  { path: "/api/assessments", method: "GET", category: "Assessment", isProtected: true },
  { path: "/api/gradebook", method: "GET", category: "Assessment", isProtected: true },

  // Protected — AI/Tools
  { path: "/api/revision-notes", method: "GET", category: "AI Tools", isProtected: true },
  { path: "/api/flashcards/decks", method: "GET", category: "AI Tools", isProtected: true },
];

adminRouteHealthRouter.get("/", async (req, res) => {
  const token = (req as any).user?.token || (req.headers.authorization?.replace("Bearer ", "") || "");
  const results: RouteCheck[] = [];

  for (const check of ROUTE_CHECKS) {
    try {
      if (check.isProtected) {
        // Test without token (should return 401)
        const unauth = await checkRoute(check.path, check.method);
        // Test with token (should return 2xx or 4xx but not 401)
        const authed = await checkRoute(check.path, check.method, token);
        const protectionOk = unauth.code === 401 || unauth.code === 403;
        const accessible = authed.code >= 200 && authed.code < 500;
        results.push({
          path: check.path,
          method: check.method,
          category: check.category,
          status: protectionOk && accessible ? "pass" : protectionOk ? "warn" : "fail",
          httpCode: authed.code,
          isProtected: true,
          protectionOk,
          latencyMs: authed.latencyMs,
          note: !protectionOk ? `Auth bypass — got ${unauth.code} without token` : !accessible ? `Got ${authed.code} with valid token` : "",
        });
      } else {
        const result = await checkRoute(check.path, check.method);
        const expected = check.expectedPublic || [200];
        const ok = expected.includes(result.code);
        results.push({
          path: check.path,
          method: check.method,
          category: check.category,
          status: ok ? "pass" : "fail",
          httpCode: result.code,
          isProtected: false,
          protectionOk: true,
          latencyMs: result.latencyMs,
          note: !ok ? `Expected ${expected.join("/")} but got ${result.code}` : "",
        });
      }
    } catch (err: any) {
      results.push({
        path: check.path, method: check.method, category: check.category,
        status: "fail", httpCode: null, isProtected: check.isProtected,
        protectionOk: false, latencyMs: null, note: err?.message || "Exception during check",
      });
    }
  }

  const total = results.length;
  const passed = results.filter(r => r.status === "pass").length;
  const failed = results.filter(r => r.status === "fail").length;
  const warned = results.filter(r => r.status === "warn").length;
  const avgLatency = results.filter(r => r.latencyMs !== null).reduce((s, r) => s + (r.latencyMs || 0), 0) / total;

  res.json({
    summary: { total, passed, failed, warned, healthScore: Math.round((passed / total) * 100), avgLatencyMs: Math.round(avgLatency) },
    results,
    generatedAt: new Date().toISOString(),
  });
});
