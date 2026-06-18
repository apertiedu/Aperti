import { Router, type IRouter } from "express";
import { eq, and, sql, desc, gte, inArray } from "drizzle-orm";
import {
  db, studentsTable, attendanceTable, examsTable, studentMarksTable,
  examQuestionsTable, homeworkTable, homeworkSubmissionsTable,
  accountsTable, auditLogsTable, sessionsTable,
} from "@workspace/db";
import { requireTenantAccess } from "../middleware/tenant";

const router: IRouter = Router();

// ─── Report Text Generation Helpers ──────────────────────────────────────────

function progressBar(pct: number): string {
  const filled = Math.round(pct / 20);
  return "🟩".repeat(Math.min(filled, 5)) + "⬜".repeat(Math.max(0, 5 - filled));
}

function classifyStudent(attRate: number, examAvg: number | null, hwRate: number, examTrend: number | null): { label: string; emoji: string } {
  if (attRate >= 95 && examAvg !== null && examAvg >= 85 && hwRate >= 90) return { label: "Elite Performer", emoji: "🌟" };
  if (examTrend !== null && examTrend >= 12) return { label: "Rising Star", emoji: "🚀" };
  if (attRate >= 88 && examAvg !== null && examAvg >= 75 && hwRate >= 80) return { label: "Consistent Achiever", emoji: "⭐" };
  if (attRate < 55 || (examAvg !== null && examAvg < 35)) return { label: "Needs Urgent Support", emoji: "🚨" };
  if (attRate < 70) return { label: "Attendance-Risk Student", emoji: "⚠️" };
  if (examTrend !== null && examTrend <= -12) return { label: "Performance Declining", emoji: "📉" };
  if (hwRate >= 90 && attRate >= 80) return { label: "Disciplined Worker", emoji: "💪" };
  if (examAvg !== null && examAvg >= 70 && attRate < 75) return { label: "High Potential / Low Focus", emoji: "💡" };
  if (examAvg !== null && examAvg < 55 && attRate >= 80) return { label: "Hard Worker / Exam Struggling", emoji: "📖" };
  return { label: "Steady Progress", emoji: "📈" };
}

const MOTIVATION_POOL = {
  excellent: [
    "🌟 Outstanding dedication — your consistency is truly setting you apart.",
    "⭐ Every session attended and every task completed compounds into excellence.",
    "🏆 Remarkable commitment. This is how champions are built — one session at a time.",
  ],
  improving: [
    "🚀 The upward trajectory is clear. Keep pushing — momentum is powerful.",
    "💪 Progress is visible and real. Stay the course and the results will follow.",
    "📈 Small improvements every week create massive long-term success.",
  ],
  struggling: [
    "🤝 Every expert was once a beginner. Focus on one step at a time.",
    "💡 Challenges are the foundation of growth. Support is available — use it.",
    "🔄 Recovery is a process. Consistency now will rebuild confidence fast.",
  ],
  standard: [
    "⚡ Consistency creates excellence — every session is an investment in your future.",
    "📚 Great foundations are being built. Keep showing up and the results will come.",
    "🎯 Stay focused, stay present, and trust the process.",
  ],
};

function pickMotivation(attRate: number, examAvg: number | null, examTrend: number | null): string {
  const seed = (attRate + (examAvg ?? 50) + Math.abs(examTrend ?? 0)) % 3;
  if (attRate >= 85 && examAvg !== null && examAvg >= 75) return MOTIVATION_POOL.excellent[seed % 3];
  if (examTrend !== null && examTrend >= 5) return MOTIVATION_POOL.improving[seed % 3];
  if (attRate < 65 || (examAvg !== null && examAvg < 45)) return MOTIVATION_POOL.struggling[seed % 3];
  return MOTIVATION_POOL.standard[seed % 3];
}

function generateAIInsight(attRate: number, examAvg: number | null, hwRate: number, examTrend: number | null, weakTopics: string[], strongTopics: string[]): string[] {
  const lines: string[] = [];
  if (attRate < 65) {
    lines.push("📌 Attendance has dropped to a concerning level. Each missed session creates compounding knowledge gaps that directly impact exam readiness.");
  } else if (attRate >= 90) {
    lines.push("📌 Exceptional attendance consistency — this is the single most reliable predictor of academic success.");
  } else {
    lines.push("📌 Attendance is at an acceptable level but has room for improvement. Higher consistency will directly lift performance.");
  }
  if (examAvg !== null) {
    if (examAvg >= 80) lines.push("📌 Strong exam performance reflects thorough preparation and solid subject understanding.");
    else if (examAvg >= 60) lines.push("📌 Exam performance is developing well. Targeted revision on weak areas can push scores to the next level.");
    else lines.push("📌 Exam scores indicate areas of conceptual difficulty. Structured revision with model answers is strongly recommended.");
  }
  if (examTrend !== null && examTrend >= 8) lines.push(`📌 Impressive upward trend detected (+${Math.round(examTrend)}%). The improvement momentum is building — do not break it now.`);
  if (examTrend !== null && examTrend <= -8) lines.push(`📌 Declining exam trend detected (${Math.round(examTrend)}%). Early intervention is recommended before this becomes a pattern.`);
  if (weakTopics.length > 0) lines.push(`📌 Identified priority revision areas: ${weakTopics.join(", ")}. Focus here first before moving to new content.`);
  if (hwRate >= 90) lines.push("📌 Excellent homework discipline. This consistent practice is a strong indicator of long-term academic success.");
  if (hwRate < 50 && hwRate >= 0) lines.push("📌 Homework completion rate is low. Regular practice is essential — each skipped task leaves a gap in understanding.");
  return lines;
}

function generateActionPlanItems(attRate: number, examAvg: number | null, hwRate: number, weakTopics: string[], examTrend: number | null): string[] {
  const actions: string[] = [];
  if (attRate < 70) actions.push("📅 Immediate priority: improve attendance to 85%+ — every session missed is a gap that compounds.");
  else if (attRate < 85) actions.push("📅 Aim to reach 90%+ attendance — consistency now will pay dividends before exams.");
  if (weakTopics.length > 0) actions.push(`📖 Revise priority topics: ${weakTopics.slice(0, 3).join(", ")} — solve 5 past paper questions per topic.`);
  if (examAvg !== null && examAvg < 55) actions.push("✏️ Practice timed past paper questions daily. Focus on understanding mark schemes.");
  else if (examAvg !== null && examAvg < 70) actions.push("✏️ Review returned papers — identify marking patterns and strengthen weaker question types.");
  if (hwRate < 70) actions.push("📝 Commit to submitting all homework on time — it is structured exam practice, not optional.");
  if (examTrend !== null && examTrend <= -8) actions.push("🔍 Schedule a catch-up session to identify and address the root cause of declining performance.");
  actions.push("🧠 Review session notes within 24 hours using active recall — this doubles long-term retention.");
  return actions;
}

function buildReportText(
  studentName: string, studentCode: string, teacherName: string, weekLabel: string,
  attRate: number, totalPresent: number, totalAbsent: number,
  examAvg: number | null, examCount: number, examTrend: number | null,
  hwRate: number, hwSubmitted: number, hwAssigned: number, hwAvg: number | null,
  weakTopics: string[], strongTopics: string[],
): string {
  const cls = classifyStudent(attRate, examAvg, hwRate, examTrend);

  const lines: string[] = [
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "⭐  APERTI WEEKLY PERFORMANCE REPORT",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    `👨‍🎓  Student : ${studentName}`,
    `🆔  Code    : ${studentCode}`,
    `📅  Period  : ${weekLabel}`,
    teacherName ? `🏫  Teacher : ${teacherName}` : "",
    `📊  Status  : ${cls.label} ${cls.emoji}`,
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "📊  PERFORMANCE SNAPSHOT",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    `🎯  Attendance      : ${attRate}%`,
    examAvg !== null ? `📚  Exams Average   : ${examAvg}%` : "📚  Exams Average   : No data yet",
    examTrend !== null ? `📈  Exam Trend      : ${examTrend > 0 ? "+" : ""}${Math.round(examTrend)}%  ${examTrend > 0 ? "↑ Improving" : examTrend < 0 ? "↓ Declining" : "→ Stable"}` : "",
    `📝  Homework Rate   : ${hwRate}%  (${hwSubmitted}/${hwAssigned} submitted)`,
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "📈  SMART METRICS",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "",
    `📍  Attendance: ${attRate}%`,
    progressBar(attRate),
    `    ${totalPresent} present · ${totalAbsent} absent`,
    "",
  ];

  if (hwAssigned > 0) {
    lines.push(`📍  Homework: ${hwRate}%`);
    lines.push(progressBar(hwRate));
    if (hwAvg !== null) lines.push(`    Avg score: ${hwAvg}%`);
    lines.push("");
  }

  if (examAvg !== null) {
    lines.push(`📍  Exam Performance: ${examAvg}%`);
    lines.push(progressBar(examAvg));
    lines.push(`    ${examCount} exam${examCount !== 1 ? "s" : ""} recorded`);
    lines.push("");
  }

  if (strongTopics.length > 0 || weakTopics.length > 0) {
    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    lines.push("🧠  ACADEMIC ANALYSIS");
    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    if (strongTopics.length > 0) {
      lines.push("✅  Strongest Areas:");
      strongTopics.forEach(t => lines.push(`    • ${t} 💪`));
    }
    if (weakTopics.length > 0) {
      lines.push("⚠️  Priority Revision:");
      weakTopics.forEach(t => lines.push(`    • ${t}`));
    }
    lines.push("");
  }

  const insights = generateAIInsight(attRate, examAvg, hwRate, examTrend, weakTopics, strongTopics);
  if (insights.length > 0) {
    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    lines.push("💡  AI INSIGHTS");
    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    insights.forEach(i => lines.push(i));
    lines.push("");
  }

  const actions = generateActionPlanItems(attRate, examAvg, hwRate, weakTopics, examTrend);
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("🚀  ACTION PLAN");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  actions.forEach(a => lines.push(a));
  lines.push("");

  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push(pickMotivation(attRate, examAvg, examTrend));
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  return lines.filter(l => l !== null).join("\n");
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/reports/weekly-data  — aggregate per-student data
router.get("/reports/weekly-data", requireTenantAccess, async (req, res): Promise<void> => {
  const { teacherId, isAdmin, accountId } = req.tenant;
  const studentFilter = !isAdmin && teacherId ? eq(studentsTable.teacherAccountId, teacherId) : sql`1=1`;
  const hwTeacherFilter = !isAdmin && teacherId ? eq(homeworkTable.teacherAccountId, teacherId) : sql`1=1`;

  const students = await db.select().from(studentsTable).where(studentFilter).limit(500);
  if (students.length === 0) { res.json([]); return; }

  const studentIds = students.map(s => s.id);
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const recentCutoff = fourWeeksAgo.toISOString().split("T")[0]!;

  const [myAccount] = await db.select({ displayName: accountsTable.displayName }).from(accountsTable).where(eq(accountsTable.id, accountId));
  const teacherName = myAccount?.displayName ?? "";

  const [allAtt, recentAtt, allMarks, allHwSubs, [hwTotal]] = await Promise.all([
    db.select({ sid: attendanceTable.studentId, status: attendanceTable.status, cnt: sql<number>`count(*)::int` })
      .from(attendanceTable).where(inArray(attendanceTable.studentId, studentIds)).groupBy(attendanceTable.studentId, attendanceTable.status),
    db.select({ sid: attendanceTable.studentId, status: attendanceTable.status, cnt: sql<number>`count(*)::int` })
      .from(attendanceTable).where(and(inArray(attendanceTable.studentId, studentIds), gte(attendanceTable.date, recentCutoff))).groupBy(attendanceTable.studentId, attendanceTable.status),
    db.select({ sid: studentMarksTable.studentId, examId: studentMarksTable.examId, marksScored: studentMarksTable.marksScored, maxMarks: examQuestionsTable.maxMarks, topic: examQuestionsTable.topic })
      .from(studentMarksTable).innerJoin(examQuestionsTable, eq(studentMarksTable.questionId, examQuestionsTable.id)).where(inArray(studentMarksTable.studentId, studentIds)),
    db.select({ sid: homeworkSubmissionsTable.studentId, marksAwarded: homeworkSubmissionsTable.marksAwarded, totalMarks: homeworkTable.totalMarks })
      .from(homeworkSubmissionsTable).innerJoin(homeworkTable, eq(homeworkSubmissionsTable.homeworkId, homeworkTable.id)).where(and(inArray(homeworkSubmissionsTable.studentId, studentIds), hwTeacherFilter)),
    db.select({ cnt: sql<number>`count(*)::int` }).from(homeworkTable).where(hwTeacherFilter),
  ]);

  const attMap = new Map<number, { present: number; absent: number }>();
  for (const r of allAtt) {
    if (!attMap.has(r.sid)) attMap.set(r.sid, { present: 0, absent: 0 });
    const a = attMap.get(r.sid)!;
    if (r.status === "Present") a.present = r.cnt; else if (r.status === "Absent") a.absent = r.cnt;
  }
  const recentAttMap = new Map<number, { present: number; absent: number }>();
  for (const r of recentAtt) {
    if (!recentAttMap.has(r.sid)) recentAttMap.set(r.sid, { present: 0, absent: 0 });
    const a = recentAttMap.get(r.sid)!;
    if (r.status === "Present") a.present = r.cnt; else if (r.status === "Absent") a.absent = r.cnt;
  }
  const marksMap = new Map<number, typeof allMarks>();
  for (const m of allMarks) {
    if (!marksMap.has(m.sid)) marksMap.set(m.sid, []);
    marksMap.get(m.sid)!.push(m);
  }
  const hwSubsMap = new Map<number, typeof allHwSubs>();
  for (const s of allHwSubs) {
    if (!hwSubsMap.has(s.sid)) hwSubsMap.set(s.sid, []);
    hwSubsMap.get(s.sid)!.push(s);
  }
  const hwCount = hwTotal?.cnt ?? 0;

  const result = students.map(student => {
    const att = attMap.get(student.id) ?? { present: 0, absent: 0 };
    const total = att.present + att.absent;
    const attRate = total > 0 ? Math.round((att.present / total) * 100) : 0;
    const rAtt = recentAttMap.get(student.id) ?? { present: 0, absent: 0 };
    const rTotal = rAtt.present + rAtt.absent;
    const recentRate = rTotal > 0 ? Math.round((rAtt.present / rTotal) * 100) : attRate;

    const marks = marksMap.get(student.id) ?? [];
    const byExam: Record<number, { scored: number; max: number }> = {};
    const byTopic: Record<string, { scored: number; max: number }> = {};
    for (const m of marks) {
      if (!byExam[m.examId]) byExam[m.examId] = { scored: 0, max: 0 };
      byExam[m.examId].scored += Number(m.marksScored ?? 0);
      byExam[m.examId].max += Number(m.maxMarks ?? 0);
      if (m.topic) {
        if (!byTopic[m.topic]) byTopic[m.topic] = { scored: 0, max: 0 };
        byTopic[m.topic].scored += Number(m.marksScored ?? 0);
        byTopic[m.topic].max += Number(m.maxMarks ?? 0);
      }
    }
    const examPcts = Object.values(byExam).filter(e => e.max > 0).map(e => Math.round((e.scored / e.max) * 100));
    const examAvg = examPcts.length > 0 ? Math.round(examPcts.reduce((a, b) => a + b, 0) / examPcts.length) : null;
    const examTrend = examPcts.length >= 2 ? Math.round(examPcts[examPcts.length - 1]! - examPcts.slice(0, -1).reduce((a, b) => a + b, 0) / (examPcts.length - 1)) : null;
    const topicStats = Object.entries(byTopic).map(([topic, { scored, max }]) => ({ topic, pct: max > 0 ? Math.round((scored / max) * 100) : 0 })).sort((a, b) => a.pct - b.pct);
    const weakTopics = topicStats.filter(t => t.pct < 60).map(t => t.topic).slice(0, 3);
    const strongTopics = topicStats.filter(t => t.pct >= 80).map(t => t.topic).slice(-2);

    const hwSubs = hwSubsMap.get(student.id) ?? [];
    const hwSubmitted = hwSubs.length;
    const hwRate = hwCount > 0 ? Math.round((hwSubmitted / hwCount) * 100) : 0;
    const hwScores = hwSubs.filter(s => s.marksAwarded != null && s.totalMarks != null && Number(s.totalMarks) > 0).map(s => Math.round((Number(s.marksAwarded) / Number(s.totalMarks)) * 100));
    const hwAvg = hwScores.length > 0 ? Math.round(hwScores.reduce((a, b) => a + b, 0) / hwScores.length) : null;

    return {
      id: student.id,
      studentCode: student.studentCode,
      studentName: student.studentName,
      teacherName,
      attendance: { rate: attRate, recentRate, totalPresent: att.present, totalAbsent: att.absent, total },
      exams: { count: examPcts.length, avg: examAvg, trend: examTrend, weakTopics, strongTopics },
      homework: { assigned: hwCount, submitted: hwSubmitted, rate: hwRate, avg: hwAvg },
    };
  });

  res.json(result);
});

// POST /api/reports/generate  — generate formatted text report for one or all students
router.post("/reports/generate", requireTenantAccess, async (req, res): Promise<void> => {
  const { weekLabel = "This week" } = req.body;
  const { teacherId, isAdmin, accountId } = req.tenant;
  const studentFilter = !isAdmin && teacherId ? eq(studentsTable.teacherAccountId, teacherId) : sql`1=1`;
  const hwTeacherFilter = !isAdmin && teacherId ? eq(homeworkTable.teacherAccountId, teacherId) : sql`1=1`;

  const [myAccount] = await db.select({ displayName: accountsTable.displayName }).from(accountsTable).where(eq(accountsTable.id, accountId));
  const teacherName = myAccount?.displayName ?? "";

  const students = await db.select().from(studentsTable).where(studentFilter).limit(500);
  if (students.length === 0) { res.json([]); return; }

  const studentIds = students.map(s => s.id);

  const [allAtt, allMarks, allHwSubs, [hwTotal]] = await Promise.all([
    db.select({ sid: attendanceTable.studentId, status: attendanceTable.status, cnt: sql<number>`count(*)::int` })
      .from(attendanceTable).where(inArray(attendanceTable.studentId, studentIds)).groupBy(attendanceTable.studentId, attendanceTable.status),
    db.select({ sid: studentMarksTable.studentId, examId: studentMarksTable.examId, marksScored: studentMarksTable.marksScored, maxMarks: examQuestionsTable.maxMarks, topic: examQuestionsTable.topic })
      .from(studentMarksTable).innerJoin(examQuestionsTable, eq(studentMarksTable.questionId, examQuestionsTable.id)).where(inArray(studentMarksTable.studentId, studentIds)),
    db.select({ sid: homeworkSubmissionsTable.studentId, marksAwarded: homeworkSubmissionsTable.marksAwarded, totalMarks: homeworkTable.totalMarks })
      .from(homeworkSubmissionsTable).innerJoin(homeworkTable, eq(homeworkSubmissionsTable.homeworkId, homeworkTable.id)).where(and(inArray(homeworkSubmissionsTable.studentId, studentIds), hwTeacherFilter)),
    db.select({ cnt: sql<number>`count(*)::int` }).from(homeworkTable).where(hwTeacherFilter),
  ]);

  const attMap = new Map<number, { present: number; absent: number }>();
  for (const r of allAtt) {
    if (!attMap.has(r.sid)) attMap.set(r.sid, { present: 0, absent: 0 });
    const a = attMap.get(r.sid)!;
    if (r.status === "Present") a.present = r.cnt; else if (r.status === "Absent") a.absent = r.cnt;
  }
  const marksMap = new Map<number, typeof allMarks>();
  for (const m of allMarks) {
    if (!marksMap.has(m.sid)) marksMap.set(m.sid, []);
    marksMap.get(m.sid)!.push(m);
  }
  const hwSubsMap = new Map<number, typeof allHwSubs>();
  for (const s of allHwSubs) {
    if (!hwSubsMap.has(s.sid)) hwSubsMap.set(s.sid, []);
    hwSubsMap.get(s.sid)!.push(s);
  }
  const hwCount = hwTotal?.cnt ?? 0;

  const reports: { studentId: number; studentCode: string; studentName: string; report: string }[] = students.map(student => {
    const att = attMap.get(student.id) ?? { present: 0, absent: 0 };
    const total = att.present + att.absent;
    const attRate = total > 0 ? Math.round((att.present / total) * 100) : 0;

    const marks = marksMap.get(student.id) ?? [];
    const byExam: Record<number, { scored: number; max: number }> = {};
    const byTopic: Record<string, { scored: number; max: number }> = {};
    for (const m of marks) {
      if (!byExam[m.examId]) byExam[m.examId] = { scored: 0, max: 0 };
      byExam[m.examId].scored += Number(m.marksScored ?? 0); byExam[m.examId].max += Number(m.maxMarks ?? 0);
      if (m.topic) {
        if (!byTopic[m.topic]) byTopic[m.topic] = { scored: 0, max: 0 };
        byTopic[m.topic].scored += Number(m.marksScored ?? 0); byTopic[m.topic].max += Number(m.maxMarks ?? 0);
      }
    }
    const examPcts = Object.values(byExam).filter(e => e.max > 0).map(e => Math.round((e.scored / e.max) * 100));
    const examAvg = examPcts.length > 0 ? Math.round(examPcts.reduce((a, b) => a + b, 0) / examPcts.length) : null;
    const examTrend = examPcts.length >= 2 ? Math.round(examPcts[examPcts.length - 1]! - examPcts.slice(0, -1).reduce((a, b) => a + b, 0) / (examPcts.length - 1)) : null;
    const topicStats = Object.entries(byTopic).map(([topic, { scored, max }]) => ({ topic, pct: max > 0 ? Math.round((scored / max) * 100) : 0 })).sort((a, b) => a.pct - b.pct);
    const weakTopics = topicStats.filter(t => t.pct < 60).map(t => t.topic).slice(0, 3);
    const strongTopics = topicStats.filter(t => t.pct >= 80).map(t => t.topic).slice(-2);

    const hwSubs = hwSubsMap.get(student.id) ?? [];
    const hwSubmitted = hwSubs.length;
    const hwRate = hwCount > 0 ? Math.round((hwSubmitted / hwCount) * 100) : 0;
    const hwScores = hwSubs.filter(s => s.marksAwarded != null && s.totalMarks != null && Number(s.totalMarks) > 0).map(s => Math.round((Number(s.marksAwarded) / Number(s.totalMarks)) * 100));
    const hwAvg = hwScores.length > 0 ? Math.round(hwScores.reduce((a, b) => a + b, 0) / hwScores.length) : null;

    const reportText = buildReportText(
      student.studentName, student.studentCode, teacherName, weekLabel,
      attRate, att.present, att.absent,
      examAvg, examPcts.length, examTrend,
      hwRate, hwSubmitted, hwCount, hwAvg,
      weakTopics, strongTopics,
    );
    return { studentId: student.id, studentCode: student.studentCode, studentName: student.studentName, report: reportText };
  });

  res.json(reports);
});

// GET /api/reports/system-stats  — admin-only platform overview
router.get("/reports/system-stats", requireTenantAccess, async (req, res): Promise<void> => {
  if (!req.tenant.isAdmin) { res.status(403).json({ message: "Admin only" }); return; }

  const [
    [totalStudents], [totalAttendance], [presentCount], [totalExams], [totalSessions],
    [teacherCount], [assistantCount], [studentAccountCount],
    teacherStudentCounts,
    recentLogs,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(studentsTable),
    db.select({ count: sql<number>`count(*)::int` }).from(attendanceTable),
    db.select({ count: sql<number>`count(*)::int` }).from(attendanceTable).where(eq(attendanceTable.status, "Present")),
    db.select({ count: sql<number>`count(*)::int` }).from(examsTable),
    db.select({ count: sql<number>`count(*)::int` }).from(sessionsTable),
    db.select({ count: sql<number>`count(*)::int` }).from(accountsTable).where(eq(accountsTable.role, "teacher")),
    db.select({ count: sql<number>`count(*)::int` }).from(accountsTable).where(eq(accountsTable.role, "assistant")),
    db.select({ count: sql<number>`count(*)::int` }).from(accountsTable).where(eq(accountsTable.role, "student")),
    db.select({
      teacherAccountId: studentsTable.teacherAccountId,
      studentCount: sql<number>`count(*)::int`,
    }).from(studentsTable).groupBy(studentsTable.teacherAccountId).orderBy(desc(sql`count(*)`)).limit(10),
    db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt)).limit(100),
  ]);

  const neededIds = [
    ...teacherStudentCounts.map(t => t.teacherAccountId).filter(Boolean) as number[],
    ...recentLogs.map(l => l.accountId).filter(Boolean) as number[],
  ];
  const uniqueIds = [...new Set(neededIds)];
  const accountRows = uniqueIds.length > 0
    ? await db.select({
        id: accountsTable.id,
        displayName: accountsTable.displayName,
        username: accountsTable.username,
        role: accountsTable.role,
        status: accountsTable.status,
        createdAt: accountsTable.createdAt,
      }).from(accountsTable).where(inArray(accountsTable.id, uniqueIds))
    : [];
  const accountMap = Object.fromEntries(accountRows.map(a => [a.id, a]));

  const topTeachers = teacherStudentCounts.map(t => ({
    teacherId: t.teacherAccountId,
    teacherName: t.teacherAccountId ? accountMap[t.teacherAccountId]?.displayName ?? "Unknown" : "Unassigned",
    username: t.teacherAccountId ? accountMap[t.teacherAccountId]?.username ?? "" : "",
    studentCount: t.studentCount,
    status: t.teacherAccountId ? accountMap[t.teacherAccountId]?.status ?? "active" : "active",
  }));

  const paginatedAccounts = await db.select({
    id: accountsTable.id,
    username: accountsTable.username,
    displayName: accountsTable.displayName,
    role: accountsTable.role,
    status: accountsTable.status,
    createdAt: accountsTable.createdAt,
  }).from(accountsTable).orderBy(desc(accountsTable.createdAt)).limit(200);

  const attRate = totalAttendance?.count > 0 ? Math.round(((presentCount?.count ?? 0) / totalAttendance.count) * 100) : 0;

  res.json({
    totals: {
      students: totalStudents?.count ?? 0,
      teachers: teacherCount?.count ?? 0,
      assistants: assistantCount?.count ?? 0,
      studentAccounts: studentAccountCount?.count ?? 0,
      sessions: totalSessions?.count ?? 0,
      exams: totalExams?.count ?? 0,
      totalAttendance: totalAttendance?.count ?? 0,
    },
    overallAttendanceRate: attRate,
    topTeachers,
    accounts: paginatedAccounts,
    recentAuditLogs: recentLogs.map(l => ({
      id: l.id,
      action: l.action,
      resource: l.resource,
      resourceId: l.resourceId,
      actorName: l.accountId ? accountMap[l.accountId]?.displayName ?? "Unknown" : "System",
      actorRole: l.accountId ? accountMap[l.accountId]?.role ?? "" : "",
      ipAddress: l.ipAddress,
      createdAt: l.createdAt,
    })),
  });
});

export default router;
