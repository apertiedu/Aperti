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
    res.status(500).json({ error: "An unexpected error occurred" });
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
    res.status(500).json({ error: "An unexpected error occurred" });
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

// GET /coremind/analytics/confidence-trend — Daily avg AI confidence over last 30 days, by module
coremindAnalyticsRouter.get("/analytics/confidence-trend", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { pool } = await import("@workspace/db");
    const days = parseInt(String(req.query.days ?? "30"));
    const clampedDays = Math.min(Math.max(days, 7), 90);

    const { rows } = await pool.query(`
      SELECT
        DATE_TRUNC('day', created_at AT TIME ZONE 'UTC')::date AS day,
        module,
        ROUND(AVG(confidence::numeric) * 100, 1)              AS avg_confidence_pct,
        COUNT(*)::int                                          AS call_count,
        COUNT(*) FILTER (WHERE accepted = true)::int           AS accepted_count,
        COUNT(*) FILTER (WHERE accepted = false)::int          AS rejected_count
      FROM ai_interactions
      WHERE
        created_at >= NOW() - ($1 || ' days')::interval
        AND confidence IS NOT NULL
      GROUP BY 1, 2
      ORDER BY 1 ASC, 2
    `, [clampedDays]);

    // Build a sorted list of unique dates
    const dateSet = new Set<string>(rows.map((r: any) => String(r.day)));
    const dates = Array.from(dateSet).sort();

    // Build per-module series
    const moduleSet = new Set<string>(rows.map((r: any) => String(r.module)));
    const modules = Array.from(moduleSet);

    // Combined daily avg across all modules
    const byDate: Record<string, { sumConf: number; count: number; accepted: number; rejected: number }> = {};
    for (const r of rows) {
      const d = String(r.day);
      if (!byDate[d]) byDate[d] = { sumConf: 0, count: 0, accepted: 0, rejected: 0 };
      byDate[d].sumConf  += parseFloat(r.avg_confidence_pct) * parseInt(r.call_count);
      byDate[d].count    += parseInt(r.call_count);
      byDate[d].accepted += parseInt(r.accepted_count);
      byDate[d].rejected += parseInt(r.rejected_count);
    }

    const overall = dates.map(d => ({
      date: d,
      avgConfidencePct: byDate[d].count > 0
        ? Math.round(byDate[d].sumConf / byDate[d].count * 10) / 10
        : null,
      calls:    byDate[d].count,
      accepted: byDate[d].accepted,
      rejected: byDate[d].rejected,
      acceptanceRate: byDate[d].count > 0
        ? Math.round(byDate[d].accepted / byDate[d].count * 100)
        : null,
    }));

    // Per-module series (for multi-line chart)
    const byModule: Record<string, Array<{ date: string; avgConfidencePct: number | null; calls: number }>> = {};
    for (const mod of modules) {
      const modRows = rows.filter((r: any) => r.module === mod);
      const modByDate: Record<string, { sumConf: number; count: number }> = {};
      for (const r of modRows) {
        const d = String(r.day);
        modByDate[d] = {
          sumConf: parseFloat(r.avg_confidence_pct) * parseInt(r.call_count),
          count:   parseInt(r.call_count),
        };
      }
      byModule[mod] = dates.map(d => ({
        date: d,
        avgConfidencePct: modByDate[d]
          ? Math.round(modByDate[d].sumConf / modByDate[d].count * 10) / 10
          : null,
        calls: modByDate[d]?.count ?? 0,
      }));
    }

    res.json({ overall, byModule, modules, dates, windowDays: clampedDays });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// GET /coremind/analytics/impact — Student Impact Score (Mentor users vs non-users grade comparison)
coremindAnalyticsRouter.get("/analytics/impact", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    // Get distinct student user IDs who have used Mentor
    const mentorUsers = await db
      .selectDistinct({ userId: aiInteractionsTable.userId })
      .from(aiInteractionsTable)
      .where(eq(aiInteractionsTable.module, "mentor"));

    const mentorUserIds = mentorUsers.map(r => r.userId).filter(Boolean) as number[];

    // Raw SQL for grade comparison — students who use Mentor vs those who don't
    const { pool } = await import("@workspace/db");

    const { rows: gradeStats } = await pool.query(`
      WITH student_grades AS (
        SELECT
          sm.student_id,
          ROUND(SUM(sm.marks_scored)::numeric / NULLIF(SUM(eq.max_marks),0) * 100, 1) AS grade_pct
        FROM student_marks sm
        JOIN exam_questions eq ON eq.id = sm.question_id
        GROUP BY sm.student_id
        HAVING SUM(eq.max_marks) > 0
      )
      SELECT
        COUNT(*)::int AS total_students,
        ROUND(AVG(grade_pct), 1) AS overall_avg
      FROM student_grades
    `);

    let mentorAvg = 0, nonMentorAvg = 0, mentorCount = 0, nonMentorCount = 0;

    if (mentorUserIds.length > 0) {
      // Get student records for mentor users (users → accounts → students)
      const { rows: mentorGrades } = await pool.query(`
        WITH mentor_students AS (
          SELECT s.id AS student_id
          FROM students s
          WHERE s.account_id = ANY($1::int[])
        ),
        student_grades AS (
          SELECT sm.student_id,
            ROUND(SUM(sm.marks_scored)::numeric / NULLIF(SUM(eq.max_marks),0) * 100, 1) AS grade_pct
          FROM student_marks sm
          JOIN exam_questions eq ON eq.id = sm.question_id
          WHERE sm.student_id IN (SELECT student_id FROM mentor_students)
          GROUP BY sm.student_id
          HAVING SUM(eq.max_marks) > 0
        )
        SELECT COUNT(*)::int AS cnt, ROUND(AVG(grade_pct),1) AS avg_grade FROM student_grades
      `, [mentorUserIds]);

      const { rows: nonMentorGrades } = await pool.query(`
        WITH mentor_students AS (
          SELECT s.id AS student_id
          FROM students s
          WHERE s.account_id = ANY($1::int[])
        ),
        student_grades AS (
          SELECT sm.student_id,
            ROUND(SUM(sm.marks_scored)::numeric / NULLIF(SUM(eq.max_marks),0) * 100, 1) AS grade_pct
          FROM student_marks sm
          JOIN exam_questions eq ON eq.id = sm.question_id
          WHERE sm.student_id NOT IN (SELECT student_id FROM mentor_students)
          GROUP BY sm.student_id
          HAVING SUM(eq.max_marks) > 0
        )
        SELECT COUNT(*)::int AS cnt, ROUND(AVG(grade_pct),1) AS avg_grade FROM student_grades
      `, [mentorUserIds]);

      mentorAvg = parseFloat(mentorGrades[0]?.avg_grade ?? "0");
      nonMentorAvg = parseFloat(nonMentorGrades[0]?.avg_grade ?? "0");
      mentorCount = parseInt(mentorGrades[0]?.cnt ?? "0");
      nonMentorCount = parseInt(nonMentorGrades[0]?.cnt ?? "0");
    }

    const overallAvg = parseFloat(gradeStats[0]?.overall_avg ?? "0");
    const totalStudents = parseInt(gradeStats[0]?.total_students ?? "0");
    const impactDelta = mentorCount > 0 && nonMentorCount > 0 ? Math.round((mentorAvg - nonMentorAvg) * 10) / 10 : null;

    res.json({
      mentorUsers: mentorUserIds.length,
      mentorCount,
      nonMentorCount,
      mentorAvgGrade: mentorAvg,
      nonMentorAvgGrade: nonMentorAvg,
      overallAvg,
      totalStudents,
      impactDelta,
      impactMessage: impactDelta !== null
        ? impactDelta > 0
          ? `Students using The Mentor score ${impactDelta}% higher on average than those who don't.`
          : impactDelta < 0
          ? `Mentor users are scoring ${Math.abs(impactDelta)}% lower — they may be higher-risk students self-selecting into AI help.`
          : "No measurable grade difference yet — more data needed."
        : "Not enough data to compute impact. Students need AI interaction history and exam results.",
    });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});
