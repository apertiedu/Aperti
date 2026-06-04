import { Router, Response } from "express";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { db } from "@workspace/db";
import { aiInteractionsTable } from "@workspace/db";
import { eq, isNull, isNotNull, count, avg, sql } from "drizzle-orm";

export const coremindAnalyticsRouter = Router();

// GET /coremind/analytics/stats — AI usage + acceptance stats (admin only)
coremindAnalyticsRouter.get("/analytics/stats", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const allInteractions = await db.select().from(aiInteractionsTable).limit(5000);

    const byModule: Record<string, { total: number; accepted: number; rejected: number; pending: number; avgConfidence: number }> = {};
    for (const row of allInteractions) {
      const mod = row.module || "unknown";
      if (!byModule[mod]) byModule[mod] = { total: 0, accepted: 0, rejected: 0, pending: 0, avgConfidence: 0 };
      byModule[mod].total++;
      if (row.accepted === true) byModule[mod].accepted++;
      else if (row.accepted === false) byModule[mod].rejected++;
      else byModule[mod].pending++;
      byModule[mod].avgConfidence += parseFloat(String(row.confidence ?? 0));
    }
    for (const mod of Object.keys(byModule)) {
      byModule[mod].avgConfidence = byModule[mod].total > 0
        ? Math.round((byModule[mod].avgConfidence / byModule[mod].total) * 100) / 100
        : 0;
    }

    const totalCalls = allInteractions.length;
    const totalAccepted = allInteractions.filter(r => r.accepted === true).length;
    const totalRejected = allInteractions.filter(r => r.accepted === false).length;
    const totalPending = allInteractions.filter(r => r.accepted === null).length;
    const overallAcceptanceRate = totalCalls > 0 ? Math.round((totalAccepted / (totalAccepted + totalRejected || 1)) * 100) : 0;

    const avgConfidence = totalCalls > 0
      ? Math.round(allInteractions.reduce((s, r) => s + parseFloat(String(r.confidence ?? 0)), 0) / totalCalls * 100) / 100
      : 0;

    const totalTokens = allInteractions.reduce((s, r) => s + (r.tokensUsed ?? 0), 0);
    const estimatedCostUSD = Math.round(totalTokens * 0.00000015 * 100) / 100;

    const last7Days = new Date(Date.now() - 7 * 86400000);
    const recentCalls = allInteractions.filter(r => new Date(r.createdAt) > last7Days).length;

    const callsPerDay: Record<string, number> = {};
    for (const row of allInteractions) {
      const day = new Date(row.createdAt).toISOString().split("T")[0];
      callsPerDay[day] = (callsPerDay[day] ?? 0) + 1;
    }
    const callsTimeline = Object.entries(callsPerDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, calls]) => ({ date, calls }));

    res.json({
      totalCalls,
      totalAccepted,
      totalRejected,
      totalPending,
      overallAcceptanceRate,
      avgConfidence,
      totalTokens,
      estimatedCostUSD,
      recentCallsLast7Days: recentCalls,
      byModule,
      callsTimeline,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /coremind/safety/pending — AI interactions pending review
coremindAnalyticsRouter.get("/safety/pending", authenticate, requireRole("admin", "teacher"), async (req: AuthRequest, res: Response) => {
  try {
    const pending = await db.select().from(aiInteractionsTable)
      .where(isNull(aiInteractionsTable.accepted))
      .orderBy(aiInteractionsTable.createdAt)
      .limit(100);
    res.json(pending);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /coremind/safety/review/:id — mark an interaction as accepted or rejected
coremindAnalyticsRouter.post("/safety/review/:id", authenticate, requireRole("admin", "teacher"), async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const { accepted } = req.body;
  await db.update(aiInteractionsTable)
    .set({ accepted: accepted === true })
    .where(eq(aiInteractionsTable.id, id));
  res.json({ success: true });
});
