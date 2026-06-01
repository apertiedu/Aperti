import { Router, Response } from "express";
import { AccessToken } from "livekit-server-sdk";
import { db } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import { liveClassRoomsTable } from "@workspace/db";
import { lessonsTable } from "@workspace/db";
import crypto from "crypto";
import { redis } from "../lib/redis";

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

// POST /live-class/pair – generate a pairing secret for TwinControl
liveClassRouter.post("/pair", authenticate, async (req: AuthRequest, res: Response) => {
  const { liveClassId } = req.body;
  const teacherId = req.userId!;
  const secret = crypto.randomUUID();
  const pairCode = `${liveClassId}-${secret.slice(0, 8)}`;
  await redis.set(`twin:${pairCode}`, JSON.stringify({ liveClassId, teacherId }), "EX", 600);
  res.json({ pairCode, secretUrl: `aperti://twin?code=${pairCode}` });
});

// GET /live-class/control-token?pairCode=xxx – exchange for control token
liveClassRouter.get("/control-token", authenticate, async (req: AuthRequest, res: Response) => {
  const { pairCode } = req.query as Record<string, string>;
  const raw = await redis.get(`twin:${pairCode}`);
  if (!raw) return res.status(404).json({ error: "Invalid or expired pairing code" });

  const data = JSON.parse(raw) as { liveClassId: string; teacherId: number };
  const roomName = `lesson-${data.liveClassId}`;
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_SECRET, {
    identity: `teacher-ctrl-${req.userId}`,
    name: "Teacher Control",
    metadata: JSON.stringify({ isControl: true }),
  });
  at.addGrant({ roomJoin: true, room: roomName, canPublish: false, canSubscribe: true, hidden: true });
  const controlToken = await at.toJwt();
  res.json({ controlToken, roomName });
});
