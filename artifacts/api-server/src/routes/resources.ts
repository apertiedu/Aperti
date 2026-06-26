import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, resourcesTable, subjectsTable } from "@workspace/db";
import { requireTenantAccess } from "../middleware/tenant";

const router: IRouter = Router();

router.get("/resources", requireTenantAccess, async (req, res): Promise<void> => {
  try {
    const { teacherId, isAdmin } = req.tenant;
    const { subjectId, type } = req.query as Record<string, string>;

    let query = db.select({
      id: resourcesTable.id,
      title: resourcesTable.title,
      description: resourcesTable.description,
      type: resourcesTable.type,
      url: resourcesTable.url,
      content: resourcesTable.content,
      topic: resourcesTable.topic,
      tags: resourcesTable.tags,
      subjectId: resourcesTable.subjectId,
      subjectName: subjectsTable.name,
      isStudentVisible: resourcesTable.isStudentVisible,
      viewCount: resourcesTable.viewCount,
      createdAt: resourcesTable.createdAt,
    }).from(resourcesTable)
      .leftJoin(subjectsTable, eq(resourcesTable.subjectId, subjectsTable.id))
      .$dynamic();

    const conditions = [];
    if (!isAdmin && teacherId) conditions.push(eq(resourcesTable.teacherAccountId, teacherId));
    if (subjectId) conditions.push(eq(resourcesTable.subjectId, parseInt(subjectId, 10)));
    if (type) conditions.push(eq(resourcesTable.type, type));
    if (conditions.length > 0) query = query.where(and(...conditions));

    const rows = await query.orderBy(desc(resourcesTable.createdAt));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to load resources" });
  }
});

router.post("/resources", requireTenantAccess, async (req, res): Promise<void> => {
  try {
    const { teacherId, isAdmin, accountId } = req.tenant;
    const { title, description, type, url, content, topic, tags, subjectId, isStudentVisible } = req.body;

    if (!title?.trim()) { res.status(400).json({ message: "Title is required" }); return; }
    if ((type === "link" || type === "video" || type === "recording") && !url) { res.status(400).json({ message: "URL is required for this resource type" }); return; }

    const effectiveTeacherId = isAdmin ? accountId : (teacherId ?? accountId);

    const [created] = await db.insert(resourcesTable).values({
      teacherAccountId: effectiveTeacherId,
      title: title.trim(),
      description: description?.trim() || null,
      type: type || "link",
      url: url?.trim() || null,
      content: content?.trim() || null,
      topic: topic?.trim() || null,
      tags: tags?.trim() || null,
      subjectId: subjectId ? parseInt(subjectId, 10) : null,
      isStudentVisible: isStudentVisible !== false,
    }).returning();

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: "Failed to create resource" });
  }
});

router.patch("/resources/:id", requireTenantAccess, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { teacherId, isAdmin } = req.tenant;
    const updates: Record<string, unknown> = {};
    const fields = ["title", "description", "type", "url", "content", "topic", "tags", "isStudentVisible", "subjectId"] as const;
    for (const f of fields) {
      if (f in req.body) {
        if (f === "subjectId") updates[f] = req.body[f] ? parseInt(req.body[f], 10) : null;
        else if (f === "isStudentVisible") updates[f] = !!req.body[f];
        else updates[f] = req.body[f]?.trim?.() ?? req.body[f] ?? null;
      }
    }
    const condition = isAdmin ? eq(resourcesTable.id, id) : and(eq(resourcesTable.id, id), eq(resourcesTable.teacherAccountId, teacherId!));
    const [updated] = await db.update(resourcesTable).set(updates).where(condition!).returning();
    if (!updated) { res.status(404).json({ message: "Resource not found" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update resource" });
  }
});

router.delete("/resources/:id", requireTenantAccess, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { teacherId, isAdmin } = req.tenant;
    const condition = isAdmin ? eq(resourcesTable.id, id) : and(eq(resourcesTable.id, id), eq(resourcesTable.teacherAccountId, teacherId!));
    await db.delete(resourcesTable).where(condition!);
    res.json({ message: "Resource deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete resource" });
  }
});

router.post("/resources/:id/view", requireTenantAccess, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    await db.update(resourcesTable).set({ viewCount: sql`${resourcesTable.viewCount} + 1` }).where(eq(resourcesTable.id, id));
    res.json({ message: "View counted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to count view" });
  }
});

export default router;
