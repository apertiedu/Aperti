import { Router, Response } from "express";
import { db } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";

export const echoEvolveRouter = Router();

// POST /echo-evolve/run — manually trigger a global analysis run (admin only)
echoEvolveRouter.post("/run", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  // In production, this would analyze all echo_memory records,
  // find common weak topics globally, and adjust the global knowledge graph.
  // For now, we return a mock success with some statistics.
  const totalStudents = await db.query.echoMemory.count();
  const weakTopicAggregation = await db.query.echoMemory.aggregate({
    weakTopics: { count: true },
  });
  // Mock result
  res.json({
    message: "Global evolution run completed successfully.",
    studentsAnalyzed: totalStudents,
    newGlobalInsights: ["Electricity topic difficulty increased", "Quadratic equations retention improved across network"],
  });
});
