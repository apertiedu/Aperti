import { Router } from "express";
import { eq, desc, sql, inArray } from "drizzle-orm";
import {
  db, studentsTable, ascendProfilesTable, attendanceTable, studentMarksTable,
  examQuestionsTable, examsTable, accountsTable,
} from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";

const studentGuard = [authenticate, requireRole("student")];
import type { Response } from "express";

const router = Router();

router.get("/peak-rankings", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const type = (req.query.type as string) ?? "xp";
  const scope = (req.query.scope as string) ?? "school";

  const [currentStudent] = await db.select().from(studentsTable)
    .where(eq(studentsTable.accountId, req.userId!)).limit(1);

  if (!currentStudent) { res.status(403).json({ message: "No student record" }); return; }

  const teacherId = currentStudent.teacherAccountId!;

  const profiles = await db.select({
    id: ascendProfilesTable.id,
    studentAccountId: ascendProfilesTable.studentAccountId,
    xp: ascendProfilesTable.xp,
    level: ascendProfilesTable.level,
    rank: ascendProfilesTable.rank,
    streak: ascendProfilesTable.streak,
    privacyMode: ascendProfilesTable.privacyMode,
  }).from(ascendProfilesTable)
    .orderBy(desc(ascendProfilesTable.xp))
    .limit(200);

  // Build accountId → studentId + teacherId mapping for scope filtering
  const allStudents = await db.select({ id: studentsTable.id, accountId: studentsTable.accountId, teacherAccountId: studentsTable.teacherAccountId })
    .from(studentsTable);
  const accountToStudent = new Map(allStudents.filter(s => s.accountId).map(s => [s.accountId!, s]));

  // Build accountId → displayName mapping for public profiles
  const accountIds = profiles.map(p => p.studentAccountId).filter(Boolean);
  const accounts = accountIds.length > 0
    ? await db.select({ id: accountsTable.id, displayName: accountsTable.displayName })
        .from(accountsTable)
        .where(inArray(accountsTable.id, accountIds))
    : [];
  const accountDisplayNames = new Map(accounts.map(a => [a.id, a.displayName]));

  let filteredProfiles = scope === "class"
    ? profiles.filter(p => {
        const s = accountToStudent.get(p.studentAccountId);
        return s && s.teacherAccountId === teacherId;
      })
    : profiles;

  type RankEntry = {
    studentAccountId: number;
    score: number;
    privacyMode: string;
    rank: string;
    level: number;
    displayName: string;
  };

  let scored: RankEntry[] = [];

  const makeEntry = (p: typeof filteredProfiles[0], score: number): RankEntry => ({
    studentAccountId: p.studentAccountId,
    score,
    privacyMode: p.privacyMode ?? "public",
    rank: p.rank ?? "Bronze",
    level: p.level ?? 1,
    displayName: accountDisplayNames.get(p.studentAccountId) ?? "Student",
  });

  if (type === "xp") {
    scored = filteredProfiles.map(p => makeEntry(p, p.xp ?? 0));

  } else if (type === "streak") {
    scored = filteredProfiles.map(p => makeEntry(p, p.streak ?? 0));

  } else if (type === "attendance") {
    const since90 = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];
    const attStats = await db.select({
      studentId: attendanceTable.studentId,
      presentCount: sql<number>`count(*) filter (where ${attendanceTable.status} = 'Present')::int`,
      totalCount: sql<number>`count(*)::int`,
    }).from(attendanceTable)
      .where(sql`${attendanceTable.date} >= ${since90}`)
      .groupBy(attendanceTable.studentId);

    const studentIdToAtt = new Map(attStats.map(a => [
      a.studentId,
      a.totalCount > 0 ? Math.round((a.presentCount / a.totalCount) * 100) : 0,
    ]));

    scored = filteredProfiles.map(p => {
      const s = accountToStudent.get(p.studentAccountId);
      return makeEntry(p, s !== undefined ? (studentIdToAtt.get(s.id) ?? 0) : 0);
    });

  } else if (type === "mock_scores") {
    const marksByStudent = await db.select({
      studentId: studentMarksTable.studentId,
      scored: sql<number>`sum(${studentMarksTable.marksScored})::numeric`,
      max: sql<number>`sum(${examQuestionsTable.maxMarks})::numeric`,
      examId: studentMarksTable.examId,
    }).from(studentMarksTable)
      .innerJoin(examQuestionsTable, eq(studentMarksTable.questionId, examQuestionsTable.id))
      .groupBy(studentMarksTable.studentId, studentMarksTable.examId);

    const studentExamMap: Map<number, number[]> = new Map();
    for (const m of marksByStudent) {
      const pct = m.max > 0 ? Math.round((m.scored / m.max) * 100) : 0;
      const existing = studentExamMap.get(m.studentId) ?? [];
      existing.push(pct);
      studentExamMap.set(m.studentId, existing);
    }

    scored = filteredProfiles.map(p => {
      const s = accountToStudent.get(p.studentAccountId);
      const exams = s !== undefined ? (studentExamMap.get(s.id) ?? []) : [];
      const last3 = exams.slice(-3);
      const avg = last3.length > 0 ? Math.round(last3.reduce((a, v) => a + v, 0) / last3.length) : 0;
      return makeEntry(p, avg);
    });

  } else if (type === "consistency") {
    const maxXp = Math.max(...filteredProfiles.map(p => p.xp ?? 0), 1);
    scored = filteredProfiles.map(p => makeEntry(p,
      Math.round(((p.streak ?? 0) * 0.5) + (((p.xp ?? 0) / maxXp) * 50))
    ));

  } else {
    scored = filteredProfiles.map(p => makeEntry(p, p.xp ?? 0));
  }

  scored.sort((a, b) => b.score - a.score);

  const top20 = scored.slice(0, 20).map((s, i) => ({
    position: i + 1,
    displayName: s.privacyMode === "public"
      ? s.displayName
      : s.privacyMode === "anonymous"
        ? `Anonymous Student`
        : "Hidden",
    score: s.score,
    rank: s.rank,
    level: s.level,
    isCurrentUser: s.studentAccountId === req.userId,
  }));

  const myIdx = scored.findIndex(s => s.studentAccountId === req.userId);
  const myEntry = scored[myIdx];

  res.json({
    type,
    scope,
    leaderboard: top20,
    currentUser: myEntry ? {
      position: myIdx + 1,
      score: myEntry.score,
      rank: myEntry.rank,
      level: myEntry.level,
    } : null,
  });
});

export default router;
