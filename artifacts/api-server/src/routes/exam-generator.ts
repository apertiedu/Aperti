import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { requireTenantAccess } from "../middleware/tenant";

const router: IRouter = Router();

router.post("/exams/generate", requireTenantAccess, async (req, res): Promise<void> => {
  const { teacherId, accountId, isAdmin } = req.tenant;
  const {
    name, subjectId, topics, difficulty, questionCount, mode, examDate, timeLimit
  } = req.body as {
    name: string;
    subjectId?: number;
    topics?: string[];
    difficulty?: "easy" | "medium" | "hard" | "mixed";
    questionCount?: number;
    mode?: "easy" | "medium" | "hard" | "mixed" | "topic-specific" | "predicted";
    examDate?: string;
    timeLimit?: number;
  };

  if (!name?.trim()) { res.status(400).json({ message: "Exam name required" }); return; }

  const effectiveTeacherId = isAdmin ? accountId : (teacherId ?? accountId);
  const count = Math.min(Math.max(questionCount ?? 10, 1), 50);

  const conditions: string[] = [`teacher_account_id = $1`];
  const params: unknown[] = [effectiveTeacherId];
  let i = 2;

  if (subjectId) { conditions.push(`subject_id = $${i++}`); params.push(subjectId); }

  if (topics && topics.length > 0) {
    const topicPlaceholders = topics.map(() => `$${i++}`).join(", ");
    conditions.push(`topic = ANY(ARRAY[${topicPlaceholders}])`);
    params.push(...topics);
  }

  const diffMode = mode || difficulty || "mixed";
  if (diffMode !== "mixed" && diffMode !== "predicted" && diffMode !== "topic-specific") {
    const diffMap: Record<string, string> = { easy: "easy", medium: "medium", hard: "hard" };
    if (diffMap[diffMode]) { conditions.push(`difficulty = $${i++}`); params.push(diffMap[diffMode]); }
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  let orderBy = "ORDER BY RANDOM()";
  if (diffMode === "predicted") {
    orderBy = "ORDER BY times_used DESC, RANDOM()";
  } else if (diffMode === "mixed") {
    orderBy = "ORDER BY RANDOM()";
  }

  // Weave enrichment: for "predicted" mode, bias toward high-connectivity topics
  let weaveHighYieldTopics: string[] = [];
  if (diffMode === "predicted") {
    try {
      const { rows: topNodes } = await pool.query(`
        SELECT n.name, COUNT(e.id) AS edge_count
        FROM knowledge_nodes n
        LEFT JOIN knowledge_edges e ON e.from_node_id = n.id OR e.to_node_id = n.id
        WHERE n.type = 'topic'
        GROUP BY n.id, n.name
        ORDER BY edge_count DESC
        LIMIT 15
      `);
      weaveHighYieldTopics = topNodes.map((n: any) => n.name as string);
    } catch { /* Weave best-effort */ }
  }

  let { rows: questions } = await pool.query(
    `SELECT id, question_text, topic, max_marks, difficulty FROM question_bank ${where} ${orderBy} LIMIT $${i}`,
    [...params, count * 3] // fetch 3x, then bias-sort
  );

  // Bias toward Weave high-yield topics for predicted mode
  if (weaveHighYieldTopics.length > 0 && diffMode === "predicted") {
    const highYield = questions.filter((q: any) =>
      weaveHighYieldTopics.some(t => (q.topic ?? "").toLowerCase().includes(t.toLowerCase()))
    );
    const rest = questions.filter((q: any) =>
      !weaveHighYieldTopics.some(t => (q.topic ?? "").toLowerCase().includes(t.toLowerCase()))
    );
    questions = [...highYield, ...rest].slice(0, count);
  } else {
    questions = questions.slice(0, count);
  }

  if (questions.length === 0) {
    res.status(400).json({ message: "No questions found matching your criteria. Add questions to the question bank first." });
    return;
  }

  const totalMarks = questions.reduce((sum: number, q: any) => sum + parseFloat(q.max_marks || 0), 0);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: [exam] } = await client.query(
      `INSERT INTO exams (name, subject_id, teacher_account_id, exam_date, total_marks)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name.trim(), subjectId || null, effectiveTeacherId, examDate || null, totalMarks]
    );

    for (let idx = 0; idx < questions.length; idx++) {
      const q = questions[idx];
      await client.query(
        `INSERT INTO exam_questions (exam_id, question_text, topic, max_marks, question_order)
         VALUES ($1,$2,$3,$4,$5)`,
        [exam.id, q.question_text, q.topic || null, q.max_marks, idx + 1]
      );
      await client.query(
        `UPDATE question_bank SET times_used = times_used + 1 WHERE id = $1`, [q.id]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      exam,
      questionCount: questions.length,
      totalMarks,
      topics: [...new Set(questions.map((q: any) => q.topic).filter(Boolean))],
      difficultyBreakdown: {
        easy: questions.filter((q: any) => q.difficulty === "easy").length,
        medium: questions.filter((q: any) => q.difficulty === "medium").length,
        hard: questions.filter((q: any) => q.difficulty === "hard").length,
      },
      weaveHighYieldTopics: weaveHighYieldTopics.length > 0 ? weaveHighYieldTopics.slice(0, 5) : undefined,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

router.get("/exams/generate/topics", requireTenantAccess, async (req, res): Promise<void> => {
  const { teacherId, isAdmin, accountId } = req.tenant;
  const effectiveTeacherId = isAdmin ? accountId : (teacherId ?? accountId);
  const { subjectId } = req.query as Record<string, string>;

  const params: unknown[] = [effectiveTeacherId];
  let cond = `WHERE teacher_account_id = $1 AND topic IS NOT NULL`;
  if (subjectId) { cond += ` AND subject_id = $2`; params.push(parseInt(subjectId, 10)); }

  const { rows } = await pool.query(
    `SELECT DISTINCT topic, COUNT(*)::int AS question_count
     FROM question_bank ${cond}
     GROUP BY topic ORDER BY question_count DESC`,
    params
  );
  res.json(rows);
});

export default router;
