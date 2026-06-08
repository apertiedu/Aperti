import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { db, pool } from "@workspace/db";
import {
  collaborationRoomsTable,
  roomMembersTable,
  roomMessagesTable,
  sharedResourcesTable,
} from "@workspace/db";
import { eq, and, desc, or } from "drizzle-orm";

export const commRoomsRouter = Router();

const BLOCKLIST = ["spam", "hate", "abuse"];
function containsBlocked(text: string) {
  return BLOCKLIST.some((w) => text.toLowerCase().includes(w));
}

// ── POST /api/rooms – create room ───────────────────────────────────────────
commRoomsRouter.post("/rooms", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, type, course_id, is_public, settings } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });

    const [room] = await db.insert(collaborationRoomsTable).values({
      name, type: type || "study_group", courseId: course_id ? Number(course_id) : null,
      createdBy: req.userId!, isPublic: is_public !== false,
      settings: settings || {},
    }).returning();

    await db.insert(roomMembersTable).values({ roomId: room.id, userId: req.userId!, role: "owner" });

    res.status(201).json(room);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/rooms – list rooms ─────────────────────────────────────────────
commRoomsRouter.get("/rooms", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.userId!;
    const { type, course_id } = req.query;

    let query = `
      SELECT r.*,
        a.display_name AS creator_name,
        (SELECT COUNT(*) FROM room_members rm WHERE rm.room_id = r.id) AS member_count,
        (SELECT rm2.role FROM room_members rm2 WHERE rm2.room_id = r.id AND rm2.user_id = $1) AS my_role,
        (SELECT rm3.joined_at FROM room_members rm3 WHERE rm3.room_id = r.id AND rm3.user_id = $1) AS joined_at
      FROM collaboration_rooms r
      JOIN accounts a ON a.id = r.created_by
      WHERE (r.is_public = true OR EXISTS(SELECT 1 FROM room_members rm4 WHERE rm4.room_id = r.id AND rm4.user_id = $1))
    `;
    const params: unknown[] = [uid];
    if (type) { params.push(type); query += ` AND r.type = $${params.length}`; }
    if (course_id) { params.push(course_id); query += ` AND r.course_id = $${params.length}`; }
    query += ` ORDER BY r.created_at DESC`;

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/rooms/:id – room detail ────────────────────────────────────────
commRoomsRouter.get("/rooms/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const roomId = parseInt(req.params.id);
    const uid = req.userId!;

    const { rows: roomRows } = await pool.query(
      `SELECT r.*, a.display_name AS creator_name FROM collaboration_rooms r JOIN accounts a ON a.id = r.created_by WHERE r.id = $1`,
      [roomId],
    );
    if (!roomRows.length) return res.status(404).json({ error: "Room not found" });

    const { rows: members } = await pool.query(
      `SELECT rm.*, a.display_name AS name, a.role AS account_role FROM room_members rm JOIN accounts a ON a.id = rm.user_id WHERE rm.room_id = $1`,
      [roomId],
    );
    const { rows: messages } = await pool.query(
      `SELECT rm.*, a.display_name AS sender_name FROM room_messages rm JOIN accounts a ON a.id = rm.sender_id WHERE rm.room_id = $1 ORDER BY rm.created_at ASC LIMIT 100`,
      [roomId],
    );
    const { rows: resources } = await pool.query(
      `SELECT sr.*, a.display_name AS shared_by_name FROM shared_resources sr JOIN accounts a ON a.id = sr.user_id WHERE sr.room_id = $1 ORDER BY sr.shared_at DESC`,
      [roomId],
    );

    const myRole = members.find((m: any) => m.user_id === uid)?.role || null;
    res.json({ room: roomRows[0], members, messages, resources, myRole });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/rooms/:id/join – join room ────────────────────────────────────
commRoomsRouter.post("/rooms/:id/join", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const roomId = parseInt(req.params.id);
    const uid = req.userId!;

    const room = await db.query.collaborationRoomsTable.findFirst({ where: eq(collaborationRoomsTable.id, roomId) });
    if (!room) return res.status(404).json({ error: "Room not found" });

    const existing = await db.query.roomMembersTable.findFirst({
      where: and(eq(roomMembersTable.roomId, roomId), eq(roomMembersTable.userId, uid)),
    });
    if (existing) return res.json({ success: true, role: existing.role, already: true });

    const [member] = await db.insert(roomMembersTable).values({ roomId, userId: uid, role: "member" }).returning();
    res.status(201).json(member);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/rooms/:id/members/:userId – change role or remove ──────────────
commRoomsRouter.put("/rooms/:id/members/:userId", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const roomId = parseInt(req.params.id);
    const targetId = parseInt(req.params.userId);
    const { role, remove } = req.body;

    const myMember = await db.query.roomMembersTable.findFirst({
      where: and(eq(roomMembersTable.roomId, roomId), eq(roomMembersTable.userId, req.userId!)),
    });
    if (!myMember || !["owner", "moderator"].includes(myMember.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    if (remove) {
      await db.delete(roomMembersTable).where(and(eq(roomMembersTable.roomId, roomId), eq(roomMembersTable.userId, targetId)));
      return res.json({ success: true });
    }

    const [updated] = await db.update(roomMembersTable).set({ role }).where(
      and(eq(roomMembersTable.roomId, roomId), eq(roomMembersTable.userId, targetId)),
    ).returning();
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/rooms/:id/messages – send room message ────────────────────────
commRoomsRouter.post("/rooms/:id/messages", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const roomId = parseInt(req.params.id);
    const uid = req.userId!;
    const { content, attachment_url } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "content required" });
    if (containsBlocked(content)) return res.status(422).json({ error: "Message contains prohibited content" });

    const member = await db.query.roomMembersTable.findFirst({
      where: and(eq(roomMembersTable.roomId, roomId), eq(roomMembersTable.userId, uid)),
    });
    if (!member) return res.status(403).json({ error: "Not a member of this room" });

    const [msg] = await db.insert(roomMessagesTable).values({
      roomId, senderId: uid, content: content.trim(), attachmentUrl: attachment_url || null,
    }).returning();
    res.status(201).json(msg);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/rooms/:id/share – share resource ──────────────────────────────
commRoomsRouter.post("/rooms/:id/share", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const roomId = parseInt(req.params.id);
    const uid = req.userId!;
    const { resource_type, resource_id, title } = req.body;
    if (!resource_type) return res.status(400).json({ error: "resource_type required" });

    const member = await db.query.roomMembersTable.findFirst({
      where: and(eq(roomMembersTable.roomId, roomId), eq(roomMembersTable.userId, uid)),
    });
    if (!member) return res.status(403).json({ error: "Not a member of this room" });

    const [shared] = await db.insert(sharedResourcesTable).values({
      roomId, userId: uid, resourceType: resource_type, resourceId: resource_id || null, title: title || null,
    }).returning();
    res.status(201).json(shared);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/rooms/:id/collaborate – launch session token ───────────────────
commRoomsRouter.get("/rooms/:id/collaborate", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const roomId = parseInt(req.params.id);
    const uid = req.userId!;

    const member = await db.query.roomMembersTable.findFirst({
      where: and(eq(roomMembersTable.roomId, roomId), eq(roomMembersTable.userId, uid)),
    });
    if (!member) return res.status(403).json({ error: "Not a member of this room" });

    const token = Buffer.from(`${roomId}:${uid}:${Date.now()}`).toString("base64url");
    res.json({ token, room_id: roomId, user_id: uid });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
