import { Router, type IRouter } from "express";
import { eq, sql, and } from "drizzle-orm";
import { db, accountsTable, studentsTable, subjectsTable, sessionsTable } from "@workspace/db";

const router: IRouter = Router();

// Public teacher directory — no auth required
router.get("/public/teachers", async (req, res): Promise<void> => {
  const teachers = await db.select({
    id: accountsTable.id,
    displayName: accountsTable.displayName,
    username: accountsTable.username,
    createdAt: accountsTable.createdAt,
  }).from(accountsTable)
    .where(and(eq(accountsTable.role, "teacher"), eq(accountsTable.status, "active")));

  const teacherIds = teachers.map(t => t.id);
  if (teacherIds.length === 0) { res.json([]); return; }

  // Subject counts per teacher
  const subjectRows = await db.select({
    teacherAccountId: subjectsTable.teacherAccountId,
    name: subjectsTable.name,
  }).from(subjectsTable);

  // Student counts per teacher
  const studentCounts = await db.select({
    teacherAccountId: studentsTable.teacherAccountId,
    count: sql<number>`count(*)::int`,
  }).from(studentsTable)
    .where(eq(studentsTable.status, "active"))
    .groupBy(studentsTable.teacherAccountId);

  const subjectMap: Record<number, string[]> = {};
  for (const s of subjectRows) {
    if (!s.teacherAccountId) continue;
    if (!subjectMap[s.teacherAccountId]) subjectMap[s.teacherAccountId] = [];
    subjectMap[s.teacherAccountId].push(s.name);
  }

  const studentMap: Record<number, number> = {};
  for (const s of studentCounts) {
    if (s.teacherAccountId) studentMap[s.teacherAccountId] = s.count;
  }

  const result = teachers.map(t => ({
    id: t.id,
    displayName: t.displayName || t.username,
    subjects: subjectMap[t.id] ?? [],
    studentCount: studentMap[t.id] ?? 0,
    memberSince: t.createdAt,
  }));

  res.json(result);
});

// Public platform stats
router.get("/public/stats", async (req, res): Promise<void> => {
  const [teacherCount] = await db.select({ count: sql<number>`count(*)::int` })
    .from(accountsTable).where(and(eq(accountsTable.role, "teacher"), eq(accountsTable.status, "active")));

  const [studentCount] = await db.select({ count: sql<number>`count(*)::int` })
    .from(studentsTable).where(eq(studentsTable.status, "active"));

  const [subjectCount] = await db.select({ count: sql<number>`count(*)::int` })
    .from(subjectsTable);

  res.json({
    teachers: teacherCount?.count ?? 0,
    students: studentCount?.count ?? 0,
    subjects: subjectCount?.count ?? 0,
  });
});

export default router;
