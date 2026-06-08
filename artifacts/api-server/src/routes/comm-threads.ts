import { Router, Response } from "express";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { db, pool } from "@workspace/db";
import {
  messageThreadsExtTable,
  threadParticipantsTable,
  threadMessagesTable,
  classChannelsTable,
  channelMessagesTable,
  announcementsTable,
  announcementReadsTable,
} from "@workspace/db";
import { eq, and, desc, or, inArray, sql } from "drizzle-orm";
import { AI_CONFIG } from "../lib/ai-config";

export const commThreadsRouter = Router();

const BLOCKLIST = ["spam", "hate", "abuse", "slur"];
function containsBlocked(text: string) {
  const lower = text.toLowerCase();
  return BLOCKLIST.some((w) => lower.includes(w));
}

async function aiSummarize(messages: string[]): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key || messages.length === 0) {
    const last = messages.slice(-3).join(" … ");
    return last.length > 200 ? last.slice(0, 200) + "…" : last || "No messages yet.";
  }
  try {
    const body = JSON.stringify({
      model: AI_CONFIG.model,
      max_tokens: AI_CONFIG.maxTokens.summary,
      messages: [
        { role: "system", content: "Summarise this conversation in 2-3 sentences." },
        { role: "user", content: messages.slice(-20).join("\n") },
      ],
    });
    const r = await fetch(`${AI_CONFIG.baseUrl}/chat/completions`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body,
    });
    const d = await r.json() as any;
    return d.choices?.[0]?.message?.content ?? "Summary unavailable.";
  } catch {
    return "Summary unavailable.";
  }
}

// ── POST /api/messages/threads – create thread ──────────────────────────────
commThreadsRouter.post("/messages/threads", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { recipient_ids, title, context_type, context_id, type = "direct" } = req.body;
    if (!recipient_ids?.length) return res.status(400).json({ error: "recipient_ids required" });

    const [thread] = await db.insert(messageThreadsExtTable).values({
      type, title: title || null, contextType: context_type || null,
      contextId: context_id || null, createdBy: req.userId!,
    }).returning();

    const participants = [req.userId!, ...recipient_ids.map(Number)].filter((v, i, a) => a.indexOf(v) === i);
    await db.insert(threadParticipantsTable).values(participants.map((uid) => ({ threadId: thread.id, userId: uid })));

    res.status(201).json(thread);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/messages/threads – list user threads ───────────────────────────
commThreadsRouter.get("/messages/threads", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.userId!;
    const { rows } = await pool.query(
      `SELECT t.*, 
        (SELECT COUNT(*) FROM thread_messages tm WHERE tm.thread_id = t.id AND tm.is_read = false AND tm.sender_id != $1) AS unread_count,
        (SELECT tm2.content FROM thread_messages tm2 WHERE tm2.thread_id = t.id ORDER BY tm2.created_at DESC LIMIT 1) AS last_message,
        (SELECT tm2.created_at FROM thread_messages tm2 WHERE tm2.thread_id = t.id ORDER BY tm2.created_at DESC LIMIT 1) AS last_at,
        (SELECT json_agg(json_build_object('id', a.id, 'name', a.display_name, 'role', a.role))
          FROM thread_participants tp2
          JOIN accounts a ON a.id = tp2.user_id
          WHERE tp2.thread_id = t.id AND tp2.user_id != $1) AS participants
       FROM message_threads_ext t
       JOIN thread_participants tp ON tp.thread_id = t.id AND tp.user_id = $1
       ORDER BY COALESCE(last_at, t.created_at) DESC`,
      [uid],
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/messages/threads/:id – get thread + messages ───────────────────
commThreadsRouter.get("/messages/threads/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const threadId = parseInt(req.params.id);
    const uid = req.userId!;

    const participant = await db.query.threadParticipantsTable.findFirst({
      where: and(eq(threadParticipantsTable.threadId, threadId), eq(threadParticipantsTable.userId, uid)),
    });
    if (!participant) return res.status(403).json({ error: "Not a participant" });

    const thread = await db.query.messageThreadsExtTable.findFirst({ where: eq(messageThreadsExtTable.id, threadId) });
    const { rows: messages } = await pool.query(
      `SELECT tm.*, a.display_name AS sender_name, a.role AS sender_role
       FROM thread_messages tm
       JOIN accounts a ON a.id = tm.sender_id
       WHERE tm.thread_id = $1 ORDER BY tm.created_at ASC`,
      [threadId],
    );

    await pool.query(`UPDATE thread_messages SET is_read = true WHERE thread_id = $1 AND sender_id != $2`, [threadId, uid]);

    const { rows: participants } = await pool.query(
      `SELECT a.id, a.display_name AS name, a.role FROM thread_participants tp JOIN accounts a ON a.id = tp.user_id WHERE tp.thread_id = $1`,
      [threadId],
    );

    res.json({ thread, messages, participants });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/messages/threads/:id/messages – send message ──────────────────
commThreadsRouter.post("/messages/threads/:id/messages", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const threadId = parseInt(req.params.id);
    const uid = req.userId!;
    const { content, attachment_url, attachment_type } = req.body;

    if (!content?.trim()) return res.status(400).json({ error: "content required" });
    if (containsBlocked(content)) return res.status(422).json({ error: "Message contains prohibited content" });

    const participant = await db.query.threadParticipantsTable.findFirst({
      where: and(eq(threadParticipantsTable.threadId, threadId), eq(threadParticipantsTable.userId, uid)),
    });
    if (!participant) return res.status(403).json({ error: "Not a participant" });

    const [msg] = await db.insert(threadMessagesTable).values({
      threadId, senderId: uid, content: content.trim(),
      attachmentUrl: attachment_url || null, attachmentType: attachment_type || null,
    }).returning();

    await pool.query(`UPDATE message_threads_ext SET updated_at = NOW() WHERE id = $1`, [threadId]);

    res.status(201).json(msg);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/messages/threads/:id/summary – AI summary ──────────────────────
commThreadsRouter.get("/messages/threads/:id/summary", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const threadId = parseInt(req.params.id);
    const { rows } = await pool.query(
      `SELECT content FROM thread_messages WHERE thread_id = $1 ORDER BY created_at ASC`,
      [threadId],
    );
    const summary = await aiSummarize(rows.map((r: any) => r.content));
    res.json({ summary });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/messages/threads/:id/unanswered ────────────────────────────────
commThreadsRouter.get("/messages/threads/:id/unanswered", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const threadId = parseInt(req.params.id);
    const { rows } = await pool.query(
      `SELECT tm.*, a.display_name AS sender_name
       FROM thread_messages tm
       JOIN accounts a ON a.id = tm.sender_id
       WHERE tm.thread_id = $1 AND (tm.content ILIKE '%?' OR tm.content ILIKE '%please%' OR tm.content ILIKE '%could you%')
       ORDER BY tm.created_at DESC LIMIT 10`,
      [threadId],
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/messages/translate – translate message ────────────────────────
commThreadsRouter.post("/messages/translate", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { content, target_language } = req.body;
    if (!content || !target_language) return res.status(400).json({ error: "content and target_language required" });

    const key = process.env.OPENAI_API_KEY;
    if (!key) return res.json({ translated: content, note: "AI not configured" });

    const r = await fetch(`${AI_CONFIG.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: AI_CONFIG.model,
        max_tokens: 500,
        messages: [
          { role: "system", content: `Translate the following to ${target_language}. Return only the translation.` },
          { role: "user", content },
        ],
      }),
    });
    const d = await r.json() as any;
    res.json({ translated: d.choices?.[0]?.message?.content ?? content });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
// CLASS CHANNELS
// ════════════════════════════════════════════════════════════════════════════

// ── POST /api/channels – create channel ─────────────────────────────────────
commThreadsRouter.post("/channels", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, course_id } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    const [channel] = await db.insert(classChannelsTable).values({
      name, description: description || null, courseId: course_id ? Number(course_id) : null,
      createdBy: req.userId!,
    }).returning();
    res.status(201).json(channel);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/channels/:courseId – get channel for course ────────────────────
commThreadsRouter.get("/channels/:courseId", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const courseId = parseInt(req.params.courseId);
    const channel = await db.query.classChannelsTable.findFirst({
      where: eq(classChannelsTable.courseId, courseId),
    });
    if (!channel) return res.status(404).json({ error: "Channel not found" });

    const { rows: messages } = await pool.query(
      `SELECT cm.*, a.display_name AS sender_name, a.role AS sender_role
       FROM channel_messages cm
       JOIN accounts a ON a.id = cm.sender_id
       WHERE cm.channel_id = $1 ORDER BY cm.created_at ASC LIMIT 100`,
      [channel.id],
    );
    res.json({ channel, messages });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/channels – list all channels ───────────────────────────────────
commThreadsRouter.get("/channels", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const channels = await db.select().from(classChannelsTable).orderBy(desc(classChannelsTable.createdAt));
    res.json(channels);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/channels/:id/messages – post in channel ───────────────────────
commThreadsRouter.post("/channels/:id/messages", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const channelId = parseInt(req.params.id);
    const { content, attachment_url } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "content required" });
    if (containsBlocked(content)) return res.status(422).json({ error: "Message contains prohibited content" });

    const channel = await db.query.classChannelsTable.findFirst({ where: eq(classChannelsTable.id, channelId) });
    if (!channel) return res.status(404).json({ error: "Channel not found" });
    if (channel.isLocked && req.role === "student") return res.status(403).json({ error: "Channel is locked" });

    const [msg] = await db.insert(channelMessagesTable).values({
      channelId, senderId: req.userId!, content: content.trim(), attachmentUrl: attachment_url || null,
    }).returning();
    res.status(201).json(msg);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/channels/:id/settings – teacher controls ───────────────────────
commThreadsRouter.put("/channels/:id/settings", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const channelId = parseInt(req.params.id);
    const { is_locked, pinned_message_id } = req.body;
    const [updated] = await db.update(classChannelsTable)
      .set({ isLocked: is_locked ?? false, pinnedMessageId: pinned_message_id ?? null })
      .where(eq(classChannelsTable.id, channelId)).returning();
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
// ANNOUNCEMENTS
// ════════════════════════════════════════════════════════════════════════════

// ── POST /api/announcements – create ────────────────────────────────────────
commThreadsRouter.post("/announcements", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { title, body, audience_type, audience_ids, scheduled_at } = req.body;
    if (!title || !body) return res.status(400).json({ error: "title and body required" });
    const [ann] = await db.insert(announcementsTable).values({
      senderId: req.userId!, title, body,
      audienceType: audience_type || "class",
      audienceIds: audience_ids || [],
      scheduledAt: scheduled_at ? new Date(scheduled_at) : null,
      status: scheduled_at ? "scheduled" : "delivered",
      deliveredAt: scheduled_at ? null : new Date(),
    }).returning();
    res.status(201).json(ann);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/announcements – list for user ───────────────────────────────────
commThreadsRouter.get("/announcements", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.userId!;
    const role = req.role;
    let query = `SELECT a.*, acc.display_name AS sender_name,
      EXISTS(SELECT 1 FROM announcement_reads ar WHERE ar.announcement_id = a.id AND ar.user_id = $1) AS is_read
      FROM announcements a
      JOIN accounts acc ON acc.id = a.sender_id`;

    if (role === "teacher" || role === "admin") {
      query += ` WHERE a.sender_id = $1 ORDER BY a.created_at DESC`;
    } else {
      query += ` WHERE a.status = 'delivered' ORDER BY a.created_at DESC`;
    }

    const { rows } = await pool.query(query, [uid]);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/announcements/:id – edit/schedule ──────────────────────────────
commThreadsRouter.put("/announcements/:id", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { title, body, status, scheduled_at } = req.body;
    const [updated] = await db.update(announcementsTable).set({
      title: title || undefined, body: body || undefined,
      status: status || undefined,
      scheduledAt: scheduled_at ? new Date(scheduled_at) : undefined,
    }).where(and(eq(announcementsTable.id, id), eq(announcementsTable.senderId, req.userId!))).returning();
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/announcements/:id ───────────────────────────────────────────
commThreadsRouter.delete("/announcements/:id", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(announcementsTable).where(and(eq(announcementsTable.id, id), eq(announcementsTable.senderId, req.userId!)));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/announcements/:id/read – mark as read ─────────────────────────
commThreadsRouter.post("/announcements/:id/read", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const annId = parseInt(req.params.id);
    const uid = req.userId!;
    const existing = await db.query.announcementReadsTable.findFirst({
      where: and(eq(announcementReadsTable.announcementId, annId), eq(announcementReadsTable.userId, uid)),
    });
    if (!existing) {
      await db.insert(announcementReadsTable).values({ announcementId: annId, userId: uid });
    }
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
