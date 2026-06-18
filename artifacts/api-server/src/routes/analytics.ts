import { Router, Response } from "express";
import { db, pool } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import { eq, and, sql, inArray } from "drizzle-orm";

export const analyticsRouter = Router();

// GET /analytics/class-overview — teacher's whole-class summary
analyticsRouter.get("/class-overview", authenticate, async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;

  // 1. Students count
  const students = await db.query.students.findMany({
    where: (s, { eq }) => eq(s.teacherAccountId, teacherId),
  });

  // 2. Attendance rate (last 30 days) — scoped to this teacher's students only
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const studentIds = students.map(s => s.id);
  const attendanceRecords = studentIds.length > 0
    ? await db.query.attendance.findMany({
        where: (a, { gte, inArray, and }) => and(
          gte(a.date, thirtyDaysAgo),
          inArray(a.studentId, studentIds),
        ),
      })
    : [];
  const present = attendanceRecords.filter(a => a.status === "Present").length;
  const totalRecs = attendanceRecords.length;
  const attendanceRate = totalRecs > 0 ? Math.round((present / totalRecs) * 100) : 0;

  // 3. Weak topics (aggregated from Echo)
  const memoryRecords = await db.query.echoMemory.findMany({
    where: (m, { inArray }) => inArray(m.studentId, students.map(s => s.id)),
  });
  const weakTopicCounts: Record<string, number> = {};
  memoryRecords.forEach(m => {
    const topics = (m.weakTopics as string[]) ?? [];
    topics.forEach(t => { weakTopicCounts[t] = (weakTopicCounts[t] || 0) + 1; });
  });
  const weakTopics = Object.entries(weakTopicCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([topic, count]) => ({ topic, count }));

  // 4. Recent exam average — single aggregation query instead of N+1
  const exams = await db.query.exams.findMany({
    where: (e, { eq }) => eq(e.teacherAccountId, teacherId),
    orderBy: (e, { desc }) => [desc(e.createdAt)],
    limit: 5,
  });
  let recentExamAverages: { examId: number; examName: string; average: number }[] = [];
  if (exams.length > 0) {
    const examIds = exams.map(e => e.id);
    const { rows: markRows } = await pool.query<{ exam_id: number; avg: string }>(
      `SELECT exam_id, ROUND(AVG(marks_scored::float)::numeric, 0)::text AS avg
       FROM student_marks WHERE exam_id = ANY($1) GROUP BY exam_id`,
      [examIds],
    );
    const markMap = new Map(markRows.map(r => [r.exam_id, parseFloat(r.avg ?? "0")]));
    recentExamAverages = exams.map(exam => ({
      examId: exam.id,
      examName: exam.name,
      average: Math.round(markMap.get(exam.id) ?? 0),
    }));
  }

  res.json({
    studentCount: students.length,
    attendanceRate,
    weakTopics,
    recentExamAverages,
  });
});

// GET /analytics/student/:studentId — individual student report
analyticsRouter.get("/analytics/student/:studentId", authenticate, async (req: AuthRequest, res: Response) => {
  const studentId = parseInt(req.params.studentId);

  const memory = await db.query.echoMemory.findFirst({ where: (m, { eq }) => eq(m.studentId, studentId) });
  const attendance = await db.query.attendance.findMany({ where: (a, { eq }) => eq(a.studentId, studentId), limit: 30 });
  const presentCount = attendance.filter(a => a.status === "Present").length;

  res.json({
    weakTopics: memory?.weakTopics ?? [],
    strongTopics: memory?.strongTopics ?? [],
    learningPace: memory?.learningPace ?? "medium",
    attendanceRate: attendance.length > 0 ? Math.round((presentCount / attendance.length) * 100) : 0,
    burnoutRisk: memory?.burnoutRisk ?? 0,
  });
});

// GET /analytics/grade-distribution — real grade distribution from exam marks
analyticsRouter.get("/grade-distribution", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.userId!;
    const { pool } = await import("@workspace/db");
    const { rows } = await pool.query(`
      SELECT
        CASE
          WHEN (sm.score::numeric / NULLIF(sm.max_score::numeric, 0)) * 100 >= 90 THEN 'A*'
          WHEN (sm.score::numeric / NULLIF(sm.max_score::numeric, 0)) * 100 >= 80 THEN 'A'
          WHEN (sm.score::numeric / NULLIF(sm.max_score::numeric, 0)) * 100 >= 70 THEN 'B'
          WHEN (sm.score::numeric / NULLIF(sm.max_score::numeric, 0)) * 100 >= 60 THEN 'C'
          WHEN (sm.score::numeric / NULLIF(sm.max_score::numeric, 0)) * 100 >= 50 THEN 'D'
          ELSE 'U'
        END AS grade,
        COUNT(*)::int AS count
      FROM student_marks sm
      JOIN exams e ON e.id = sm.exam_id
      WHERE e.teacher_account_id = $1
        AND sm.created_at >= NOW() - INTERVAL '90 days'
        AND sm.score IS NOT NULL
        AND sm.max_score IS NOT NULL
        AND sm.max_score::numeric > 0
      GROUP BY 1
      ORDER BY ARRAY_POSITION(ARRAY['A*','A','B','C','D','U'], grade)
    `, [teacherId]).catch(() => ({ rows: [] }));
    res.json({ grades: rows, hasSufficientData: rows.length > 0 });
  } catch {
    res.status(500).json({ error: "Failed to fetch grade distribution" });
  }
});

// GET /analytics/student-scores — per-student engagement/risk/consistency scores
analyticsRouter.get("/student-scores", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.userId!;
    const { pool } = await import("@workspace/db");

    const { rows } = await pool.query(`
      WITH student_base AS (
        SELECT s.id, a.display_name, s.student_code
        FROM students s
        JOIN accounts a ON a.id = s.account_id
        WHERE s.teacher_account_id = $1 AND s.status = 'active'
        LIMIT 100
      ),
      att_stats AS (
        SELECT att.student_id,
          COALESCE(ROUND(100.0 * SUM(CASE WHEN att.status IN ('present','Present') THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)), 0) AS att_pct,
          COUNT(*) AS att_total
        FROM attendance att
        JOIN student_base sb ON sb.id = att.student_id
        WHERE att.date >= NOW() - INTERVAL '30 days'
        GROUP BY att.student_id
      ),
      hw_stats AS (
        SELECT hs.student_id,
          COUNT(hs.id)::int AS submitted,
          COUNT(h.id)::int AS total_assigned
        FROM homework h
        JOIN student_base sb ON sb.id = ANY(
          SELECT s2.id FROM students s2 WHERE s2.teacher_account_id = $1
        )
        LEFT JOIN homework_submissions hs ON hs.homework_id = h.id AND hs.student_id = sb.id
        WHERE h.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY hs.student_id
      ),
      exam_stats AS (
        SELECT sm.student_id,
          ROUND(AVG(sm.score::numeric / NULLIF(sm.max_score::numeric,0) * 100)) AS avg_score,
          COUNT(sm.id) AS exam_count
        FROM student_marks sm
        JOIN exams e ON e.id = sm.exam_id
        WHERE e.teacher_account_id = $1
          AND sm.created_at >= NOW() - INTERVAL '60 days'
          AND sm.score IS NOT NULL AND sm.max_score::numeric > 0
        GROUP BY sm.student_id
      )
      SELECT
        sb.id,
        sb.display_name,
        sb.student_code,
        COALESCE(att.att_pct, 0) AS attendance_pct,
        COALESCE(hw.submitted, 0) AS hw_submitted,
        COALESCE(hw.total_assigned, 0) AS hw_total,
        COALESCE(ex.avg_score, 0) AS avg_exam_score,
        COALESCE(ex.exam_count, 0) AS exam_count
      FROM student_base sb
      LEFT JOIN att_stats att ON att.student_id = sb.id
      LEFT JOIN hw_stats hw ON hw.student_id = sb.id
      LEFT JOIN exam_stats ex ON ex.student_id = sb.id
      ORDER BY sb.display_name
    `, [teacherId]).catch(() => ({ rows: [] }));

    const students = rows.map((r: any) => {
      const attPct = Number(r.attendance_pct ?? 0);
      const hwRate = r.hw_total > 0 ? (r.hw_submitted / r.hw_total) * 100 : 0;
      const examScore = Number(r.avg_exam_score ?? 0);

      const engagementScore = Math.round(
        attPct * 0.4 + hwRate * 0.35 + (examScore > 0 ? examScore * 0.25 : 40)
      );

      const riskScore = Math.round(
        (attPct < 70 ? 40 : attPct < 85 ? 20 : 0) +
        (hwRate < 50 ? 30 : hwRate < 75 ? 15 : 0) +
        (examScore < 50 ? 30 : examScore < 65 ? 15 : 0)
      );

      const consistencyScore = Math.min(100, Math.round(
        (attPct * 0.5) + (hwRate * 0.5)
      ));

      return {
        id: r.id,
        name: r.display_name,
        code: r.student_code,
        attendancePct: attPct,
        hwCompletionPct: Math.round(hwRate),
        avgExamScore: examScore,
        engagementScore: Math.min(100, engagementScore),
        riskScore: Math.min(100, riskScore),
        consistencyScore,
        riskLevel: riskScore >= 50 ? "high" : riskScore >= 25 ? "medium" : "low",
      };
    });

    res.json({ students });
  } catch {
    res.status(500).json({ error: "Failed to compute student scores" });
  }
});
