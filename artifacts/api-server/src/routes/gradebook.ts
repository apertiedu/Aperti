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

router.get("/gradebook", requireTenantAccess, async (req, res): Promise<void> => {
  try {
    const { teacherId, isAdmin } = req.tenant;
    const { subjectId, sessionId } = req.query as { subjectId?: string; sessionId?: string };

    // ── Exams query ────────────────────────────────────────────────────────
    const examParams: any[] = [];
    let examTeacherCond = "";
    let subjectFilter = "";
    if (!isAdmin && teacherId) {
      examParams.push(teacherId);
      examTeacherCond = `AND e.teacher_account_id = $${examParams.length}`;
    }
    if (subjectId) {
      const sid = parseInt(subjectId, 10);
      if (!isNaN(sid)) {
        examParams.push(sid);
        subjectFilter = `AND e.subject_id = $${examParams.length}`;
      }
    }

    const { rows: exams } = await pool.query(`
      SELECT e.id, e.name, e.exam_date AS "examDate", e.total_marks AS "totalMarks",
             COALESCE(sub.name, 'No Subject') AS "subjectName", sub.id AS "subjectId"
      FROM exams e
      LEFT JOIN subjects sub ON sub.id = e.subject_id
      WHERE 1=1 ${examTeacherCond} ${subjectFilter}
      ORDER BY e.exam_date ASC NULLS LAST, e.name
    `, examParams);

    // ── Students query ─────────────────────────────────────────────────────
    const stuParams: any[] = [];
    let teacherCond = "";
    let sessionFilter = "";
    if (!isAdmin && teacherId) {
      stuParams.push(teacherId);
      teacherCond = `AND st.teacher_account_id = $${stuParams.length}`;
    }
    if (sessionId) {
      const sesId = parseInt(sessionId, 10);
      if (!isNaN(sesId)) {
        stuParams.push(sesId);
        const idx = stuParams.length;
        sessionFilter = `AND (st.lesson1_session_id = $${idx} OR st.lesson2_session_id = $${idx} OR st.lesson3_session_id = $${idx})`;
      }
    }

    const { rows: students } = await pool.query(`
      SELECT st.id, st.student_name AS "studentName", st.student_code AS "studentCode",
             st.lesson1_session_id AS "l1", st.lesson2_session_id AS "l2", st.lesson3_session_id AS "l3"
      FROM students st
      WHERE st.status = 'active' ${teacherCond} ${sessionFilter}
      ORDER BY st.student_name
    `, stuParams);

    if (students.length === 0 || exams.length === 0) {
      res.json({ exams, students: students.map((s: any) => ({ ...s, scores: {}, attendanceRate: 0, average: null, igcse: null })) });
      return;
    }

    const studentIds = students.map((s: any) => s.id);
    const examIds = exams.map((e: any) => e.id);

    const { rows: marks } = await pool.query(`
      SELECT sm.student_id AS "studentId", sm.exam_id AS "examId",
             SUM(sm.marks_scored)::numeric AS scored,
             SUM(eq.max_marks)::numeric AS "maxAvailable"
      FROM student_marks sm
      JOIN exam_questions eq ON eq.id = sm.question_id
      WHERE sm.student_id = ANY($1) AND sm.exam_id = ANY($2)
      GROUP BY sm.student_id, sm.exam_id
    `, [studentIds, examIds]);

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
  } catch (err) {
    res.status(500).json({ error: "Failed to load gradebook" });
  }
});

router.get("/gradebook/filters", requireTenantAccess, async (req, res): Promise<void> => {
  try {
    const { teacherId, isAdmin } = req.tenant;

    // Parameterized — no template literal interpolation of user-controlled values
    const subjectParams: any[] = [];
    let subjectCond = "";
    const sessionParams: any[] = [];
    let sessionCond = "";
    if (!isAdmin && teacherId) {
      subjectParams.push(teacherId);
      subjectCond = `AND teacher_account_id = $${subjectParams.length}`;
      sessionParams.push(teacherId);
      sessionCond = `AND s.teacher_account_id = $${sessionParams.length}`;
    }

    const { rows: subjects } = await pool.query(`SELECT id, name FROM subjects WHERE 1=1 ${subjectCond} ORDER BY name`, subjectParams);
    const { rows: sessions } = await pool.query(`
      SELECT s.id, s.lesson_number AS "lessonNumber", s.day_of_week AS "dayOfWeek", s.start_time AS "startTime",
             COALESCE(sub.name,'No Subject') AS "subjectName"
      FROM lessons s LEFT JOIN subjects sub ON sub.id=s.subject_id
      WHERE 1=1 ${sessionCond}
      ORDER BY s.lesson_number, s.day_of_week
    `, sessionParams);

    res.json({ subjects, sessions });
  } catch (err) {
    res.status(500).json({ error: "Failed to load gradebook filters" });
  }
});

export default router;
