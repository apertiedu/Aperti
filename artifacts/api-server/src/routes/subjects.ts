import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, subjectsTable } from "@workspace/db";

const router: IRouter = Router();

function getTeacherFilter(req: any): number | null {
  if (req.session.role === "admin") return null;
  if (req.session.role === "teacher") return req.session.accountId;
  if (req.session.role === "assistant") return req.session.teacherAccountId;
  return req.session.accountId;
}

router.get("/subjects", async (req, res): Promise<void> => {
  const teacherId = getTeacherFilter(req);
  const rows = teacherId
    ? await db.select().from(subjectsTable).where(eq(subjectsTable.teacherAccountId, teacherId))
    : await db.select().from(subjectsTable);
  res.json(rows);
});

router.post("/subjects", async (req, res): Promise<void> => {
  const { name } = req.body;
  if (!name?.trim()) { res.status(400).json({ message: "Subject name is required" }); return; }

  const teacherId = req.session.role === "admin"
    ? (req.body.teacherAccountId ? parseInt(req.body.teacherAccountId, 10) : req.session.accountId)
    : (req.session.role === "teacher" ? req.session.accountId : req.session.teacherAccountId);

  if (!teacherId) { res.status(400).json({ message: "Teacher account required" }); return; }

  const [created] = await db.insert(subjectsTable).values({ name: name.trim(), teacherAccountId: teacherId! }).returning();
  res.status(201).json(created);
});

router.patch("/subjects/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid ID" }); return; }
  const { name } = req.body;
  if (!name?.trim()) { res.status(400).json({ message: "Name required" }); return; }
  const [updated] = await db.update(subjectsTable).set({ name: name.trim() }).where(eq(subjectsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ message: "Subject not found" }); return; }
  res.json(updated);
});

router.delete("/subjects/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  await db.delete(subjectsTable).where(eq(subjectsTable.id, id));
  res.json({ message: "Subject deleted" });
});

export default router;
