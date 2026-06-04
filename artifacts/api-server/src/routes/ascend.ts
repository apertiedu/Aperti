import { Router, Response } from "express";
import { db, ascendProfilesTable, questsTable, studentsTable } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { eq, desc, inArray } from "drizzle-orm";

export const ascendRouter = Router();

const studentGuard = [authenticate, requireRole("student")];

// ─── STUDENT ROUTES ───

// GET /ascend/profile — current student's profile
ascendRouter.get("/profile", ...studentGuard, async (req: AuthRequest, res: Response) => {
  const studentId = req.userId!;
  let profile = await db.query.ascendProfiles.findFirst({
    where: (p, { eq }) => eq(p.studentAccountId, studentId),
  });
  if (!profile) {
    // create default
    const [newProfile] = await db.insert(ascendProfilesTable).values({
      studentAccountId: studentId,
    }).returning();
    profile = newProfile;
  }
  res.json(profile);
});

// POST /ascend/earn-xp — add XP (called internally by other services)
ascendRouter.post("/earn-xp", ...studentGuard, async (req: AuthRequest, res: Response) => {
  const studentId = req.userId!;
  const { xp } = req.body; // xp amount
  let profile = await db.query.ascendProfiles.findFirst({
    where: (p, { eq }) => eq(p.studentAccountId, studentId),
  });
  if (!profile) {
    const [newProfile] = await db.insert(ascendProfilesTable).values({
      studentAccountId: studentId, xp,
    }).returning();
    profile = newProfile;
  } else {
    profile.xp += xp;
    // XP formula: level = floor(sqrt(totalXP / 100))
    profile.level = Math.max(1, Math.floor(Math.sqrt(profile.xp / 100)));
    // rank based on XP thresholds
    if (profile.xp >= 10000) profile.rank = "Apex";
    else if (profile.xp >= 5000) profile.rank = "Diamond";
    else if (profile.xp >= 2000) profile.rank = "Platinum";
    else if (profile.xp >= 1000) profile.rank = "Gold";
    else if (profile.xp >= 500) profile.rank = "Silver";
    else profile.rank = "Bronze";
    await db.update(ascendProfilesTable).set({
      xp: profile.xp, level: profile.level, rank: profile.rank
    }).where(eq(ascendProfilesTable.id, profile.id));
  }
  res.json(profile);
});

// POST /ascend/update-streak — called daily when student engages
ascendRouter.post("/update-streak", ...studentGuard, async (req: AuthRequest, res: Response) => {
  const studentId = req.userId!;
  let profile = await db.query.ascendProfiles.findFirst({
    where: (p, { eq }) => eq(p.studentAccountId, studentId),
  });
  if (!profile) {
    const [newProfile] = await db.insert(ascendProfilesTable).values({
      studentAccountId: studentId, streak: 1,
    }).returning();
    return res.json(newProfile);
  }
  const today = new Date().toISOString().split("T")[0];
  // In production we'd track last login date; for now increment
  profile.streak = (profile.streak || 0) + 1;
  await db.update(ascendProfilesTable).set({ streak: profile.streak }).where(eq(ascendProfilesTable.id, profile.id));
  res.json(profile);
});

// GET /ascend/quests — available quests
ascendRouter.get("/quests", ...studentGuard, async (req: AuthRequest, res: Response) => {
  const quests = await db.query.quests.findMany();
  res.json(quests);
});

// GET /ascend/leaderboard?scope=class|school — privacy-aware ranked leaderboard
ascendRouter.get("/leaderboard", ...studentGuard, async (req: AuthRequest, res: Response) => {
  const scope = (req.query.scope as string) || "class";
  const studentId = req.userId!;

  // Fetch the requesting student's teacher (for class scope filtering)
  const [student] = await db.select({ teacherAccountId: studentsTable.teacherAccountId })
    .from(studentsTable).where(eq(studentsTable.accountId, studentId)).limit(1);

  const teacherAccountId = student?.teacherAccountId;

  // Fetch all profiles; for class scope, filter to students under the same teacher
  let profiles;
  if (scope === "class" && teacherAccountId) {
    const classStudents = await db.select({ accountId: studentsTable.accountId })
      .from(studentsTable).where(eq(studentsTable.teacherAccountId, teacherAccountId));
    const classAccountIds = classStudents.map(s => s.accountId);
    profiles = await db.select().from(ascendProfilesTable)
      .where(inArray(ascendProfilesTable.studentAccountId, classAccountIds))
      .orderBy(desc(ascendProfilesTable.xp))
      .limit(50);
  } else {
    profiles = await db.select().from(ascendProfilesTable)
      .orderBy(desc(ascendProfilesTable.xp))
      .limit(50);
  }

  // Respect privacy mode: redact name for profiles with privacy enabled
  const result = profiles.map((p, idx) => ({
    rank: idx + 1,
    accountId: p.studentAccountId === studentId ? p.studentAccountId : undefined,
    isYou: p.studentAccountId === studentId,
    xp: p.xp,
    level: p.level,
    displayRank: p.rank,
    archetype: p.archetype,
    streak: p.streak,
  }));

  res.json({ scope, leaderboard: result });
});

// ─── TEACHER / ADMIN ROUTES ───

// POST /ascend/quests — create a new quest (teacher/admin)
ascendRouter.post("/quests", authenticate, async (req: AuthRequest, res: Response) => {
  const { title, description, type, xpReward } = req.body;
  const [quest] = await db.insert(questsTable).values({
    title, description, type, xpReward,
  }).returning();
  res.status(201).json(quest);
});
