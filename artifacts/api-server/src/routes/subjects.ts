import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, subjectsTable } from "@workspace/db";
import { requireTenantAccess } from "../middleware/tenant";

const router: IRouter = Router();

router.get("/subjects", requireTenantAccess, async (req, res): Promise<void> => {
  const { teacherId, isAdmin } = req.tenant;
  const rows = !isAdmin && teacherId
    ? await db.select().from(subjectsTable).where(eq(subjectsTable.teacherAccountId, teacherId))
    : await db.select().from(subjectsTable);
  res.json(rows);
});

router.post("/subjects", requireTenantAccess, async (req, res): Promise<void> => {
  const { name } = req.body;
  if (!name?.trim()) { res.status(400).json({ message: "Subject name is required" }); return; }

  const { teacherId, isAdmin, accountId } = req.tenant;
  const effectiveTeacherId = isAdmin
    ? (req.body.teacherAccountId ? parseInt(req.body.teacherAccountId, 10) : accountId)
    : (teacherId ?? accountId);

  const [created] = await db.insert(subjectsTable).values({ name: name.trim(), teacherAccountId: effectiveTeacherId }).returning();
  res.status(201).json(created);
});

router.patch("/subjects/:id", requireTenantAccess, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { name } = req.body;
  if (!name?.trim()) { res.status(400).json({ message: "Name required" }); return; }
  const [updated] = await db.update(subjectsTable).set({ name: name.trim() }).where(eq(subjectsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ message: "Subject not found" }); return; }
  res.json(updated);
});

router.delete("/subjects/:id", requireTenantAccess, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  await db.delete(subjectsTable).where(eq(subjectsTable.id, id));
  res.json({ message: "Subject deleted" });
});

export default router;
