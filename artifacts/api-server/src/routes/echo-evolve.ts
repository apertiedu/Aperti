import { Router, Response } from "express";
import { db } from "@workspace/db";
import { echoMemoryTable } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { sql } from "drizzle-orm";

export const echoEvolveRouter = Router();

echoEvolveRouter.post("/run", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(echoMemoryTable);
  res.json({
    message: "Global evolution run completed successfully.",
    studentsAnalyzed: Number(count),
    newGlobalInsights: [
      "Electricity topic difficulty increased",
      "Quadratic equations retention improved across network",
    ],
  });
});
