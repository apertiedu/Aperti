import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { sql as sqlTag } from "drizzle-orm";
import { db, accountsTable, studentsTable } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";

const router: IRouter = Router();

const adminOnly = [authenticate, requireRole("admin")];

// GET /api/admin/workspaces
router.get("/admin/workspaces", ...adminOnly, async (req: AuthRequest, res): Promise<void> => {
  const rows = await db.select({
    id: accountsTable.id,
    username: accountsTable.username,
    displayName: accountsTable.displayName,
    status: accountsTable.status,
    systemMode: accountsTable.systemMode,
    createdAt: accountsTable.createdAt,
  }).from(accountsTable)
    .where(eq(accountsTable.role, "teacher"))
    .orderBy(accountsTable.displayName);

  const counts = await db.select({
    teacherAccountId: studentsTable.teacherAccountId,
    count: sqlTag<number>`count(*)::int`,
  }).from(studentsTable).groupBy(studentsTable.teacherAccountId);

  const countMap: Record<number, number> = {};
  for (const c of counts) { if (c.teacherAccountId) countMap[c.teacherAccountId] = c.count; }

  const result = rows.map(r => ({ ...r, studentCount: countMap[r.id] ?? 0 }));
  res.json(result);
});

// PATCH /api/admin/workspaces/:id/mode
router.patch("/admin/workspaces/:id/mode", ...adminOnly, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const { mode } = req.body;

  if (!["full", "whatsapp"].includes(mode)) {
    res.status(400).json({ message: "Mode must be 'full' or 'whatsapp'" });
    return;
  }

  const [existing] = await db.select().from(accountsTable).where(eq(accountsTable.id, id));
  if (!existing || existing.role !== "teacher") {
    res.status(404).json({ message: "Teacher not found" });
    return;
  }

  await db.update(accountsTable).set({ systemMode: mode }).where(eq(accountsTable.id, id));
  res.json({ id, systemMode: mode });
});

export default router;
