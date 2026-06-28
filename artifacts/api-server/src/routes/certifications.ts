import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, AuthRequest, requireRole } from "../middleware/auth";
import crypto from "crypto";

export const certificationsRouter = Router();

const teacherOrAdmin = [authenticate, requireRole("teacher", "admin")];
const anyAuth = [authenticate];

// ── POST /certificates/issue ────────────────────────────────────────────────
certificationsRouter.post("/certificates/issue", ...teacherOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const issuedBy = req.userId!;
    const {
      student_id, course_id, assessment_id,
      title, description, template = {},
    } = req.body;

    if (!student_id || !title) {
      return res.status(400).json({ error: "student_id and title required" });
    }

    const { rows: studentRows } = await pool.query(
      `SELECT s.id FROM students s WHERE s.id = $1 AND s.teacher_account_id = $2`,
      [student_id, issuedBy]
    );
    if (!studentRows.length) {
      return res.status(403).json({ error: "Student not in your scope" });
    }

    if (assessment_id) {
      const { rows: markRows } = await pool.query(
        `SELECT sm.marks_scored, e.total_marks
         FROM student_marks sm
         JOIN exams e ON e.id = sm.exam_id
         WHERE sm.exam_id = $1 AND sm.student_id = $2 AND sm.approved_at IS NOT NULL
         LIMIT 1`,
        [assessment_id, student_id]
      );
      if (!markRows.length) {
        return res.status(422).json({ error: "No approved grade found for this student on the selected assessment" });
      }
      const mark = markRows[0];
      const pct = parseFloat(mark.marks_scored) / parseFloat(mark.total_marks);
      if (pct < 0.5) {
        return res.status(422).json({
          error: `Student scored ${Math.round(pct * 100)}% — a passing mark (≥50%) is required to issue a certificate`,
        });
      }
    }

    const uniqueCode = `APT-${crypto.randomBytes(4).toString("hex").toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const verificationUrl = `${process.env.PUBLIC_URL ?? "https://aperti.ai"}/verify/${uniqueCode}`;

    const { rows } = await pool.query(
      `INSERT INTO certificates
         (student_id, course_id, assessment_id, title, description,
          template, issued_by, unique_code, verification_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [student_id, course_id ?? null, assessment_id ?? null,
       title, description ?? null, JSON.stringify(template),
       issuedBy, uniqueCode, verificationUrl]
    );

    res.status(201).json({ certificate: rows[0] });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

// ── GET /certificates/:id ────────────────────────────────────────────────────
certificationsRouter.get("/certificates/:id", ...anyAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT c.*, a.display_name AS student_name,
              iss.display_name AS issued_by_name
       FROM certificates c
       JOIN students s ON s.id = c.student_id
       JOIN accounts a ON a.id = s.account_id
       JOIN accounts iss ON iss.id = c.issued_by
       WHERE c.id=$1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: "Certificate not found" });
    res.json({ certificate: rows[0] });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

// ── GET /certificates/verify/:code — PUBLIC ───────────────────────────────────
certificationsRouter.get("/certificates/verify/:code", async (_req: AuthRequest, res: Response) => {
  try {
    const { code } = _req.params;
    const { rows } = await pool.query(
      `SELECT c.title, c.description, c.issued_at, c.status,
              a.display_name AS student_name,
              iss.display_name AS issued_by_name
       FROM certificates c
       JOIN students s ON s.id = c.student_id
       JOIN accounts a ON a.id = s.account_id
       JOIN accounts iss ON iss.id = c.issued_by
       WHERE c.unique_code=$1`,
      [code]
    );
    if (!rows.length) return res.status(404).json({ valid: false, error: "Certificate not found" });
    const cert = rows[0];
    res.json({
      valid: cert.status === "active",
      status: cert.status,
      certificate: cert,
    });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

// ── GET /certificates/student/:studentId ─────────────────────────────────────
certificationsRouter.get("/certificates/student/:studentId", ...anyAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { studentId } = req.params;
    const { rows } = await pool.query(
      `SELECT c.*, iss.display_name AS issued_by_name
       FROM certificates c
       JOIN accounts iss ON iss.id = c.issued_by
       WHERE c.student_id=$1 AND c.status='active'
       ORDER BY c.issued_at DESC`,
      [studentId]
    );
    res.json({ certificates: rows });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

// ── GET /certificates — teacher lists certs they issued ─────────────────────
certificationsRouter.get("/certificates", ...teacherOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.userId!;
    const { rows } = await pool.query(
      `SELECT c.*, a.display_name AS student_name
       FROM certificates c
       JOIN students s ON s.id = c.student_id
       JOIN accounts a ON a.id = s.account_id
       WHERE c.issued_by=$1
       ORDER BY c.issued_at DESC LIMIT 50`,
      [teacherId]
    );
    res.json({ certificates: rows });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

// ── PUT /certificates/:id/revoke ─────────────────────────────────────────────
certificationsRouter.put("/certificates/:id/revoke", ...teacherOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      "UPDATE certificates SET status='revoked', revoked_at=NOW(), revoked_by=$2 WHERE id=$1 AND issued_by=$2 RETURNING *",
      [id, req.userId!]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found or unauthorized" });
    res.json({ certificate: rows[0] });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

// ══════════════════════════════════════════════════════════════════
// TRANSCRIPTS
// ══════════════════════════════════════════════════════════════════

certificationsRouter.post("/transcripts/generate", ...anyAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { student_id } = req.body;

    const stuRes = await pool.query("SELECT id, account_id FROM students WHERE id=$1", [student_id]);
    if (!stuRes.rows.length) return res.status(404).json({ error: "Student not found" });

    const [marksRes, certsRes] = await Promise.all([
      pool.query(
        `SELECT sm.marks_scored, sm.grading_status,
                e.title, e.total_marks, e.created_at
         FROM student_marks sm
         JOIN exams e ON e.id = sm.exam_id
         WHERE sm.student_id=$1 AND sm.approved_at IS NOT NULL
         ORDER BY e.created_at`,
        [student_id]
      ),
      pool.query(
        "SELECT title, issued_at, unique_code FROM certificates WHERE student_id=$1 AND status='active'",
        [student_id]
      ),
    ]);

    const profileRes = await pool.query(
      "SELECT a.display_name, s.grade_level FROM students s JOIN accounts a ON a.id=s.account_id WHERE s.id=$1",
      [student_id]
    );

    const data = {
      student: profileRes.rows[0],
      generated_at: new Date(),
      assessments: marksRes.rows,
      certificates: certsRes.rows,
      overall_average: marksRes.rows.length
        ? Math.round(
            marksRes.rows.reduce((s: number, r: any) =>
              s + (parseFloat(r.marks_scored) / parseFloat(r.total_marks)) * 100, 0
            ) / marksRes.rows.length
          )
        : null,
    };

    const { rows } = await pool.query(
      `INSERT INTO transcripts (student_id, data, version)
       VALUES ($1,$2, (SELECT COALESCE(MAX(version),0)+1 FROM transcripts WHERE student_id=$1))
       RETURNING *`,
      [student_id, JSON.stringify(data)]
    );

    res.json({ transcript: rows[0] });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

certificationsRouter.get("/transcripts/student/:studentId", ...anyAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { studentId } = req.params;
    const { rows } = await pool.query(
      "SELECT * FROM transcripts WHERE student_id=$1 ORDER BY generated_at DESC LIMIT 5",
      [studentId]
    );
    res.json({ transcripts: rows });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});
