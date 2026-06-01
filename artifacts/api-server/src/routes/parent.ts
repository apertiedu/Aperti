import { Router, Response } from "express";
import { authenticate, AuthRequest, requireRole } from "../middleware/auth";
import { pool } from "@workspace/db";
import { randomBytes } from "crypto";

export const parentRouter = Router();

function generatePairingCode(): string {
  return randomBytes(4).toString("hex").toUpperCase(); // 8-char e.g. A3F7B2D1
}

// ── PARENT ENDPOINTS ─────────────────────────────────────────────────────────

// GET /parent/my-code — get or generate pairing code
parentRouter.get("/my-code", authenticate, requireRole("parent"), async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query("SELECT pairing_code FROM accounts WHERE id=$1", [req.userId]);
    let code = rows[0]?.pairing_code;
    if (!code) {
      code = generatePairingCode();
      await pool.query("UPDATE accounts SET pairing_code=$1 WHERE id=$2", [code, req.userId]);
    }
    res.json({ pairingCode: code });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /parent/generate-code — regenerate pairing code
parentRouter.post("/generate-code", authenticate, requireRole("parent"), async (req: AuthRequest, res: Response) => {
  try {
    let code: string;
    let unique = false;
    while (!unique) {
      code = generatePairingCode();
      const { rows } = await pool.query("SELECT id FROM accounts WHERE pairing_code=$1", [code!]);
      if (!rows.length) unique = true;
    }
    await pool.query("UPDATE accounts SET pairing_code=$1 WHERE id=$2", [code!, req.userId]);
    res.json({ pairingCode: code! });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /parent/pending-links — see pending link requests from students
parentRouter.get("/pending-links", authenticate, requireRole("parent"), async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT gl.*, s.student_name, s.student_code, a.display_name AS student_display_name, a.email AS student_email
       FROM guardian_links gl
       JOIN students s ON gl.student_id=s.id
       LEFT JOIN accounts a ON s.account_id=a.id
       WHERE gl.parent_account_id=$1
       ORDER BY gl.requested_at DESC`,
      [req.userId]
    );
    res.json(rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// PUT /parent/approve-link/:id — approve or reject a link
parentRouter.put("/approve-link/:id", authenticate, requireRole("parent"), async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body; // 'active' | 'rejected'
    if (!["active","rejected"].includes(status)) return res.status(400).json({ error: "Invalid status" });
    const { rowCount } = await pool.query(
      "UPDATE guardian_links SET status=$1 WHERE id=$2 AND parent_account_id=$3",
      [status, parseInt(req.params.id), req.userId]
    );
    if (!rowCount) return res.status(404).json({ error: "Link not found" });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── STUDENT ENDPOINT ─────────────────────────────────────────────────────────

// POST /parent/link-student — student enters parent's pairing code
parentRouter.post("/link-student", authenticate, requireRole("student"), async (req: AuthRequest, res: Response) => {
  try {
    const { pairingCode } = req.body;
    if (!pairingCode) return res.status(400).json({ error: "pairingCode is required" });

    // Find parent by code
    const { rows: parentRows } = await pool.query(
      "SELECT id FROM accounts WHERE pairing_code=$1 AND role='parent'",
      [pairingCode.trim().toUpperCase()]
    );
    if (!parentRows.length) return res.status(404).json({ error: "No parent found with that pairing code. Please check the code and try again." });

    const parentId = parentRows[0].id;

    // Find student record for this account
    const { rows: studentRows } = await pool.query(
      "SELECT id FROM students WHERE account_id=$1", [req.userId]
    );
    if (!studentRows.length) return res.status(400).json({ error: "No student profile found for your account" });

    const studentId = studentRows[0].id;

    // Check if already linked
    const { rows: existing } = await pool.query(
      "SELECT id FROM guardian_links WHERE parent_account_id=$1 AND student_id=$2",
      [parentId, studentId]
    );
    if (existing.length) return res.status(409).json({ error: "A link with this parent already exists" });

    // Create pending link
    const { rows } = await pool.query(
      `INSERT INTO guardian_links (parent_account_id, student_id, status, pairing_code, requested_at)
       VALUES ($1,$2,'pending',$3,NOW()) RETURNING *`,
      [parentId, studentId, pairingCode.trim().toUpperCase()]
    );
    res.status(201).json(rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});
