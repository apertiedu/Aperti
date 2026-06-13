import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";

export const guardianPulseRouter = Router();

guardianPulseRouter.get("/preview/:parentId", authenticate, async (req: AuthRequest, res: Response) => {
  const parentId = parseInt(req.params.parentId, 10);

  const { rows: links } = await pool.query(
    `SELECT gl.student_id, gl.parent_account_id FROM guardian_links gl WHERE gl.parent_account_id = $1`,
    [parentId]
  );

  const childrenData = await Promise.all(links.map(async (link: any) => {
    const { rows: [student] } = await pool.query(
      `SELECT student_name FROM students WHERE id = $1 LIMIT 1`,
      [link.student_id]
    );
    const { rows: [memory] } = await pool.query(
      `SELECT weak_topics FROM echo_memory WHERE student_id = $1 LIMIT 1`,
      [link.student_id]
    );
    const { rows: attendance } = await pool.query(
      `SELECT status FROM attendance WHERE student_id = $1 ORDER BY date DESC LIMIT 7`,
      [link.student_id]
    );

    return {
      name: student?.student_name || "Unknown",
      weakTopics: (memory?.weak_topics as string[]) || [],
      attendanceThisWeek: attendance.filter((a: any) => a.status === "Present").length,
      totalSessionsThisWeek: attendance.length,
    };
  }));

  const emailBody = childrenData.map((child: any) => `
    <div style="margin-bottom:20px;">
      <h3>${child.name}</h3>
      <p>Attendance: ${child.attendanceThisWeek}/${child.totalSessionsThisWeek} sessions</p>
      <p>Focus areas: ${child.weakTopics.join(", ") || "All caught up!"}</p>
    </div>
  `).join("");

  res.json({
    subject: "Your Weekly GuardianPulse Report",
    body: emailBody,
    children: childrenData,
  });
});
