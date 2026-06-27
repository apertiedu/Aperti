import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { knowledgeBaseArticlesTable } from "@workspace/db";
import { eq, desc, ilike } from "drizzle-orm";
import { authenticate, requireRole } from "../middleware/auth";

export const adminKbRouter = Router();
adminKbRouter.use(authenticate, requireRole("admin", "super_admin"));

adminKbRouter.get("/", async (req: Request, res: Response) => {
  try {
    const { search, category } = req.query as Record<string, string>;
    let query = db.select().from(knowledgeBaseArticlesTable).$dynamic();
    if (search) query = query.where(ilike(knowledgeBaseArticlesTable.title, `%${search}%`));
    const articles = await query.orderBy(desc(knowledgeBaseArticlesTable.updatedAt));
    res.json(articles);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch articles" });
  }
});

adminKbRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { title, content, category, language } = req.body;
    const [article] = await db.insert(knowledgeBaseArticlesTable).values({ title, content, category: category || "general", language: language || "en", createdBy: (req as any).userId }).returning();
    res.status(201).json(article);
  } catch (err) {
    res.status(500).json({ error: "Failed to create article" });
  }
});

adminKbRouter.put("/:id", async (req: Request, res: Response) => {
  try {
    const { title, content, category, language } = req.body;
    const [article] = await db.update(knowledgeBaseArticlesTable).set({ title, content, category, language, updatedAt: new Date() }).where(eq(knowledgeBaseArticlesTable.id, parseInt(req.params.id))).returning();
    res.json(article);
  } catch (err) {
    res.status(500).json({ error: "Failed to update article" });
  }
});

adminKbRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(knowledgeBaseArticlesTable).where(eq(knowledgeBaseArticlesTable.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete article" });
  }
});
