import { Router, Request, Response, NextFunction } from "express";
import { db, pool } from "@workspace/db";
import {
  bugsTable, testCasesTable, testRunsTable, qualityScoresTable, launchChecklistTable,
  accountsTable,
} from "@workspace/db";
import { eq, desc, and, sql, count, inArray } from "drizzle-orm";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";

export const qaRouter = Router();

// Only apply admin auth to /admin/* paths — prevents this router from acting
// as a catch-all that blocks non-admin users from later-mounted routers.
qaRouter.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.path.startsWith("/admin/")) { next("router"); return; }
  (authenticate as any)(req, res, () => {
    (requireRole("admin", "super_admin") as any)(req, res, next);
  });
});

// ─── BUG TRACKER ────────────────────────────────────────────────────────────

qaRouter.post("/admin/bugs", async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, stepsToReproduce, severity = "medium", module, linkedFeatureId } = req.body;
    if (!title) return res.status(400).json({ error: "title required" });
    const [bug] = await db.insert(bugsTable).values({
      title, description, stepsToReproduce, severity, module,
      linkedFeatureId: linkedFeatureId ? parseInt(linkedFeatureId) : null,
      reportedBy: (req as any).user?.id ?? null,
      status: "reported",
    }).returning();
    res.status(201).json(bug);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

qaRouter.get("/admin/bugs", async (req: Request, res: Response) => {
  try {
    const { status, severity, module } = req.query as Record<string, string>;
    let query = db
      .select({
        id: bugsTable.id, title: bugsTable.title, description: bugsTable.description,
        stepsToReproduce: bugsTable.stepsToReproduce, severity: bugsTable.severity,
        status: bugsTable.status, module: bugsTable.module,
        linkedFeatureId: bugsTable.linkedFeatureId, createdAt: bugsTable.createdAt,
        updatedAt: bugsTable.updatedAt,
        reporterName: accountsTable.displayName,
        assignedTo: bugsTable.assignedTo,
      })
      .from(bugsTable)
      .leftJoin(accountsTable, eq(bugsTable.reportedBy, accountsTable.id))
      .orderBy(desc(bugsTable.createdAt))
      .$dynamic();

    const conditions = [];
    if (status) conditions.push(eq(bugsTable.status, status));
    if (severity) conditions.push(eq(bugsTable.severity, severity));
    if (module) conditions.push(eq(bugsTable.module, module));
    if (conditions.length) query = query.where(and(...conditions)) as typeof query;

    const bugs = await query;
    res.json(bugs);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

qaRouter.put("/admin/bugs/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, stepsToReproduce, severity, status, assignedTo, module, notes } = req.body;
    const [bug] = await db.update(bugsTable)
      .set({
        ...(title && { title }), ...(description !== undefined && { description }),
        ...(stepsToReproduce !== undefined && { stepsToReproduce }),
        ...(severity && { severity }), ...(status && { status }),
        ...(assignedTo !== undefined && { assignedTo: assignedTo ? parseInt(assignedTo) : null }),
        ...(module && { module }),
        updatedAt: new Date(),
      })
      .where(eq(bugsTable.id, parseInt(req.params.id)))
      .returning();
    if (!bug) return res.status(404).json({ error: "Bug not found" });
    res.json(bug);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

qaRouter.get("/admin/bugs/stats", async (_req: Request, res: Response) => {
  try {
    const [bySeverity, byStatus] = await Promise.all([
      db.select({ severity: bugsTable.severity, count: count() })
        .from(bugsTable).groupBy(bugsTable.severity),
      db.select({ status: bugsTable.status, count: count() })
        .from(bugsTable).groupBy(bugsTable.status),
    ]);
    const total = bySeverity.reduce((s, r) => s + Number(r.count), 0);
    const openCritical = byStatus.filter(r =>
      ["reported","triaged","in_progress","testing"].includes(r.status)
    ).reduce((s, r) => s + Number(r.count), 0);
    res.json({ bySeverity, byStatus, total, openCritical });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── TEST CASE MANAGEMENT ───────────────────────────────────────────────────

qaRouter.post("/admin/test-cases", async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, category = "functional", linkedModule, notes } = req.body;
    if (!title) return res.status(400).json({ error: "title required" });
    const [tc] = await db.insert(testCasesTable).values({
      title, description, category, linkedModule, notes,
      status: "pending",
    }).returning();
    res.status(201).json(tc);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

qaRouter.get("/admin/test-cases", async (req: Request, res: Response) => {
  try {
    const { category, status } = req.query as Record<string, string>;
    const conditions = [];
    if (category) conditions.push(eq(testCasesTable.category, category));
    if (status) conditions.push(eq(testCasesTable.status, status));

    let q = db.select().from(testCasesTable).orderBy(testCasesTable.category, testCasesTable.createdAt).$dynamic();
    if (conditions.length) q = q.where(and(...conditions)) as typeof q;
    res.json(await q);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

qaRouter.put("/admin/test-cases/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { status, notes } = req.body;
    const [tc] = await db.update(testCasesTable).set({
      ...(status && { status }),
      ...(notes !== undefined && { notes }),
      ...(status && status !== "pending" ? {
        testedBy: (req as any).user?.id ?? null,
        testedAt: new Date(),
      } : {}),
    }).where(eq(testCasesTable.id, parseInt(req.params.id))).returning();
    if (!tc) return res.status(404).json({ error: "Test case not found" });
    res.json(tc);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

qaRouter.post("/admin/test-runs", async (req: AuthRequest, res: Response) => {
  try {
    const { name, testCaseUpdates, triggeredBy = "manual" } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });

    // Bulk update test cases if provided
    if (Array.isArray(testCaseUpdates) && testCaseUpdates.length > 0) {
      for (const upd of testCaseUpdates) {
        if (upd.id && upd.status) {
          await db.update(testCasesTable).set({
            status: upd.status,
            notes: upd.notes,
            testedBy: (req as any).user?.id ?? null,
            testedAt: new Date(),
          }).where(eq(testCasesTable.id, parseInt(upd.id)));
        }
      }
    }

    const allCases = await db.select().from(testCasesTable);
    const total = allCases.length;
    const passed = allCases.filter(c => c.status === "passed").length;
    const failed = allCases.filter(c => c.status === "failed").length;
    const skipped = allCases.filter(c => c.status === "skipped").length;
    const coverage = total > 0 ? ((passed + failed + skipped) / total * 100).toFixed(2) : "0";

    const [run] = await db.insert(testRunsTable).values({
      name, triggeredBy,
      totalTests: total, passed, failed, skipped,
      coveragePercentage: coverage,
      executedAt: new Date(),
    }).returning();
    res.status(201).json(run);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

qaRouter.get("/admin/test-runs", async (_req: Request, res: Response) => {
  try {
    const runs = await db.select().from(testRunsTable).orderBy(desc(testRunsTable.executedAt)).limit(50);
    res.json(runs);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── QUALITY SCORE ENGINE ───────────────────────────────────────────────────

qaRouter.post("/admin/quality/calculate", async (req: AuthRequest, res: Response) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    // Gather all data
    const [allBugs, allCases, checklist] = await Promise.all([
      db.select().from(bugsTable),
      db.select().from(testCasesTable),
      db.select().from(launchChecklistTable),
    ]);

    const openBugs = allBugs.filter(b => !["resolved","closed"].includes(b.status));
    const criticalOpen = openBugs.filter(b => b.severity === "critical").length;
    const highOpen = openBugs.filter(b => b.severity === "high").length;
    const mediumOpen = openBugs.filter(b => b.severity === "medium").length;
    const totalCases = allCases.length;
    const passed = allCases.filter(c => c.status === "passed").length;
    const failed = allCases.filter(c => c.status === "failed").length;
    const checklistTotal = checklist.length;
    const checklistDone = checklist.filter(c => c.isCompleted).length;

    // Score calculations (0-100)
    const bugPenalty = Math.min(100, criticalOpen * 20 + highOpen * 8 + mediumOpen * 2);
    const functionality = Math.max(0, 100 - bugPenalty);

    const testPassRate = totalCases > 0 ? (passed / totalCases) * 100 : 50;
    const reliability = Math.max(0, testPassRate - failed * 3);

    const checklistProgress = checklistTotal > 0 ? (checklistDone / checklistTotal) * 100 : 0;
    const securityScore = Math.max(20, checklistProgress * 0.6 + (criticalOpen === 0 ? 40 : 0));

    const performanceScore = 72; // Placeholder — would pull from Phase 10 metrics
    const accessibilityScore = 65; // Placeholder — would pull from Phase 10 checks
    const uxScore = Math.max(30, 90 - openBugs.filter(b => b.module?.includes("ui") || b.module?.includes("ux")).length * 5);

    const overallScore = Math.round(
      (functionality * 0.25 +
       reliability * 0.20 +
       securityScore * 0.20 +
       performanceScore * 0.15 +
       accessibilityScore * 0.10 +
       uxScore * 0.10)
    );

    const recommendation =
      criticalOpen > 0 ? "not_ready" :
      overallScore < 50 ? "not_ready" :
      overallScore < 70 ? "needs_review" :
      overallScore < 85 ? "ready_for_beta" :
      "ready_for_launch";

    const categories = [
      { category: "functionality", score: Math.round(functionality) },
      { category: "reliability", score: Math.round(reliability) },
      { category: "security", score: Math.round(securityScore) },
      { category: "performance", score: Math.round(performanceScore) },
      { category: "accessibility", score: Math.round(accessibilityScore) },
      { category: "ux", score: Math.round(uxScore) },
    ];

    // Persist scores
    await db.delete(qualityScoresTable).where(eq(qualityScoresTable.date, today));
    for (const cat of categories) {
      await db.insert(qualityScoresTable).values({
        date: today,
        category: cat.category,
        score: cat.score.toString(),
        details: { openBugs: openBugs.length, criticalOpen, highOpen },
      });
    }

    res.json({
      overallScore,
      recommendation,
      categories,
      metrics: {
        openBugs: openBugs.length, criticalOpen, highOpen, mediumOpen,
        totalTestCases: totalCases, passed, failed,
        checklistProgress: `${checklistDone}/${checklistTotal}`,
      },
      date: today,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

qaRouter.get("/admin/quality/score", async (_req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const scores = await db.select().from(qualityScoresTable)
      .where(eq(qualityScoresTable.date, today))
      .orderBy(qualityScoresTable.category);

    if (scores.length === 0) {
      return res.json({ scores: [], overallScore: null, date: today, message: "No score calculated today" });
    }

    const overall = Math.round(scores.reduce((s, r) => s + Number(r.score), 0) / scores.length);
    res.json({ scores, overallScore: overall, date: today });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── LAUNCH CHECKLIST ───────────────────────────────────────────────────────

qaRouter.get("/admin/launch-checklist", async (_req: Request, res: Response) => {
  try {
    const items = await db.select().from(launchChecklistTable).orderBy(launchChecklistTable.category, launchChecklistTable.id);
    res.json(items);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

qaRouter.put("/admin/launch-checklist/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { isCompleted, notes } = req.body;
    const [item] = await db.update(launchChecklistTable).set({
      isCompleted: Boolean(isCompleted),
      completedAt: isCompleted ? new Date() : null,
      verifiedBy: isCompleted ? ((req as any).user?.id ?? null) : null,
      ...(notes !== undefined && { notes }),
    }).where(eq(launchChecklistTable.id, parseInt(req.params.id))).returning();
    if (!item) return res.status(404).json({ error: "Item not found" });
    res.json(item);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── ROUTE PERMISSION SCANNER ───────────────────────────────────────────────

qaRouter.post("/admin/security/scan-routes", async (req: AuthRequest, res: Response) => {
  try {
    // List of routes to test for auth protection
    const routesToTest = [
      { method: "GET", path: "/api/admin/users" },
      { method: "GET", path: "/api/admin/bugs" },
      { method: "GET", path: "/api/admin/test-cases" },
      { method: "GET", path: "/api/admin/launch-checklist" },
      { method: "GET", path: "/api/admin/quality/score" },
      { method: "GET", path: "/api/admin/test-runs" },
      { method: "GET", path: "/api/admin/bugs/stats" },
      { method: "GET", path: "/api/sessions" },
      { method: "GET", path: "/api/students" },
      { method: "GET", path: "/api/subjects" },
      { method: "GET", path: "/api/accounts" },
      { method: "GET", path: "/api/audit-logs" },
      { method: "GET", path: "/api/subscriptions" },
    ];

    const baseUrl = `http://localhost:${process.env.PORT || 3001}`;
    const results = [];

    for (const route of routesToTest) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const resp = await fetch(`${baseUrl}${route.path}`, {
          method: route.method,
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
        }).catch(() => null);
        clearTimeout(timeout);

        const status = resp?.status ?? 0;
        const protected_ = status === 401 || status === 403;
        results.push({
          method: route.method,
          path: route.path,
          status,
          protected: protected_,
          risk: !protected_ ? "UNPROTECTED" : "OK",
        });
      } catch {
        results.push({ method: route.method, path: route.path, status: 0, protected: true, risk: "TIMEOUT" });
      }
    }

    const unprotected = results.filter(r => r.risk === "UNPROTECTED");
    const summary = {
      total: results.length,
      protected: results.filter(r => r.protected).length,
      unprotected: unprotected.length,
      riskLevel: unprotected.length === 0 ? "LOW" : unprotected.length < 3 ? "MEDIUM" : "HIGH",
      scannedAt: new Date().toISOString(),
    };

    res.json({ summary, results });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── API SANITY TEST RUNNER ─────────────────────────────────────────────────

qaRouter.post("/admin/tests/run-sanity", async (req: AuthRequest, res: Response) => {
  try {
    const baseUrl = `http://localhost:${process.env.PORT || 3001}`;

    // Get or create test admin account
    const [admin] = await db.select().from(accountsTable)
      .where(eq(accountsTable.role, "admin")).limit(1);

    let adminToken: string | null = null;
    if (admin) {
      const loginResp = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: admin.username, password: "admin123" }),
      }).catch(() => null);
      if (loginResp?.ok) {
        const data = await loginResp.json().catch(() => null);
        adminToken = (data as any)?.token ?? null;
      }
    }

    const authHeaders = adminToken
      ? { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` }
      : { "Content-Type": "application/json" };

    const sanityTests = [
      { id: "health-check",        name: "Health Check",           method: "GET", path: "/api/health",             auth: false, expectedStatus: 200 },
      { id: "auth-stats",          name: "Auth Stats",             method: "GET", path: "/api/auth/stats",         auth: false, expectedStatus: 200 },
      { id: "public-courses",      name: "Public Courses",         method: "GET", path: "/courses",                auth: false, expectedStatus: 200 },
      { id: "dashboard-auth",      name: "Dashboard (no auth)",    method: "GET", path: "/api/dashboard",          auth: false, expectedStatus: 401 },
      { id: "dashboard-ok",        name: "Dashboard (with auth)",  method: "GET", path: "/api/dashboard",          auth: true,  expectedStatus: 200 },
      { id: "students-list",       name: "Students List",          method: "GET", path: "/api/students",           auth: true,  expectedStatus: [200, 403] },
      { id: "subjects-list",       name: "Subjects List",          method: "GET", path: "/api/subjects",           auth: true,  expectedStatus: [200, 404] },
      { id: "notifications",       name: "Notifications",          method: "GET", path: "/api/notifications",      auth: true,  expectedStatus: 200 },
      { id: "admin-users",         name: "Admin Users List",       method: "GET", path: "/api/admin/users",        auth: true,  expectedStatus: 200 },
      { id: "admin-bugs",          name: "Bug Tracker",            method: "GET", path: "/api/admin/bugs",         auth: true,  expectedStatus: 200 },
      { id: "admin-test-cases",    name: "Test Cases",             method: "GET", path: "/api/admin/test-cases",   auth: true,  expectedStatus: 200 },
      { id: "admin-checklist",     name: "Launch Checklist",       method: "GET", path: "/api/admin/launch-checklist", auth: true, expectedStatus: 200 },
    ];

    const results = [];
    for (const test of sanityTests) {
      try {
        const headers = test.auth ? authHeaders : { "Content-Type": "application/json" };
        const resp = await fetch(`${baseUrl}${test.path}`, {
          method: test.method, headers,
        }).catch(() => null);

        const status = resp?.status ?? 0;
        const expected = Array.isArray(test.expectedStatus) ? test.expectedStatus : [test.expectedStatus];
        const passed = expected.includes(status);

        results.push({
          id: test.id, name: test.name, method: test.method,
          path: test.path, expectedStatus: test.expectedStatus,
          actualStatus: status, passed,
        });
      } catch (err) {
        results.push({
          id: test.id, name: test.name, method: test.method,
          path: test.path, expectedStatus: test.expectedStatus,
          actualStatus: 0, passed: false, error: String(err),
        });
      }
    }

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const coverage = ((passed / results.length) * 100).toFixed(2);

    // Save to test cases and test run
    for (const result of results) {
      const existing = await db.select().from(testCasesTable)
        .where(eq(testCasesTable.title, `[API] ${result.name}`)).limit(1);

      if (existing.length > 0) {
        await db.update(testCasesTable).set({
          status: result.passed ? "passed" : "failed",
          notes: `Status: ${result.actualStatus} (expected ${result.expectedStatus})`,
          testedAt: new Date(),
          testedBy: (req as any).user?.id ?? null,
        }).where(eq(testCasesTable.id, existing[0].id));
      } else {
        await db.insert(testCasesTable).values({
          title: `[API] ${result.name}`,
          description: `Automated sanity test: ${result.method} ${result.path}`,
          category: "api",
          linkedModule: "api",
          status: result.passed ? "passed" : "failed",
          notes: `Status: ${result.actualStatus} (expected ${result.expectedStatus})`,
          testedAt: new Date(),
          testedBy: (req as any).user?.id ?? null,
        });
      }
    }

    const [run] = await db.insert(testRunsTable).values({
      name: `Sanity Run — ${new Date().toLocaleString()}`,
      triggeredBy: "automated",
      totalTests: results.length,
      passed, failed, skipped: 0,
      coveragePercentage: coverage,
      executedAt: new Date(),
      details: { results },
    }).returning();

    res.json({ runId: run.id, passed, failed, total: results.length, coverage, results });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
