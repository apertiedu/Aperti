import { Router, Response } from "express";
import { db } from "../lib/db";
import { authenticate, AuthRequest } from "../middleware/auth";

export const errorTraceRouter = Router();

// GET /error-trace/student/:studentId — analyze mistake patterns
errorTraceRouter.get("/student/:studentId", authenticate, async (req: AuthRequest, res: Response) => {
  const studentId = parseInt(req.params.studentId);

  // Fetch all mistakes from echo memory
  const memory = await db.query.echoMemory.findFirst({
    where: (m, { eq }) => eq(m.studentId, studentId),
  });

  const mistakeHistory = memory?.mistakeHistory as Record<string, number> || {};

  // Categorize
  const patterns = {
    carelessErrors: 0,
    conceptualGaps: 0,
    timingIssues: 0,
  };

  // Simplified pattern detection (would be AI-powered in production)
  Object.entries(mistakeHistory).forEach(([topic, count]) => {
    if (topic.includes("units") || topic.includes("decimal")) patterns.carelessErrors += count;
    else if (topic.includes("formula") || topic.includes("concept")) patterns.conceptualGaps += count;
    else patterns.timingIssues += count;
  });

  res.json({
    mistakeHistory,
    patterns,
    recommendation: patterns.carelessErrors > patterns.conceptualGaps
      ? "Focus on careful checking. Double‑check units and decimals."
      : "Revisit core concepts. Use The Mentor for deep explanations.",
  });
});
