import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { requireTenantAccess } from "../middleware/tenant";

const router: IRouter = Router();

router.get("/analytics/risk-report", requireTenantAccess, async (req, res): Promise<void> => {
  const { teacherId, isAdmin } = req.tenant;
  const teacherFilter = isAdmin ? "" : `AND st.teacher_account_id = ${teacherId}`;

  const { rows: students } = await pool.query(`
    SELECT 
      st.id, st.student_name, st.student_code,
      COALESCE(
        ROUND(COUNT(CASE WHEN a.status='present' THEN 1 END)::numeric / NULLIF(COUNT(a.id),0)*100, 1),
        0
      ) AS overall_att_rate,
      COALESCE(
        ROUND(COUNT(CASE WHEN a.status='present' AND a.date >= CURRENT_DATE - INTERVAL '28 days' THEN 1 END)::numeric / 
        NULLIF(COUNT(CASE WHEN a.date >= CURRENT_DATE - INTERVAL '28 days' THEN 1 END), 0)*100, 1),
        0
      ) AS recent_att_rate,
      COALESCE(
        ROUND(COUNT(CASE WHEN a.status='present' AND a.date >= CURRENT_DATE - INTERVAL '14 days' THEN 1 END)::numeric /
        NULLIF(COUNT(CASE WHEN a.date >= CURRENT_DATE - INTERVAL '14 days' THEN 1 END), 0)*100, 1),
        0
      ) AS last2wk_att_rate,
      MAX(a.date)::text AS last_attendance_date,
      COALESCE((
        SELECT ROUND(AVG(sub.pct)::numeric, 1) FROM (
          SELECT ROUND(SUM(sm.marks_scored)/NULLIF(SUM(eq.max_marks),0)*100,1) AS pct
          FROM student_marks sm
          JOIN exam_questions eq ON eq.id=sm.question_id
          JOIN exams e ON e.id=sm.exam_id
          WHERE sm.student_id=st.id
          GROUP BY e.id ORDER BY e.id DESC LIMIT 3
        ) sub
      ), 0) AS recent_exam_avg,
      COALESCE((
        SELECT ROUND(AVG(sub.pct)::numeric, 1) FROM (
          SELECT ROUND(SUM(sm.marks_scored)/NULLIF(SUM(eq.max_marks),0)*100,1) AS pct
          FROM student_marks sm
          JOIN exam_questions eq ON eq.id=sm.question_id
          JOIN exams e ON e.id=sm.exam_id
          WHERE sm.student_id=st.id
          GROUP BY e.id ORDER BY e.id DESC LIMIT 6 OFFSET 3
        ) sub
      ), 0) AS prev_exam_avg
    FROM students st
    LEFT JOIN attendance a ON a.student_id = st.id
    WHERE st.status = 'active' ${teacherFilter}
    GROUP BY st.id, st.student_name, st.student_code
    ORDER BY recent_att_rate ASC
  `);

  const result = students.map((s: any) => {
    const recentAtt = parseFloat(s.recent_att_rate);
    const last2wkAtt = parseFloat(s.last2wk_att_rate);
    const recentExam = parseFloat(s.recent_exam_avg);
    const prevExam = parseFloat(s.prev_exam_avg);
    const lastDate = s.last_attendance_date ? new Date(s.last_attendance_date) : null;
    const daysSinceAttendance = lastDate ? Math.floor((Date.now() - lastDate.getTime()) / 86400000) : 999;

    const reasons: string[] = [];
    const recommendations: string[] = [];
    let riskScore = 0;

    if (recentAtt < 50) { riskScore += 40; reasons.push("Attendance below 50% this month"); recommendations.push("Immediate parent contact required"); }
    else if (recentAtt < 70) { riskScore += 25; reasons.push("Attendance below 70% this month"); recommendations.push("Schedule a check-in call with parents"); }
    else if (recentAtt < 80) { riskScore += 10; reasons.push("Attendance below 80% this month"); recommendations.push("Monitor and send attendance reminder"); }

    if (daysSinceAttendance >= 14) { riskScore += 30; reasons.push(`No attendance recorded for ${daysSinceAttendance} days`); recommendations.push("Verify student is still enrolled"); }
    else if (daysSinceAttendance >= 7) { riskScore += 15; reasons.push(`Absent for ${daysSinceAttendance} days`); recommendations.push("Follow up with student or parent"); }

    if (prevExam > 0 && recentExam > 0 && recentExam < prevExam * 0.8) {
      const drop = Math.round(prevExam - recentExam);
      riskScore += 20;
      reasons.push(`Exam performance dropped ${drop}% from previous period`);
      recommendations.push("Review recent exam mistakes with student");
    }

    if (last2wkAtt < 50) { riskScore += 20; reasons.push("Less than 50% attendance in last 2 weeks — disengagement risk"); recommendations.push("Urgent pastoral check-in needed"); }

    const level: "low" | "medium" | "high" | "critical" =
      riskScore >= 60 ? "critical" :
      riskScore >= 35 ? "high" :
      riskScore >= 15 ? "medium" : "low";

    return {
      studentId: s.id,
      studentName: s.student_name,
      studentCode: s.student_code,
      recentAttRate: recentAtt,
      overallAttRate: parseFloat(s.overall_att_rate),
      recentExamAvg: recentExam,
      prevExamAvg: prevExam,
      daysSinceAttendance,
      riskScore,
      riskLevel: level,
      reasons,
      recommendations,
    };
  });

  const summary = {
    critical: result.filter((r: any) => r.riskLevel === "critical").length,
    high: result.filter((r: any) => r.riskLevel === "high").length,
    medium: result.filter((r: any) => r.riskLevel === "medium").length,
    low: result.filter((r: any) => r.riskLevel === "low").length,
  };

  // CoreMind enrichment: enrich top high/critical students with AI analysis (best-effort)
  const topAtRisk = result
    .filter((r: any) => r.riskLevel === "critical" || r.riskLevel === "high")
    .slice(0, 8);

  const enrichedMap: Record<number, any> = {};
  if (topAtRisk.length > 0) {
    try {
      const { analyzeStudent } = await import("../lib/coremind");
      await Promise.allSettled(topAtRisk.map(async (s: any) => {
        const analysis = await analyzeStudent(s.studentId);
        enrichedMap[s.studentId] = {
          examReadiness: analysis.examReadiness,
          weakTopics: analysis.weakTopics.slice(0, 3),
          recommendedActions: analysis.recommendedActions.slice(0, 2),
          coremindRisk: analysis.riskLevel,
          nextBestTopic: analysis.nextBestTopic,
        };
      }));
    } catch { /* best-effort — CoreMind may be unavailable */ }
  }

  const enrichedResult = result.map((r: any) => ({
    ...r,
    coremindInsights: enrichedMap[r.studentId] ?? null,
  }));

  res.json({ students: enrichedResult, summary });
});

export default router;
