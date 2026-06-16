import { Router, Response, Request } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";

export const pastPapersRouter = Router();

// PUBLIC: GET /past-papers — browse and filter
pastPapersRouter.get("/", async (req: Request, res: Response) => {
  try {
    const { subject, year, session, search } = req.query as Record<string, string>;
    let q = `SELECT id, board, subject, year, session, variant, paper_number,
                    COALESCE(title, '') AS title,
                    file_url, mark_scheme_url, examiner_report_url, created_at
             FROM past_papers WHERE is_public::text = 'true' OR is_public IS TRUE`;
    const params: any[] = [];
    if (subject) { params.push(subject); q += ` AND LOWER(subject) = LOWER($${params.length})`; }
    if (year)    { params.push(parseInt(year)); q += ` AND year = $${params.length}`; }
    if (session) { params.push(session); q += ` AND session = $${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      q += ` AND (LOWER(title) ILIKE $${params.length} OR LOWER(subject) ILIKE $${params.length} OR LOWER(board) ILIKE $${params.length})`;
    }
    q += " ORDER BY year DESC NULLS LAST, created_at DESC";
    const { rows } = await pool.query(q, params);

    // Synthesise a title if none stored
    const enriched = rows.map((p: any) => ({
      ...p,
      title: p.title || [p.board, p.subject, p.year, p.session, p.variant ? `Variant ${p.variant}` : null]
        .filter(Boolean).join(" — "),
    }));
    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// PUBLIC: GET /past-papers/subjects — distinct subject list
pastPapersRouter.get("/subjects", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT subject FROM past_papers WHERE (is_public::text = 'true' OR is_public IS TRUE) ORDER BY subject ASC`
    );
    res.json(rows.map((r: any) => r.subject));
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// ADMIN: POST /past-papers — create a paper record
pastPapersRouter.post(
  "/",
  authenticate,
  requireRole("admin", "admin_assistant"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { board, subject, year, session, variant, paperNumber, title,
              fileUrl, markSchemeUrl, examinerReportUrl } = req.body;
      if (!subject || !fileUrl) return res.status(400).json({ error: "subject and fileUrl required" });
      const { rows } = await pool.query(
        `INSERT INTO past_papers
          (board, subject, year, session, variant, paper_number, title, file_url, mark_scheme_url,
           examiner_report_url, uploaded_by, is_public, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'true',NOW()) RETURNING *`,
        [board || null, subject, year || null, session || null, variant || null,
         paperNumber || null, title || null, fileUrl, markSchemeUrl || null,
         examinerReportUrl || null, req.userId]
      );
      res.status(201).json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: "An unexpected error occurred" });
    }
  }
);

// ADMIN: POST /past-papers/upload — multipart upload (existing admin panel)
pastPapersRouter.post(
  "/upload",
  authenticate,
  requireRole("admin", "admin_assistant"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { board, subject, year, session, variant, paperNumber, title,
              fileUrl, markSchemeUrl, examinerReportUrl } = req.body;
      if (!subject || !fileUrl) return res.status(400).json({ error: "subject and fileUrl required" });
      const { rows } = await pool.query(
        `INSERT INTO past_papers
          (board, subject, year, session, variant, paper_number, title, file_url, mark_scheme_url,
           examiner_report_url, uploaded_by, is_public, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'true',NOW()) RETURNING *`,
        [board || null, subject, year ? parseInt(year) : null, session || null,
         variant || null, paperNumber || null, title || null, fileUrl,
         markSchemeUrl || null, examinerReportUrl || null, req.userId]
      );
      res.status(201).json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: "An unexpected error occurred" });
    }
  }
);

// ADMIN: DELETE /past-papers/:id
pastPapersRouter.delete(
  "/:id",
  authenticate,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      await pool.query("DELETE FROM past_papers WHERE id=$1", [parseInt(req.params.id)]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: "An unexpected error occurred" });
    }
  }
);
