import { useState, useCallback } from "react";
import {
  CheckCircle2, XCircle, Loader2, Play, RefreshCw,
  Activity, Clock, AlertTriangle, ChevronDown, ChevronRight,
} from "lucide-react";
import { useAuth } from "@/context/auth";
import { apiFetch } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";


interface TestCase {
  id: string;
  name: string;
  group: string;
  run: (token: string | null) => Promise<{ ok: boolean; detail?: string }>;
}

interface TestResult {
  id: string;
  status: "idle" | "running" | "pass" | "fail" | "skip";
  detail?: string;
  durationMs?: number;
}

async function checkEndpoint(
  path: string,
  method: "GET" | "POST" = "GET",
  body?: unknown,
  token?: string | null,
  expectStatus?: number,
): Promise<{ ok: boolean; detail?: string }> {
  const t0 = Date.now();
  try {
    const res = await apiFetch(path, {
      method,
      ...(body ? { body: JSON.stringify(body) } : {}),
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const duration = Date.now() - t0;
    const expected = expectStatus ?? (method === "POST" && !expectStatus ? 200 : 200);
    const ok = expectStatus ? res.status === expectStatus : res.ok;
    let text = "";
    try { text = await res.text(); } catch {}
    return { ok, detail: ok ? `${res.status} · ${duration}ms` : `Expected ${expected}, got ${res.status}: ${text.slice(0, 120)}` };
  } catch (e: any) {
    return { ok: false, detail: e.message ?? "Network error" };
  }
}

const TESTS: TestCase[] = [
  {
    id: "health_ok",
    name: "Health endpoint responds",
    group: "Infrastructure",
    run: async () => {
      const r = await checkEndpoint("/api/health");
      if (!r.ok) return r;
      try {
        const res = await apiFetch("/api/health");
        const data = await res.json();
        if (data.db !== "connected") return { ok: false, detail: `DB status: ${data.db}` };
        return { ok: true, detail: `uptime ${data.uptime}s · db ${data.dbLatencyMs}ms` };
      } catch (e: any) { return { ok: false, detail: e.message }; }
    },
  },
  {
    id: "health_db",
    name: "Database latency < 500ms",
    group: "Infrastructure",
    run: async () => {
      try {
        const res = await apiFetch("/api/health");
        const data = await res.json();
        const ok = data.dbLatencyMs < 500;
        return { ok, detail: `${data.dbLatencyMs}ms` };
      } catch (e: any) { return { ok: false, detail: e.message }; }
    },
  },
  {
    id: "landing_cms",
    name: "Landing CMS data loads",
    group: "Public API",
    run: async () => checkEndpoint("/api/landing"),
  },
  {
    id: "landing_stats",
    name: "Landing stats endpoint",
    group: "Public API",
    run: async () => checkEndpoint("/api/landing/stats"),
  },
  {
    id: "courses_public",
    name: "Course list is public",
    group: "Public API",
    run: async () => checkEndpoint("/api/courses"),
  },
  {
    id: "auth_invalid",
    name: "Invalid login returns 401",
    group: "Auth",
    run: async () => checkEndpoint(
      "/api/auth/login", "POST",
      { username: "__nonexistent_user__", password: "wrongpassword", captchaAnswer: "0" },
      null,
      401,
    ),
  },
  {
    id: "auth_no_token",
    name: "Protected route without token → 401",
    group: "Auth",
    run: async () => checkEndpoint("/api/students", "GET", undefined, null, 401),
  },
  {
    id: "students_authed",
    name: "Students list (admin auth)",
    group: "Admin API",
    run: async () => checkEndpoint("/api/students", "GET", undefined, null),
  },
  {
    id: "subjects_authed",
    name: "Subjects list (admin auth)",
    group: "Admin API",
    run: async () => checkEndpoint("/api/subjects", "GET", undefined, null),
  },
  {
    id: "data_quality",
    name: "Data quality report (admin)",
    group: "Admin API",
    run: async () => checkEndpoint("/api/admin/data-quality", "GET", undefined, null),
  },
  {
    id: "route_health",
    name: "Route health audit (admin)",
    group: "Admin API",
    run: async () => checkEndpoint("/api/admin/route-health", "GET", undefined, null),
  },
  {
    id: "error_log",
    name: "Error logging endpoint",
    group: "Error Handling",
    run: async () => checkEndpoint("/api/errors/log", "POST", {
      message: "Test Runner synthetic error",
      stack: "TestRunner.tsx",
      route: "/admin/test-runner",
      source: "TestRunner",
    }),
  },
  {
    id: "lessons_authed",
    name: "Lessons list (admin auth)",
    group: "Admin API",
    run: async () => checkEndpoint("/api/lessons", "GET", undefined, null),
  },
  {
    id: "homework_authed",
    name: "Homework endpoint (admin auth)",
    group: "Admin API",
    run: async () => checkEndpoint("/api/homework", "GET", undefined, null),
  },
  {
    id: "404_api",
    name: "Unknown API route → JSON 404",
    group: "Error Handling",
    run: async () => {
      try {
        const res = await apiFetch("/api/__no_such_route__");
        const ct = res.headers.get("content-type") ?? "";
        if (!ct.includes("json")) return { ok: false, detail: `Expected JSON, got ${ct}` };
        return { ok: res.status === 404, detail: `Content-Type: ${ct.split(";")[0]} · status ${res.status}` };
      } catch (e: any) { return { ok: false, detail: e.message }; }
    },
  },
];

const GROUPS = Array.from(new Set(TESTS.map((t) => t.group)));

function statusIcon(s: TestResult["status"]) {
  if (s === "pass") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (s === "fail") return <XCircle className="h-4 w-4 text-red-500" />;
  if (s === "running") return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  if (s === "skip") return <AlertTriangle className="h-4 w-4 text-amber-400" />;
  return <div className="h-4 w-4 rounded-full border-2 border-gray-200" />;
}

function statusBadge(s: TestResult["status"]) {
  const map: Record<string, string> = {
    pass: "bg-emerald-50 text-emerald-700",
    fail: "bg-red-50 text-red-600",
    running: "bg-primary/8 text-primary",
    skip: "bg-amber-50 text-amber-700",
    idle: "bg-gray-50 text-gray-400",
  };
  return map[s] ?? map.idle;
}

export default function TestRunner() {
  const { user } = useAuth();
  const token = null as string | null;
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [running, setRunning] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(GROUPS));

  const runAll = useCallback(async () => {
    setRunning(true);
    const fresh: Record<string, TestResult> = {};
    for (const t of TESTS) fresh[t.id] = { id: t.id, status: "idle" };
    setResults({ ...fresh });

    for (const test of TESTS) {
      setResults((prev) => ({ ...prev, [test.id]: { id: test.id, status: "running" } }));
      const t0 = Date.now();
      try {
        const r = await test.run(token);
        setResults((prev) => ({
          ...prev,
          [test.id]: { id: test.id, status: r.ok ? "pass" : "fail", detail: r.detail, durationMs: Date.now() - t0 },
        }));
      } catch (e: any) {
        setResults((prev) => ({
          ...prev,
          [test.id]: { id: test.id, status: "fail", detail: e.message, durationMs: Date.now() - t0 },
        }));
      }
    }
    setRunning(false);
  }, [token]);

  const runSingle = useCallback(async (test: TestCase) => {
    setResults((prev) => ({ ...prev, [test.id]: { id: test.id, status: "running" } }));
    const t0 = Date.now();
    try {
      const r = await test.run(token);
      setResults((prev) => ({
        ...prev,
        [test.id]: { id: test.id, status: r.ok ? "pass" : "fail", detail: r.detail, durationMs: Date.now() - t0 },
      }));
    } catch (e: any) {
      setResults((prev) => ({
        ...prev,
        [test.id]: { id: test.id, status: "fail", detail: e.message, durationMs: Date.now() - t0 },
      }));
    }
  }, [token]);

  const total = TESTS.length;
  const passed = Object.values(results).filter((r) => r.status === "pass").length;
  const failed = Object.values(results).filter((r) => r.status === "fail").length;
  const done = passed + failed;

  const toggleGroup = (g: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Test Runner</h1>
          <p className="text-sm text-gray-500 mt-1">
            Runs real API calls to verify platform health. Logged in as <strong>{user?.username}</strong>.
          </p>
        </div>
        <button
          onClick={runAll}
          disabled={running}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-opacity disabled:opacity-60 bg-primary text-primary-foreground"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? "Running…" : "Run All Tests"}
        </button>
      </div>

      {done > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Passed", value: passed, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Failed", value: failed, color: "text-red-600", bg: "bg-red-50" },
            { label: "Total", value: total, color: "text-gray-700", bg: "bg-gray-50" },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} rounded-xl p-4 text-center`}>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {done > 0 && (
        <div className="h-2 rounded-full bg-gray-100 mb-6 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: failed > 0 ? "#EF4444" : "hsl(var(--primary))" }}
            initial={{ width: 0 }}
            animate={{ width: `${(done / total) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      )}

      <div className="space-y-3">
        {GROUPS.map((group) => {
          const groupTests = TESTS.filter((t) => t.group === group);
          const expanded = expandedGroups.has(group);
          const gPassed = groupTests.filter((t) => results[t.id]?.status === "pass").length;
          const gFailed = groupTests.filter((t) => results[t.id]?.status === "fail").length;

          return (
            <div key={group} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
                onClick={() => toggleGroup(group)}
              >
                <div className="flex items-center gap-2.5">
                  <Activity className="h-4 w-4 text-gray-400" />
                  <span className="font-semibold text-sm text-gray-800">{group}</span>
                  {gPassed > 0 && (
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700">
                      {gPassed} pass
                    </span>
                  )}
                  {gFailed > 0 && (
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded-md bg-red-50 text-red-600">
                      {gFailed} fail
                    </span>
                  )}
                </div>
                {expanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
              </button>

              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <div className="divide-y divide-gray-50 border-t border-gray-100">
                      {groupTests.map((test) => {
                        const r = results[test.id];
                        const s = r?.status ?? "idle";
                        return (
                          <div key={test.id} className="flex items-center gap-3 px-5 py-3">
                            <div className="flex-shrink-0">{statusIcon(s)}</div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-gray-800">{test.name}</span>
                              {r?.detail && (
                                <p className={`text-xs mt-0.5 truncate ${s === "fail" ? "text-red-500" : "text-gray-400"}`}>
                                  {r.detail}
                                </p>
                              )}
                            </div>
                            {r?.durationMs != null && (
                              <span className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                                <Clock className="h-3 w-3" />{r.durationMs}ms
                              </span>
                            )}
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-md flex-shrink-0 ${statusBadge(s)}`}>
                              {s}
                            </span>
                            <button
                              onClick={() => runSingle(test)}
                              disabled={running}
                              className="flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-40"
                              title="Re-run this test"
                            >
                              <RefreshCw className="h-3.5 w-3.5 text-gray-400" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 mt-6 text-center">
        Tests make real API calls against the live backend. Results reflect actual system state.
      </p>
    </div>
  );
}
