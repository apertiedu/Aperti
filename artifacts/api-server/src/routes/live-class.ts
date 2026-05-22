import { Router, Response } from "express";
import { AccessToken } from "livekit-server-sdk";
import { db } from "../lib/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import { liveClassRoomsTable } from "@lib/db/schema/live-class";
import { lessonsTable } from "@lib/db/schema/sessions";

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "devkey";
const LIVEKIT_SECRET = process.env.LIVEKIT_SECRET || "devsecret";

export const liveClassRouter = Router();

// POST /live-class/create – teacher creates a room for a lesson
liveClassRouter.post("/create", authenticate, async (req: AuthRequest, res: Response) => {
  const { lessonId } = req.body;
  const teacherId = req.userId!;
  const roomName = `lesson-${lessonId}-${teacherId}-${Date.now()}`;

  const [room] = await db.insert(liveClassRoomsTable).values({
    lessonId,
    roomName,
    startedAt: new Date(),
  }).returning();

  // Issue host token for teacher
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_SECRET, {
    identity: `teacher-${teacherId}`,
    name: `Teacher`,
  });
  at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
  const hostToken = await at.toJwt();

  res.status(201).json({ roomName, roomId: room.id, hostToken });
});

// GET /live-class/token?room=xxx&identity=student-123&name=Ali
liveClassRouter.get("/token", authenticate, async (req: AuthRequest, res: Response) => {
  const { room, identity, name } = req.query as Record<string, string>;
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_SECRET, {
    identity,
    name,
  });
  at.addGrant({ roomJoin: true, room: room, canPublish: true, canSubscribe: true });
  const token = await at.toJwt();
  res.json({ token });
});
