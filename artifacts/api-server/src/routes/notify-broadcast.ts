import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { requireTenantAccess } from "../middleware/tenant";

const router: IRouter = Router();

// POST /api/notifications/broadcast
// Body: { title, message, type, link?, target: "all" | "session" | "specific", sessionId?, studentIds? }
router.post("/notifications/broadcast", requireTenantAccess, async (req, res): Promise<void> => {
  const { teacherId, isAdmin, accountId } = req.tenant;
  const teacherCond = !isAdmin && teacherId ? `AND st.teacher_account_id = ${teacherId}` : "";
  const { title, message, type = "info", link, target, sessionId, studentIds } = req.body;

  if (!title || !message) { res.status(400).json({ error: "title and message required" }); return; }

  let accountFilter = "";
  if (target === "specific" && Array.isArray(studentIds) && studentIds.length > 0) {
    // Find student_account_ids for the given student row ids
    const { rows } = await pool.query(`
      SELECT a.id FROM accounts a
      JOIN students st ON st.id = ANY($1::int[]) AND a.id IS NOT NULL
      WHERE a.role = 'student' AND EXISTS (
        SELECT 1 FROM students s2 WHERE s2.id = ANY($1::int[]) AND s2.student_code = a.username
      ) ${teacherCond.replace('st.', 'st.')}
    `, [studentIds]).catch(() => ({ rows: [] }));
    // Simpler approach: get account_ids via student_codes
    const { rows: studentRows } = await pool.query(
      `SELECT student_code FROM students WHERE id = ANY($1::int[]) ${teacherCond}`,
      [studentIds]
    );
    const codes = studentRows.map((r: any) => r.student_code);
    if (codes.length === 0) { res.json({ sent: 0 }); return; }
    const { rows: accts } = await pool.query(
      `SELECT id FROM accounts WHERE username = ANY($1) AND role='student'`, [codes]
    );
    if (accts.length === 0) { res.json({ sent: 0 }); return; }
    const ids = accts.map((a: any) => a.id);
    // Insert notifications for these accounts
    let sent = 0;
    for (const aid of ids) {
      await pool.query(
        `INSERT INTO notifications (account_id, title, message, type, link) VALUES ($1,$2,$3,$4,$5)`,
        [aid, title, message, type, link || null]
      );
      sent++;
    }
    req.log.info({ action: "broadcast_notification", target: "specific", sent }, "Notification broadcast");
    res.json({ sent });
    return;
  }

  // All students (teacher-scoped) or session-filtered
  let sessionJoin = "";
  let sessionWhere = "";
  if (target === "session" && sessionId) {
    const sid = parseInt(sessionId as string, 10);
    sessionJoin = "";
    sessionWhere = `AND (st.lesson1_session_id=${sid} OR st.lesson2_session_id=${sid} OR st.lesson3_session_id=${sid})`;
  }

  const { rows: studentRows } = await pool.query(
    `SELECT st.student_code FROM students st WHERE st.status='active' ${teacherCond} ${sessionWhere}`,
  );
  const codes = studentRows.map((r: any) => r.student_code);
  if (codes.length === 0) { res.json({ sent: 0 }); return; }

  const { rows: accts } = await pool.query(
    `SELECT id FROM accounts WHERE username = ANY($1) AND role='student'`, [codes]
  );

  let sent = 0;
  for (const a of accts) {
    await pool.query(
      `INSERT INTO notifications (account_id, title, message, type, link) VALUES ($1,$2,$3,$4,$5)`,
      [a.id, title, message, type, link || null]
    );
    sent++;
  }

  req.log.info({ action: "broadcast_notification", target, sent }, "Notification broadcast");
  res.json({ sent });
});

export default router;
