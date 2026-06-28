import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, AuthRequest, requireRole } from "../middleware/auth";
import { gradingLimiter } from "../middleware/rate-limit";
export const assessmentGradingRouter = Router();

const teacherOrAdmin = [authenticate, requireRole("teacher", "admin"), gradingLimiter];
const anyAuth = [authenticate];

// POST /grading/assessments/:submissionId/manual-grade
assessmentGradingRouter.post("/grading/assessments/:submissionId/manual-grade", ...teacherOrAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { submissionId } = req.params;
      const { answers = [], overall_feedback } = req.body as {
        answers: Array<{ answer_id: number; marks_awarded: number; feedback?: string }>;
        overall_feedback?: string;
      };
      const teacherId = req.userId!;
      const isAdmin = req.role === "admin" || req.role === "super_admin";

      if (!isAdmin) {
        const { rows: ownerRows } = await pool.query(
          `SELECT asub.id FROM assessment_submissions asub
           JOIN assessments a ON a.id = asub.assessment_id
           WHERE asub.id=$1 AND a.teacher_id=$2 LIMIT 1`,
          [submissionId, teacherId]
        );
        if (!ownerRows.length) return res.status(403).json({ error: "Access denied" });
      }

      for (const a of answers) {
        await pool.query(
          "UPDATE submission_answers SET marks_awarded=$1, grader_feedback=$2, auto_graded=FALSE WHERE id=$3",
          [a.marks_awarded, a.feedback ?? null, a.answer_id]
        );
      }

      const scoreRes = await pool.query(
        "SELECT COALESCE(SUM(marks_awarded),0) AS total FROM submission_answers WHERE submission_id=$1",
        [submissionId]
      );
      const total = parseFloat(scoreRes.rows[0].total);
      const subRes = await pool.query("SELECT max_score FROM assessment_submissions WHERE id=$1", [submissionId]);
      const maxScore = parseFloat(subRes.rows[0]?.max_score ?? "100");
      const percentage = maxScore > 0 ? Math.round((total / maxScore) * 100) : 0;

      const { rows } = await pool.query(
        `UPDATE assessment_submissions
         SET score=$1, percentage=$2, grade=$3, status='graded',
             feedback=$4, graded_at=NOW(), graded_by=$5
         WHERE id=$6 RETURNING *`,
        [total, percentage, igcseGrade(percentage), overall_feedback ?? null, teacherId, submissionId]
      );

      res.json({ submission: rows[0] });
    } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
  }
);

// POST /grading/assessments/:submissionId/moderate
assessmentGradingRouter.post("/grading/assessments/:submissionId/moderate", ...teacherOrAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { submissionId } = req.params;
      const { moderated_score, reason } = req.body;
      const moderatorId = req.userId!;
      const isAdmin = req.role === "admin" || req.role === "super_admin";
      const isSuperAdmin = req.role === "super_admin";

      const subRes = await pool.query(
        `SELECT asub.*, a.teacher_id AS assessment_teacher_id,
                a.subject_id,
                acc.teacher_account_id AS assessment_teacher_tenant
         FROM assessment_submissions asub
         JOIN assessments a ON a.id = asub.assessment_id
         JOIN accounts acc ON acc.id = a.teacher_id
         WHERE asub.id=$1 LIMIT 1`,
        [submissionId]
      );
      if (!subRes.rows.length) return res.status(404).json({ error: "Not found" });
      const sub = subRes.rows[0];

      // Ownership check: teacher must own the assessment
      if (!isAdmin && sub.assessment_teacher_id !== moderatorId) {
        return res.status(403).json({ error: "Access denied: you do not own this assessment" });
      }

      // Tenant isolation for scoped admins: an admin belongs to a tenant and cannot
      // cross into another tenant's data. super_admin bypasses this.
      if (isAdmin && !isSuperAdmin) {
        const { rows: adminTenant } = await pool.query(
          "SELECT teacher_account_id FROM accounts WHERE id=$1 LIMIT 1",
          [moderatorId]
        );
        const modTenant = adminTenant[0]?.teacher_account_id;
        const subTenant = sub.assessment_teacher_tenant;
        // Both must be platform-level (null) or share the same tenant root
        if (modTenant !== null && subTenant !== null && modTenant !== subTenant) {
          return res.status(403).json({ error: "Cross-tenant moderation denied" });
        }
      }

      if (moderated_score === undefined || moderated_score === null) {
        return res.status(400).json({ error: "moderated_score is required" });
      }
      const score = parseFloat(moderated_score);
      if (isNaN(score) || score < 0) {
        return res.status(400).json({ error: "moderated_score must be a non-negative number" });
      }

      await pool.query(
        `INSERT INTO moderation_logs (assessment_id, student_id, original_grade, moderated_grade, moderator_id, reason)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [sub.assessment_id, sub.student_id, sub.score, score, moderatorId, reason ?? null]
      );

      // Audit log
      pool.query(
        `INSERT INTO audit_logs (actor_id, actor_role, action, resource_type, resource_id, ip_address, metadata, created_at)
         VALUES ($1,$2,'GRADE_MODERATED','assessment_submission',$3,$4,$5,NOW())`,
        [moderatorId, req.role, submissionId, (req as any).ip ?? null,
         JSON.stringify({ original: sub.score, moderated: score, reason: reason ?? null })]
      ).catch(() => null);

      const maxScore = parseFloat(sub.max_score ?? "100");
      const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
      const { rows } = await pool.query(
        `UPDATE assessment_submissions SET score=$1, percentage=$2, grade=$3 WHERE id=$4 RETURNING *`,
        [score, percentage, igcseGrade(percentage), submissionId]
      );

      res.json({ submission: rows[0] });
    } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
  }
);

// ══════════════════════════════════════════════════════════════════
// PRACTICAL ASSESSMENTS
// ══════════════════════════════════════════════════════════════════

assessmentGradingRouter.post("/practicals/:assessmentId/submit", ...anyAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { assessmentId } = req.params;
    const userId = req.userId!;
    const stuRes = await pool.query("SELECT id FROM students WHERE account_id=$1 LIMIT 1", [userId]);
    if (!stuRes.rows.length) return res.status(403).json({ error: "Not a student" });
    const studentId = stuRes.rows[0].id;

    const { file_urls = [], description } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO coursework_projects (assessment_id, student_id, description, files, submitted_at)
       VALUES ($1,$2,$3,$4,NOW())
       ON CONFLICT (assessment_id, student_id) DO UPDATE
         SET files = $4, description = $3, submitted_at = NOW()
       RETURNING *`,
      [assessmentId, studentId, description ?? null, JSON.stringify(file_urls)]
    );
    res.json({ project: rows[0] });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

assessmentGradingRouter.post("/practicals/:assessmentId/grade", ...teacherOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { assessmentId } = req.params;
    const { student_id, score, feedback, rubric_id } = req.body;
    const teacherId = req.userId!;
    const isAdmin = req.role === "admin" || req.role === "super_admin";

    if (!isAdmin) {
      const { rows: own } = await pool.query(
        "SELECT id FROM assessments WHERE id=$1 AND teacher_id=$2 LIMIT 1",
        [assessmentId, teacherId]
      );
      if (!own.length) return res.status(403).json({ error: "Access denied" });
    }

    const { rows } = await pool.query(
      `UPDATE coursework_projects SET score=$1, feedback=$2, status='graded'
       WHERE assessment_id=$3 AND student_id=$4 RETURNING *`,
      [score, feedback ?? null, assessmentId, student_id]
    );
    if (!rows.length) return res.status(404).json({ error: "Submission not found" });
    res.json({ project: rows[0] });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

// ══════════════════════════════════════════════════════════════════
// COURSEWORK
// ══════════════════════════════════════════════════════════════════

assessmentGradingRouter.post("/coursework/:assessmentId/submit", ...anyAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { assessmentId } = req.params;
    const userId = req.userId!;
    const stuRes = await pool.query("SELECT id FROM students WHERE account_id=$1 LIMIT 1", [userId]);
    if (!stuRes.rows.length) return res.status(403).json({ error: "Not a student" });
    const studentId = stuRes.rows[0].id;

    const { title, description, files = [], milestones = [] } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO coursework_projects (assessment_id, student_id, title, description, files, milestones, submitted_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW())
       ON CONFLICT (assessment_id, student_id) DO UPDATE
         SET title=$3, description=$4, files=$5, milestones=$6, submitted_at=NOW()
       RETURNING *`,
      [assessmentId, studentId, title ?? null, description ?? null,
       JSON.stringify(files), JSON.stringify(milestones)]
    );
    res.json({ project: rows[0] });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

assessmentGradingRouter.get("/coursework/:assessmentId/submissions", ...teacherOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { assessmentId } = req.params;
    const teacherId = req.userId!;
    const isAdmin = req.role === "admin" || req.role === "super_admin";

    if (!isAdmin) {
      const { rows: own } = await pool.query(
        "SELECT id FROM assessments WHERE id=$1 AND teacher_id=$2 LIMIT 1",
        [assessmentId, teacherId]
      );
      if (!own.length) return res.status(403).json({ error: "Access denied" });
    }

    const { rows } = await pool.query(
      `SELECT cp.*, a.display_name AS student_name
       FROM coursework_projects cp
       JOIN students s ON s.id = cp.student_id
       JOIN accounts a ON a.id = s.account_id
       WHERE cp.assessment_id=$1 ORDER BY cp.submitted_at DESC NULLS LAST`,
      [assessmentId]
    );
    res.json({ submissions: rows });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

assessmentGradingRouter.post("/coursework/:submissionId/moderate", ...teacherOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { submissionId } = req.params;
    const { moderated_grade, reason } = req.body;
    const moderatorId = req.userId!;
    const isAdmin = req.role === "admin" || req.role === "super_admin";

    if (!isAdmin) {
      const { rows: own } = await pool.query(
        `SELECT cp.id FROM coursework_projects cp
         JOIN assessments a ON a.id = cp.assessment_id
         WHERE cp.id=$1 AND a.teacher_id=$2 LIMIT 1`,
        [submissionId, moderatorId]
      );
      if (!own.length) return res.status(403).json({ error: "Access denied" });
    }

    const { rows } = await pool.query(
      `UPDATE coursework_projects
       SET moderated_grade=$1, moderated_by=$2, moderated_at=NOW()
       WHERE id=$3 RETURNING *`,
      [moderated_grade, moderatorId, submissionId]
    );
    if (!rows.length) return res.status(404).json({ error: "Submission not found" });

    await pool.query(
      `INSERT INTO moderation_logs (assessment_id, student_id, original_grade, moderated_grade, moderator_id, reason)
       SELECT cp.assessment_id, cp.student_id, cp.score, $1, $2, $3
       FROM coursework_projects cp WHERE cp.id=$4`,
      [moderated_grade, moderatorId, reason ?? null, submissionId]
    ).catch(() => {});

    res.json({ project: rows[0] });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

// ══════════════════════════════════════════════════════════════════
// ORAL EXAMINATIONS
// ══════════════════════════════════════════════════════════════════

assessmentGradingRouter.post("/oral-exams/:assessmentId/schedule", ...teacherOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { assessmentId } = req.params;
    const { student_id, scheduled_for } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO oral_recordings (assessment_id, student_id, scheduled_for)
       VALUES ($1,$2,$3)
       ON CONFLICT (assessment_id, student_id) DO UPDATE SET scheduled_for=$3
       RETURNING *`,
      [assessmentId, student_id, scheduled_for]
    );
    res.json({ oral: rows[0] });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

assessmentGradingRouter.post("/oral-exams/:assessmentId/record", ...anyAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { assessmentId } = req.params;
    const userId = req.userId!;
    const stuRes = await pool.query("SELECT id FROM students WHERE account_id=$1 LIMIT 1", [userId]);
    if (!stuRes.rows.length) return res.status(403).json({ error: "Not a student" });
    const studentId = stuRes.rows[0].id;
    const { recording_url } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO oral_recordings (assessment_id, student_id, recording_url)
       VALUES ($1,$2,$3)
       ON CONFLICT (assessment_id, student_id) DO UPDATE SET recording_url=$3
       RETURNING *`,
      [assessmentId, studentId, recording_url]
    );
    res.json({ oral: rows[0] });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

assessmentGradingRouter.post("/oral-exams/:id/grade", ...teacherOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { score, feedback } = req.body;
    const teacherId = req.userId!;
    const isAdmin = req.role === "admin" || req.role === "super_admin";

    if (!isAdmin) {
      const { rows: own } = await pool.query(
        `SELECT or_.id FROM oral_recordings or_
         JOIN assessments a ON a.id = or_.assessment_id
         WHERE or_.id=$1 AND a.teacher_id=$2 LIMIT 1`,
        [id, teacherId]
      );
      if (!own.length) return res.status(403).json({ error: "Access denied" });
    }

    const { rows } = await pool.query(
      "UPDATE oral_recordings SET score=$1, feedback=$2, graded_at=NOW() WHERE id=$3 RETURNING *",
      [score, feedback ?? null, id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json({ oral: rows[0] });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

assessmentGradingRouter.get("/oral-exams/:id/transcript", ...teacherOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const teacherId = req.userId!;
    const isAdmin = req.role === "admin" || req.role === "super_admin";

    const { rows } = await pool.query(
      `SELECT or_.*, a.teacher_id AS assessment_teacher_id
       FROM oral_recordings or_
       JOIN assessments a ON a.id = or_.assessment_id
       WHERE or_.id=$1 LIMIT 1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const oral = rows[0];

    if (!isAdmin && oral.assessment_teacher_id !== teacherId) {
      const { rows: stuRows } = await pool.query(
        "SELECT id FROM students WHERE id=$1 AND account_id=$2 LIMIT 1",
        [oral.student_id, req.userId]
      );
      if (!stuRows.length) return res.status(403).json({ error: "Access denied" });
    }

    res.json({ oral });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

// ══════════════════════════════════════════════════════════════════
// STANDARDIZATION / MODERATION CENTER
// ══════════════════════════════════════════════════════════════════

assessmentGradingRouter.post("/moderation/benchmark", ...teacherOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { assessment_id, benchmark_answers } = req.body;
    const teacherId = req.userId!;
    const isAdmin = req.role === "admin" || req.role === "super_admin";

    if (!isAdmin) {
      const { rows: own } = await pool.query(
        "SELECT id FROM assessments WHERE id=$1 AND teacher_id=$2 LIMIT 1",
        [assessment_id, teacherId]
      );
      if (!own.length) return res.status(403).json({ error: "Access denied" });
    }

    await pool.query(
      `UPDATE assessments SET settings = settings || $1 WHERE id=$2`,
      [JSON.stringify({ benchmark_answers }), assessment_id]
    );
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

assessmentGradingRouter.get("/moderation/consistency", ...teacherOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { assessment_id } = req.query;
    const teacherId = req.userId!;
    const isAdmin = req.role === "admin" || req.role === "super_admin";

    if (!isAdmin) {
      const { rows: own } = await pool.query(
        "SELECT id FROM assessments WHERE id=$1 AND teacher_id=$2 LIMIT 1",
        [assessment_id, teacherId]
      );
      if (!own.length) return res.status(403).json({ error: "Access denied" });
    }
    const { rows } = await pool.query(
      `SELECT sa.question_id, STDDEV(sa.marks_awarded) AS std_dev,
              AVG(sa.marks_awarded) AS avg_marks, COUNT(*) AS count,
              MAX(sa.marks_awarded) AS max_given, MIN(sa.marks_awarded) AS min_given
       FROM submission_answers sa
       JOIN assessment_submissions asub ON asub.id = sa.submission_id
       WHERE asub.assessment_id=$1
       GROUP BY sa.question_id
       HAVING COUNT(*) > 1
       ORDER BY STDDEV(sa.marks_awarded) DESC NULLS LAST`,
      [assessment_id]
    );
    const discrepancies = rows.filter((r: any) => parseFloat(r.std_dev ?? "0") > 2);
    res.json({ analysis: rows, discrepancies });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

assessmentGradingRouter.post("/moderation/double-mark", ...teacherOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { submission_id, second_marker_id } = req.body;
    const teacherId = req.userId!;
    const isAdmin = req.role === "admin" || req.role === "super_admin";

    if (!isAdmin) {
      const { rows: own } = await pool.query(
        `SELECT asub.id FROM assessment_submissions asub
         JOIN assessments a ON a.id = asub.assessment_id
         WHERE asub.id=$1 AND a.teacher_id=$2 LIMIT 1`,
        [submission_id, teacherId]
      );
      if (!own.length) return res.status(403).json({ error: "Access denied" });
    }

    await pool.query(
      `UPDATE assessment_submissions
       SET device_info = device_info || $1
       WHERE id=$2`,
      [JSON.stringify({ second_marker_id, double_mark_assigned_at: new Date() }), submission_id]
    );
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

// ══════════════════════════════════════════════════════════════════
// GRADEBOOK CALCULATIONS
// ══════════════════════════════════════════════════════════════════

assessmentGradingRouter.post("/gradebook/calculate", ...teacherOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { student_id, course_id } = req.body;
    const teacherId = req.userId!;
    const isAdmin = req.role === "admin" || req.role === "super_admin";

    if (!isAdmin) {
      const { rows: stuCheck } = await pool.query(
        "SELECT id FROM students WHERE id=$1 AND teacher_account_id=$2 LIMIT 1",
        [student_id, teacherId]
      );
      if (!stuCheck.length) return res.status(403).json({ error: "Access denied" });
    }

    const { rows } = await pool.query(
      `SELECT ge.*, a.title AS assessment_title, a.type AS assessment_type
       FROM gradebook_entries ge
       LEFT JOIN assessments a ON a.id = ge.assessment_id
       WHERE ge.student_id = $1
       ORDER BY ge.graded_at DESC NULLS LAST`,
      [student_id]
    );

    if (!rows.length) return res.json({ final_grade: null, entries: [], weighted_score: 0 });

    // Weighted average
    let totalWeight = 0;
    let weightedSum = 0;
    for (const entry of rows) {
      const weight = parseFloat(entry.weight ?? "1");
      const pct = parseFloat(entry.max_marks) > 0
        ? (parseFloat(entry.marks_obtained ?? "0") / parseFloat(entry.max_marks)) * 100
        : 0;
      weightedSum += pct * weight;
      totalWeight += weight;
    }

    const finalPct = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
    const finalGrade = igcseGrade(finalPct);

    res.json({ entries: rows, weighted_score: finalPct, final_grade: finalGrade, total_weight: totalWeight });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

assessmentGradingRouter.get("/gradebook/export", ...teacherOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { format = "json" } = req.query as Record<string, string>;
    const isAdmin = req.role === "admin" || req.role === "super_admin";
    const teacherId = isAdmin && req.query.teacher_id
      ? parseInt(req.query.teacher_id as string)
      : req.userId!;

    const { rows } = await pool.query(
      `SELECT a.display_name AS student_name, s.grade_level,
              asub.score, asub.max_score, asub.percentage, asub.grade,
              assess.title AS assessment_title, assess.type AS assessment_type,
              asub.submitted_at, asub.graded_at
       FROM assessment_submissions asub
       JOIN students s ON s.id = asub.student_id
       JOIN accounts a ON a.id = s.account_id
       JOIN assessments assess ON assess.id = asub.assessment_id
       WHERE assess.teacher_id = $1 AND asub.status IN ('graded','returned')
       ORDER BY a.display_name, assess.created_at`,
      [teacherId]
    );

    if (format === "csv") {
      const headers = "Student,Grade Level,Assessment,Type,Score,Max,Percentage,Grade,Submitted,Graded\n";
      const csv = headers + rows.map((r: any) =>
        `"${r.student_name}","${r.grade_level ?? ""}","${r.assessment_title}","${r.assessment_type}",` +
        `${r.score ?? ""},${r.max_score ?? ""},${r.percentage ?? ""}%,${r.grade ?? ""},` +
        `"${r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : ""}",` +
        `"${r.graded_at ? new Date(r.graded_at).toLocaleDateString() : ""}"`
      ).join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=gradebook.csv");
      return res.send(csv);
    }

    res.json({ entries: rows, exported_at: new Date() });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

assessmentGradingRouter.put("/gradebook/settings", ...teacherOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.userId!;
    const { weightings, categories, grading_scale } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO gradebook_settings (teacher_id, weightings, categories, grading_scale)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (teacher_id) DO UPDATE
         SET weightings=$2, categories=$3, grading_scale=$4, updated_at=NOW()
       RETURNING *`,
      [teacherId, JSON.stringify(weightings ?? {}), JSON.stringify(categories ?? []), JSON.stringify(grading_scale ?? {})]
    );
    res.json({ settings: rows[0] });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

// ══════════════════════════════════════════════════════════════════
// REPORTING
// ══════════════════════════════════════════════════════════════════

assessmentGradingRouter.get("/reports/student/:studentId", ...anyAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { studentId } = req.params;
    const sid = parseInt(studentId, 10);
    if (isNaN(sid)) return res.status(400).json({ error: "Invalid studentId" });
    const userId = req.userId!;
    const role = req.role;

    if (role === "student") {
      const { rows: own } = await pool.query(
        "SELECT id FROM students WHERE id=$1 AND account_id=$2 LIMIT 1",
        [sid, userId]
      );
      if (!own.length) return res.status(403).json({ error: "Access denied" });
    } else if (role === "teacher") {
      const { rows: own } = await pool.query(
        "SELECT id FROM students WHERE id=$1 AND teacher_account_id=$2 LIMIT 1",
        [sid, userId]
      );
      if (!own.length) return res.status(403).json({ error: "Access denied" });
    } else if (role === "parent") {
      const { rows: link } = await pool.query(
        `SELECT id FROM guardian_links
         WHERE parent_account_id=$1 AND student_id=$2 AND status='active' LIMIT 1`,
        [userId, sid]
      );
      if (!link.length) return res.status(403).json({ error: "Not linked to this student" });
    } else if (role !== "admin" && role !== "super_admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    const [profileRes, submissionsRes, strongWeakRes] = await Promise.all([
      pool.query(
        `SELECT a.display_name, s.grade_level, s.id AS student_id
         FROM students s JOIN accounts a ON a.id = s.account_id
         WHERE s.id=$1 LIMIT 1`,
        [studentId]
      ),
      pool.query(
        `SELECT asub.score, asub.max_score, asub.percentage, asub.grade,
                assess.title, assess.type, assess.created_at
         FROM assessment_submissions asub
         JOIN assessments assess ON assess.id = asub.assessment_id
         WHERE asub.student_id=$1 AND asub.status IN ('graded','returned')
         ORDER BY assess.created_at DESC LIMIT 20`,
        [studentId]
      ),
      pool.query(
        `SELECT sa.marks_awarded, aq.question_type,
                COALESCE(qb.topic, aq.custom_question->>'topic') AS topic
         FROM submission_answers sa
         JOIN assessment_questions aq ON aq.id = sa.question_id
         LEFT JOIN question_bank qb ON qb.id = aq.question_bank_id
         JOIN assessment_submissions asub ON asub.id = sa.submission_id
         WHERE asub.student_id=$1 AND sa.marks_awarded IS NOT NULL`,
        [studentId]
      ),
    ]);

    const submissions = submissionsRes.rows;
    const avgScore = submissions.length > 0
      ? Math.round(submissions.reduce((s: number, r: any) => s + (parseFloat(r.percentage) || 0), 0) / submissions.length)
      : 0;

    // Topic strength/weakness
    const topicMap: Record<string, { total: number; earned: number; count: number }> = {};
    for (const a of strongWeakRes.rows) {
      const topic = a.topic ?? "General";
      if (!topicMap[topic]) topicMap[topic] = { total: 0, earned: 0, count: 0 };
      topicMap[topic].earned += parseFloat(a.marks_awarded ?? "0");
      topicMap[topic].count++;
    }
    const topicScores = Object.entries(topicMap).map(([topic, d]) => ({
      topic,
      pct: d.count > 0 ? Math.round((d.earned / d.count) * 100) : 0,
    })).sort((a, b) => b.pct - a.pct);

    res.json({
      student: profileRes.rows[0],
      summary: { avg_score: avgScore, total_assessments: submissions.length, grade: igcseGrade(avgScore) },
      assessments: submissions,
      strong_topics: topicScores.slice(0, 5),
      weak_topics: topicScores.slice(-5).reverse(),
    });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

assessmentGradingRouter.get("/reports/teacher/:teacherId/class", ...teacherOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    // Admins may query any teacher; non-admins are scoped to their own data only
    const isAdminRole = req.role === "admin" || req.role === "super_admin";
    const teacherId = isAdminRole
      ? (parseInt(req.params.teacherId, 10) || req.userId!)
      : req.userId!;
    const { rows } = await pool.query(
      `SELECT assess.title, assess.type, COUNT(asub.id) AS submissions,
              ROUND(AVG(asub.percentage),1) AS avg_pct,
              ROUND(MIN(asub.percentage),1) AS min_pct,
              ROUND(MAX(asub.percentage),1) AS max_pct,
              COUNT(CASE WHEN asub.percentage >= 50 THEN 1 END) AS passed,
              COUNT(CASE WHEN asub.percentage < 50 THEN 1 END) AS failed
       FROM assessments assess
       LEFT JOIN assessment_submissions asub ON asub.assessment_id = assess.id AND asub.status='graded'
       WHERE assess.teacher_id=$1
       GROUP BY assess.id ORDER BY assess.created_at DESC LIMIT 20`,
      [teacherId]
    );
    res.json({ assessments: rows });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

assessmentGradingRouter.get("/reports/parent/:studentId", ...anyAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { studentId } = req.params;
    const sid = parseInt(studentId, 10);
    if (isNaN(sid)) return res.status(400).json({ error: "Invalid studentId" });

    const role = req.role;
    const userId = req.userId!;

    // Access control — only the student themselves, their linked parent, their
    // teacher, or an admin may view this data
    if (role === "parent") {
      const { rows: link } = await pool.query(
        `SELECT id FROM guardian_links
         WHERE parent_account_id=$1 AND student_id=$2 AND status='active' LIMIT 1`,
        [userId, sid],
      );
      if (!link.length) return res.status(403).json({ error: "Not linked to this student" });
    } else if (role === "student") {
      const { rows: stu } = await pool.query(
        "SELECT id FROM students WHERE account_id=$1 AND id=$2 LIMIT 1",
        [userId, sid],
      );
      if (!stu.length) return res.status(403).json({ error: "Access denied" });
    } else if (role === "teacher") {
      const { rows: stu } = await pool.query(
        "SELECT id FROM students WHERE teacher_account_id=$1 AND id=$2 LIMIT 1",
        [userId, sid],
      );
      if (!stu.length) return res.status(403).json({ error: "Student not in your class" });
    } else if (role !== "admin" && role !== "super_admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    const { rows } = await pool.query(
      `SELECT asub.percentage, asub.grade, asub.submitted_at,
              assess.title, assess.type
       FROM assessment_submissions asub
       JOIN assessments assess ON assess.id = asub.assessment_id
       WHERE asub.student_id=$1 AND asub.status IN ('graded','returned')
       ORDER BY asub.submitted_at DESC LIMIT 10`,
      [sid],
    );
    const avgPct = rows.length > 0
      ? Math.round(rows.reduce((s: number, r: any) => s + (parseFloat(r.percentage) || 0), 0) / rows.length)
      : 0;
    res.json({ recent_results: rows, average_score: avgPct, overall_grade: igcseGrade(avgPct) });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

// ══════════════════════════════════════════════════════════════════
// APPEALS
// ══════════════════════════════════════════════════════════════════

assessmentGradingRouter.post("/appeals", ...anyAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const stuRes = await pool.query("SELECT id FROM students WHERE account_id=$1 LIMIT 1", [userId]);
    if (!stuRes.rows.length) return res.status(403).json({ error: "Not a student" });
    const { submission_id, reason } = req.body;
    const { rows } = await pool.query(
      "INSERT INTO appeals (submission_id, student_id, reason) VALUES ($1,$2,$3) RETURNING *",
      [submission_id, stuRes.rows[0].id, reason]
    );
    res.status(201).json({ appeal: rows[0] });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

assessmentGradingRouter.get("/appeals/my", ...anyAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const stuRes = await pool.query("SELECT id FROM students WHERE account_id=$1 LIMIT 1", [userId]);
    if (!stuRes.rows.length) return res.status(403).json({ error: "Not a student" });
    const { rows } = await pool.query(
      `SELECT ap.*, assess.title AS assessment_title, asub.score, asub.grade
       FROM appeals ap
       JOIN assessment_submissions asub ON asub.id = ap.submission_id
       JOIN assessments assess ON assess.id = asub.assessment_id
       WHERE ap.student_id=$1
       ORDER BY ap.created_at DESC
       LIMIT 50`,
      [stuRes.rows[0].id]
    );
    res.json({ appeals: rows });
  } catch { res.status(500).json({ error: "An unexpected error occurred" }); }
});

assessmentGradingRouter.get("/appeals", ...teacherOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT ap.*, a.display_name AS student_name, asub.score, asub.grade,
              assess.title AS assessment_title
       FROM appeals ap
       JOIN students s ON s.id = ap.student_id
       JOIN accounts a ON a.id = s.account_id
       JOIN assessment_submissions asub ON asub.id = ap.submission_id
       JOIN assessments assess ON assess.id = asub.assessment_id
       WHERE assess.teacher_id=$1
       ORDER BY ap.created_at DESC`,
      [req.userId!]
    );
    res.json({ appeals: rows });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

assessmentGradingRouter.put("/appeals/:id/resolve", ...teacherOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { resolution, status = "resolved" } = req.body;
    const { rows } = await pool.query(
      `UPDATE appeals SET status=$2, resolution=$3, reviewed_by=$4, resolved_at=NOW()
       WHERE id=$1 RETURNING *`,
      [id, status, resolution ?? null, req.userId!]
    );
    if (!rows.length) return res.status(404).json({ error: "Appeal not found" });
    res.json({ appeal: rows[0] });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

// ── Student Self-Marking (Practice Mode) ─────────────────────────────────────
// POST /grading/self-mark
// Students can request instant AI feedback on a written answer (practice only)
assessmentGradingRouter.post("/grading/self-mark", authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { questionText, studentAnswer, modelAnswer, maxMarks, subject } = req.body as {
        questionText: string;
        studentAnswer: string;
        modelAnswer?: string;
        maxMarks: number;
        subject?: string;
      };

      if (!questionText || !studentAnswer) {
        return res.status(400).json({ error: "questionText and studentAnswer are required" });
      }
      if (!studentAnswer.trim() || studentAnswer.trim().split(/\s+/).length < 3) {
        return res.status(400).json({ error: "Answer is too short to mark" });
      }

      const maxM = Math.max(1, Math.min(parseInt(String(maxMarks)) || 1, 25));

      const prompt = `You are an expert ${subject ?? "exam"} marker. Grade this student's answer.
${modelAnswer ? `Model Answer: ${modelAnswer}\n` : ""}Max Marks: ${maxM}

Respond ONLY with valid JSON in this exact format:
{
  "marks": <number between 0 and ${maxM}>,
  "percentage": <number 0-100>,
  "grade": "<A*|A|B|C|D|E|U>",
  "feedback": "<2-3 sentence overall feedback>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvements": ["<improvement 1>", "<improvement 2>"],
  "missingPoints": ["<missing key point 1>"],
  "examTip": "<one actionable exam technique tip>"
}`;

      const aiResponse = await openaiChat({
        systemPrompt: prompt,
        userMessage: `Question: ${questionText}\n\nStudent Answer: ${studentAnswer}`,
        maxTokens: 500,
      });

      if (!aiResponse) {
        // Graceful fallback without AI
        const wordCount = studentAnswer.trim().split(/\s+/).length;
        const estimatedMarks = Math.round(Math.min(maxM, (wordCount / (maxM * 30)) * maxM));
        return res.json({
          marks: estimatedMarks,
          percentage: Math.round((estimatedMarks / maxM) * 100),
          grade: igcseGrade(Math.round((estimatedMarks / maxM) * 100)),
          feedback: "AI marking is not available right now. Your teacher will review this answer.",
          strengths: ["Answer submitted"],
          improvements: ["Review with your teacher"],
          missingPoints: [],
          examTip: "Practice writing structured answers with clear key points.",
          aiAvailable: false,
        });
      }

      try {
        const parsed = JSON.parse(aiResponse.trim());
        const marks = Math.min(Math.max(0, parseFloat(parsed.marks) || 0), maxM);
        const percentage = Math.round((marks / maxM) * 100);
        return res.json({
          marks,
          maxMarks: maxM,
          percentage,
          grade: parsed.grade ?? igcseGrade(percentage),
          feedback: parsed.feedback ?? "",
          strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
          improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
          missingPoints: Array.isArray(parsed.missingPoints) ? parsed.missingPoints : [],
          examTip: parsed.examTip ?? "",
          aiAvailable: true,
        });
      } catch {
        return res.status(500).json({ error: "Failed to parse AI response. Please try again." });
      }
    } catch (err: any) {
      res.status(500).json({ error: "An unexpected error occurred" });
    }
  }
);

// ── Shared helpers ────────────────────────────────────────────────────────────
function igcseGrade(pct: number): string {
  if (pct >= 90) return "A*";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  if (pct >= 40) return "E";
  if (pct >= 30) return "F";
  if (pct >= 20) return "G";
  return "U";
}
