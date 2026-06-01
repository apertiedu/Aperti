import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { requireStudentAccess } from "../middleware/tenant";
import { AuthRequest } from "../middleware/auth";

const router: IRouter = Router();

router.get("/portal/goals", requireStudentAccess as any, async (req: AuthRequest, res): Promise<void> => {
  const studentId: number = (req as any).studentId;

  const { rows: goals } = await pool.query(`
    SELECT g.*, s.name AS subject_name FROM student_goals g
    LEFT JOIN subjects s ON s.id = g.subject_id
    WHERE g.student_id = $1 AND g.is_active = true
    ORDER BY g.created_at DESC
  `, [studentId]);

  const enriched = await Promise.all(goals.map(async (goal: any) => {
    let currentValue = 0;
    if (goal.goal_type === "attendance") {
      const { rows } = await pool.query(`
        SELECT ROUND(COUNT(CASE WHEN status='present' THEN 1 END)::numeric / NULLIF(COUNT(*),0) * 100, 1) AS rate
        FROM attendance WHERE student_id = $1
      `, [studentId]);
      currentValue = parseFloat(rows[0]?.rate ?? "0");
    } else if (goal.goal_type === "grade") {
      const subCond = goal.subject_id ? `AND e.subject_id = ${goal.subject_id}` : "";
      const { rows } = await pool.query(`
        SELECT ROUND(AVG(sm.marks_scored / NULLIF(eq.max_marks,0) * 100)::numeric, 1) AS avg_pct
        FROM student_marks sm
        JOIN exam_questions eq ON eq.id = sm.question_id
        JOIN exams e ON e.id = sm.exam_id
        WHERE sm.student_id = $1 ${subCond}
      `, [studentId]);
      currentValue = parseFloat(rows[0]?.avg_pct ?? "0");
    } else if (goal.goal_type === "streak") {
      const { rows } = await pool.query(`
        SELECT COUNT(DISTINCT DATE(next_review_at - interval '1 day'))::int AS streak
        FROM flashcard_progress WHERE student_id = $1 AND reps > 0
        AND updated_at >= NOW() - INTERVAL '7 days'
      `, [studentId]);
      currentValue = parseInt(rows[0]?.streak ?? "0", 10);
    }
    const targetNum = parseFloat(goal.target_value);
    const progress = targetNum > 0 ? Math.min(100, Math.round((currentValue / targetNum) * 100)) : 0;
    return { ...goal, current_value: currentValue, progress_pct: progress };
  }));

  res.json(enriched);
});

router.post("/portal/goals", requireStudentAccess as any, async (req: AuthRequest, res): Promise<void> => {
  const studentId: number = (req as any).studentId;
  const { goalType, targetValue, subjectId, deadline, notes } = req.body;
  if (!goalType || targetValue === undefined) { res.status(400).json({ message: "goalType and targetValue required" }); return; }
  const { rows } = await pool.query(
    `INSERT INTO student_goals (student_id, goal_type, target_value, subject_id, deadline, notes)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [studentId, goalType, targetValue, subjectId || null, deadline || null, notes?.trim() || null]
  );
  res.status(201).json(rows[0]);
});

router.patch("/portal/goals/:id", requireStudentAccess as any, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const studentId: number = (req as any).studentId;
  const { targetValue, deadline, notes, isActive } = req.body;
  const sets: string[] = []; const params: unknown[] = []; let i = 1;
  if (targetValue !== undefined) { sets.push(`target_value=$${i++}`); params.push(targetValue); }
  if ("deadline" in req.body) { sets.push(`deadline=$${i++}`); params.push(deadline || null); }
  if ("notes" in req.body) { sets.push(`notes=$${i++}`); params.push(notes?.trim() || null); }
  if ("isActive" in req.body) { sets.push(`is_active=$${i++}`); params.push(isActive); }
  if (!sets.length) { res.status(400).json({ message: "Nothing to update" }); return; }
  params.push(id, studentId);
  const { rows } = await pool.query(
    `UPDATE student_goals SET ${sets.join(",")} WHERE id=$${i} AND student_id=$${i+1} RETURNING *`, params
  );
  if (!rows[0]) { res.status(404).json({ message: "Not found" }); return; }
  res.json(rows[0]);
});

router.delete("/portal/goals/:id", requireStudentAccess as any, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const studentId: number = (req as any).studentId;
  await pool.query(`DELETE FROM student_goals WHERE id=$1 AND student_id=$2`, [id, studentId]);
  res.json({ message: "Goal deleted" });
});

export default router;
