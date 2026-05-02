import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();

function requireAdmin(req: any, res: any, next: any) {
  const session = req.session as any;
  if (!session.accountId || session.role !== "admin") {
    res.status(403).json({ message: "Admin access required" });
    return;
  }
  next();
}

function requireAuth(req: any, res: any, next: any) {
  const session = req.session as any;
  if (!session.accountId) { res.status(401).json({ message: "Not authenticated" }); return; }
  next();
}

router.get("/past-papers", requireAuth, async (req, res): Promise<void> => {
  const { subject, year, session: sess, variant, search } = req.query as Record<string, string>;
  const conditions: string[] = ["is_public = true"];
  const params: unknown[] = [];
  let i = 1;
  if (subject) { conditions.push(`subject ILIKE $${i++}`); params.push(`%${subject}%`); }
  if (year) { conditions.push(`year = $${i++}`); params.push(parseInt(year, 10)); }
  if (sess) { conditions.push(`session ILIKE $${i++}`); params.push(`%${sess}%`); }
  if (variant) { conditions.push(`variant = $${i++}`); params.push(variant); }
  if (search) { conditions.push(`title ILIKE $${i++}`); params.push(`%${search}%`); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const { rows } = await pool.query(
    `SELECT pp.*, a.display_name AS uploaded_by_name
     FROM past_papers pp
     LEFT JOIN accounts a ON a.id = pp.uploaded_by
     ${where} ORDER BY year DESC NULLS LAST, session, variant, paper_number`,
    params
  );
  res.json(rows);
});

router.get("/past-papers/subjects", requireAuth, async (_req, res): Promise<void> => {
  const { rows } = await pool.query(
    `SELECT DISTINCT subject FROM past_papers WHERE is_public = true ORDER BY subject`
  );
  res.json(rows.map((r: any) => r.subject));
});

router.post("/past-papers", requireAdmin, async (req, res): Promise<void> => {
  const session = req.session as any;
  const { title, subject, year, session: sess, variant, paperNumber, fileUrl, markSchemeUrl, examinerReportUrl, isPublic } = req.body;
  if (!title?.trim() || !subject?.trim() || !fileUrl?.trim()) {
    res.status(400).json({ message: "title, subject and fileUrl are required" });
    return;
  }
  const { rows } = await pool.query(
    `INSERT INTO past_papers (title, subject, year, session, variant, paper_number, file_url, mark_scheme_url, examiner_report_url, uploaded_by, is_public)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [title.trim(), subject.trim(), year || null, sess?.trim() || null, variant?.trim() || null,
     paperNumber?.trim() || null, fileUrl.trim(), markSchemeUrl?.trim() || null,
     examinerReportUrl?.trim() || null, session.accountId, isPublic !== false]
  );
  res.status(201).json(rows[0]);
});

router.patch("/past-papers/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const { title, subject, year, session: sess, variant, paperNumber, fileUrl, markSchemeUrl, examinerReportUrl, isPublic } = req.body;
  const sets: string[] = []; const params: unknown[] = []; let i = 1;
  if (title) { sets.push(`title=$${i++}`); params.push(title.trim()); }
  if (subject) { sets.push(`subject=$${i++}`); params.push(subject.trim()); }
  if ("year" in req.body) { sets.push(`year=$${i++}`); params.push(year || null); }
  if ("session" in req.body) { sets.push(`session=$${i++}`); params.push(sess?.trim() || null); }
  if ("variant" in req.body) { sets.push(`variant=$${i++}`); params.push(variant?.trim() || null); }
  if ("paperNumber" in req.body) { sets.push(`paper_number=$${i++}`); params.push(paperNumber?.trim() || null); }
  if (fileUrl) { sets.push(`file_url=$${i++}`); params.push(fileUrl.trim()); }
  if ("markSchemeUrl" in req.body) { sets.push(`mark_scheme_url=$${i++}`); params.push(markSchemeUrl?.trim() || null); }
  if ("examinerReportUrl" in req.body) { sets.push(`examiner_report_url=$${i++}`); params.push(examinerReportUrl?.trim() || null); }
  if ("isPublic" in req.body) { sets.push(`is_public=$${i++}`); params.push(isPublic); }
  if (!sets.length) { res.status(400).json({ message: "Nothing to update" }); return; }
  params.push(id);
  const { rows } = await pool.query(
    `UPDATE past_papers SET ${sets.join(",")} WHERE id=$${i} RETURNING *`, params
  );
  if (!rows[0]) { res.status(404).json({ message: "Paper not found" }); return; }
  res.json(rows[0]);
});

router.delete("/past-papers/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const { rowCount } = await pool.query(`DELETE FROM past_papers WHERE id=$1`, [id]);
  if (!rowCount) { res.status(404).json({ message: "Paper not found" }); return; }
  res.json({ message: "Paper deleted" });
});

export default router;
