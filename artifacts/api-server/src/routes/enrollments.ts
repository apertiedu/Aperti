import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { requireAssistantPermission } from "../middleware/permissions";
import { notifyUser } from "../lib/notify";
import { logActivity } from "../lib/activity";

export const enrollmentsRouter = Router();

const VALID_STATES = ["requested", "payment_pending", "verification_pending", "approved", "rejected", "cancelled", "suspended"] as const;
type EnrollmentStatus = typeof VALID_STATES[number];

const VALID_TRANSITIONS: Record<string, string[]> = {
  requested:            ["payment_pending", "verification_pending", "approved", "rejected", "cancelled"],
  payment_pending:      ["verification_pending", "approved", "rejected", "cancelled"],
  verification_pending: ["approved", "rejected", "cancelled"],
  approved:             ["suspended", "cancelled"],
  rejected:             ["requested"],
  cancelled:            ["requested"],
  suspended:            ["approved", "cancelled"],
};

function isValidTransition(from: string, to: string): boolean {
  return (VALID_TRANSITIONS[from] ?? []).includes(to);
}

function guardInt(val: string | undefined, fallback = 50): number {
  const n = parseInt(val ?? "");
  return isNaN(n) || n < 1 ? fallback : Math.min(n, 200);
}

enrollmentsRouter.use(authenticate);

/* ── Teacher/Admin: list enrollments with filters + search + pagination ─── */
enrollmentsRouter.get(
  "/",
  requireRole("teacher", "admin", "super_admin", "assistant"),
  requireAssistantPermission("can_manage_enrollments"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { status, search, course_id, limit, offset } = req.query as Record<string, string>;
      const lim = guardInt(limit);
      const off = guardInt(offset, 0);
      const isAdmin = req.role === "admin" || req.role === "super_admin";

      const params: unknown[] = [];
      const conditions: string[] = ["e.deleted_at IS NULL"];

      if (!isAdmin) {
        params.push(req.userId);
        conditions.push(`c.teacher_account_id = $${params.length}`);
      }
      if (status && VALID_STATES.includes(status as EnrollmentStatus)) {
        params.push(status);
        conditions.push(`e.status = $${params.length}`);
      }
      if (course_id) {
        params.push(parseInt(course_id));
        conditions.push(`e.course_id = $${params.length}`);
      }
      if (search) {
        params.push(`%${search}%`);
        conditions.push(`(a.display_name ILIKE $${params.length} OR a.email ILIKE $${params.length} OR c.title ILIKE $${params.length})`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const { rows } = await pool.query(
        `SELECT e.*,
                c.title AS course_title, c.subject AS course_subject,
                a.display_name AS student_name, a.email AS student_email, a.username AS student_username,
                approver.display_name AS approved_by_name
         FROM course_enrollments e
         JOIN aperti_courses c ON c.id = e.course_id
         JOIN accounts a ON a.id = e.student_account_id
         LEFT JOIN accounts approver ON approver.id = e.approved_by
         ${where}
         ORDER BY e.requested_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, lim, off],
      );

      const { rows: countRows } = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM course_enrollments e
         JOIN aperti_courses c ON c.id = e.course_id
         JOIN accounts a ON a.id = e.student_account_id
         ${where}`,
        params,
      );

      res.json({ enrollments: rows, total: countRows[0]?.total ?? 0, limit: lim, offset: off });
    } catch {
      res.status(500).json({ error: "Failed to fetch enrollments" });
    }
  },
);

/* ── Student: my enrollments ─────────────────────────────────────────────── */
enrollmentsRouter.get("/my", requireRole("student"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.query as Record<string, string>;
    const params: unknown[] = [req.userId];
    let where = "WHERE e.student_account_id = $1 AND e.deleted_at IS NULL";
    if (status && VALID_STATES.includes(status as EnrollmentStatus)) {
      params.push(status);
      where += ` AND e.status = $${params.length}`;
    }
    const { rows } = await pool.query(
      `SELECT e.*, c.title AS course_title, c.subject, c.price_egp, c.thumbnail_url, c.description,
              a.display_name AS teacher_name
       FROM course_enrollments e
       JOIN aperti_courses c ON c.id = e.course_id
       LEFT JOIN accounts a ON a.id = c.teacher_account_id
       ${where}
       ORDER BY e.requested_at DESC`,
      params,
    );
    res.json({ enrollments: rows });
  } catch {
    res.status(500).json({ error: "Failed to fetch enrollments" });
  }
});

/* ── Enrollment detail ───────────────────────────────────────────────────── */
enrollmentsRouter.get("/:id", requireRole("teacher", "admin", "super_admin", "assistant", "student"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const isAdmin = req.role === "admin" || req.role === "super_admin";
    const isStudent = req.role === "student";

    const { rows } = await pool.query(
      `SELECT e.*,
              c.title AS course_title, c.subject, c.price_egp, c.thumbnail_url,
              a.display_name AS student_name, a.email AS student_email,
              teacher_acc.display_name AS teacher_name,
              approver.display_name AS approved_by_name
       FROM course_enrollments e
       JOIN aperti_courses c ON c.id = e.course_id
       JOIN accounts a ON a.id = e.student_account_id
       LEFT JOIN accounts teacher_acc ON teacher_acc.id = c.teacher_account_id
       LEFT JOIN accounts approver ON approver.id = e.approved_by
       WHERE e.id = $1 AND e.deleted_at IS NULL`,
      [id],
    );

    if (!rows[0]) {
      res.status(404).json({ error: "Enrollment not found" });
      return;
    }

    const enrollment = rows[0];

    if (isStudent && enrollment.student_account_id !== req.userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    if (!isAdmin && !isStudent && enrollment.teacher_account_id !== req.userId) {
      if (req.role === "assistant") {
        const { rows: aRows } = await pool.query(
          `SELECT 1 FROM accounts WHERE id=$1 AND teacher_account_id=$2`,
          [req.userId, enrollment.teacher_account_id],
        );
        if (!aRows.length) {
          res.status(403).json({ error: "Access denied" });
          return;
        }
      } else {
        res.status(403).json({ error: "Access denied" });
        return;
      }
    }

    const { rows: history } = await pool.query(
      `SELECT al.* FROM activity_logs al
       WHERE al.entity_type = 'enrollment' AND al.entity_id = $1
       ORDER BY al.created_at DESC LIMIT 20`,
      [id],
    );

    res.json({ enrollment, history });
  } catch {
    res.status(500).json({ error: "Failed to fetch enrollment" });
  }
});

/* ── Transition enrollment status (FSM) ──────────────────────────────────── */
enrollmentsRouter.put(
  "/:id/status",
  requireRole("teacher", "admin", "super_admin", "assistant"),
  requireAssistantPermission("can_manage_enrollments"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      const { status, notes, reason, payment_reference } = req.body as {
        status: string;
        notes?: string;
        reason?: string;
        payment_reference?: string;
      };

      if (!status || !VALID_STATES.includes(status as EnrollmentStatus)) {
        res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATES.join(", ")}` });
        return;
      }

      const isAdmin = req.role === "admin" || req.role === "super_admin";

      const { rows } = await pool.query(
        `SELECT e.*, c.teacher_account_id, c.title AS course_title,
                a.display_name AS student_name, a.id AS student_acc_id
         FROM course_enrollments e
         JOIN aperti_courses c ON c.id = e.course_id
         JOIN accounts a ON a.id = e.student_account_id
         WHERE e.id = $1 AND e.deleted_at IS NULL`,
        [id],
      );

      if (!rows[0]) {
        res.status(404).json({ error: "Enrollment not found" });
        return;
      }

      const enrollment = rows[0];

      if (!isAdmin && enrollment.teacher_account_id !== req.userId) {
        if (req.role === "assistant") {
          const { rows: aRows } = await pool.query(
            `SELECT 1 FROM accounts WHERE id=$1 AND teacher_account_id=$2`,
            [req.userId, enrollment.teacher_account_id],
          );
          if (!aRows.length) {
            res.status(403).json({ error: "Access denied" });
            return;
          }
        } else {
          res.status(403).json({ error: "Access denied: not the course owner" });
          return;
        }
      }

      if (!isValidTransition(enrollment.status, status)) {
        res.status(422).json({
          error: `Invalid transition: cannot move from '${enrollment.status}' to '${status}'`,
          valid_transitions: VALID_TRANSITIONS[enrollment.status] ?? [],
        });
        return;
      }

      const setFields: string[] = [
        "status = $1",
        "updated_at = NOW()",
        `updated_by = $2`,
      ];
      const params: unknown[] = [status, req.userId];

      if (notes) {
        params.push(notes);
        setFields.push(`notes = $${params.length}`);
      }
      if (reason) {
        params.push(reason);
        setFields.push(`reason = $${params.length}`);
      }
      if (payment_reference) {
        params.push(payment_reference);
        setFields.push(`payment_reference = $${params.length}`);
      }

      if (status === "approved") {
        setFields.push("approved_by = $2", "approved_at = NOW()");
      } else if (status === "rejected") {
        setFields.push("rejected_by = $2", "rejected_at = NOW()");
      } else if (status === "cancelled") {
        setFields.push("cancelled_by = $2", "cancelled_at = NOW()");
      } else if (status === "suspended") {
        setFields.push("suspended_by = $2", "suspended_at = NOW()");
      } else if (status === "verification_pending" && payment_reference) {
        setFields.push("payment_verified_at = NOW()");
      }

      params.push(id);
      await pool.query(
        `UPDATE course_enrollments SET ${setFields.join(", ")} WHERE id = $${params.length}`,
        params,
      );

      const { rows: actorRows } = await pool.query(
        "SELECT display_name FROM accounts WHERE id=$1",
        [req.userId],
      );
      const actorName = actorRows[0]?.display_name ?? "Unknown";

      await logActivity({
        actorId: req.userId!,
        actorName,
        actorRole: req.role ?? "teacher",
        action: `enrollment_${status}`,
        entityType: "enrollment",
        entityId: id,
        entityName: enrollment.course_title,
        description: `${actorName} changed enrollment status to '${status}' for '${enrollment.course_title}'${reason ? ` — ${reason}` : ""}`,
        metadata: { previousStatus: enrollment.status, newStatus: status, reason, notes },
        tenantId: enrollment.teacher_account_id,
      });

      const notifTitle = status === "approved"
        ? `Your enrollment in "${enrollment.course_title}" was approved`
        : status === "rejected"
          ? `Your enrollment in "${enrollment.course_title}" was rejected`
          : status === "suspended"
            ? `Your enrollment in "${enrollment.course_title}" has been suspended`
            : null;

      if (notifTitle) {
        await notifyUser({
          accountId: enrollment.student_acc_id,
          title: notifTitle,
          message: reason ?? undefined,
          type: status === "approved" ? "enrollment_approved" : status === "rejected" ? "enrollment_rejected" : "system_notice",
          link: `/my-enrollments`,
          relatedEntityType: "enrollment",
          relatedEntityId: id,
        });
      }

      res.json({ success: true, previousStatus: enrollment.status, newStatus: status });
    } catch {
      res.status(500).json({ error: "Failed to update enrollment status" });
    }
  },
);

/* ── Soft delete enrollment ──────────────────────────────────────────────── */
enrollmentsRouter.delete(
  "/:id",
  requireRole("teacher", "admin", "super_admin"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      const isAdmin = req.role === "admin" || req.role === "super_admin";

      const { rows } = await pool.query(
        `SELECT e.*, c.teacher_account_id FROM course_enrollments e
         JOIN aperti_courses c ON c.id = e.course_id WHERE e.id=$1 AND e.deleted_at IS NULL`,
        [id],
      );
      if (!rows[0]) {
        res.status(404).json({ error: "Enrollment not found" });
        return;
      }
      if (!isAdmin && rows[0].teacher_account_id !== req.userId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      await pool.query(
        "UPDATE course_enrollments SET deleted_at=NOW(), deleted_by=$1 WHERE id=$2",
        [req.userId, id],
      );

      await logActivity({
        actorId: req.userId!,
        actorRole: req.role ?? "teacher",
        action: "enrollment_deleted",
        entityType: "enrollment",
        entityId: id,
        description: `Enrollment soft-deleted`,
        tenantId: rows[0].teacher_account_id,
      });

      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete enrollment" });
    }
  },
);

/* ── Restore soft-deleted enrollment ─────────────────────────────────────── */
enrollmentsRouter.post(
  "/:id/restore",
  requireRole("teacher", "admin", "super_admin"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      const isAdmin = req.role === "admin" || req.role === "super_admin";

      const { rows } = await pool.query(
        `SELECT e.*, c.teacher_account_id FROM course_enrollments e
         JOIN aperti_courses c ON c.id = e.course_id WHERE e.id=$1 AND e.deleted_at IS NOT NULL`,
        [id],
      );
      if (!rows[0]) {
        res.status(404).json({ error: "Deleted enrollment not found" });
        return;
      }
      if (!isAdmin && rows[0].teacher_account_id !== req.userId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      await pool.query(
        "UPDATE course_enrollments SET deleted_at=NULL, deleted_by=NULL WHERE id=$1",
        [id],
      );
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to restore enrollment" });
    }
  },
);

/* ── Summary stats ───────────────────────────────────────────────────────── */
enrollmentsRouter.get(
  "/stats/summary",
  requireRole("teacher", "admin", "super_admin", "assistant"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const isAdmin = req.role === "admin" || req.role === "super_admin";
      const params = isAdmin ? [] : [req.userId];
      const teacherFilter = isAdmin ? "" : `AND c.teacher_account_id = $1`;

      const { rows } = await pool.query(
        `SELECT e.status, COUNT(*)::int AS count
         FROM course_enrollments e
         JOIN aperti_courses c ON c.id = e.course_id
         WHERE e.deleted_at IS NULL ${teacherFilter}
         GROUP BY e.status`,
        params,
      );

      const stats = Object.fromEntries(VALID_STATES.map(s => [s, 0]));
      for (const row of rows) stats[row.status] = row.count;
      res.json({ stats, total: Object.values(stats).reduce((a, b) => a + b, 0) });
    } catch {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  },
);
