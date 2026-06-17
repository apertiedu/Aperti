import { Router, Request, Response } from "express";
import { pool, db } from "@workspace/db";
import { requireRole } from "../middleware/auth";
import { sql } from "drizzle-orm";

export const adminCoursesRouter = Router();
adminCoursesRouter.use(requireRole("admin", "super_admin"));

adminCoursesRouter.get("/", async (req: Request, res: Response) => {
  try {
    const pageNum = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const limitNum = Math.min(200, Math.max(1, parseInt((req.query.limit as string) || "50", 10)));
    const offset = (pageNum - 1) * limitNum;
    const search = (req.query.search as string) ?? "";

    // Use fully parameterized query — never interpolate user input into SQL
    const params: any[] = [];
    let searchClause = "";
    if (search) {
      params.push(`%${search}%`);
      searchClause = `AND (tc.name ILIKE $${params.length})`;
    }
    params.push(limitNum, offset);
    const limitIdx = params.length - 1;
    const offsetIdx = params.length;

    const { rows } = await pool.query(`
      SELECT tc.*, a.username, a.display_name as teacher_name,
             (SELECT count(*)::int FROM course_units WHERE course_id = tc.id) as unit_count
      FROM teacher_courses tc
      LEFT JOIN accounts a ON a.id = tc.teacher_account_id
      WHERE 1=1 ${searchClause}
      ORDER BY tc.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `, params).catch(() => ({ rows: [] }));
    const { rows: cnt } = await pool.query("SELECT count(*)::int as c FROM teacher_courses").catch(() => ({ rows: [{ c: 0 }] }));
    res.json({ courses: rows, total: cnt[0].c });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch courses" });
  }
});

adminCoursesRouter.put("/:id", async (req: Request, res: Response) => {
  try {
    const { visibility, teacherAccountId } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (visibility !== undefined) { updates.push(`visibility = $${idx++}`); values.push(visibility); }
    if (teacherAccountId !== undefined) { updates.push(`teacher_account_id = $${idx++}`); values.push(teacherAccountId); }
    if (updates.length === 0) return res.status(400).json({ error: "No updates provided" });
    values.push(req.params.id);
    await pool.query(`UPDATE teacher_courses SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${idx}`, values).catch(() => {});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update course" });
  }
});

adminCoursesRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    await pool.query("UPDATE teacher_courses SET visibility = 'archived' WHERE id = $1", [req.params.id]).catch(() => {});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to archive course" });
  }
});
