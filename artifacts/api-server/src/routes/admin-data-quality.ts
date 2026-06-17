import { Router } from "express";
import { db, pool } from "@workspace/db";
import { requireRole } from "../middleware/auth";
import {
  studentsTable, accountsTable, subjectsTable, lessonsTable,
} from "@workspace/db";
import { isNull, eq, sql } from "drizzle-orm";

export const adminDataQualityRouter = Router();
adminDataQualityRouter.use(requireRole("admin", "super_admin"));

adminDataQualityRouter.get("/", async (_req, res) => {
  try {
    // Gather stats
    const [totalStudents] = await db.select({ count: sql<number>`count(*)::int` }).from(studentsTable);
    const [studentsWithoutSessions] = await db.select({ count: sql<number>`count(*)::int` }).from(studentsTable).where(
      sql`lesson1_session_id IS NULL AND lesson2_session_id IS NULL AND lesson3_session_id IS NULL`
    );
    const [studentsWithoutCode] = await db.select({ count: sql<number>`count(*)::int` }).from(studentsTable).where(
      sql`student_code IS NULL OR student_code = ''`
    );
    const [subjectsWithoutTeacher] = await db.select({ count: sql<number>`count(*)::int` }).from(subjectsTable).where(
      isNull(subjectsTable.teacherAccountId)
    );

    let duplicateAttendance = 0;
    let orphanedEnrollments = 0;
    let homeworkWithoutDueDate = 0;
    let attendanceWithoutSession = 0;
    let lessonsWithoutTeacher = 0;

    try {
      const dupRes = await pool.query(`
        SELECT COUNT(*) as count FROM (
          SELECT student_id, lesson_id, date, COUNT(*) as n
          FROM attendance
          GROUP BY student_id, lesson_id, date
          HAVING COUNT(*) > 1
        ) sub
      `);
      duplicateAttendance = parseInt(dupRes.rows[0]?.count ?? "0");
    } catch { /* table may not exist */ }

    try {
      const orphRes = await pool.query(`
        SELECT COUNT(*) as count FROM students s
        WHERE s.account_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.id = s.account_id)
      `);
      orphanedEnrollments = parseInt(orphRes.rows[0]?.count ?? "0");
    } catch { /* ignore */ }

    try {
      const hwRes = await pool.query(`
        SELECT COUNT(*) as count FROM homework WHERE due_date IS NULL
      `);
      homeworkWithoutDueDate = parseInt(hwRes.rows[0]?.count ?? "0");
    } catch { /* ignore */ }

    try {
      const attRes = await pool.query(`
        SELECT COUNT(*) as count FROM attendance a
        WHERE NOT EXISTS (
          SELECT 1 FROM lessons l WHERE l.id = a.lesson_id
        )
      `);
      attendanceWithoutSession = parseInt(attRes.rows[0]?.count ?? "0");
    } catch { /* ignore */ }

    try {
      const lessonRes = await pool.query(`
        SELECT COUNT(*) as count FROM lessons l
        WHERE NOT EXISTS (
          SELECT 1 FROM accounts a WHERE a.id = l.teacher_account_id
        )
      `);
      lessonsWithoutTeacher = parseInt(lessonRes.rows[0]?.count ?? "0");
    } catch { /* ignore */ }

    const stats = {
      totalStudents: totalStudents.count,
      studentsWithoutSessions: studentsWithoutSessions.count,
      studentsWithoutCode: studentsWithoutCode.count,
      duplicateAttendance,
      orphanedEnrollments,
      subjectsWithoutTeacher: subjectsWithoutTeacher.count,
      homeworkWithoutDueDate,
      attendanceWithoutSession,
      lessonsWithoutTeacher,
    };

    // Build issues list
    const issues: Array<{
      id: string; severity: "critical" | "high" | "medium" | "low";
      category: string; title: string; description: string; count: number; fixable: boolean;
    }> = [];

    if (stats.studentsWithoutCode > 0) {
      issues.push({
        id: "missing_student_code",
        severity: "critical",
        category: "Students",
        title: "Students missing student code",
        description: "These students cannot be identified by QR code or exported. Assign codes immediately.",
        count: stats.studentsWithoutCode,
        fixable: true,
      });
    }

    if (stats.duplicateAttendance > 0) {
      issues.push({
        id: "duplicate_attendance",
        severity: "high",
        category: "Attendance",
        title: "Duplicate attendance records",
        description: "Multiple attendance entries exist for the same student, lesson, and date. This inflates attendance counts.",
        count: stats.duplicateAttendance,
        fixable: true,
      });
    }

    if (stats.orphanedEnrollments > 0) {
      issues.push({
        id: "orphaned_enrollments",
        severity: "high",
        category: "Students",
        title: "Students linked to deleted accounts",
        description: "Student records reference account IDs that no longer exist in the accounts table.",
        count: stats.orphanedEnrollments,
        fixable: true,
      });
    }

    if (stats.studentsWithoutSessions > 0) {
      issues.push({
        id: "students_without_sessions",
        severity: "medium",
        category: "Scheduling",
        title: "Students with no session assigned",
        description: "These students are enrolled but have no lesson sessions. They cannot have attendance recorded.",
        count: stats.studentsWithoutSessions,
        fixable: false,
      });
    }

    if (stats.subjectsWithoutTeacher > 0) {
      issues.push({
        id: "subjects_without_teacher",
        severity: "medium",
        category: "Subjects",
        title: "Subjects with no assigned teacher",
        description: "These subjects exist but have no teacher assigned. Students may not have proper support.",
        count: stats.subjectsWithoutTeacher,
        fixable: false,
      });
    }

    if (stats.homeworkWithoutDueDate > 0) {
      issues.push({
        id: "homework_no_due_date",
        severity: "low",
        category: "Homework",
        title: "Homework without due date",
        description: "These homework assignments have no due date, making it harder for students to prioritise.",
        count: stats.homeworkWithoutDueDate,
        fixable: false,
      });
    }

    if (stats.attendanceWithoutSession > 0) {
      issues.push({
        id: "attendance_no_session",
        severity: "high",
        category: "Attendance",
        title: "Attendance records with no matching session",
        description: "Attendance entries reference lesson IDs that no longer exist. These are orphaned records.",
        count: stats.attendanceWithoutSession,
        fixable: true,
      });
    }

    if (stats.lessonsWithoutTeacher > 0) {
      issues.push({
        id: "lessons_no_teacher",
        severity: "medium",
        category: "Lessons",
        title: "Lessons with no assigned teacher account",
        description: "These lessons reference a teacher account that no longer exists.",
        count: stats.lessonsWithoutTeacher,
        fixable: false,
      });
    }

    // Score: start at 100, deduct per issue weighted by severity
    let score = 100;
    for (const issue of issues) {
      if (issue.severity === "critical") score -= Math.min(20, issue.count * 2);
      else if (issue.severity === "high") score -= Math.min(15, issue.count);
      else if (issue.severity === "medium") score -= Math.min(8, issue.count / 2);
      else score -= Math.min(3, issue.count / 5);
    }
    score = Math.max(0, Math.round(score));

    res.json({ score, issues, stats, generatedAt: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

adminDataQualityRouter.post("/fix", async (req, res) => {
  const { issueId } = req.body as { issueId: string };
  let fixed = 0;

  try {
    if (issueId === "missing_student_code") {
      // Generate codes for students that are missing them
      const missingRes = await pool.query(`
        SELECT id FROM students WHERE student_code IS NULL OR student_code = '' ORDER BY id
      `);
      for (const row of missingRes.rows) {
        const code = `STU${String(row.id).padStart(5, "0")}`;
        await pool.query(`UPDATE students SET student_code = $1 WHERE id = $2`, [code, row.id]);
        fixed++;
      }
    } else if (issueId === "duplicate_attendance") {
      // Keep only the first attendance record per (student_id, lesson_id, date)
      const result = await pool.query(`
        DELETE FROM attendance WHERE id NOT IN (
          SELECT MIN(id) FROM attendance
          GROUP BY student_id, lesson_id, date
        )
      `);
      fixed = result.rowCount ?? 0;
    } else if (issueId === "orphaned_enrollments") {
      const result = await pool.query(`
        UPDATE students SET account_id = NULL
        WHERE account_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.id = students.account_id)
      `);
      fixed = result.rowCount ?? 0;
    } else if (issueId === "attendance_no_session") {
      const result = await pool.query(`
        DELETE FROM attendance
        WHERE NOT EXISTS (
          SELECT 1 FROM lessons l WHERE l.id = attendance.lesson_id
        )
      `);
      fixed = result.rowCount ?? 0;
    } else {
      return res.status(400).json({ error: "This issue cannot be auto-fixed" });
    }

    res.json({ fixed, issueId });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

adminDataQualityRouter.post("/repair-all", async (_req, res) => {
  const fixable = ["missing_student_code", "duplicate_attendance", "orphaned_enrollments", "attendance_no_session"];
  const results: Array<{ issueId: string; fixed: number; error?: string }> = [];

  for (const issueId of fixable) {
    try {
      let fixed = 0;
      if (issueId === "missing_student_code") {
        const rows = await pool.query(`SELECT id FROM students WHERE student_code IS NULL OR student_code = '' ORDER BY id`);
        for (const row of rows.rows) {
          const code = `STU${String(row.id).padStart(5, "0")}`;
          await pool.query(`UPDATE students SET student_code = $1 WHERE id = $2`, [code, row.id]);
          fixed++;
        }
      } else if (issueId === "duplicate_attendance") {
        const result = await pool.query(`
          DELETE FROM attendance WHERE id NOT IN (
            SELECT MIN(id) FROM attendance GROUP BY student_id, lesson_id, date
          )
        `);
        fixed = result.rowCount ?? 0;
      } else if (issueId === "orphaned_enrollments") {
        const result = await pool.query(`
          UPDATE students SET account_id = NULL
          WHERE account_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.id = students.account_id)
        `);
        fixed = result.rowCount ?? 0;
      } else if (issueId === "attendance_no_session") {
        const result = await pool.query(`
          DELETE FROM attendance
          WHERE NOT EXISTS (SELECT 1 FROM lessons l WHERE l.id = attendance.lesson_id)
        `);
        fixed = result.rowCount ?? 0;
      }
      results.push({ issueId, fixed });
    } catch (err: any) {
      results.push({ issueId, fixed: 0, error: err.message });
    }
  }

  const totalFixed = results.reduce((sum, r) => sum + r.fixed, 0);
  res.json({ totalFixed, results });
});
