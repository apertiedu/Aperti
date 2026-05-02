import { Router, type IRouter } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { db, studentsTable, sessionsTable, attendanceTable, studentMarksTable, examQuestionsTable, examsTable } from "@workspace/db";

const router: IRouter = Router();

function getTeacherId(req: any): number | null {
  if (req.session.role === "admin") return null;
  if (req.session.role === "teacher") return req.session.accountId;
  return req.session.teacherAccountId || req.session.accountId;
}

router.get("/analytics/attendance-summary", async (req, res): Promise<void> => {
  const teacherId = getTeacherId(req);

  // Per session attendance counts
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
    .where(teacherId ? eq(sessionsTable.teacherAccountId, teacherId) : sql`1=1`)
    .groupBy(attendanceTable.sessionId, sessionsTable.lessonNumber, sessionsTable.dayOfWeek, sessionsTable.startTime, sessionsTable.type, sessionsTable.capacity, attendanceTable.status);

  const bySession: Record<number, any> = {};
  for (const row of sessionSummary) {
    if (!bySession[row.sessionId]) {
      bySession[row.sessionId] = { sessionId: row.sessionId, lessonNumber: row.lessonNumber, dayOfWeek: row.dayOfWeek, startTime: row.startTime, type: row.type, capacity: row.capacity, present: 0, absent: 0 };
    }
    if (row.status === "Present") bySession[row.sessionId].present += row.count;
    else bySession[row.sessionId].absent += row.count;
  }

  // Most absent students
  const absentQuery = db.select({
    studentId: attendanceTable.studentId,
    studentName: studentsTable.studentName,
    studentCode: studentsTable.studentCode,
    absentCount: sql<number>`count(*)::int`,
  }).from(attendanceTable)
    .innerJoin(studentsTable, eq(attendanceTable.studentId, studentsTable.id))
    .where(and(
      eq(attendanceTable.status, "Absent"),
      teacherId ? eq(studentsTable.teacherAccountId, teacherId) : sql`1=1`
    ))
    .groupBy(attendanceTable.studentId, studentsTable.studentName, studentsTable.studentCode)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  const mostAbsent = await absentQuery;

  // Overall stats
  const totalStudentsQ = await db.select({ count: sql<number>`count(*)::int` }).from(studentsTable)
    .where(teacherId ? eq(studentsTable.teacherAccountId, teacherId) : sql`1=1`);
  const presentQ = await db.select({ count: sql<number>`count(*)::int` }).from(attendanceTable)
    .innerJoin(studentsTable, eq(attendanceTable.studentId, studentsTable.id))
    .where(and(eq(attendanceTable.status, "Present"), teacherId ? eq(studentsTable.teacherAccountId, teacherId) : sql`1=1`));
  const absentQ = await db.select({ count: sql<number>`count(*)::int` }).from(attendanceTable)
    .innerJoin(studentsTable, eq(attendanceTable.studentId, studentsTable.id))
    .where(and(eq(attendanceTable.status, "Absent"), teacherId ? eq(studentsTable.teacherAccountId, teacherId) : sql`1=1`));

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

router.get("/analytics/performance", async (req, res): Promise<void> => {
  const teacherId = getTeacherId(req);

  const students = teacherId
    ? await db.select().from(studentsTable).where(eq(studentsTable.teacherAccountId, teacherId))
    : await db.select().from(studentsTable);

  if (students.length === 0) { res.json({ topStudents: [], atRisk: [], averagePercentage: 0, studentStats: [] }); return; }

  const studentIds = students.map(s => s.id);

  // Get all marks with question max marks
  const marksData = await db.select({
    studentId: studentMarksTable.studentId,
    marksScored: studentMarksTable.marksScored,
    maxMarks: examQuestionsTable.maxMarks,
    topic: examQuestionsTable.topic,
    mistakes: studentMarksTable.mistakes,
  }).from(studentMarksTable)
    .innerJoin(examQuestionsTable, eq(studentMarksTable.questionId, examQuestionsTable.id))
    .where(teacherId ? and(sql`${studentMarksTable.studentId} = ANY(${sql.raw(`ARRAY[${studentIds.join(',')}]`)})`) : sql`1=1`);

  // Get attendance per student
  const attendanceData = await db.select({
    studentId: attendanceTable.studentId,
    status: attendanceTable.status,
    count: sql<number>`count(*)::int`,
  }).from(attendanceTable)
    .where(teacherId ? and(eq(attendanceTable.status, attendanceTable.status), sql`${attendanceTable.studentId} = ANY(${sql.raw(`ARRAY[${studentIds.join(',')}]`)})`) : sql`1=1`)
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

    // Predicted IGCSE grade based on exam performance + attendance
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

    // Weak/strong topics
    const topicStats = marks ? Object.entries(marks.topics).map(([topic, data]) => ({
      topic,
      percentage: data.max > 0 ? Math.round((data.scored / data.max) * 100) : 0,
    })).sort((a, b) => a.percentage - b.percentage) : [];

    const weakTopics = topicStats.filter(t => t.percentage < 60).map(t => t.topic);
    const strongTopics = topicStats.filter(t => t.percentage >= 80).map(t => t.topic);

    return {
      id: s.id,
      studentCode: s.studentCode,
      studentName: s.studentName,
      attendanceRate,
      presentCount: att.present,
      absentCount: att.absent,
      examPercentage,
      predictedGrade,
      weakTopics,
      strongTopics,
      isAtRisk: attendanceRate < 70 || (examPercentage !== null && examPercentage < 50),
    };
  });

  const withExams = studentStats.filter(s => s.examPercentage !== null);
  const avgPercentage = withExams.length > 0
    ? Math.round(withExams.reduce((sum, s) => sum + (s.examPercentage ?? 0), 0) / withExams.length * 10) / 10
    : 0;

  const topStudents = [...studentStats].sort((a, b) => (b.examPercentage ?? 0) - (a.examPercentage ?? 0)).slice(0, 5);
  const atRisk = studentStats.filter(s => s.isAtRisk).sort((a, b) => a.attendanceRate - b.attendanceRate).slice(0, 10);

  res.json({ topStudents, atRisk, averagePercentage: avgPercentage, studentStats });
});

export default router;
