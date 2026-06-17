import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { requireRole } from "../middleware/auth";

export const learningEfficiencyRouter = Router();
learningEfficiencyRouter.use(requireRole("admin", "super_admin") as any);

/* GET /api/admin/learning-efficiency */
learningEfficiencyRouter.get("/", async (req, res: Response) => {
  try {
    const subject = req.query.subject as string | undefined;

    const [activityRows, subjectRows, trendRows, summaryRows] = await Promise.all([
      pool.query(`
        SELECT
          'assessments' as type,
          COUNT(DISTINCT s.student_account_id) as sessions,
          COUNT(DISTINCT CASE WHEN s.score IS NOT NULL AND s.score > 50 THEN s.student_account_id END) as students_improved,
          COALESCE(AVG(s.score), 0) as avg_improvement
        FROM student_assessments s
        WHERE s.submitted_at > NOW() - INTERVAL '90 days'
        ${subject ? `AND s.assessment_id IN (SELECT id FROM assessments WHERE title ILIKE '%${subject.replace(/'/g, "''")}%')` : ""}
      `).catch(() => ({ rows: [] })),

      pool.query(`
        SELECT
          COALESCE(sub.name, 'General') as subject,
          ROUND(AVG(sa.score)::numeric, 1) as avg_score,
          COUNT(DISTINCT sa.student_account_id) as students_active
        FROM student_assessments sa
        LEFT JOIN assessments a ON a.id = sa.assessment_id
        LEFT JOIN subjects sub ON sub.id = a.subject_id
        WHERE sa.submitted_at > NOW() - INTERVAL '90 days'
          AND sa.score IS NOT NULL
        GROUP BY sub.name
        ORDER BY avg_score DESC
        LIMIT 10
      `).catch(() => ({ rows: [] })),

      pool.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('week', submitted_at), 'Mon DD') as week,
          COUNT(*) as assessments
        FROM student_assessments
        WHERE submitted_at > NOW() - INTERVAL '8 weeks'
        GROUP BY week
        ORDER BY MIN(submitted_at)
      `).catch(() => ({ rows: [] })),

      pool.query(`
        SELECT
          COUNT(DISTINCT student_account_id) as active_students,
          ROUND(AVG(score)::numeric, 1) as avg_improvement_pct,
          COUNT(*) as sessions_this_week
        FROM student_assessments
        WHERE submitted_at > NOW() - INTERVAL '7 days'
          AND score IS NOT NULL
      `).catch(() => ({ rows: [{ active_students: 0, avg_improvement_pct: 0, sessions_this_week: 0 }] })),
    ]);

    const activityEfficiency = [
      {
        type: "assessments",
        avgImprovement: parseFloat(activityRows.rows[0]?.avg_improvement ?? "0"),
        sessions: parseInt(activityRows.rows[0]?.sessions ?? "0"),
        studentsImproved: parseInt(activityRows.rows[0]?.students_improved ?? "0"),
      },
    ].filter(a => a.sessions > 0);

    const subjectBreakdown = subjectRows.rows.map((r: any) => ({
      subject: r.subject,
      avgScore: parseFloat(r.avg_score ?? "0"),
      studentsActive: parseInt(r.students_active ?? "0"),
    }));

    const weeklyTrend = trendRows.rows.map((r: any) => ({
      week: r.week,
      assessments: parseInt(r.assessments ?? "0"),
      flashcards: 0,
      practice_questions: 0,
    }));

    const sum = summaryRows.rows[0] ?? {};
    const summary = {
      activeStudents: parseInt(sum.active_students ?? "0"),
      avgImprovementPct: parseFloat(sum.avg_improvement_pct ?? "0"),
      topActivity: activityEfficiency.sort((a, b) => b.avgImprovement - a.avgImprovement)[0]?.type ?? null,
      sessionsThisWeek: parseInt(sum.sessions_this_week ?? "0"),
    };

    res.json({ activityEfficiency, subjectBreakdown, weeklyTrend, summary, topPerformers: [] });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});
