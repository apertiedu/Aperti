import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { requireTenantAccess } from "../middleware/tenant";

const router: IRouter = Router();

const DAY_INDEX: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};

// Generate all dates matching dayOfWeek within [start, end] inclusive
function expandRecurring(dayOfWeek: string, start: Date, end: Date): string[] {
  const target = DAY_INDEX[dayOfWeek];
  if (target === undefined) return [];
  const dates: string[] = [];
  const cur = new Date(start);
  // Advance to first matching day
  while (cur.getDay() !== target) cur.setDate(cur.getDate() + 1);
  while (cur <= end) {
    dates.push(cur.toISOString().split("T")[0]);
    cur.setDate(cur.getDate() + 7);
  }
  return dates;
}

router.get("/calendar/events", requireTenantAccess, async (req, res): Promise<void> => {
  const { teacherId, isAdmin } = req.tenant;
  const teacherCond = !isAdmin && teacherId ? `AND s.teacher_account_id = ${teacherId}` : "";
  const examTeacherCond = !isAdmin && teacherId ? `AND e.teacher_account_id = ${teacherId}` : "";
  const hwTeacherCond = !isAdmin && teacherId ? `AND h.teacher_account_id = ${teacherId}` : "";

  const { start, end } = req.query as { start?: string; end?: string };
  const startDate = start ? new Date(start as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const endDate = end ? new Date(end as string) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
  const startStr = startDate.toISOString().split("T")[0];
  const endStr = endDate.toISOString().split("T")[0];

  const events: any[] = [];

  // Sessions (recurring weekly)
  const { rows: sessions } = await pool.query(`
    SELECT s.id, s.lesson_number AS "lessonNumber", s.day_of_week AS "dayOfWeek",
           s.start_time AS "startTime", s.type, s.online_link AS "onlineLink",
           COALESCE(sub.name, 'No Subject') AS "subjectName",
           COUNT(DISTINCT st.id)::int AS "studentCount"
    FROM sessions s
    LEFT JOIN subjects sub ON sub.id = s.subject_id
    LEFT JOIN students st ON (st.lesson1_session_id=s.id OR st.lesson2_session_id=s.id OR st.lesson3_session_id=s.id)
    WHERE 1=1 ${teacherCond}
    GROUP BY s.id, s.lesson_number, s.day_of_week, s.start_time, s.type, s.online_link, sub.name
  `);

  for (const s of sessions) {
    const dates = expandRecurring(s.dayOfWeek, startDate, endDate);
    for (const date of dates) {
      events.push({
        id: `session-${s.id}-${date}`,
        type: "session",
        date,
        title: s.subjectName,
        subtitle: `Lesson ${s.lessonNumber} · ${s.startTime?.slice(0, 5)}`,
        meta: { sessionId: s.id, type: s.type, studentCount: s.studentCount, onlineLink: s.onlineLink },
        color: "blue",
      });
    }
  }

  // Exams
  const { rows: exams } = await pool.query(`
    SELECT e.id, e.name, e.exam_date AS "examDate", e.total_marks AS "totalMarks",
           COALESCE(sub.name, 'No Subject') AS "subjectName",
           COUNT(DISTINCT eq.id)::int AS "questionCount"
    FROM exams e
    LEFT JOIN subjects sub ON sub.id = e.subject_id
    LEFT JOIN exam_questions eq ON eq.exam_id = e.id
    WHERE e.exam_date >= $1 AND e.exam_date <= $2 ${examTeacherCond}
    GROUP BY e.id, e.name, e.exam_date, e.total_marks, sub.name
  `, [startStr, endStr]);

  for (const e of exams) {
    const examDateStr = typeof e.examDate === "string"
      ? e.examDate.split("T")[0]
      : (e.examDate as Date).toISOString().split("T")[0];
    events.push({
      id: `exam-${e.id}`,
      type: "exam",
      date: examDateStr,
      title: e.name,
      subtitle: `${e.subjectName} · ${e.questionCount}Q · ${e.totalMarks}m`,
      meta: { examId: e.id },
      color: "purple",
    });
  }

  // Homework
  const { rows: homework } = await pool.query(`
    SELECT h.id, h.title, h.due_date AS "dueDate", COALESCE(sub.name, 'General') AS "subjectName"
    FROM homework h
    LEFT JOIN subjects sub ON sub.id = h.subject_id
    WHERE h.due_date >= $1 AND h.due_date <= $2 ${hwTeacherCond}
    ORDER BY h.due_date
  `, [startStr, endStr]).catch(() => ({ rows: [] as any[] }));

  for (const h of homework) {
    if (!h.dueDate) continue;
    events.push({
      id: `hw-${h.id}`,
      type: "homework",
      date: typeof h.dueDate === "string" ? h.dueDate : h.dueDate.toISOString().split("T")[0],
      title: h.title,
      subtitle: h.subjectName,
      meta: { homeworkId: h.id },
      color: "amber",
    });
  }

  events.sort((a, b) => a.date.localeCompare(b.date));
  res.json(events);
});

export default router;
