import { Router, Response } from "express";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { pool } from "@workspace/db";

export const courseHealthRouter = Router();

courseHealthRouter.use(authenticate);
courseHealthRouter.use(requireRole(["teacher", "admin", "assistant"]));

// GET /api/course-health/:courseId — health score for a specific course
courseHealthRouter.get("/:courseId", async (req: AuthRequest, res: Response) => {
  try {
    const courseId = parseInt(req.params.courseId);
    if (isNaN(courseId)) return res.status(400).json({ error: "Invalid course ID" });

    // Attendance rate last 30 days
    const { rows: attRows } = await pool.query(`
      SELECT ROUND(100.0 * SUM(CASE WHEN att.status='present' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0)) AS rate
      FROM attendance att
      JOIN sessions s ON s.id = att.session_id
      JOIN subjects sub ON sub.id = s.subject_id
      WHERE sub.course_id = $1
        AND s.date >= NOW() - INTERVAL '30 days'
    `, [courseId]).catch(() => ({ rows: [{ rate: null }] }));

    // Average exam score
    const { rows: examRows } = await pool.query(`
      SELECT ROUND(AVG(sm.score / NULLIF(sm.max_score, 0) * 100)) AS avg_pct
      FROM student_marks sm
      JOIN exams e ON e.id = sm.exam_id
      WHERE e.course_id = $1
        AND sm.created_at >= NOW() - INTERVAL '60 days'
    `, [courseId]).catch(() => ({ rows: [{ avg_pct: null }] }));

    // Homework completion rate
    const { rows: hwRows } = await pool.query(`
      SELECT
        COUNT(h.id)::int AS total_assigned,
        COUNT(hs.id)::int AS total_submitted
      FROM homework h
      JOIN students s ON s.course_id = h.course_id
      LEFT JOIN homework_submissions hs ON hs.homework_id = h.id AND hs.student_id = s.id
      WHERE h.course_id = $1
        AND h.due_date >= NOW() - INTERVAL '30 days'
    `, [courseId]).catch(() => ({ rows: [{ total_assigned: 0, total_submitted: 0 }] }));

    // Student count
    const { rows: studentRows } = await pool.query(`
      SELECT COUNT(*)::int AS count FROM students WHERE course_id = $1 AND status = 'active'
    `, [courseId]).catch(() => ({ rows: [{ count: 0 }] }));

    const attendanceRate = Number(attRows[0]?.rate || 0);
    const examAvg = Number(examRows[0]?.avg_pct || 0);
    const hwTotal = Number(hwRows[0]?.total_assigned || 0);
    const hwSubmitted = Number(hwRows[0]?.total_submitted || 0);
    const hwRate = hwTotal > 0 ? (hwSubmitted / hwTotal) * 100 : 0;
    const studentCount = Number(studentRows[0]?.count || 0);

    // Calculate health score (0-100)
    let healthScore = 0;
    let dataPoints = 0;
    if (attRows[0]?.rate !== null) { healthScore += (attendanceRate / 100) * 40; dataPoints++; }
    if (examRows[0]?.avg_pct !== null) { healthScore += (examAvg / 100) * 40; dataPoints++; }
    if (hwTotal > 0) { healthScore += (hwRate / 100) * 20; dataPoints++; }

    const finalScore = dataPoints > 0 ? Math.round(healthScore) : null;

    let status: "healthy" | "attention" | "critical" | "no-data";
    let color: string;
    let label: string;

    if (finalScore === null || studentCount === 0) {
      status = "no-data"; color = "#94a3b8"; label = "No Data";
    } else if (finalScore >= 70) {
      status = "healthy"; color = "#16a34a"; label = "Healthy";
    } else if (finalScore >= 45) {
      status = "attention"; color = "#d97706"; label = "Needs Attention";
    } else {
      status = "critical"; color = "#dc2626"; label = "Critical";
    }

    const issues: string[] = [];
    if (attendanceRate < 70 && attRows[0]?.rate !== null) issues.push(`Low attendance (${attendanceRate}%)`);
    if (examAvg < 50 && examRows[0]?.avg_pct !== null) issues.push(`Poor exam scores (avg ${examAvg}%)`);
    if (hwRate < 50 && hwTotal > 0) issues.push(`Low homework completion (${Math.round(hwRate)}%)`);
    if (studentCount === 0) issues.push("No active students");

    res.json({
      courseId,
      score: finalScore,
      status,
      color,
      label,
      issues,
      metrics: {
        attendanceRate: attRows[0]?.rate !== null ? attendanceRate : null,
        examAvgScore: examRows[0]?.avg_pct !== null ? examAvg : null,
        homeworkCompletionRate: hwTotal > 0 ? Math.round(hwRate) : null,
        activeStudents: studentCount,
      },
    });
  } catch (err) {
    console.error("course-health error:", err);
    res.status(500).json({ error: "Failed to calculate course health" });
  }
});

// GET /api/course-health — all courses for the teacher
courseHealthRouter.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const accountId = req.user!.id;
    const { rows: courses } = await pool.query(
      `SELECT id FROM aperti_courses WHERE teacher_id = $1 AND status = 'active' LIMIT 20`,
      [accountId]
    ).catch(() => ({ rows: [] }));

    const results = await Promise.all(
      courses.map(async (c: any) => {
        const r = await pool.query(`
          SELECT
            ROUND(100.0 * SUM(CASE WHEN att.status='present' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0)) AS att_rate,
            NULL::numeric AS exam_avg
          FROM attendance att
          JOIN sessions s ON s.id = att.session_id
          JOIN subjects sub ON sub.id = s.subject_id
          WHERE sub.course_id = $1 AND s.date >= NOW() - INTERVAL '30 days'
        `, [c.id]).catch(() => ({ rows: [{ att_rate: null, exam_avg: null }] }));
        const attRate = Number(r.rows[0]?.att_rate || 0);
        const score = attRate > 0 ? Math.round(attRate) : null;
        return {
          courseId: c.id,
          score,
          status: score === null ? "no-data" : score >= 70 ? "healthy" : score >= 45 ? "attention" : "critical",
        };
      })
    );

    res.json(results);
  } catch (err) {
    console.error("course-health-all error:", err);
    res.status(500).json({ error: "Failed to load course health" });
  }
});
