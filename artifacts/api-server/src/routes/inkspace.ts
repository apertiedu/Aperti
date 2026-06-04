import { Router } from "express";
import { eq, and, asc } from "drizzle-orm";
import {
  db, studentsTable,
  inkspaceNotebooksTable, inkspacePagesTable, inkspaceBlocksTable,
} from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import type { Response } from "express";

const inkspaceRouter = Router();

async function requireStudent(req: AuthRequest, res: Response): Promise<number | null> {
  const [s] = await db.select({ id: studentsTable.id })
    .from(studentsTable).where(eq(studentsTable.accountId, req.userId!)).limit(1);
  if (!s) { res.status(403).json({ message: "No student record" }); return null; }
  return s.id;
}

// ── Notebooks ─────────────────────────────────────────────────────────────────

inkspaceRouter.get("/notebooks", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const studentId = await requireStudent(req, res);
  if (!studentId) return;

  const notebooks = await db.select().from(inkspaceNotebooksTable)
    .where(eq(inkspaceNotebooksTable.studentId, studentId))
    .orderBy(inkspaceNotebooksTable.createdAt);
  res.json(notebooks);
});

inkspaceRouter.post("/notebooks", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const studentId = await requireStudent(req, res);
  if (!studentId) return;

  const { title, color } = req.body;
  const [notebook] = await db.insert(inkspaceNotebooksTable).values({
    studentId,
    title: title?.trim() || "Untitled Notebook",
    color: color || "#00796B",
  }).returning();

  const [firstPage] = await db.insert(inkspacePagesTable).values({
    notebookId: notebook.id,
    title: "Page 1",
    sortOrder: 0,
  }).returning();

  res.status(201).json({ ...notebook, pages: [firstPage] });
});

inkspaceRouter.put("/notebooks/:id", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const studentId = await requireStudent(req, res);
  if (!studentId) return;

  const notebookId = parseInt(req.params.id, 10);
  const [nb] = await db.select().from(inkspaceNotebooksTable)
    .where(and(eq(inkspaceNotebooksTable.id, notebookId), eq(inkspaceNotebooksTable.studentId, studentId))).limit(1);
  if (!nb) { res.status(404).json({ message: "Notebook not found" }); return; }

  const { title, color } = req.body;
  const [updated] = await db.update(inkspaceNotebooksTable)
    .set({ title: title?.trim() || nb.title, color: color || nb.color })
    .where(eq(inkspaceNotebooksTable.id, notebookId))
    .returning();
  res.json(updated);
});

inkspaceRouter.delete("/notebooks/:id", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const studentId = await requireStudent(req, res);
  if (!studentId) return;

  const notebookId = parseInt(req.params.id, 10);
  const [nb] = await db.select().from(inkspaceNotebooksTable)
    .where(and(eq(inkspaceNotebooksTable.id, notebookId), eq(inkspaceNotebooksTable.studentId, studentId))).limit(1);
  if (!nb) { res.status(404).json({ message: "Notebook not found" }); return; }

  await db.delete(inkspaceNotebooksTable).where(eq(inkspaceNotebooksTable.id, notebookId));
  res.json({ success: true });
});

// ── Pages ─────────────────────────────────────────────────────────────────────

inkspaceRouter.get("/notebooks/:notebookId/pages", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const studentId = await requireStudent(req, res);
  if (!studentId) return;

  const notebookId = parseInt(req.params.notebookId, 10);
  const [nb] = await db.select().from(inkspaceNotebooksTable)
    .where(and(eq(inkspaceNotebooksTable.id, notebookId), eq(inkspaceNotebooksTable.studentId, studentId))).limit(1);
  if (!nb) { res.status(404).json({ message: "Notebook not found" }); return; }

  const pages = await db.select().from(inkspacePagesTable)
    .where(eq(inkspacePagesTable.notebookId, notebookId))
    .orderBy(asc(inkspacePagesTable.sortOrder));
  res.json(pages);
});

inkspaceRouter.post("/notebooks/:notebookId/pages", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const studentId = await requireStudent(req, res);
  if (!studentId) return;

  const notebookId = parseInt(req.params.notebookId, 10);
  const [nb] = await db.select().from(inkspaceNotebooksTable)
    .where(and(eq(inkspaceNotebooksTable.id, notebookId), eq(inkspaceNotebooksTable.studentId, studentId))).limit(1);
  if (!nb) { res.status(404).json({ message: "Notebook not found" }); return; }

  const existing = await db.select({ sortOrder: inkspacePagesTable.sortOrder })
    .from(inkspacePagesTable).where(eq(inkspacePagesTable.notebookId, notebookId));
  const maxOrder = existing.reduce((max, p) => Math.max(max, p.sortOrder), -1);

  const { title, content } = req.body;
  const [page] = await db.insert(inkspacePagesTable).values({
    notebookId,
    title: title?.trim() || `Page ${existing.length + 1}`,
    sortOrder: maxOrder + 1,
    content: content ?? null,
  }).returning();
  res.status(201).json(page);
});

inkspaceRouter.get("/notebooks/:notebookId/pages/:pageId", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const studentId = await requireStudent(req, res);
  if (!studentId) return;

  const notebookId = parseInt(req.params.notebookId, 10);
  const pageId = parseInt(req.params.pageId, 10);

  const [nb] = await db.select().from(inkspaceNotebooksTable)
    .where(and(eq(inkspaceNotebooksTable.id, notebookId), eq(inkspaceNotebooksTable.studentId, studentId))).limit(1);
  if (!nb) { res.status(404).json({ message: "Notebook not found" }); return; }

  const [page] = await db.select().from(inkspacePagesTable)
    .where(and(eq(inkspacePagesTable.id, pageId), eq(inkspacePagesTable.notebookId, notebookId))).limit(1);
  if (!page) { res.status(404).json({ message: "Page not found" }); return; }

  const blocks = await db.select().from(inkspaceBlocksTable)
    .where(eq(inkspaceBlocksTable.pageId, pageId))
    .orderBy(asc(inkspaceBlocksTable.sortOrder));

  res.json({ ...page, blocks });
});

inkspaceRouter.put("/notebooks/:notebookId/pages/:pageId", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const studentId = await requireStudent(req, res);
  if (!studentId) return;

  const notebookId = parseInt(req.params.notebookId, 10);
  const pageId = parseInt(req.params.pageId, 10);

  const [nb] = await db.select().from(inkspaceNotebooksTable)
    .where(and(eq(inkspaceNotebooksTable.id, notebookId), eq(inkspaceNotebooksTable.studentId, studentId))).limit(1);
  if (!nb) { res.status(404).json({ message: "Notebook not found" }); return; }

  const { title, content, sortOrder } = req.body;
  const [updated] = await db.update(inkspacePagesTable)
    .set({
      ...(title !== undefined && { title: title.trim() || "Untitled Page" }),
      ...(content !== undefined && { content }),
      ...(sortOrder !== undefined && { sortOrder }),
      updatedAt: new Date(),
    })
    .where(and(eq(inkspacePagesTable.id, pageId), eq(inkspacePagesTable.notebookId, notebookId)))
    .returning();
  if (!updated) { res.status(404).json({ message: "Page not found" }); return; }
  res.json(updated);
});

inkspaceRouter.delete("/notebooks/:notebookId/pages/:pageId", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const studentId = await requireStudent(req, res);
  if (!studentId) return;

  const notebookId = parseInt(req.params.notebookId, 10);
  const pageId = parseInt(req.params.pageId, 10);

  const [nb] = await db.select().from(inkspaceNotebooksTable)
    .where(and(eq(inkspaceNotebooksTable.id, notebookId), eq(inkspaceNotebooksTable.studentId, studentId))).limit(1);
  if (!nb) { res.status(404).json({ message: "Notebook not found" }); return; }

  await db.delete(inkspacePagesTable)
    .where(and(eq(inkspacePagesTable.id, pageId), eq(inkspacePagesTable.notebookId, notebookId)));
  res.json({ success: true });
});

// ── Blocks ────────────────────────────────────────────────────────────────────

inkspaceRouter.post("/notebooks/:notebookId/pages/:pageId/blocks", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const studentId = await requireStudent(req, res);
  if (!studentId) return;

  const notebookId = parseInt(req.params.notebookId, 10);
  const pageId = parseInt(req.params.pageId, 10);

  const [nb] = await db.select().from(inkspaceNotebooksTable)
    .where(and(eq(inkspaceNotebooksTable.id, notebookId), eq(inkspaceNotebooksTable.studentId, studentId))).limit(1);
  if (!nb) { res.status(404).json({ message: "Notebook not found" }); return; }

  const existing = await db.select({ sortOrder: inkspaceBlocksTable.sortOrder })
    .from(inkspaceBlocksTable).where(eq(inkspaceBlocksTable.pageId, pageId));
  const maxOrder = existing.reduce((max, b) => Math.max(max, b.sortOrder), -1);

  const { type, data, sortOrder } = req.body;
  const [block] = await db.insert(inkspaceBlocksTable).values({
    pageId,
    type: type || "text",
    data: data ?? null,
    sortOrder: sortOrder ?? maxOrder + 1,
  }).returning();
  res.status(201).json(block);
});

inkspaceRouter.put("/notebooks/:notebookId/pages/:pageId/blocks/:blockId", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const studentId = await requireStudent(req, res);
  if (!studentId) return;

  const notebookId = parseInt(req.params.notebookId, 10);
  const pageId = parseInt(req.params.pageId, 10);
  const blockId = parseInt(req.params.blockId, 10);

  const [nb] = await db.select().from(inkspaceNotebooksTable)
    .where(and(eq(inkspaceNotebooksTable.id, notebookId), eq(inkspaceNotebooksTable.studentId, studentId))).limit(1);
  if (!nb) { res.status(404).json({ message: "Notebook not found" }); return; }

  const { type, data, sortOrder } = req.body;
  const [updated] = await db.update(inkspaceBlocksTable)
    .set({
      ...(type !== undefined && { type }),
      ...(data !== undefined && { data }),
      ...(sortOrder !== undefined && { sortOrder }),
    })
    .where(and(eq(inkspaceBlocksTable.id, blockId), eq(inkspaceBlocksTable.pageId, pageId)))
    .returning();
  if (!updated) { res.status(404).json({ message: "Block not found" }); return; }
  res.json(updated);
});

inkspaceRouter.delete("/notebooks/:notebookId/pages/:pageId/blocks/:blockId", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const studentId = await requireStudent(req, res);
  if (!studentId) return;

  const notebookId = parseInt(req.params.notebookId, 10);
  const pageId = parseInt(req.params.pageId, 10);
  const blockId = parseInt(req.params.blockId, 10);

  const [nb] = await db.select().from(inkspaceNotebooksTable)
    .where(and(eq(inkspaceNotebooksTable.id, notebookId), eq(inkspaceNotebooksTable.studentId, studentId))).limit(1);
  if (!nb) { res.status(404).json({ message: "Notebook not found" }); return; }

  await db.delete(inkspaceBlocksTable)
    .where(and(eq(inkspaceBlocksTable.id, blockId), eq(inkspaceBlocksTable.pageId, pageId)));
  res.json({ success: true });
});

// ── Full-text search across all notebooks ─────────────────────────────────────

inkspaceRouter.get("/search", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const studentId = await requireStudent(req, res);
  if (!studentId) return;

  const q = (req.query.q as string || "").toLowerCase().trim();
  if (!q) { res.json([]); return; }

  const notebooks = await db.select().from(inkspaceNotebooksTable)
    .where(eq(inkspaceNotebooksTable.studentId, studentId));

  const results: Array<{ pageId: number; pageTitle: string; notebookId: number; notebookTitle: string; updatedAt: Date }> = [];

  for (const nb of notebooks) {
    const pages = await db.select().from(inkspacePagesTable)
      .where(eq(inkspacePagesTable.notebookId, nb.id));
    for (const p of pages) {
      if (
        p.title.toLowerCase().includes(q) ||
        JSON.stringify(p.content ?? "").toLowerCase().includes(q)
      ) {
        results.push({
          pageId: p.id,
          pageTitle: p.title,
          notebookId: nb.id,
          notebookTitle: nb.title,
          updatedAt: p.updatedAt,
        });
      }
    }
  }

  res.json(results.slice(0, 20));
});

export default inkspaceRouter;
