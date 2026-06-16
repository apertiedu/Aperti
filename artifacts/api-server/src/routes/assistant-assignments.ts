import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { logError } from "../lib/log-error";
import { auditLog, getClientIp } from "../lib/financial-audit";

export const assistantAssignmentsRouter = Router();

assistantAssignmentsRouter.use(authenticate);

/* ── GET /api/assistant-assignments ────────────────────────────────────── */
assistantAssignmentsRouter.get("/", requireRole("admin", "super_admin", "teacher"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isAdmin = req.role === "admin" || req.role === "super_admin";
    const { rows } = await pool.query(
      isAdmin
        ? `SELECT aa.*,
                  asst.display_name AS assistant_name, asst.email AS assistant_email,
                  teacher.display_name AS teacher_name
           FROM assistant_assignments aa
           LEFT JOIN accounts asst ON asst.id = aa.assistant_id
           LEFT JOIN accounts teacher ON teacher.id = aa.teacher_id
           WHERE aa.active = TRUE
           ORDER BY aa.created_at DESC`
        : `SELECT aa.*,
                  asst.display_name AS assistant_name, asst.email AS assistant_email
           FROM assistant_assignments aa
           LEFT JOIN accounts asst ON asst.id = aa.assistant_id
           WHERE aa.teacher_id = $1 AND aa.active = TRUE
           ORDER BY aa.created_at DESC`,
      isAdmin ? [] : [req.userId],
    );
    res.json({ assignments: rows });
  } catch (err) {
    await logError(err, { route: "/api/assistant-assignments" });
    res.status(500).json({ error: "Failed to fetch assignments" });
  }
});

/* ── POST /api/assistant-assignments ───────────────────────────────────── */
assistantAssignmentsRouter.post("/", requireRole("admin", "super_admin", "teacher"), async (req: AuthRequest, res: Response): Promise<void> => {
  const ip = getClientIp(req as unknown as { ip?: string; headers: Record<string, string | string[] | undefined> });
  try {
    const { assistantId, teacherId: bodyTeacherId, courseIds } = req.body as {
      assistantId: number;
      teacherId?: number;
      courseIds: number[];
    };

    if (!assistantId || !courseIds?.length) {
      res.status(400).json({ error: "assistantId and courseIds are required" });
      return;
    }

    const isAdmin = req.role === "admin" || req.role === "super_admin";
    const effectiveTeacherId = isAdmin ? (bodyTeacherId ?? req.userId!) : req.userId!;

    const { rows: assistantRows } = await pool.query(
      "SELECT id, role FROM accounts WHERE id = $1 LIMIT 1",
      [assistantId],
    );
    if (assistantRows.length === 0 || assistantRows[0].role !== "assistant") {
      res.status(400).json({ error: "Specified user is not an assistant account" });
      return;
    }

    const { rows: courseRows } = await pool.query(
      `SELECT id FROM aperti_courses WHERE id = ANY($1) AND teacher_id = $2`,
      [courseIds, effectiveTeacherId],
    );
    if (courseRows.length !== courseIds.length) {
      res.status(403).json({ error: "All courses must belong to the teacher" });
      return;
    }

    const { rows } = await pool.query(
      `INSERT INTO assistant_assignments
         (assistant_id, teacher_id, granted_by, course_ids, active, created_at)
       VALUES ($1, $2, $3, $4, TRUE, NOW())
       ON CONFLICT (assistant_id, teacher_id)
       DO UPDATE SET course_ids = $4, active = TRUE, granted_by = $3, revoked_at = NULL
       RETURNING *`,
      [assistantId, effectiveTeacherId, req.userId, JSON.stringify(courseIds)],
    );

    auditLog({ actorId: req.userId!, actorRole: req.role!, action: "ASSIGN_ASSISTANT", targetId: assistantId, targetType: "assistant_assignment", ip, result: "success", metadata: { teacherId: effectiveTeacherId, courseIds } });
    res.status(201).json(rows[0]);
  } catch (err) {
    await logError(err, { route: "/api/assistant-assignments", method: "POST" });
    res.status(500).json({ error: "Failed to create assignment" });
  }
});

/* ── PATCH /api/assistant-assignments/:id/revoke ────────────────────────── */
assistantAssignmentsRouter.patch("/:id/revoke", requireRole("admin", "super_admin", "teacher"), async (req: AuthRequest, res: Response): Promise<void> => {
  const ip = getClientIp(req as unknown as { ip?: string; headers: Record<string, string | string[] | undefined> });
  try {
    const id = parseInt(req.params.id);
    const isAdmin = req.role === "admin" || req.role === "super_admin";

    const { rows } = await pool.query("SELECT * FROM assistant_assignments WHERE id = $1 LIMIT 1", [id]);
    if (rows.length === 0) { res.status(404).json({ error: "Assignment not found" }); return; }

    if (!isAdmin && rows[0].teacher_id !== req.userId) {
      res.status(403).json({ error: "You can only revoke your own assistant assignments" });
      return;
    }

    await pool.query(
      "UPDATE assistant_assignments SET active = FALSE, revoked_at = NOW() WHERE id = $1",
      [id],
    );

    auditLog({ actorId: req.userId!, actorRole: req.role!, action: "REVOKE_ASSISTANT", targetId: id, targetType: "assistant_assignment", ip, result: "success" });
    res.json({ success: true });
  } catch (err) {
    await logError(err, { route: `/api/assistant-assignments/${req.params.id}/revoke` });
    res.status(500).json({ error: "Failed to revoke assignment" });
  }
});

/* ── GET /api/assistant-assignments/my-scope (assistant self-view) ────── */
assistantAssignmentsRouter.get("/my-scope", requireRole("assistant"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      `SELECT aa.course_ids, aa.teacher_id, teacher.display_name AS teacher_name
       FROM assistant_assignments aa
       LEFT JOIN accounts teacher ON teacher.id = aa.teacher_id
       WHERE aa.assistant_id = $1 AND aa.active = TRUE`,
      [req.userId],
    );
    const allCourseIds = rows.flatMap((r) => {
      const ids: number[] = Array.isArray(r.course_ids) ? r.course_ids : JSON.parse(r.course_ids ?? "[]");
      return ids;
    });
    res.json({ assignments: rows, allCourseIds: [...new Set(allCourseIds)] });
  } catch (err) {
    await logError(err, { route: "/api/assistant-assignments/my-scope" });
    res.status(500).json({ error: "Failed to fetch scope" });
  }
});
