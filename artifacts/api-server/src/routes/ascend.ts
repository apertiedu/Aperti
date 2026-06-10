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

// XP awarded per source type
const XP_SOURCE_MAP: Record<string, number> = {
  attendance_checkin: 20,
  on_time_submission: 30,
  revision_task: 50,
  flashcard_review: 15,
  mock_exam: 100,
  peer_review: 40,
  focus_session: 30,
  manual: 0, // uses xp field directly
};

// POST /ascend/earn-xp — source-aware XP award
ascendRouter.post("/earn-xp", ...studentGuard, async (req: AuthRequest, res: Response) => {
  const studentId = req.userId!;
  const { xp: rawXp, source, subjectId } = req.body;

  // Derive XP from source taxonomy, or use explicit xp amount
  const xpAmount: number = source && XP_SOURCE_MAP[source] !== undefined
    ? (source === "manual" ? (rawXp ?? 0) : XP_SOURCE_MAP[source])
    : (rawXp ?? 0);

  if (xpAmount <= 0) { res.status(400).json({ message: "xp or valid source is required" }); return; }

  let profile = await db.query.ascendProfiles.findFirst({
    where: (p, { eq }) => eq(p.studentAccountId, studentId),
  });
  if (!profile) {
    const [newProfile] = await db.insert(ascendProfilesTable).values({
      studentAccountId: studentId, xp: xpAmount,
    }).returning();
    profile = newProfile;
  } else {
    const newXp = profile.xp + xpAmount;
    // XP formula: level = floor(sqrt(totalXP / 100))
    const newLevel = Math.max(1, Math.floor(Math.sqrt(newXp / 100)));
    // rank based on XP thresholds
    let newRank = profile.rank;
    if (newXp >= 10000) newRank = "Apex";
    else if (newXp >= 5000) newRank = "Diamond";
    else if (newXp >= 2000) newRank = "Platinum";
    else if (newXp >= 1000) newRank = "Gold";
    else if (newXp >= 500) newRank = "Silver";
    else newRank = "Bronze";

    // Subject-level XP tracking: persist per-subject XP separately
    const currentSubjectXp: Record<string, number> = (profile.subjectXp as Record<string, number>) ?? {};
    if (subjectId) {
      const key = String(subjectId);
      currentSubjectXp[key] = (currentSubjectXp[key] ?? 0) + xpAmount;
    }

    await db.update(ascendProfilesTable).set({
      xp: newXp, level: newLevel, rank: newRank, subjectXp: currentSubjectXp,
    }).where(eq(ascendProfilesTable.id, profile.id));
    profile = { ...profile, xp: newXp, level: newLevel, rank: newRank };
  }
  res.json({ profile, xpAwarded: xpAmount, source: source ?? "manual", subjectId: subjectId ?? null });
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
    const classAccountIds = classStudents.map(s => s.accountId).filter((id): id is number => id !== null);
    profiles = await db.select().from(ascendProfilesTable)
      .where(inArray(ascendProfilesTable.studentAccountId, classAccountIds))
      .orderBy(desc(ascendProfilesTable.xp))
      .limit(50);
  } else {
    profiles = await db.select().from(ascendProfilesTable)
      .orderBy(desc(ascendProfilesTable.xp))
      .limit(50);
  }

  // Enforce privacy mode: profiles with privacyMode="private" are excluded unless it's the requester
  const publicProfiles = profiles.filter(p =>
    p.studentAccountId === studentId || p.privacyMode !== "private"
  );

  const result = publicProfiles.map((p, idx) => ({
    rank: idx + 1,
    isYou: p.studentAccountId === studentId,
    xp: p.xp,
    level: p.level,
    displayRank: p.rank,
    archetype: p.archetype,
    streak: p.streak,
    privacyMode: p.privacyMode,
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
