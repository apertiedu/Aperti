import { Router, type IRouter } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { db, studentsTable, sessionsTable, attendanceTable, studentMarksTable, examQuestionsTable, examsTable } from "@workspace/db";
import { requireTenantAccess } from "../middleware/tenant";

const router: IRouter = Router();

router.get("/analytics/attendance-summary", requireTenantAccess, async (req, res): Promise<void> => {
  const { teacherId, isAdmin } = req.tenant;
  const teacherFilter = !isAdmin && teacherId ? eq(sessionsTable.teacherAccountId, teacherId) : sql`1=1`;
  const studentFilter = !isAdmin && teacherId ? eq(studentsTable.teacherAccountId, teacherId) : sql`1=1`;

  const sessionSummary = await db.select({
    sessionId: attendanceTable.sessionId,
    lessonNumber: sessionsTable.lessonNumber,
    dayOfWeek: sessionsTable.dayOfWeek,
    startTime: sessionsTable.startTime,
    type: sessionsTable.type,
    capacity: sessionsTable.capacity,
    status: attendanceTable.status,
    count: sql<number>`count(*)::int`,
  }).from(attendanceTable)
    .innerJoin(sessionsTable, eq(attendanceTable.sessionId, sessionsTable.id))
    .innerJoin(studentsTable, eq(attendanceTable.studentId, studentsTable.id))
    .where(and(teacherFilter, studentFilter))
    .groupBy(attendanceTable.sessionId, sessionsTable.lessonNumber, sessionsTable.dayOfWeek, sessionsTable.startTime, sessionsTable.type, sessionsTable.capacity, attendanceTable.status);

  const bySession: Record<number, any> = {};
  for (const row of sessionSummary) {
    if (!bySession[row.sessionId]) {
      bySession[row.sessionId] = { sessionId: row.sessionId, lessonNumber: row.lessonNumber, dayOfWeek: row.dayOfWeek, startTime: row.startTime, type: row.type, capacity: row.capacity, present: 0, absent: 0 };
    }
    if (row.status === "Present") bySession[row.sessionId].present += row.count;
    else bySession[row.sessionId].absent += row.count;
  }

  const mostAbsent = await db.select({
    studentId: attendanceTable.studentId,
    studentName: studentsTable.studentName,
    studentCode: studentsTable.studentCode,
    absentCount: sql<number>`count(*)::int`,
  }).from(attendanceTable)
    .innerJoin(studentsTable, eq(attendanceTable.studentId, studentsTable.id))
    .where(and(eq(attendanceTable.status, "Absent"), studentFilter))
    .groupBy(attendanceTable.studentId, studentsTable.studentName, studentsTable.studentCode)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  const totalStudentsQ = await db.select({ count: sql<number>`count(*)::int` }).from(studentsTable).where(studentFilter);
  const presentQ = await db.select({ count: sql<number>`count(*)::int` }).from(attendanceTable)
    .innerJoin(studentsTable, eq(attendanceTable.studentId, studentsTable.id))
    .where(and(eq(attendanceTable.status, "Present"), studentFilter));
  const absentQ = await db.select({ count: sql<number>`count(*)::int` }).from(attendanceTable)
    .innerJoin(studentsTable, eq(attendanceTable.studentId, studentsTable.id))
    .where(and(eq(attendanceTable.status, "Absent"), studentFilter));

  const totalPresent = presentQ[0]?.count || 0;
  const totalAbsent = absentQ[0]?.count || 0;
  const total = totalPresent + totalAbsent;

  res.json({
    sessions: Object.values(bySession),
    mostAbsent,
    overall: {
      totalStudents: totalStudentsQ[0]?.count || 0,
      totalPresent,
      totalAbsent,
      attendanceRate: total > 0 ? Math.round((totalPresent / total) * 100 * 10) / 10 : 0,
    },
  });
});

router.get("/analytics/performance", requireTenantAccess, async (req, res): Promise<void> => {
  const { teacherId, isAdmin } = req.tenant;
  const studentFilter = !isAdmin && teacherId ? eq(studentsTable.teacherAccountId, teacherId) : sql`1=1`;

  const students = await db.select().from(studentsTable).where(studentFilter);
  if (students.length === 0) { res.json({ topStudents: [], atRisk: [], averagePercentage: 0, studentStats: [] }); return; }

  const studentIds = students.map(s => s.id);
  if (studentIds.length === 0) { res.json({ topStudents: [], atRisk: [], averagePercentage: 0, studentStats: [] }); return; }

  const marksData = await db.select({
    studentId: studentMarksTable.studentId,
    marksScored: studentMarksTable.marksScored,
    maxMarks: examQuestionsTable.maxMarks,
    topic: examQuestionsTable.topic,
  }).from(studentMarksTable)
    .innerJoin(examQuestionsTable, eq(studentMarksTable.questionId, examQuestionsTable.id))
    .where(sql`${studentMarksTable.studentId} = ANY(ARRAY[${sql.raw(studentIds.join(","))}]::int[])`);

  const attendanceData = await db.select({
    studentId: attendanceTable.studentId,
    status: attendanceTable.status,
    count: sql<number>`count(*)::int`,
  }).from(attendanceTable)
    .where(sql`${attendanceTable.studentId} = ANY(ARRAY[${sql.raw(studentIds.join(","))}]::int[])`)
    .groupBy(attendanceTable.studentId, attendanceTable.status);

  const attendanceMap: Record<number, { present: number; absent: number }> = {};
  for (const row of attendanceData) {
    if (!attendanceMap[row.studentId]) attendanceMap[row.studentId] = { present: 0, absent: 0 };
    if (row.status === "Present") attendanceMap[row.studentId].present += row.count;
    else attendanceMap[row.studentId].absent += row.count;
  }

  const marksMap: Record<number, { totalScored: number; totalMax: number; topics: Record<string, { scored: number; max: number }> }> = {};
  for (const m of marksData) {
    if (!marksMap[m.studentId]) marksMap[m.studentId] = { totalScored: 0, totalMax: 0, topics: {} };
    const scored = m.marksScored !== null ? parseFloat(String(m.marksScored)) : 0;
    const max = parseFloat(String(m.maxMarks));
    marksMap[m.studentId].totalScored += scored;
    marksMap[m.studentId].totalMax += max;
    if (m.topic) {
      if (!marksMap[m.studentId].topics[m.topic]) marksMap[m.studentId].topics[m.topic] = { scored: 0, max: 0 };
      marksMap[m.studentId].topics[m.topic].scored += scored;
      marksMap[m.studentId].topics[m.topic].max += max;
    }
  }

  const studentStats = students.map(s => {
    const att = attendanceMap[s.id] || { present: 0, absent: 0 };
    const totalAtt = att.present + att.absent;
    const attendanceRate = totalAtt > 0 ? Math.round((att.present / totalAtt) * 100) : 0;
    const marks = marksMap[s.id];
    const examPercentage = marks && marks.totalMax > 0 ? Math.round((marks.totalScored / marks.totalMax) * 100 * 10) / 10 : null;

    let predictedGrade = "N/A";
    if (examPercentage !== null) {
      const adjusted = examPercentage * 0.7 + attendanceRate * 0.3;
      if (adjusted >= 90) predictedGrade = "A*";
      else if (adjusted >= 80) predictedGrade = "A";
      else if (adjusted >= 70) predictedGrade = "B";
      else if (adjusted >= 60) predictedGrade = "C";
      else if (adjusted >= 50) predictedGrade = "D";
      else if (adjusted >= 40) predictedGrade = "E";
      else predictedGrade = "U";
    }

    const topicStats = marks ? Object.entries(marks.topics).map(([topic, data]) => ({
      topic, percentage: data.max > 0 ? Math.round((data.scored / data.max) * 100) : 0,
    })).sort((a, b) => a.percentage - b.percentage) : [];

    const riskScore = Math.min(100, Math.round(Math.max(0, 80 - attendanceRate) * 1.2 + (examPercentage !== null ? Math.max(0, 60 - examPercentage) * 0.8 : 20)));

    return {
      id: s.id, studentCode: s.studentCode, studentName: s.studentName,
      attendanceRate, presentCount: att.present, absentCount: att.absent,
      examPercentage, predictedGrade,
      weakTopics: topicStats.filter(t => t.percentage < 60).map(t => t.topic),
      strongTopics: topicStats.filter(t => t.percentage >= 80).map(t => t.topic),
      isAtRisk: attendanceRate < 70 || (examPercentage !== null && examPercentage < 50),
      riskScore,
    };
  });

  const withExams = studentStats.filter(s => s.examPercentage !== null);
  const avgPercentage = withExams.length > 0
    ? Math.round(withExams.reduce((sum, s) => sum + (s.examPercentage ?? 0), 0) / withExams.length * 10) / 10 : 0;

  res.json({
    topStudents: [...studentStats].sort((a, b) => (b.examPercentage ?? 0) - (a.examPercentage ?? 0)).slice(0, 5),
    atRisk: studentStats.filter(s => s.isAtRisk).sort((a, b) => b.riskScore - a.riskScore).slice(0, 10),
    averagePercentage: avgPercentage,
    studentStats,
  });
});

export default router;
