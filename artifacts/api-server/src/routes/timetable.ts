import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { requireTenantAccess, requireStudentAccess } from "../middleware/tenant";
import { AuthRequest } from "../middleware/auth";

const router: IRouter = Router();

router.get("/timetable", requireTenantAccess as any, async (req: AuthRequest, res): Promise<void> => {
  const { teacherId, isAdmin } = req.tenant;
  if (!isAdmin && !teacherId) { res.status(403).json({ error: "Forbidden" }); return; }
  const params: unknown[] = [];
  const teacherCond = isAdmin ? "" : (() => { params.push(teacherId); return `WHERE s.teacher_account_id = $${params.length}`; })();
  const { rows } = await pool.query(`
    SELECT
      s.id, s.lesson_number AS "lessonNumber", s.day_of_week AS "dayOfWeek",
      s.start_time AS "startTime", s.type, s.capacity, s.online_link AS "onlineLink",
      sub.name AS "subjectName",
      COUNT(DISTINCT st.id)::int AS "studentCount"
    FROM lessons s
    LEFT JOIN subjects sub ON sub.id = s.subject_id
    LEFT JOIN students st ON (
      st.lesson1_session_id = s.id OR
      st.lesson2_session_id = s.id OR
      st.lesson3_session_id = s.id
    )
    ${teacherCond}
    GROUP BY s.id, s.lesson_number, s.day_of_week, s.start_time, s.type,
             s.capacity, s.online_link, sub.name
    ORDER BY
      CASE s.day_of_week
        WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3
        WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6
        ELSE 7 END,
      s.start_time
  `, params);
  res.json(rows);
});

router.get("/portal/timetable", requireStudentAccess as any, async (req: AuthRequest, res): Promise<void> => {
  const studentId: number = (req as any).studentId;

  const { rows } = await pool.query(`
    SELECT
      s.id, s.lesson_number AS "lessonNumber", s.day_of_week AS "dayOfWeek",
      s.start_time AS "startTime", s.type, s.capacity, s.online_link AS "onlineLink",
      sub.name AS "subjectName"
    FROM students st
    JOIN lessons s ON (
      s.id = st.lesson1_session_id OR
      s.id = st.lesson2_session_id OR
      s.id = st.lesson3_session_id
    )
    LEFT JOIN subjects sub ON sub.id = s.subject_id
    WHERE st.id = $1
    ORDER BY
      CASE s.day_of_week
        WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3
        WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6
        ELSE 7 END,
      s.start_time
  `, [studentId]);
  res.json(rows);
});

export default router;
