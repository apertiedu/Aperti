import { Router, type IRouter } from "express";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { db, studentsTable, attendanceTable, sessionsTable, studentMarksTable, examQuestionsTable, examsTable } from "@workspace/db";
import { requireTenantAccess } from "../middleware/tenant";

const router: IRouter = Router();

function generateInsights(
  studentName: string,
  recentRate: number,
  olderRate: number,
  overallRate: number,
  examPercentage: number | null,
  weakTopics: string[],
  strongTopics: string[],
  examTrend: number | null,
  totalAbsent: number
): Array<{ type: "success" | "warning" | "info"; text: string }> {
  const insights: Array<{ type: "success" | "warning" | "info"; text: string }> = [];
  const name = studentName.split(" ")[0];

  const drop = olderRate - recentRate;
  if (drop >= 20) {
    insights.push({ type: "warning", text: `${name}'s attendance dropped by ${Math.round(drop)}% in recent weeks. Consider reaching out to the family.` });
  } else if (recentRate - olderRate >= 15) {
    insights.push({ type: "success", text: `${name} has improved their attendance by ${Math.round(recentRate - olderRate)}% recently — great consistency.` });
  }

  if (overallRate >= 95) insights.push({ type: "success", text: `${name} has outstanding attendance at ${overallRate}%. Excellent commitment.` });
  else if (overallRate < 60) insights.push({ type: "warning", text: `${name}'s overall attendance is critically low at ${overallRate}%. Immediate intervention may be needed.` });
  else if (overallRate < 75) insights.push({ type: "warning", text: `${name}'s attendance of ${overallRate}% is below the recommended 80% threshold.` });

  if (totalAbsent >= 5) insights.push({ type: "warning", text: `${name} has accumulated ${totalAbsent} absences. Consistent attendance is key to academic success.` });

  if (examPercentage !== null) {
    if (examPercentage >= 85) insights.push({ type: "success", text: `${name} is performing excellently in exams with an average of ${examPercentage}%.` });
    else if (examPercentage < 50) insights.push({ type: "warning", text: `${name}'s exam performance of ${examPercentage}% suggests they need additional support.` });
    if (examTrend !== null && examTrend >= 10) insights.push({ type: "success", text: `${name} has improved by ${Math.round(examTrend)}% across recent exams — clear upward trend.` });
    else if (examTrend !== null && examTrend <= -10) insights.push({ type: "warning", text: `${name}'s exam scores have declined by ${Math.round(Math.abs(examTrend))}%. Review recent topics.` });
  }

  if (weakTopics.length > 0) insights.push({ type: "info", text: `${name} struggles most with: ${weakTopics.slice(0, 3).join(", ")}. Focused revision is recommended.` });
  if (strongTopics.length > 0) insights.push({ type: "success", text: `${name} excels in: ${strongTopics.slice(0, 3).join(", ")}.` });

  if (insights.length === 0) insights.push({ type: "info", text: `${name} is on track. Keep monitoring progress regularly.` });

  return insights;
}

router.get("/students/:id/profile", requireTenantAccess, async (req, res): Promise<void> => {
  const studentId = parseInt(req.params.id, 10);
  const { teacherId, isAdmin } = req.tenant;

  // Verify tenant access to this student
  const [student] = await db.select().from(studentsTable).where(
    isAdmin
      ? eq(studentsTable.id, studentId)
      : and(eq(studentsTable.id, studentId), eq(studentsTable.teacherAccountId, teacherId!))
  );
  if (!student) { res.status(404).json({ message: "Student not found" }); return; }

  // Attendance history — last 365 days
  const since = new Date();
  since.setDate(since.getDate() - 365);
  const sinceStr = since.toISOString().split("T")[0];

  const attendanceHistory = await db.select({
    date: attendanceTable.date,
    status: attendanceTable.status,
    lessonNumber: sessionsTable.lessonNumber,
    dayOfWeek: sessionsTable.dayOfWeek,
  }).from(attendanceTable)
    .innerJoin(sessionsTable, eq(attendanceTable.sessionId, sessionsTable.id))
    .where(and(eq(attendanceTable.studentId, studentId), gte(attendanceTable.date, sinceStr)))
    .orderBy(attendanceTable.date);

  // Heatmap: map date -> { present, absent }
  const heatmapMap: Record<string, { present: number; absent: number }> = {};
  for (const row of attendanceHistory) {
    if (!heatmapMap[row.date]) heatmapMap[row.date] = { present: 0, absent: 0 };
    if (row.status === "Present") heatmapMap[row.date].present++;
    else heatmapMap[row.date].absent++;
  }

  const heatmap = Object.entries(heatmapMap).map(([date, data]) => ({
    date,
    value: data.present > 0 ? (data.absent > 0 ? 2 : 3) : 1, // 0=none,1=absent,2=partial,3=present
    present: data.present,
    absent: data.absent,
  }));

  // Attendance stats
  const totalPresent = attendanceHistory.filter(r => r.status === "Present").length;
  const totalAbsent = attendanceHistory.filter(r => r.status === "Absent").length;
  const total = totalPresent + totalAbsent;
  const overallRate = total > 0 ? Math.round((totalPresent / total) * 100) : 0;

  // Recent vs older attendance rate (last 4 weeks vs prior 4 weeks)
  const now = new Date();
  const fourWeeksAgo = new Date(now); fourWeeksAgo.setDate(now.getDate() - 28);
  const eightWeeksAgo = new Date(now); eightWeeksAgo.setDate(now.getDate() - 56);
  const fw = fourWeeksAgo.toISOString().split("T")[0];
  const ew = eightWeeksAgo.toISOString().split("T")[0];

  const recent = attendanceHistory.filter(r => r.date >= fw);
  const older = attendanceHistory.filter(r => r.date >= ew && r.date < fw);
  const recentRate = recent.length > 0 ? Math.round((recent.filter(r => r.status === "Present").length / recent.length) * 100) : overallRate;
  const olderRate = older.length > 0 ? Math.round((older.filter(r => r.status === "Present").length / older.length) * 100) : overallRate;

  // Exam marks
  const marks = await db.select({
    examId: studentMarksTable.examId,
    examName: examsTable.name,
    examDate: examsTable.examDate,
    marksScored: studentMarksTable.marksScored,
    maxMarks: examQuestionsTable.maxMarks,
    topic: examQuestionsTable.topic,
  }).from(studentMarksTable)
    .innerJoin(examQuestionsTable, eq(studentMarksTable.questionId, examQuestionsTable.id))
    .innerJoin(examsTable, eq(studentMarksTable.examId, examsTable.id))
    .where(eq(studentMarksTable.studentId, studentId))
    .orderBy(examsTable.examDate);

  // Per-exam summary
  const examMap: Record<number, { examId: number; examName: string; examDate: string | null; totalScored: number; totalMax: number }> = {};
  const topicMap: Record<string, { scored: number; max: number }> = {};

  for (const m of marks) {
    if (!examMap[m.examId]) examMap[m.examId] = { examId: m.examId, examName: m.examName, examDate: m.examDate, totalScored: 0, totalMax: 0 };
    const scored = m.marksScored !== null ? parseFloat(String(m.marksScored)) : 0;
    const max = parseFloat(String(m.maxMarks));
    examMap[m.examId].totalScored += scored;
    examMap[m.examId].totalMax += max;
    if (m.topic) {
      if (!topicMap[m.topic]) topicMap[m.topic] = { scored: 0, max: 0 };
      topicMap[m.topic].scored += scored;
      topicMap[m.topic].max += max;
    }
  }

  const examResults = Object.values(examMap).map(e => ({
    ...e,
    percentage: e.totalMax > 0 ? Math.round((e.totalScored / e.totalMax) * 1000) / 10 : 0,
  })).sort((a, b) => (a.examDate ?? "").localeCompare(b.examDate ?? ""));

  const topicStats = Object.entries(topicMap).map(([topic, data]) => ({
    topic,
    percentage: data.max > 0 ? Math.round((data.scored / data.max) * 100) : 0,
    scored: data.scored,
    max: data.max,
  })).sort((a, b) => a.percentage - b.percentage);

  const weakTopics = topicStats.filter(t => t.percentage < 60).map(t => t.topic);
  const strongTopics = topicStats.filter(t => t.percentage >= 80).map(t => t.topic);

  const avgExamPercent = examResults.length > 0
    ? Math.round(examResults.reduce((s, e) => s + e.percentage, 0) / examResults.length * 10) / 10
    : null;

  // Exam trend: difference between last and first exam
  let examTrend: number | null = null;
  if (examResults.length >= 2) {
    examTrend = examResults[examResults.length - 1].percentage - examResults[0].percentage;
  }

  // Predicted grade
  let predictedGrade = "N/A";
  if (avgExamPercent !== null) {
    const adjusted = avgExamPercent * 0.7 + overallRate * 0.3;
    if (adjusted >= 90) predictedGrade = "A*";
    else if (adjusted >= 80) predictedGrade = "A";
    else if (adjusted >= 70) predictedGrade = "B";
    else if (adjusted >= 60) predictedGrade = "C";
    else if (adjusted >= 50) predictedGrade = "D";
    else if (adjusted >= 40) predictedGrade = "E";
    else predictedGrade = "U";
  }

  // Risk score (0-100, higher = more at risk)
  const attendanceRisk = Math.max(0, 80 - overallRate) * 1.2;
  const examRisk = avgExamPercent !== null ? Math.max(0, 60 - avgExamPercent) * 0.8 : 20;
  const riskScore = Math.min(100, Math.round(attendanceRisk + examRisk));
  const riskLevel = riskScore >= 60 ? "high" : riskScore >= 30 ? "medium" : "low";

  // Ranking: get all students' attendance rates for same teacher
  const allStudents = await db.select({ id: studentsTable.id }).from(studentsTable)
    .where(isAdmin ? sql`1=1` : eq(studentsTable.teacherAccountId, teacherId!));
  const rankingPercentile = allStudents.length > 1
    ? Math.round((1 - (allStudents.findIndex(s => s.id === studentId) / (allStudents.length - 1))) * 100)
    : 100;

  const insights = generateInsights(student.studentName, recentRate, olderRate, overallRate, avgExamPercent, weakTopics, strongTopics, examTrend, totalAbsent);

  // Compute archetype
  function computeArchetype(attRate: number, examAvg: number | null, trend: number | null, recent: number, older: number) {
    const drop = older - recent;
    if (drop >= 20) return { name: "Burnout Risk", description: "Showing signs of withdrawal with significantly declining attendance.", color: "red", emoji: "🔴", priority: "critical" };
    if (attRate >= 90 && examAvg !== null && examAvg >= 80) return { name: "Consistent Achiever", description: "Outstanding attendance combined with top academic performance.", color: "emerald", emoji: "⭐", priority: "excellent" };
    if (examAvg !== null && examAvg >= 70 && attRate < 75) return { name: "High Potential / Low Discipline", description: "Strong academic ability hampered by irregular attendance.", color: "amber", emoji: "💡", priority: "watch" };
    if (attRate < 60 || (examAvg !== null && examAvg < 40)) return { name: "At-Risk Student", description: "Requires immediate intervention and dedicated support.", color: "red", emoji: "⚠️", priority: "critical" };
    if (trend !== null && trend >= 15) return { name: "Fast Improver", description: "Remarkable upward trajectory in academic performance.", color: "blue", emoji: "🚀", priority: "excellent" };
    if (attRate >= 90 && examAvg !== null && examAvg < 60) return { name: "Attendance-Dependent Learner", description: "Great attendance but needs stronger academic reinforcement.", color: "orange", emoji: "📚", priority: "watch" };
    if (examAvg !== null && examAvg >= 75 && attRate < 80) return { name: "Exam Specialist", description: "Achieves strong exam results despite irregular attendance.", color: "purple", emoji: "🎯", priority: "monitor" };
    if (attRate >= 85 && examAvg !== null && examAvg >= 60) return { name: "Quiet Analytical Learner", description: "Consistent and methodical with steady, reliable progress.", color: "teal", emoji: "🧠", priority: "good" };
    if (attRate < 80 && examAvg !== null && examAvg >= 60) return { name: "Last-Minute Performer", description: "Capable of good results but needs more consistent effort.", color: "amber", emoji: "⏰", priority: "watch" };
    return { name: "Standard Learner", description: "Making steady progress — building foundations for success.", color: "slate", emoji: "📈", priority: "good" };
  }

  // Generate action plan
  function generateActionPlan(weak: string[], strong: string[], attRate: number, examAvg: number | null, trend: number | null) {
    const items: { category: string; priority: "high" | "medium" | "low"; action: string; icon: string }[] = [];
    if (attRate < 70) items.push({ category: "Attendance", priority: "high", action: `Attendance at ${attRate}% needs urgent improvement. Target 85%+. Every missed session creates knowledge gaps that compound.`, icon: "📅" });
    else if (attRate < 85) items.push({ category: "Attendance", priority: "medium", action: `Improve attendance from ${attRate}% to 90%+. Consistent presence is the single biggest predictor of academic success.`, icon: "📅" });
    if (weak.length > 0) items.push({ category: "Priority Revision", priority: "high", action: `Focus revision on: ${weak.slice(0, 3).join(", ")}. Solve 5 targeted questions per topic. Study marking schemes carefully.`, icon: "📖" });
    if (examAvg !== null && examAvg < 50) items.push({ category: "Exam Technique", priority: "high", action: "Practice past paper questions daily under timed conditions. Understand what examiners reward.", icon: "✏️" });
    else if (examAvg !== null && examAvg < 70) items.push({ category: "Exam Skills", priority: "medium", action: "Review returned papers for patterns. Maximize performance on familiar topics before tackling harder ones.", icon: "✏️" });
    if (trend !== null && trend <= -10) items.push({ category: "Performance Recovery", priority: "high", action: "Exam scores are declining. Schedule a one-to-one session to identify root causes.", icon: "🔍" });
    if (strong.length > 0) items.push({ category: "Leverage Strengths", priority: "low", action: `Excellent in ${strong.slice(0, 2).join(" and ")}. Apply this same strategy to weaker areas.`, icon: "💪" });
    items.push({ category: "Study Habit", priority: "low", action: "Review session notes within 24 hours using active recall — closes notes, tests memory. Doubles long-term retention.", icon: "🧠" });
    return items;
  }

  const archetype = computeArchetype(overallRate, avgExamPercent, examTrend, recentRate, olderRate);
  const actionPlan = generateActionPlan(weakTopics, strongTopics, overallRate, avgExamPercent, examTrend);

  res.json({
    student,
    attendance: { total, totalPresent, totalAbsent, overallRate, recentRate, olderRate, heatmap },
    exams: { results: examResults, topicStats, avgExamPercent, examTrend, weakTopics, strongTopics },
    prediction: { predictedGrade, riskScore, riskLevel, rankingPercentile },
    insights,
    archetype,
    actionPlan,
  });
});

// WhatsApp message generation
router.post("/students/:id/whatsapp-message", requireTenantAccess, async (req, res): Promise<void> => {
  const studentId = parseInt(req.params.id, 10);
  const { teacherId, isAdmin } = req.tenant;
  const { type = "absence", weekStart, customNote } = req.body;

  const [student] = await db.select().from(studentsTable).where(
    isAdmin ? eq(studentsTable.id, studentId)
      : and(eq(studentsTable.id, studentId), eq(studentsTable.teacherAccountId, teacherId!))
  );
  if (!student) { res.status(404).json({ message: "Student not found" }); return; }

  const name = student.studentName;
  const code = student.studentCode;
  let message = "";

  if (type === "absence") {
    message = `Dear Parent/Guardian of *${name}*,\n\nWe noticed that *${name}* (Code: ${code}) was absent from today's session.\n\nPlease ensure regular attendance to avoid falling behind.\n\nIf there is a valid reason for the absence, kindly inform us.\n\nThank you for your cooperation.\n\n*Aperti Education Platform*`;
  } else if (type === "low-attendance") {
    const attRes = await db.select({ count: sql<number>`count(*)::int` }).from(attendanceTable)
      .where(and(eq(attendanceTable.studentId, studentId), eq(attendanceTable.status, "Absent")));
    const absences = attRes[0]?.count ?? 0;
    message = `Dear Parent/Guardian of *${name}*,\n\nWe are writing to inform you that *${name}* has been absent *${absences} times* this term.\n\nConsistent attendance is crucial for academic progress. We kindly ask you to discuss this with your child and ensure they attend all sessions.\n\nPlease contact us if there are any concerns.\n\nBest regards,\n*Aperti Education Platform*`;
  } else if (type === "exam-reminder") {
    const dateStr = weekStart || new Date().toLocaleDateString("en-GB");
    message = `Dear Parent/Guardian of *${name}*,\n\nThis is a friendly reminder that *${name}* has an upcoming exam.\n\nPlease ensure they are well-prepared and have completed all revision materials.\n\nExam Date: *${dateStr}*\n\nWe wish them the best of luck!\n\n*Aperti Education Platform*`;
  } else if (type === "low-performance") {
    message = `Dear Parent/Guardian of *${name}*,\n\nWe would like to bring to your attention that *${name}* is currently showing signs of academic difficulty.\n\nWe recommend:\n• Extra revision at home\n• Attending all sessions\n• Seeking help on challenging topics\n\nWe are here to support *${name}*'s progress. Please feel free to reach out to discuss further.\n\n*Aperti Education Platform*`;
  } else if (type === "custom") {
    message = `Dear Parent/Guardian of *${name}*,\n\n${customNote || "We have an important message regarding your child's progress."}\n\nBest regards,\n*Aperti Education Platform*`;
  } else if (type === "weekly-summary") {
    message = `Dear Parent/Guardian of *${name}*,\n\nHere is your weekly progress summary for *${name}* (Code: ${code}):\n\n📅 Week of ${weekStart || new Date().toLocaleDateString("en-GB")}\n\nPlease log in to the portal for detailed reports and attendance records.\n\nThank you for staying engaged in your child's education.\n\n*Aperti Education Platform*`;
  }

  res.json({ message, studentName: name, phone: student.phone, parentPhone: student.parentPhone });
});

export default router;
