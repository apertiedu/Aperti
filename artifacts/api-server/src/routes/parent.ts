import { Router, Response } from "express";
import { authenticate, AuthRequest, requireRole } from "../middleware/auth";
import { pool } from "@workspace/db";
import { randomBytes } from "crypto";
import { auditFromReq } from "../lib/audit";
import { notifyAndPush } from "../lib/notify";

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
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
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
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
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
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
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
    auditFromReq(req, "PARENT_LINK_APPROVE", "guardian_links", { resourceId: parseInt(req.params.id), metadata: { status } });
    const linkId = parseInt(req.params.id);
    pool.query(
      `SELECT s.account_id FROM guardian_links gl
       JOIN students s ON s.id = gl.student_id
       WHERE gl.id = $1 AND s.account_id IS NOT NULL`,
      [linkId]
    ).then(({ rows: linkRows }) => {
      const accountId = linkRows[0]?.account_id;
      if (!accountId) return;
      const approved = status === "active";
      notifyAndPush(accountId, {
        title: approved ? "Parent link approved" : "Parent link declined",
        message: approved
          ? "Your parent link request was approved. Your parent can now view your progress."
          : "Your parent link request was declined.",
        type: "parent_link",
        link: "/settings",
        pushBody: approved ? "Your parent link request was approved." : "Your parent link request was declined.",
        relatedEntityType: "guardian_link",
        relatedEntityId: linkId,
      }).catch(() => {});
    }).catch(() => {});
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

// GET /parent/child-stats/:linkId — parent gets child's attendance & homework summary
parentRouter.get("/child-stats/:linkId", authenticate, requireRole("parent"), async (req: AuthRequest, res: Response) => {
  try {
    const linkId = parseInt(req.params.linkId);
    const { rows: linkRows } = await pool.query(
      "SELECT student_id FROM guardian_links WHERE id=$1 AND parent_account_id=$2 AND status='active'",
      [linkId, req.userId]
    );
    if (!linkRows.length) return res.status(404).json({ error: "Link not found or not active" });
    const studentId = linkRows[0].student_id;

    const { rows: attRows } = await pool.query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) AS present
       FROM attendance WHERE student_id=$1`, [studentId]
    );
    const total = parseInt(attRows[0]?.total || "0");
    const present = parseInt(attRows[0]?.present || "0");
    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;

    const { rows: hwRows } = await pool.query(
      `SELECT
         COUNT(CASE WHEN submission_status IN ('submitted','graded') THEN 1 END) AS submitted,
         COUNT(CASE WHEN submission_status='pending' THEN 1 END) AS pending
       FROM homework_submissions WHERE student_id=$1`, [studentId]
    );

    res.json({
      attendanceRate,
      totalSessions: total,
      presentCount: present,
      homeworkSubmitted: parseInt(hwRows[0]?.submitted || "0"),
      homeworkPending: parseInt(hwRows[0]?.pending || "0"),
    });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

// ── STUDENT ENDPOINTS ────────────────────────────────────────────────────────

// GET /parent/my-links — student sees their own guardian link requests
parentRouter.get("/my-links", authenticate, requireRole("student"), async (req: AuthRequest, res: Response) => {
  try {
    const { rows: studentRows } = await pool.query(
      "SELECT id FROM students WHERE account_id=$1", [req.userId]
    );
    if (!studentRows.length) return res.json([]);
    const studentId = studentRows[0].id;
    const { rows } = await pool.query(
      `SELECT gl.id, gl.status, gl.pairing_code, gl.requested_at
       FROM guardian_links gl
       WHERE gl.student_id=$1
       ORDER BY gl.requested_at DESC`,
      [studentId]
    );
    res.json(rows);
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

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
    auditFromReq(req, "PARENT_LINK_CREATE", "guardian_links", { resourceId: rows[0]?.id, metadata: { parentId, studentId } });
    notifyAndPush(parentId, {
      title: "Parent link request received",
      message: "A student has requested to link with your account. Review it in your pending links.",
      type: "parent_link",
      link: "/parent/pending-links",
      pushBody: "A student requested to link with your account.",
      relatedEntityType: "guardian_link",
      relatedEntityId: rows[0]?.id,
    }).catch(() => {});
    res.status(201).json(rows[0]);
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});
