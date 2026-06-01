import { Router, Response } from "express";
import { db } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { pastPapersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const pastPapersRouter = Router();

// PUBLIC: GET /past-papers — browse and filter past papers (no auth required)
pastPapersRouter.get("/", async (req, res: Response) => {
  const { board, subject, year } = req.query;
  let papers = await db.query.pastPapers.findMany({ orderBy: (p, { desc }) => [desc(p.year)] });
  if (board) papers = papers.filter(p => p.board.toLowerCase() === (board as string).toLowerCase());
  if (subject) papers = papers.filter(p => p.subject.toLowerCase().includes((subject as string).toLowerCase()));
  if (year) papers = papers.filter(p => p.year === parseInt(year as string));
  res.json(papers);
});

// ADMIN: POST /past-papers — upload a new paper
pastPapersRouter.post("/", authenticate, requireRole("admin", "admin_assistant"), async (req: AuthRequest, res: Response) => {
  const { board, subject, year, variant, fileUrl } = req.body;
  const [paper] = await db.insert(pastPapersTable).values({
    board, subject, year, variant, fileUrl,
    uploadedBy: req.userId,
    isPublic: "true",
  }).returning();
  res.status(201).json(paper);
});

// ADMIN: DELETE /past-papers/:id
pastPapersRouter.delete("/:id", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  await db.delete(pastPapersTable).where(eq(pastPapersTable.id, id));
  res.json({ success: true });
});
