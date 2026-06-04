import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";

export const autopilotRouter = Router();
autopilotRouter.use(authenticate);

// ── GET /autopilot/tasks ──────────────────────────────────────────────────
autopilotRouter.get("/tasks", async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.userId!;
    const { rows } = await pool.query(
      `SELECT * FROM automation_tasks WHERE teacher_id = $1 ORDER BY created_at DESC`,
      [teacherId]
    );
    res.json({ tasks: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /autopilot/tasks ─────────────────────────────────────────────────
autopilotRouter.post("/tasks", async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.userId!;
    const { type, schedule, parameters, label } = req.body;

    if (!type || !schedule) {
      return res.status(400).json({ error: "type and schedule are required" });
    }

    const VALID_TYPES = ["assignment", "reminder", "report", "risk_check"];
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: "Invalid task type" });
    }

    const { rows } = await pool.query(
      `INSERT INTO automation_tasks (teacher_id, type, schedule, parameters, label, enabled)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING *`,
      [teacherId, type, schedule, JSON.stringify(parameters ?? {}), label ?? type]
    );
    res.status(201).json({ task: rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /autopilot/tasks/:id ──────────────────────────────────────────────
autopilotRouter.put("/tasks/:id", async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.userId!;
    const { id } = req.params;
    const { type, schedule, parameters, label, enabled } = req.body;

    const { rows } = await pool.query(
      `UPDATE automation_tasks
       SET type=$2, schedule=$3, parameters=$4, label=$5, enabled=$6, updated_at=NOW()
       WHERE id=$1 AND teacher_id=$7
       RETURNING *`,
      [id, type, schedule, JSON.stringify(parameters ?? {}), label ?? type, enabled ?? true, teacherId]
    );
    if (!rows.length) return res.status(404).json({ error: "Task not found" });
    res.json({ task: rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /autopilot/tasks/:id/toggle ────────────────────────────────────
autopilotRouter.patch("/tasks/:id/toggle", async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.userId!;
    const { id } = req.params;
    const { rows } = await pool.query(
      `UPDATE automation_tasks SET enabled = NOT enabled, updated_at=NOW()
       WHERE id=$1 AND teacher_id=$2 RETURNING *`,
      [id, teacherId]
    );
    if (!rows.length) return res.status(404).json({ error: "Task not found" });
    res.json({ task: rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /autopilot/tasks/:id ───────────────────────────────────────────
autopilotRouter.delete("/tasks/:id", async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.userId!;
    const { id } = req.params;
    await pool.query(
      `DELETE FROM automation_tasks WHERE id=$1 AND teacher_id=$2`,
      [id, teacherId]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /autopilot/tasks/:id/run-now ────────────────────────────────────
autopilotRouter.post("/tasks/:id/run-now", async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.userId!;
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT * FROM automation_tasks WHERE id=$1 AND teacher_id=$2`,
      [id, teacherId]
    );
    if (!rows.length) return res.status(404).json({ error: "Task not found" });
    const task = rows[0];

    await executeTask(task);

    await pool.query(
      `UPDATE automation_tasks SET last_run=NOW(), run_count=run_count+1 WHERE id=$1`,
      [id]
    );
    res.json({ ok: true, message: `Task "${task.label}" executed` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Execution logic (also used by background service) ────────────────────
export async function executeTask(task: any): Promise<void> {
  const params = typeof task.parameters === "string"
    ? JSON.parse(task.parameters)
    : (task.parameters ?? {});

  try {
    switch (task.type) {
      case "risk_check": {
        const { openaiChat } = await import("../lib/ai-config");
        const studentsRes = await pool.query(
          `SELECT s.id, a.display_name, s.grade_level
           FROM students s
           JOIN accounts a ON s.account_id = a.id
           WHERE s.workspace_id = (
             SELECT workspace_id FROM accounts WHERE id = $1
           )
           LIMIT 30`,
          [task.teacher_id]
        );
        if (!studentsRes.rows.length) break;

        const studentList = studentsRes.rows
          .map((s: any) => `${s.display_name} (Grade ${s.grade_level ?? "?"})`)
          .join(", ");

        const summary = await openaiChat({
          systemPrompt: "You are an academic risk analyst. Identify which students listed may be at risk based on general statistical expectations and generate brief intervention suggestions for a teacher. Be concise.",
          userMessage: `Students: ${studentList}. Generate a brief risk alert with 2-3 intervention suggestions.`,
          maxTokens: 400,
        });

        if (summary) {
          await pool.query(
            `INSERT INTO notifications (account_id, type, title, message, is_read)
             VALUES ($1, 'autopilot_risk', 'AutoPilot: Risk Check', $2, FALSE)`,
            [task.teacher_id, summary]
          ).catch(() => {});
        }
        break;
      }

      case "reminder": {
        const message = params.message ?? "You have upcoming deadlines. Please check your assignments.";
        await pool.query(
          `INSERT INTO notifications (account_id, type, title, message, is_read)
           SELECT a.id, 'autopilot_reminder', 'AutoPilot Reminder', $1, FALSE
           FROM students s
           JOIN accounts a ON s.account_id = a.id
           WHERE s.workspace_id = (SELECT workspace_id FROM accounts WHERE id = $2)
           LIMIT 50`,
          [message, task.teacher_id]
        ).catch(() => {});
        break;
      }

      case "assignment":
      case "report":
        break;
    }
  } catch (err) {
    console.error(`[AutoPilot] Task ${task.id} (${task.type}) failed:`, err);
  }
}
