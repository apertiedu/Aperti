import { Router, Response } from "express";
import { db } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import { engagementRecordsTable } from "@workspace/db";
import { echoMemoryTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export const classForgeRouter = Router();

// POST /class-forge/breakout-room — assign students to rooms based on mastery
classForgeRouter.post("/breakout-room", authenticate, async (req: AuthRequest, res: Response) => {
  const { liveClassId, studentIds } = req.body;

  // Fetch mastery data for each student
  const memories = await db.query.echoMemory.findMany({
    where: (m, { inArray }) => inArray(m.studentId, studentIds),
  });

  // Group by weak topic / mastery level
  const groups: Record<string, number[]> = {};
  memories.forEach((mem) => {
    const key = mem.weakTopics?.[0] || "general";
    if (!groups[key]) groups[key] = [];
    groups[key].push(mem.studentId);
  });

  // Create breakout rooms
  const breakoutRooms = Object.entries(groups).map(([topic, students], idx) => ({
    roomName: `Room ${idx + 1} – ${topic}`,
    students,
    topic,
  }));

  // In production, you'd use LiveKit's room creation API here
  // For now, return the suggested grouping
  res.json({ breakoutRooms });
});

// POST /class-forge/log-engagement — log student participation during LiveClass
classForgeRouter.post("/log-engagement", authenticate, async (req: AuthRequest, res: Response) => {
  const { liveClassId, studentId, handRaises, chatMessages, pollResponses, attentionPercentage, joinedAt, leftAt } = req.body;

  const participationScore = (handRaises * 5) + (chatMessages * 2) + (pollResponses * 3) + (attentionPercentage * 0.5);

  const [record] = await db.insert(engagementRecordsTable).values({
    liveClassId,
    studentId,
    handRaises,
    chatMessages,
    pollResponses,
    attentionPercentage,
    joinedAt,
    leftAt,
    participationScore: Math.min(100, Math.round(participationScore)),
  }).returning();

  res.json(record);
});

// GET /class-forge/heatmap/:liveClassId — engagement summary for a class
classForgeRouter.get("/heatmap/:liveClassId", authenticate, async (req: AuthRequest, res: Response) => {
  const liveClassId = parseInt(req.params.liveClassId);
  const records = await db.query.engagementRecords.findMany({
    where: (r, { eq }) => eq(r.liveClassId, liveClassId),
    orderBy: (r, { desc }) => [desc(r.participationScore)],
  });

  res.json({
    records,
    averageAttention: records.length > 0
      ? Math.round(records.reduce((sum, r) => sum + r.attentionPercentage, 0) / records.length)
      : 0,
    totalHandRaises: records.reduce((sum, r) => sum + r.handRaises, 0),
    topParticipants: records.slice(0, 5),
    lowParticipants: records.filter(r => r.participationScore < 20),
  });
});
