import { Router } from "express";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import {
  db, studentsTable,
  studentGoalsTable, focusSessionsTable, ascendProfilesTable,
  echoMemoryTable, homeworkTable, homeworkSubmissionsTable,
} from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";

const studentGuard = [authenticate, requireRole("student")];
import type { Response } from "express";

const router = Router();

async function requireStudent(req: AuthRequest, res: Response): Promise<{ studentId: number } | null> {
  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.accountId, req.userId!));
  if (!student) { res.status(403).json({ message: "No student record" }); return null; }
  return { studentId: student.id };
}

// GET /focus-coach/goals
router.get("/focus-coach/goals", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const ctx = await requireStudent(req, res);
  if (!ctx) return;
  const { studentId } = ctx;

  const today = new Date().toISOString().split("T")[0];

  const [goals, echoMem, pendingHw] = await Promise.all([
    db.select().from(studentGoalsTable)
      .where(eq(studentGoalsTable.studentId, studentId))
      .orderBy(desc(studentGoalsTable.createdAt))
      .limit(50),

    db.select().from(echoMemoryTable)
      .where(eq(echoMemoryTable.studentId, studentId)).limit(1),

    db.select({
      id: homeworkTable.id,
      title: homeworkTable.title,
      dueDate: homeworkTable.dueDate,
    }).from(homeworkTable)
      .leftJoin(homeworkSubmissionsTable, and(
        eq(homeworkSubmissionsTable.homeworkId, homeworkTable.id),
        eq(homeworkSubmissionsTable.studentId, studentId)
      ))
      .where(and(
        eq(homeworkTable.isPublished, true),
        sql`${homeworkSubmissionsTable.id} IS NULL`
      ))
      .orderBy(homeworkTable.dueDate)
      .limit(3),
  ]);

  const daily = goals.filter(g => g.type === "daily" && (g.targetDate === today || !g.targetDate));
  const weekly = goals.filter(g => g.type === "weekly" && !g.completedAt);

  // Generate auto goals for today based on weak topics + pending homework
  const weakTopics = (echoMem[0]?.weakTopics as string[]) ?? [];
  const autoGoalTitles = new Set(daily.filter(g => g.source === "auto").map(g => g.title));

  const autoGoals: Array<{
    id: number | null; title: string; type: string; source: string;
    targetDate: string; xpReward: number; completedAt: Date | null; generated: boolean;
  }> = [];

  // Revision goals from weak topics
  for (const topic of weakTopics.slice(0, 2)) {
    const title = `Revise: ${topic}`;
    if (!autoGoalTitles.has(title)) {
      autoGoals.push({
        id: null, title, type: "daily", source: "auto",
        targetDate: today, xpReward: 50, completedAt: null, generated: true,
      });
    }
  }

  // Homework completion goals
  for (const hw of pendingHw.slice(0, 2)) {
    const title = `Complete: ${hw.title}`;
    if (!autoGoalTitles.has(title)) {
      autoGoals.push({
        id: null, title, type: "daily", source: "auto",
        targetDate: today, xpReward: 75, completedAt: null, generated: true,
      });
    }
  }

  // Standard daily focus goal
  const focusTitle = "Complete a 25-minute focus session";
  if (!autoGoalTitles.has(focusTitle) && !daily.find(g => g.title === focusTitle)) {
    autoGoals.push({
      id: null, title: focusTitle, type: "daily", source: "auto",
      targetDate: today, xpReward: 30, completedAt: null, generated: true,
    });
  }

  // Merge: stored auto goals + newly generated ones not yet stored
  const allDaily = [
    ...daily,
    ...autoGoals.filter(ag => !autoGoalTitles.has(ag.title)),
  ];

  res.json({ daily: allDaily, weekly, all: goals, today, autoGoalsGenerated: autoGoals.length });
});

// POST /focus-coach/goals
router.post("/focus-coach/goals", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const ctx = await requireStudent(req, res);
  if (!ctx) return;
  const { studentId } = ctx;

  const { title, type, targetDate, xpReward } = req.body;
  if (!title) { res.status(400).json({ message: "title is required" }); return; }

  const [goal] = await db.insert(studentGoalsTable).values({
    studentId,
    title: title.trim(),
    type: type ?? "daily",
    targetDate: targetDate ?? new Date().toISOString().split("T")[0],
    xpReward: xpReward ?? 50,
    source: "manual",
  }).returning();

  res.status(201).json(goal);
});

// POST /focus-coach/complete-goal — spec contract path (accepts { goalId })
router.post("/focus-coach/complete-goal", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const ctx = await requireStudent(req, res);
  if (!ctx) return;
  const { studentId } = ctx;

  const goalId = parseInt(req.body.goalId, 10);
  if (!goalId) { res.status(400).json({ message: "goalId required" }); return; }

  const [goal] = await db.select().from(studentGoalsTable)
    .where(and(eq(studentGoalsTable.id, goalId), eq(studentGoalsTable.studentId, studentId)));
  if (!goal) { res.status(404).json({ message: "Goal not found" }); return; }
  if (goal.completedAt) { res.status(400).json({ message: "Goal already completed" }); return; }

  const [updated] = await db.update(studentGoalsTable)
    .set({ completedAt: new Date() })
    .where(eq(studentGoalsTable.id, goalId))
    .returning();

  const xpToAward = goal.xpReward ?? 50;
  const [profile] = await db.select().from(ascendProfilesTable)
    .where(eq(ascendProfilesTable.studentAccountId, req.userId!)).limit(1);
  if (profile) {
    const newXp = (profile.xp ?? 0) + xpToAward;
    const newLevel = Math.max(1, Math.floor(Math.sqrt(newXp / 100)));
    await db.update(ascendProfilesTable).set({ xp: newXp, level: newLevel })
      .where(eq(ascendProfilesTable.id, profile.id));
  }

  res.json({ goal: updated, xpAwarded: xpToAward });
});

// POST /focus-coach/goals/:id/complete — legacy path alias
router.post("/focus-coach/goals/:id/complete", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const ctx = await requireStudent(req, res);
  if (!ctx) return;
  const { studentId } = ctx;

  const goalId = parseInt(req.params.id, 10);
  const [goal] = await db.select().from(studentGoalsTable)
    .where(and(eq(studentGoalsTable.id, goalId), eq(studentGoalsTable.studentId, studentId)));

  if (!goal) { res.status(404).json({ message: "Goal not found" }); return; }
  if (goal.completedAt) { res.status(400).json({ message: "Goal already completed" }); return; }

  const [updated] = await db.update(studentGoalsTable)
    .set({ completedAt: new Date() })
    .where(eq(studentGoalsTable.id, goalId))
    .returning();

  // Award XP via ascend profile
  const xpToAward = goal.xpReward ?? 50;
  const existingProfile = await db.select().from(ascendProfilesTable)
    .where(eq(ascendProfilesTable.studentAccountId, req.userId!)).limit(1);

  if (existingProfile.length > 0) {
    const p = existingProfile[0];
    const newXp = (p.xp ?? 0) + xpToAward;
    const newLevel = Math.max(1, Math.floor(Math.sqrt(newXp / 100)));
    let newRank = p.rank;
    if (newXp >= 10000) newRank = "Apex";
    else if (newXp >= 5000) newRank = "Diamond";
    else if (newXp >= 2000) newRank = "Platinum";
    else if (newXp >= 1000) newRank = "Gold";
    else if (newXp >= 500) newRank = "Silver";
    else newRank = "Bronze";
    await db.update(ascendProfilesTable)
      .set({ xp: newXp, level: newLevel, rank: newRank })
      .where(eq(ascendProfilesTable.id, p.id));
  }

  res.json({ goal: updated, xpAwarded: xpToAward });
});

// GET /focus-coach/analytics
router.get("/focus-coach/analytics", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const ctx = await requireStudent(req, res);
  if (!ctx) return;
  const { studentId } = ctx;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  const [sessions, allGoals] = await Promise.all([
    db.select().from(focusSessionsTable)
      .where(and(eq(focusSessionsTable.studentId, studentId), gte(focusSessionsTable.completedAt, thirtyDaysAgo)))
      .orderBy(focusSessionsTable.completedAt),

    db.select().from(studentGoalsTable)
      .where(eq(studentGoalsTable.studentId, studentId)),
  ]);

  const totalMinutes = sessions.reduce((s, r) => s + (r.durationMinutes ?? 0), 0);
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
  const completedGoals = allGoals.filter(g => g.completedAt).length;
  const completionRate = allGoals.length > 0
    ? Math.round((completedGoals / allGoals.length) * 100) : 0;

  // Study hours per day (last 30 days)
  const studyByDay: Record<string, number> = {};
  for (const s of sessions) {
    const day = (s.completedAt as Date).toISOString().split("T")[0];
    studyByDay[day] = (studyByDay[day] ?? 0) + (s.durationMinutes ?? 0);
  }

  // Streak calculation
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(today.getTime() - i * 86400000).toISOString().split("T")[0];
    if (studyByDay[d]) streak++;
    else break;
  }

  res.json({
    totalHours,
    totalSessions: sessions.length,
    completionRate,
    streak,
    completedGoals,
    totalGoals: allGoals.length,
    studyByDay,
    avgSessionMinutes: sessions.length > 0 ? Math.round(totalMinutes / sessions.length) : 0,
  });
});

// POST /focus-sessions
router.post("/focus-sessions", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const ctx = await requireStudent(req, res);
  if (!ctx) return;
  const { studentId } = ctx;

  const { mode, durationMinutes } = req.body;
  if (!durationMinutes || durationMinutes < 1) {
    res.status(400).json({ message: "durationMinutes required" }); return;
  }

  const xpEarned = Math.floor((durationMinutes / 25) * 30);

  const [session] = await db.insert(focusSessionsTable).values({
    studentId,
    mode: mode ?? "pomodoro",
    durationMinutes: parseInt(durationMinutes, 10),
    xpEarned,
  }).returning();

  // Award XP
  const existingProfile = await db.select().from(ascendProfilesTable)
    .where(eq(ascendProfilesTable.studentAccountId, req.userId!)).limit(1);

  if (existingProfile.length > 0) {
    const p = existingProfile[0];
    const newXp = (p.xp ?? 0) + xpEarned;
    const newLevel = Math.max(1, Math.floor(Math.sqrt(newXp / 100)));
    await db.update(ascendProfilesTable)
      .set({ xp: newXp, level: newLevel })
      .where(eq(ascendProfilesTable.id, p.id));
  }

  res.status(201).json({ session, xpEarned });
});

// PATCH /focus-sessions/:id — complete a session (update mode/duration, finalize XP)
router.patch("/focus-sessions/:id", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const ctx = await requireStudent(req, res);
  if (!ctx) return;
  const { studentId } = ctx;

  const sessionId = parseInt(req.params.id, 10);
  const [existing] = await db.select().from(focusSessionsTable)
    .where(and(eq(focusSessionsTable.id, sessionId), eq(focusSessionsTable.studentId, studentId)))
    .limit(1);

  if (!existing) { res.status(404).json({ message: "Session not found" }); return; }

  const { durationMinutes, mode } = req.body;
  const finalDuration = durationMinutes ? parseInt(durationMinutes, 10) : existing.durationMinutes;
  const xpEarned = Math.floor((finalDuration / 25) * 30);

  const [updated] = await db.update(focusSessionsTable)
    .set({
      durationMinutes: finalDuration,
      mode: mode ?? existing.mode,
      xpEarned,
      completedAt: new Date(),
    })
    .where(eq(focusSessionsTable.id, sessionId))
    .returning();

  // Reconcile XP in ascend profile
  const [profile] = await db.select().from(ascendProfilesTable)
    .where(eq(ascendProfilesTable.studentAccountId, req.userId!)).limit(1);
  if (profile) {
    const delta = xpEarned - (existing.xpEarned ?? 0);
    const newXp = Math.max(0, (profile.xp ?? 0) + delta);
    const newLevel = Math.max(1, Math.floor(Math.sqrt(newXp / 100)));
    await db.update(ascendProfilesTable)
      .set({ xp: newXp, level: newLevel })
      .where(eq(ascendProfilesTable.id, profile.id));
  }

  res.json({ session: updated, xpEarned });
});

export default router;
