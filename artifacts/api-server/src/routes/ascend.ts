import { Router, Response } from "express";
import { db } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { ascendProfilesTable, questsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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
    // level up logic (simple: every 500 XP per level)
    profile.level = Math.floor(profile.xp / 500) + 1;
    // rank based on XP thresholds
    if (profile.xp >= 10000) profile.rank = "Apex";
    else if (profile.xp >= 5000) profile.rank = "Diamond";
    else if (profile.xp >= 2000) profile.rank = "Platinum";
    else if (profile.xp >= 1000) profile.rank = "Gold";
    else if (profile.xp >= 500) profile.rank = "Silver";
    else profile.rank = "Bronze";
    await db.update(ascendProfilesTable).set(profile).where(eq(ascendProfilesTable.id, profile.id));
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

// GET /ascend/leaderboard — global leaderboard
ascendRouter.get("/leaderboard", ...studentGuard, async (req: AuthRequest, res: Response) => {
  const profiles = await db.query.ascendProfiles.findMany({
    orderBy: (p, { desc }) => [desc(p.xp)],
    limit: 20,
  });
  res.json(profiles);
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
