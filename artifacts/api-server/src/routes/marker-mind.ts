import { Router, Response } from "express";
import { db } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { examinerReportsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const markerMindRouter = Router();

// POST /marker-mind/upload — teacher uploads an examiner report (PDF text extracted)
markerMindRouter.post("/upload", authenticate, async (req: AuthRequest, res: Response) => {
  const { subjectId, board, year, content, commonMistakes } = req.body;
  const [report] = await db.insert(examinerReportsTable).values({
    subjectId, board, year, content, commonMistakes,
  }).returning();
  res.status(201).json(report);
});

// GET /marker-mind/tips/:subjectId — get examiner tips for a subject
markerMindRouter.get("/tips/:subjectId", authenticate, async (req: AuthRequest, res: Response) => {
  const subjectId = parseInt(req.params.subjectId);
  const reports = await db.query.examinerReports.findMany({
    where: (r, { eq }) => eq(r.subjectId, subjectId),
    orderBy: (r, { desc }) => [desc(r.year)],
    limit: 3,
  });

  const tips = reports.map(r => ({
    year: r.year,
    commonMistakes: r.commonMistakes,
  }));

  res.json(tips);
});
