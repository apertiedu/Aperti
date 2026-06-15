import { Router, Response } from "express";
import { db } from "@workspace/db";
import { notebooksTable, notebookPagesTable } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import { eq, and } from "drizzle-orm";

export const notebooksRouter = Router();

notebooksRouter.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const accountId = req.userId!;
    const notebooks = await db.select().from(notebooksTable)
      .where(eq(notebooksTable.accountId, accountId))
      .orderBy(notebooksTable.sortOrder);

    const result = await Promise.all(notebooks.map(async nb => {
      const pages = await db.select({ id: notebookPagesTable.id })
        .from(notebookPagesTable).where(eq(notebookPagesTable.notebookId, nb.id));
      return { ...nb, pageCount: pages.length };
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to load notebooks" });
  }
});

notebooksRouter.post("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const accountId = req.userId!;
    const { name, icon, color } = req.body;
    const [nb] = await db.insert(notebooksTable).values({
      accountId,
      name: name || "Untitled Notebook",
      icon: icon || "📓",
      color: color || "#00796B",
    }).returning();
    res.status(201).json(nb);
  } catch (err) {
    res.status(500).json({ error: "Failed to create notebook" });
  }
});

notebooksRouter.put("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const accountId = req.userId!;
    const id = parseInt(req.params.id);
    const { name, icon, color } = req.body;
    await db.update(notebooksTable)
      .set({ name, icon, color, updatedAt: new Date() })
      .where(and(eq(notebooksTable.id, id), eq(notebooksTable.accountId, accountId)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update notebook" });
  }
});

notebooksRouter.delete("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const accountId = req.userId!;
    const id = parseInt(req.params.id);
    await db.delete(notebooksTable)
      .where(and(eq(notebooksTable.id, id), eq(notebooksTable.accountId, accountId)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete notebook" });
  }
});

notebooksRouter.get("/:id/pages", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const accountId = req.userId!;
    const notebookId = parseInt(req.params.id);
    const pages = await db.select({
      id: notebookPagesTable.id,
      notebookId: notebookPagesTable.notebookId,
      title: notebookPagesTable.title,
      background: notebookPagesTable.background,
      isFavorite: notebookPagesTable.isFavorite,
      tags: notebookPagesTable.tags,
      thumbnailUrl: notebookPagesTable.thumbnailUrl,
      sortOrder: notebookPagesTable.sortOrder,
      createdAt: notebookPagesTable.createdAt,
      updatedAt: notebookPagesTable.updatedAt,
    }).from(notebookPagesTable)
      .where(and(eq(notebookPagesTable.notebookId, notebookId), eq(notebookPagesTable.accountId, accountId)))
      .orderBy(notebookPagesTable.sortOrder);
    res.json(pages);
  } catch (err) {
    res.status(500).json({ error: "Failed to load pages" });
  }
});

notebooksRouter.post("/:id/pages", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const accountId = req.userId!;
    const notebookId = parseInt(req.params.id);
    const { title, background } = req.body;
    const [page] = await db.insert(notebookPagesTable).values({
      notebookId,
      accountId,
      title: title || "Untitled Page",
      background: background || "blank",
      strokes: [],
    }).returning();
    res.status(201).json(page);
  } catch (err) {
    res.status(500).json({ error: "Failed to create page" });
  }
});

notebooksRouter.get("/pages/:pageId", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const accountId = req.userId!;
    const pageId = parseInt(req.params.pageId);
    const [page] = await db.select().from(notebookPagesTable)
      .where(and(eq(notebookPagesTable.id, pageId), eq(notebookPagesTable.accountId, accountId)));
    if (!page) { res.status(404).json({ error: "Page not found" }); return; }
    res.json(page);
  } catch (err) {
    res.status(500).json({ error: "Failed to load page" });
  }
});

notebooksRouter.put("/pages/:pageId", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const accountId = req.userId!;
    const pageId = parseInt(req.params.pageId);
    const { strokes, title, background, isFavorite, tags, thumbnailUrl } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (strokes !== undefined) updates.strokes = strokes;
    if (title !== undefined) updates.title = title;
    if (background !== undefined) updates.background = background;
    if (isFavorite !== undefined) updates.isFavorite = isFavorite;
    if (tags !== undefined) updates.tags = tags;
    if (thumbnailUrl !== undefined) updates.thumbnailUrl = thumbnailUrl;

    await db.update(notebookPagesTable)
      .set(updates)
      .where(and(eq(notebookPagesTable.id, pageId), eq(notebookPagesTable.accountId, accountId)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to save page" });
  }
});

notebooksRouter.delete("/pages/:pageId", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const accountId = req.userId!;
    const pageId = parseInt(req.params.pageId);
    await db.delete(notebookPagesTable)
      .where(and(eq(notebookPagesTable.id, pageId), eq(notebookPagesTable.accountId, accountId)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete page" });
  }
});
