import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { pool } from "@workspace/db";

export const rubricsRouter = Router();

rubricsList();
rubricsCreate();
rubricsGet();
rubricsUpdate();
rubricsDelete();

function rubricsList() {
  rubricsRouter.get("/rubrics", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const tid = req.userId!;
      const { rows } = await pool.query(
        `SELECT r.*, s.name AS subject_name, h.title AS homework_title
           FROM rubrics r
           LEFT JOIN subjects s ON r.subject_id = s.id
           LEFT JOIN homework h ON r.homework_id = h.id
          WHERE r.teacher_account_id = $1
          ORDER BY r.created_at DESC`,
        [tid],
      );
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
}

function rubricsCreate() {
  rubricsRouter.post("/rubrics", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const tid = req.userId!;
      const { title, type, max_marks, subject_id, homework_id, criteria } = req.body;
      const { rows } = await pool.query(
        `INSERT INTO rubrics (teacher_account_id, title, type, max_marks, subject_id, homework_id, criteria)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [tid, title, type || "analytic", max_marks || 10, subject_id || null, homework_id || null, JSON.stringify(criteria || [])],
      );
      res.status(201).json(rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
}

function rubricsGet() {
  rubricsRouter.get("/rubrics/:id", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const { rows } = await pool.query(
        `SELECT r.*, s.name AS subject_name FROM rubrics r LEFT JOIN subjects s ON r.subject_id = s.id WHERE r.id=$1`,
        [req.params.id],
      );
      if (!rows.length) return res.status(404).json({ error: "Not found" });
      res.json(rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
}

function rubricsUpdate() {
  rubricsRouter.put("/rubrics/:id", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const { title, type, max_marks, subject_id, homework_id, criteria } = req.body;
      await pool.query(
        `UPDATE rubrics SET title=$1, type=$2, max_marks=$3, subject_id=$4, homework_id=$5, criteria=$6, updated_at=NOW() WHERE id=$7 AND teacher_account_id=$8`,
        [title, type, max_marks, subject_id || null, homework_id || null, JSON.stringify(criteria || []), req.params.id, req.userId!],
      );
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
}

function rubricsDelete() {
  rubricsRouter.delete("/rubrics/:id", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      await pool.query("DELETE FROM rubrics WHERE id=$1 AND teacher_account_id=$2", [req.params.id, req.userId!]);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
}
