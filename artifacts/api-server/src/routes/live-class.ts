import { Router, Response } from "express";
import { AccessToken } from "livekit-server-sdk";
import { db, pool } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import { liveClassRoomsTable } from "@workspace/db";
import { lessonsTable } from "@workspace/db";
import crypto from "crypto";
import { redis } from "../lib/redis";
import { openaiChat } from "../lib/ai-config";
import { eq } from "drizzle-orm";

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

// POST /live-class/end – end a session and mark endedAt
liveClassRouter.post("/end", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { roomId } = req.body;
    await pool.query(
      `UPDATE live_class_rooms SET ended_at = NOW() WHERE id = $1`,
      [roomId]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /live-class/analyse – generate AI summary for a session
liveClassRouter.post("/analyse", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { roomId } = req.body;
    if (!roomId) return res.status(400).json({ error: "roomId required" });

    // Fetch session and engagement data
    const [sessionRes, engagementRes] = await Promise.all([
      pool.query(
        `SELECT lcr.id, lcr.room_name, lcr.started_at, lcr.ended_at, lcr.summary,
                l.title AS lesson_title, s.name AS subject_name
         FROM live_class_rooms lcr
         LEFT JOIN lessons l ON lcr.lesson_id = l.id
         LEFT JOIN subjects s ON l.subject_id = s.id
         WHERE lcr.id = $1`,
        [roomId]
      ),
      pool.query(
        `SELECT er.hand_raises, er.chat_messages, er.poll_responses,
                er.attention_percentage, er.participation_score,
                a.display_name AS student_name
         FROM engagement_records er
         JOIN students st ON er.student_id = st.id
         JOIN accounts a ON st.account_id = a.id
         WHERE er.live_class_id = $1
         ORDER BY er.participation_score DESC`,
        [roomId]
      ),
    ]);

    if (!sessionRes.rows.length) {
      return res.status(404).json({ error: "Session not found" });
    }

    const session = sessionRes.rows[0];

    // Return cached summary if already generated
    if (session.summary) {
      return res.json({ summary: session.summary, cached: true });
    }

    const engagement = engagementRes.rows;
    const totalStudents = engagement.length;
    const avgAttention = totalStudents > 0
      ? Math.round(engagement.reduce((s: number, e: any) => s + e.attention_percentage, 0) / totalStudents)
      : 0;
    const topParticipants = engagement.slice(0, 3).map((e: any) => e.student_name).join(", ") || "No participants";
    const totalHandRaises = engagement.reduce((s: number, e: any) => s + (e.hand_raises ?? 0), 0);
    const totalChat = engagement.reduce((s: number, e: any) => s + (e.chat_messages ?? 0), 0);
    const totalPolls = engagement.reduce((s: number, e: any) => s + (e.poll_responses ?? 0), 0);

    const duration = session.started_at && session.ended_at
      ? Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 60000)
      : null;

    const promptContext = [
      `Lesson: ${session.lesson_title ?? "Unknown"}`,
      `Subject: ${session.subject_name ?? "Unknown"}`,
      `Duration: ${duration ? `${duration} minutes` : "Unknown"}`,
      `Total students: ${totalStudents}`,
      `Average attention: ${avgAttention}%`,
      `Top participants: ${topParticipants}`,
      `Hand raises: ${totalHandRaises}`,
      `Chat messages: ${totalChat}`,
      `Poll responses: ${totalPolls}`,
    ].join("\n");

    const aiSummary = await openaiChat({
      systemPrompt: `You are an AI educational session analyst. Based on engagement data from a live class session, 
write a concise summary for the teacher. Include: overall engagement level, top participants, notable highlights, 
and 2-3 actionable follow-up suggestions. Keep it friendly and practical. Use bullet points.`,
      userMessage: promptContext,
      maxTokens: 500,
    });

    // Build rule-based fallback
    const fallback = [
      `**Session: ${session.lesson_title ?? "Live Class"}**`,
      `• ${totalStudents} student${totalStudents !== 1 ? "s" : ""} attended${duration ? ` over ${duration} minutes` : ""}`,
      `• Average attention: ${avgAttention}%`,
      topParticipants !== "No participants"
        ? `• Most active: ${topParticipants}`
        : "• No engagement data recorded",
      totalHandRaises > 0 ? `• ${totalHandRaises} hand raise${totalHandRaises !== 1 ? "s" : ""} recorded` : "",
      `\n**Follow-up suggestions:**`,
      `• Review any topics with lower engagement scores`,
      `• Follow up with students who had low attention percentages`,
      avgAttention < 70 ? `• Consider shorter, more interactive activities next session` : "",
    ].filter(Boolean).join("\n");

    const summary = aiSummary ?? fallback;

    // Store summary in DB
    await pool.query(
      `UPDATE live_class_rooms SET summary = $1 WHERE id = $2`,
      [summary, roomId]
    );

    res.json({ summary, cached: false });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /live-class/history – past sessions for a teacher
liveClassRouter.get("/history", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.userId!;
    const { rows } = await pool.query(
      `SELECT lcr.id, lcr.room_name, lcr.started_at, lcr.ended_at,
              lcr.recording_url, lcr.summary,
              l.title AS lesson_title,
              s.name AS subject_name,
              COUNT(DISTINCT er.student_id) AS participant_count,
              ROUND(AVG(er.attention_percentage)) AS avg_attention
       FROM live_class_rooms lcr
       LEFT JOIN lessons l ON lcr.lesson_id = l.id
       LEFT JOIN subjects s ON l.subject_id = s.id
       LEFT JOIN engagement_records er ON er.live_class_id = lcr.id
       WHERE l.teacher_id = $1
       GROUP BY lcr.id, l.title, s.name
       ORDER BY lcr.started_at DESC
       LIMIT 20`,
      [teacherId]
    );
    res.json({ sessions: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
