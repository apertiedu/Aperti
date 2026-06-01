import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { requireTenantAccess } from "../middleware/tenant";

const router: IRouter = Router();

function igcseGrade(pct: number): string {
  if (pct >= 90) return "A*";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  if (pct >= 40) return "E";
  if (pct >= 30) return "F";
  if (pct >= 20) return "G";
  return "U";
}

// GET /api/gradebook?subjectId=&sessionId=
router.get("/gradebook", requireTenantAccess, async (req, res): Promise<void> => {
  const { teacherId, isAdmin } = req.tenant;
  const teacherCond = !isAdmin && teacherId ? `AND st.teacher_account_id = ${teacherId}` : "";
  const examTeacherCond = !isAdmin && teacherId ? `AND e.teacher_account_id = ${teacherId}` : "";

  const { subjectId, sessionId } = req.query as { subjectId?: string; sessionId?: string };

  const subjectFilter = subjectId ? `AND e.subject_id = ${parseInt(subjectId, 10)}` : "";
  const sessionFilter = sessionId
    ? `AND (st.lesson1_session_id = ${parseInt(sessionId, 10)} OR st.lesson2_session_id = ${parseInt(sessionId, 10)} OR st.lesson3_session_id = ${parseInt(sessionId, 10)})`
    : "";

  // All exams (teacher-scoped)
  const { rows: exams } = await pool.query(`
    SELECT e.id, e.name, e.exam_date AS "examDate", e.total_marks AS "totalMarks",
           COALESCE(sub.name, 'No Subject') AS "subjectName", sub.id AS "subjectId"
    FROM exams e
    LEFT JOIN subjects sub ON sub.id = e.subject_id
    WHERE 1=1 ${examTeacherCond} ${subjectFilter}
    ORDER BY e.exam_date ASC NULLS LAST, e.name
  `);

  // All students (teacher-scoped, optionally filtered by session)
  const { rows: students } = await pool.query(`
    SELECT st.id, st.student_name AS "studentName", st.student_code AS "studentCode",
           st.lesson1_session_id AS "l1", st.lesson2_session_id AS "l2", st.lesson3_session_id AS "l3"
    FROM students st
    WHERE st.status = 'active' ${teacherCond} ${sessionFilter}
    ORDER BY st.student_name
  `);

  if (students.length === 0 || exams.length === 0) {
    res.json({ exams, students: students.map(s => ({ ...s, scores: {}, attendanceRate: 0, average: null, igcse: null })) });
    return;
  }

  const studentIds = students.map((s: any) => s.id);
  const examIds = exams.map((e: any) => e.id);

  // All marks for these students + exams
  const { rows: marks } = await pool.query(`
    SELECT sm.student_id AS "studentId", sm.exam_id AS "examId",
           SUM(sm.marks_scored)::numeric AS scored,
           SUM(eq.max_marks)::numeric AS "maxAvailable"
    FROM student_marks sm
    JOIN exam_questions eq ON eq.id = sm.question_id
    WHERE sm.student_id = ANY($1) AND sm.exam_id = ANY($2)
    GROUP BY sm.student_id, sm.exam_id
  `, [studentIds, examIds]);

  // Attendance rates for these students
  const { rows: attendance } = await pool.query(`
    SELECT a.student_id AS "studentId",
           COUNT(*)::int AS total,
           SUM(CASE WHEN a.status='Present' THEN 1 ELSE 0 END)::int AS present
    FROM attendance a
    WHERE a.student_id = ANY($1)
    GROUP BY a.student_id
  `, [studentIds]);

  const markMap: Record<string, { scored: number; max: number }> = {};
  for (const m of marks) {
    markMap[`${m.studentId}:${m.examId}`] = { scored: parseFloat(m.scored), max: parseFloat(m.maxAvailable) };
  }

  const attMap: Record<number, number> = {};
  for (const a of attendance) {
    attMap[a.studentId] = a.total > 0 ? Math.round((a.present / a.total) * 100) : 0;
  }

  const result = students.map((s: any) => {
    const scores: Record<number, { scored: number; max: number; pct: number; grade: string } | null> = {};
    let totalScored = 0, totalMax = 0, examCount = 0;

    for (const e of exams) {
      const key = `${s.id}:${e.id}`;
      if (markMap[key]) {
        const { scored, max } = markMap[key];
        const pct = max > 0 ? Math.round((scored / max) * 1000) / 10 : 0;
        scores[e.id] = { scored, max, pct, grade: igcseGrade(pct) };
        totalScored += scored;
        totalMax += max;
        examCount++;
      } else {
        scores[e.id] = null;
      }
    }

    const average = examCount > 0 && totalMax > 0 ? Math.round((totalScored / totalMax) * 1000) / 10 : null;

    return {
      id: s.id, studentName: s.studentName, studentCode: s.studentCode,
      scores, attendanceRate: attMap[s.id] ?? 0,
      average, igcse: average !== null ? igcseGrade(average) : null,
      examCount,
    };
  });

  res.json({ exams, students: result });
});

// GET /api/gradebook/filters — returns subjects and sessions for filter dropdowns
router.get("/gradebook/filters", requireTenantAccess, async (req, res): Promise<void> => {
  const { teacherId, isAdmin } = req.tenant;
  const teacherCond = !isAdmin && teacherId ? `AND teacher_account_id = ${teacherId}` : "";

  const { rows: subjects } = await pool.query(`SELECT id, name FROM subjects WHERE 1=1 ${teacherCond} ORDER BY name`);
  const { rows: sessions } = await pool.query(`
    SELECT s.id, s.lesson_number AS "lessonNumber", s.day_of_week AS "dayOfWeek", s.start_time AS "startTime",
           COALESCE(sub.name,'No Subject') AS "subjectName"
    FROM lessons s LEFT JOIN subjects sub ON sub.id=s.subject_id
    WHERE 1=1 ${teacherCond.replace('teacher_account_id', 's.teacher_account_id')}
    ORDER BY s.lesson_number, s.day_of_week
  `);

  res.json({ subjects, sessions });
});

export default router;
