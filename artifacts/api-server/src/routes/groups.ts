import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";

export const groupsRouter = Router();
groupsRouter.use(authenticate);

groupsRouter.get("/", async (req: AuthRequest, res: Response) => {
  const teacherId = req.user!.id;
  try {
    const { rows } = await pool.query(
      `SELECT g.*, COUNT(gm.student_id)::int AS student_count
       FROM teacher_groups g
       LEFT JOIN teacher_group_members gm ON gm.group_id = g.id
       WHERE g.teacher_account_id = $1
       GROUP BY g.id ORDER BY g.created_at DESC`,
      [teacherId]
    );
    res.json({ groups: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

groupsRouter.post("/", async (req: AuthRequest, res: Response) => {
  const teacherId = req.user!.id;
  const { name, type = "class", description, color } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Group name is required" });
  try {
    const { rows } = await pool.query(
      `INSERT INTO teacher_groups (teacher_account_id, name, type, description, color)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [teacherId, name.trim(), type, description?.trim() ?? null, color ?? "#0D9488"]
    );
    res.status(201).json({ group: rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

groupsRouter.patch("/:id", async (req: AuthRequest, res: Response) => {
  const teacherId = req.user!.id;
  const groupId = parseInt(req.params.id);
  const { name, type, description, color, is_active } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE teacher_groups SET
         name = COALESCE($3, name),
         type = COALESCE($4, type),
         description = COALESCE($5, description),
         color = COALESCE($6, color),
         is_active = COALESCE($7, is_active)
       WHERE id = $1 AND teacher_account_id = $2
       RETURNING *`,
      [groupId, teacherId, name ?? null, type ?? null, description ?? null, color ?? null, is_active ?? null]
    );
    if (!rows.length) return res.status(404).json({ error: "Group not found" });
    res.json({ group: rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

groupsRouter.delete("/:id", async (req: AuthRequest, res: Response) => {
  const teacherId = req.user!.id;
  const groupId = parseInt(req.params.id);
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM teacher_groups WHERE id = $1 AND teacher_account_id = $2`,
      [groupId, teacherId]
    );
    if (!rowCount) return res.status(404).json({ error: "Group not found" });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

groupsRouter.get("/:id/members", async (req: AuthRequest, res: Response) => {
  const teacherId = req.user!.id;
  const groupId = parseInt(req.params.id);
  try {
    const { rows: groupRows } = await pool.query(
      `SELECT id FROM teacher_groups WHERE id = $1 AND teacher_account_id = $2`,
      [groupId, teacherId]
    );
    if (!groupRows.length) return res.status(403).json({ error: "Not authorized" });

    const { rows } = await pool.query(
      `SELECT s.id, s.student_name, s.student_code, s.phone_number, s.photo_url, gm.added_at
       FROM teacher_group_members gm
       JOIN students s ON s.id = gm.student_id
       WHERE gm.group_id = $1
       ORDER BY s.student_name ASC`,
      [groupId]
    );
    res.json({ members: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

groupsRouter.post("/:id/members", async (req: AuthRequest, res: Response) => {
  const teacherId = req.user!.id;
  const groupId = parseInt(req.params.id);
  const { studentIds } = req.body;
  if (!Array.isArray(studentIds) || !studentIds.length) {
    return res.status(400).json({ error: "studentIds array required" });
  }
  try {
    const { rows: groupRows } = await pool.query(
      `SELECT id FROM teacher_groups WHERE id = $1 AND teacher_account_id = $2`,
      [groupId, teacherId]
    );
    if (!groupRows.length) return res.status(403).json({ error: "Not authorized" });

    for (const sid of studentIds) {
      await pool.query(
        `INSERT INTO teacher_group_members (group_id, student_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [groupId, sid]
      );
    }
    res.json({ ok: true, added: studentIds.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

groupsRouter.delete("/:id/members/:studentId", async (req: AuthRequest, res: Response) => {
  const teacherId = req.user!.id;
  const groupId = parseInt(req.params.id);
  const studentId = parseInt(req.params.studentId);
  try {
    const { rows: groupRows } = await pool.query(
      `SELECT id FROM teacher_groups WHERE id = $1 AND teacher_account_id = $2`,
      [groupId, teacherId]
    );
    if (!groupRows.length) return res.status(403).json({ error: "Not authorized" });
    await pool.query(`DELETE FROM teacher_group_members WHERE group_id=$1 AND student_id=$2`, [groupId, studentId]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

groupsRouter.get("/admin/all", requireRole("admin", "super_admin") as any, async (_req, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT g.*, a.display_name AS teacher_name, a.email AS teacher_email,
             COUNT(gm.student_id)::int AS student_count
      FROM teacher_groups g
      LEFT JOIN accounts a ON a.id = g.teacher_account_id
      LEFT JOIN teacher_group_members gm ON gm.group_id = g.id
      GROUP BY g.id, a.display_name, a.email ORDER BY g.created_at DESC
    `);
    res.json({ groups: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
