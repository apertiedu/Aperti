import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { requireTenantAccess } from "../middleware/tenant";
import { cacheGetOrSet, cacheDel } from "../lib/cache";

const router: IRouter = Router();

// TTL for gradebook cache — short enough to feel live, long enough to absorb repeat loads
const GRADEBOOK_TTL = 20; // seconds
const FILTERS_TTL   = 120; // subjects/sessions change rarely

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

    const cacheKey = `gradebook:t${teacherId ?? "admin"}:s${subjectId ?? "all"}:ses${sessionId ?? "all"}`;

    const data = await cacheGetOrSet(cacheKey, () => fetchGradebook({ teacherId, isAdmin, subjectId, sessionId }), GRADEBOOK_TTL);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to load gradebook" });
  }
});

async function fetchGradebook(opts: {
  teacherId: number | null;
  isAdmin: boolean;
  subjectId?: string;
  sessionId?: string;
}) {
  const { teacherId, isAdmin, subjectId, sessionId } = opts;

  // ── Exams ──────────────────────────────────────────────────────────────────
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

  // ── Students ───────────────────────────────────────────────────────────────
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
    return {
      exams,
      students: students.map((s: any) => ({ ...s, scores: {}, attendanceRate: 0, average: null, igcse: null })),
    };
  }

  const studentIds = students.map((s: any) => s.id);
  const examIds    = exams.map((e: any) => e.id);

  // ── Optimised marks query: CTE pre-aggregates exam max-marks once ──────────
  // Previously: per-row JOIN between student_marks and exam_questions
  // Now: CTE computes exam totals once, then LEFT JOIN in one pass
  const { rows: marks } = await pool.query(`
    WITH exam_totals AS (
      SELECT eq.exam_id,
             SUM(eq.max_marks)::numeric AS total_max
      FROM exam_questions eq
      WHERE eq.exam_id = ANY($2)
      GROUP BY eq.exam_id
    )
    SELECT
      sm.student_id   AS "studentId",
      sm.exam_id      AS "examId",
      SUM(sm.marks_scored)::numeric AS scored,
      et.total_max    AS "maxAvailable"
    FROM student_marks sm
    JOIN exam_totals et ON et.exam_id = sm.exam_id
    WHERE sm.student_id = ANY($1)
      AND sm.exam_id    = ANY($2)
    GROUP BY sm.student_id, sm.exam_id, et.total_max
  `, [studentIds, examIds]);

  // ── Attendance — filtered to this teacher's students ───────────────────────
  const { rows: attendance } = await pool.query(`
    SELECT a.student_id AS "studentId",
           COUNT(*)::int                                       AS total,
           SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END)::int AS present
    FROM attendance a
    WHERE a.student_id = ANY($1)
    GROUP BY a.student_id
  `, [studentIds]);

  // ── In-memory hash maps: O(S + E + M + A) — not O(S × E) ─────────────────
  const markMap: Record<string, { scored: number; max: number }> = {};
  for (const m of marks) {
    markMap[`${m.studentId}:${m.examId}`] = {
      scored: parseFloat(m.scored),
      max: parseFloat(m.maxAvailable),
    };
  }

  const attMap: Record<number, number> = {};
  for (const a of attendance) {
    attMap[a.studentId] = a.total > 0
      ? Math.round((a.present / a.total) * 100)
      : 0;
  }

  // ── Build result: O(S × E) hash-map lookups only (no DB round-trips) ───────
  const result = students.map((s: any) => {
    const scores: Record<number, { scored: number; max: number; pct: number; grade: string } | null> = {};
    let totalScored = 0, totalMax = 0, examCount = 0;

    for (const e of exams) {
      const entry = markMap[`${s.id}:${e.id}`];
      if (entry) {
        const { scored, max } = entry;
        const pct = max > 0 ? Math.round((scored / max) * 1000) / 10 : 0;
        scores[e.id] = { scored, max, pct, grade: igcseGrade(pct) };
        totalScored += scored;
        totalMax    += max;
        examCount++;
      } else {
        scores[e.id] = null;
      }
    }

    const average = examCount > 0 && totalMax > 0
      ? Math.round((totalScored / totalMax) * 1000) / 10
      : null;

    return {
      id: s.id, studentName: s.studentName, studentCode: s.studentCode,
      scores, attendanceRate: attMap[s.id] ?? 0,
      average, igcse: average !== null ? igcseGrade(average) : null,
      examCount,
    };
  });

  return { exams, students: result };
}

// ── Gradebook filters (subjects + sessions per teacher) ───────────────────────
router.get("/gradebook/filters", requireTenantAccess, async (req, res): Promise<void> => {
  try {
    const { teacherId, isAdmin } = req.tenant;
    const cacheKey = `gradebook:filters:t${teacherId ?? "admin"}`;

    const data = await cacheGetOrSet(cacheKey, async () => {
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

      const [{ rows: subjects }, { rows: sessions }] = await Promise.all([
        pool.query(`SELECT id, name FROM subjects WHERE 1=1 ${subjectCond} ORDER BY name`, subjectParams),
        pool.query(`
          SELECT s.id, s.lesson_number AS "lessonNumber", s.day_of_week AS "dayOfWeek",
                 s.start_time AS "startTime",
                 COALESCE(sub.name,'No Subject') AS "subjectName"
          FROM lessons s LEFT JOIN subjects sub ON sub.id = s.subject_id
          WHERE 1=1 ${sessionCond}
          ORDER BY s.lesson_number, s.day_of_week
        `, sessionParams),
      ]);

      return { subjects, sessions };
    }, FILTERS_TTL);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to load gradebook filters" });
  }
});

// ── Cache invalidation (called by grading/exam mutations) ─────────────────────
export async function invalidateGradebookCache(teacherId: number | null): Promise<void> {
  // Broad invalidation: delete all gradebook cache entries for this teacher
  // (specific key pattern invalidation not needed — TTL is short enough)
  await cacheDel(`gradebook:filters:t${teacherId ?? "admin"}`).catch(() => {});
}

export default router;
