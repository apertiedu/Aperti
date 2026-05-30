// This would be a scheduled job (cron) that runs every Friday
// For now, we create the route that generates the email content

import { Router, Response } from "express";
import { db } from "../lib/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";

export const guardianPulseRouter = Router();

// GET /guardian-pulse/preview/:parentId — preview the weekly email content
guardianPulseRouter.get("/preview/:parentId", authenticate, async (req: AuthRequest, res: Response) => {
  const parentId = parseInt(req.params.parentId);

  // Fetch children linked to this parent
  const links = await db.query.guardianLinks.findMany({
    where: (l, { eq }) => eq(l.parentAccountId, parentId),
  });

  const childrenData = await Promise.all(links.map(async (link) => {
    const student = await db.query.students.findFirst({ where: (s, { eq }) => eq(s.id, link.studentId) });
    const memory = await db.query.echoMemory.findFirst({ where: (m, { eq }) => eq(m.studentId, link.studentId) });
    const attendance = await db.query.attendance.findMany({
      where: (a, { eq, and }) => and(eq(a.studentId, link.studentId)),
      limit: 7,
    });

    return {
      name: student?.studentName || "Unknown",
      weakTopics: memory?.weakTopics || [],
      attendanceThisWeek: attendance.filter(a => a.status === "Present").length,
      totalSessionsThisWeek: attendance.length,
    };
  }));

  // Build a mock email body
  const emailBody = childrenData.map(child => `
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
