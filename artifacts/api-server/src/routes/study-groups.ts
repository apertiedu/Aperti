import { Router } from "express";
import { eq, and, inArray, ne } from "drizzle-orm";
import {
  db, studentsTable,
  studyGroupsTable, groupMembersTable, groupChallengesTable,
  snapgradeSubmissionsTable, peerReviewsTable,
  homeworkTable, lessonsTable,
} from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";

const studentGuard = [authenticate, requireRole("student")];
import type { Response } from "express";

const router = Router();

async function requireStudent(req: AuthRequest, res: Response): Promise<{ studentId: number; teacherId: number } | null> {
  const [student] = await db.select().from(studentsTable)
    .where(eq(studentsTable.accountId, req.userId!)).limit(1);
  if (!student) { res.status(403).json({ message: "No student record" }); return null; }
  return { studentId: student.id, teacherId: student.teacherAccountId! };
}

async function requireGroupMembership(groupId: number, studentId: number, res: Response): Promise<boolean> {
  const [member] = await db.select().from(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.studentId, studentId))).limit(1);
  if (!member) {
    res.status(403).json({ message: "Not a member of this group" });
    return false;
  }
  return true;
}

// GET /study-groups
router.get("/study-groups", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const ctx = await requireStudent(req, res);
  if (!ctx) return;
  const { studentId } = ctx;

  const memberRows = await db.select({ groupId: groupMembersTable.groupId })
    .from(groupMembersTable).where(eq(groupMembersTable.studentId, studentId));
  const groupIds = memberRows.map(r => r.groupId);

  const groups = groupIds.length > 0
    ? await db.select().from(studyGroupsTable).where(inArray(studyGroupsTable.id, groupIds))
    : [];

  res.json(groups);
});

// POST /study-groups
router.post("/study-groups", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const ctx = await requireStudent(req, res);
  if (!ctx) return;
  const { studentId } = ctx;

  const { name, subjectId, description } = req.body;
  if (!name) { res.status(400).json({ message: "name is required" }); return; }

  const [group] = await db.insert(studyGroupsTable).values({
    name: name.trim(), creatorId: studentId, subjectId: subjectId ?? null, description,
  }).returning();

  await db.insert(groupMembersTable).values({
    groupId: group.id, studentId, role: "admin",
  });

  res.status(201).json(group);
});

// GET /study-groups/:id — only members can view
router.get("/study-groups/:id", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const ctx = await requireStudent(req, res);
  if (!ctx) return;
  const { studentId } = ctx;
  const groupId = parseInt(req.params.id, 10);

  if (!(await requireGroupMembership(groupId, studentId, res))) return;

  const [group] = await db.select().from(studyGroupsTable).where(eq(studyGroupsTable.id, groupId));
  if (!group) { res.status(404).json({ message: "Group not found" }); return; }

  res.json(group);
});

// PUT /study-groups/:id — only creator (admin) can update
router.put("/study-groups/:id", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const ctx = await requireStudent(req, res);
  if (!ctx) return;
  const { studentId } = ctx;
  const groupId = parseInt(req.params.id, 10);

  const [group] = await db.select().from(studyGroupsTable)
    .where(and(eq(studyGroupsTable.id, groupId), eq(studyGroupsTable.creatorId, studentId)));
  if (!group) { res.status(404).json({ message: "Group not found or not authorized" }); return; }

  const { name, description } = req.body;
  const [updated] = await db.update(studyGroupsTable)
    .set({ name: name ?? group.name, description: description ?? group.description })
    .where(eq(studyGroupsTable.id, groupId))
    .returning();

  res.json(updated);
});

// DELETE /study-groups/:id — only creator can delete
router.delete("/study-groups/:id", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const ctx = await requireStudent(req, res);
  if (!ctx) return;
  const { studentId } = ctx;
  const groupId = parseInt(req.params.id, 10);

  const [group] = await db.select().from(studyGroupsTable)
    .where(and(eq(studyGroupsTable.id, groupId), eq(studyGroupsTable.creatorId, studentId)));
  if (!group) { res.status(404).json({ message: "Group not found or not authorized" }); return; }

  await db.delete(studyGroupsTable).where(eq(studyGroupsTable.id, groupId));
  res.json({ success: true });
});

// POST /study-groups/:id/join
router.post("/study-groups/:id/join", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const ctx = await requireStudent(req, res);
  if (!ctx) return;
  const { studentId } = ctx;
  const groupId = parseInt(req.params.id, 10);

  const [group] = await db.select().from(studyGroupsTable).where(eq(studyGroupsTable.id, groupId)).limit(1);
  if (!group) { res.status(404).json({ message: "Group not found" }); return; }

  const existing = await db.select().from(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.studentId, studentId)));
  if (existing.length > 0) { res.status(400).json({ message: "Already a member" }); return; }

  const [member] = await db.insert(groupMembersTable).values({
    groupId, studentId, role: "member",
  }).returning();

  res.status(201).json(member);
});

// POST /study-groups/:id/leave
router.post("/study-groups/:id/leave", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const ctx = await requireStudent(req, res);
  if (!ctx) return;
  const { studentId } = ctx;
  const groupId = parseInt(req.params.id, 10);

  await db.delete(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.studentId, studentId)));
  res.json({ success: true });
});

// GET /study-groups/:id/members — only members can list
router.get("/study-groups/:id/members", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const ctx = await requireStudent(req, res);
  if (!ctx) return;
  const { studentId } = ctx;
  const groupId = parseInt(req.params.id, 10);

  if (!(await requireGroupMembership(groupId, studentId, res))) return;

  const members = await db.select().from(groupMembersTable)
    .where(eq(groupMembersTable.groupId, groupId));
  res.json(members);
});

// GET /study-groups/:id/challenges — only members can view
router.get("/study-groups/:id/challenges", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const ctx = await requireStudent(req, res);
  if (!ctx) return;
  const { studentId } = ctx;
  const groupId = parseInt(req.params.id, 10);

  if (!(await requireGroupMembership(groupId, studentId, res))) return;

  const challenges = await db.select().from(groupChallengesTable)
    .where(eq(groupChallengesTable.groupId, groupId));
  res.json(challenges);
});

// POST /study-groups/:id/challenges — only members can create
router.post("/study-groups/:id/challenges", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const ctx = await requireStudent(req, res);
  if (!ctx) return;
  const { studentId } = ctx;
  const groupId = parseInt(req.params.id, 10);

  if (!(await requireGroupMembership(groupId, studentId, res))) return;

  const { title, type } = req.body;
  if (!title) { res.status(400).json({ message: "title is required" }); return; }

  const [challenge] = await db.insert(groupChallengesTable).values({
    groupId, title: title.trim(), type: type ?? "quiz", status: "open",
  }).returning();

  res.status(201).json(challenge);
});

// POST /study-groups/:id/challenges/:cid/complete — only members can complete
router.post("/study-groups/:id/challenges/:cid/complete", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const ctx = await requireStudent(req, res);
  if (!ctx) return;
  const { studentId } = ctx;
  const groupId = parseInt(req.params.id, 10);
  const challengeId = parseInt(req.params.cid, 10);

  if (!(await requireGroupMembership(groupId, studentId, res))) return;

  const [challenge] = await db.select().from(groupChallengesTable)
    .where(and(eq(groupChallengesTable.id, challengeId), eq(groupChallengesTable.groupId, groupId))).limit(1);
  if (!challenge) { res.status(404).json({ message: "Challenge not found in this group" }); return; }

  const [updated] = await db.update(groupChallengesTable)
    .set({ status: "completed" })
    .where(eq(groupChallengesTable.id, challengeId))
    .returning();
  res.json(updated);
});

// GET /peer-reviews/available — anonymized submissions from classmates in the student's subjects
router.get("/peer-reviews/available", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const ctx = await requireStudent(req, res);
  if (!ctx) return;
  const { studentId, teacherId } = ctx;

  // Resolve this student's subjects via their lesson sessions + homework assignments
  const [studentRow] = await db.select({
    lesson1SessionId: studentsTable.lesson1SessionId,
    lesson2SessionId: studentsTable.lesson2SessionId,
    lesson3SessionId: studentsTable.lesson3SessionId,
  }).from(studentsTable).where(eq(studentsTable.id, studentId)).limit(1);

  const lessonIds = [
    studentRow?.lesson1SessionId,
    studentRow?.lesson2SessionId,
    studentRow?.lesson3SessionId,
  ].filter((id): id is number => id !== null && id !== undefined);

  let mySubjectIds = new Set<number>();

  if (lessonIds.length > 0) {
    const lessonSubjects = await db.select({ subjectId: lessonsTable.subjectId })
      .from(lessonsTable)
      .where(inArray(lessonsTable.id, lessonIds));
    for (const l of lessonSubjects) {
      if (l.subjectId) mySubjectIds.add(l.subjectId);
    }
  }

  // Also pick up subjects from homework assigned to this student's teacher
  const hwSubjects = await db.select({ subjectId: homeworkTable.subjectId })
    .from(homeworkTable)
    .where(eq(homeworkTable.teacherAccountId, teacherId))
    .limit(50);
  for (const h of hwSubjects) {
    if (h.subjectId) mySubjectIds.add(h.subjectId);
  }

  // Get classmates (same teacher, not self)
  const classmates = await db.select({ id: studentsTable.id })
    .from(studentsTable)
    .where(and(
      eq(studentsTable.teacherAccountId, teacherId),
      ne(studentsTable.id, studentId)
    ));

  if (classmates.length === 0) { res.json([]); return; }

  const classmateIds = classmates.map(s => s.id);

  // Get classmates' submissions filtered to this student's subjects
  let allSubs = await db.select({
    id: snapgradeSubmissionsTable.id,
    homeworkId: snapgradeSubmissionsTable.homeworkId,
    submittedAt: snapgradeSubmissionsTable.submittedAt,
  }).from(snapgradeSubmissionsTable)
    .where(inArray(snapgradeSubmissionsTable.studentId, classmateIds))
    .limit(100);

  // Subject-filter: only keep submissions whose homework is in the student's subjects
  if (mySubjectIds.size > 0 && allSubs.length > 0) {
    const homeworkIds = allSubs.map(s => s.homeworkId).filter((id): id is number => id !== null);
    if (homeworkIds.length > 0) {
      const hwData = await db.select({ id: homeworkTable.id, subjectId: homeworkTable.subjectId })
        .from(homeworkTable)
        .where(inArray(homeworkTable.id, homeworkIds));
      const hwSubjectMap = new Map(hwData.map(h => [h.id, h.subjectId]));
      allSubs = allSubs.filter(s => {
        if (!s.homeworkId) return mySubjectIds.size === 0; // include untagged if no subject data
        const subj = hwSubjectMap.get(s.homeworkId);
        return !subj || mySubjectIds.has(subj);
      });
    }
  }

  // Exclude submissions the student has already reviewed
  const alreadyReviewed = await db.select({ submissionId: peerReviewsTable.submissionId })
    .from(peerReviewsTable)
    .where(eq(peerReviewsTable.reviewerId, studentId));

  const reviewedIds = new Set(alreadyReviewed.map(r => r.submissionId));

  const available = allSubs
    .filter(s => !reviewedIds.has(s.id))
    .slice(0, 20)
    .map(s => ({
      id: s.id,
      homeworkId: s.homeworkId,
      submittedAt: s.submittedAt,
    }));

  res.json(available);
});

// POST /peer-reviews
router.post("/peer-reviews", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const ctx = await requireStudent(req, res);
  if (!ctx) return;
  const { studentId } = ctx;

  const { submissionId, rating, comment, rubric } = req.body;
  if (!submissionId) { res.status(400).json({ message: "submissionId is required" }); return; }

  // Ensure reviewer cannot review their own submission
  const [sub] = await db.select({ studentId: snapgradeSubmissionsTable.studentId })
    .from(snapgradeSubmissionsTable)
    .where(eq(snapgradeSubmissionsTable.id, parseInt(submissionId, 10))).limit(1);
  if (!sub) { res.status(404).json({ message: "Submission not found" }); return; }
  if (sub.studentId === studentId) { res.status(403).json({ message: "Cannot review your own submission" }); return; }

  const [review] = await db.insert(peerReviewsTable).values({
    reviewerId: studentId, submissionId: parseInt(submissionId, 10), rating, comment, rubric,
  }).returning();

  res.status(201).json(review);
});

export default router;
