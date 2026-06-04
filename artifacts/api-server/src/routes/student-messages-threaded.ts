import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import {
  db, messageThreadsTable, studentMessagesTable,
} from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";

const studentGuard = [authenticate, requireRole("student")];
import type { Response } from "express";

const router = Router();

function isParticipant(thread: { participants: unknown }, userId: number): boolean {
  const participants = (thread.participants as number[]) ?? [];
  return participants.includes(userId);
}

// GET /messages/threads
router.get("/messages/threads", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId!;

  const threads = await db.select().from(messageThreadsTable)
    .orderBy(desc(messageThreadsTable.lastMessageAt))
    .limit(100);

  const myThreads = threads.filter(t => isParticipant(t, userId));
  res.json(myThreads);
});

// POST /messages/threads
router.post("/messages/threads", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId!;
  const { participantIds, subject, firstMessage } = req.body;

  if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
    res.status(400).json({ message: "participantIds array required" }); return;
  }

  const allParticipants = [...new Set([userId, ...participantIds.map((id: any) => parseInt(id, 10))])];

  const [thread] = await db.insert(messageThreadsTable).values({
    participants: allParticipants,
    subject: subject ?? null,
  }).returning();

  if (firstMessage?.trim()) {
    await db.insert(studentMessagesTable).values({
      threadId: thread.id,
      senderId: userId,
      content: firstMessage.trim(),
      readBy: [userId],
    });
    await db.update(messageThreadsTable)
      .set({ lastMessageAt: new Date() })
      .where(eq(messageThreadsTable.id, thread.id));
  }

  res.status(201).json(thread);
});

// GET /messages/threads/:id
router.get("/messages/threads/:id", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId!;
  const threadId = parseInt(req.params.id, 10);

  const [thread] = await db.select().from(messageThreadsTable)
    .where(eq(messageThreadsTable.id, threadId));
  if (!thread) { res.status(404).json({ message: "Thread not found" }); return; }

  if (!isParticipant(thread, userId)) {
    res.status(403).json({ message: "Not a participant in this thread" }); return;
  }

  const messages = await db.select().from(studentMessagesTable)
    .where(eq(studentMessagesTable.threadId, threadId))
    .orderBy(studentMessagesTable.sentAt);

  res.json({ thread, messages });
});

// POST /messages/threads/:id/send
router.post("/messages/threads/:id/send", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId!;
  const threadId = parseInt(req.params.id, 10);

  const [thread] = await db.select().from(messageThreadsTable)
    .where(eq(messageThreadsTable.id, threadId));
  if (!thread) { res.status(404).json({ message: "Thread not found" }); return; }

  if (!isParticipant(thread, userId)) {
    res.status(403).json({ message: "Not a participant in this thread" }); return;
  }

  const { content } = req.body;
  if (!content?.trim()) { res.status(400).json({ message: "content required" }); return; }

  const [msg] = await db.insert(studentMessagesTable).values({
    threadId,
    senderId: userId,
    content: content.trim(),
    readBy: [userId],
  }).returning();

  await db.update(messageThreadsTable)
    .set({ lastMessageAt: new Date() })
    .where(eq(messageThreadsTable.id, threadId));

  res.status(201).json(msg);
});

// PUT /messages/:id/read — verifies thread participation before mutation
router.put("/messages/:id/read", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId!;
  const msgId = parseInt(req.params.id, 10);

  const [msg] = await db.select().from(studentMessagesTable)
    .where(eq(studentMessagesTable.id, msgId));
  if (!msg) { res.status(404).json({ message: "Message not found" }); return; }

  // Verify the user is a participant in the thread
  const [thread] = await db.select().from(messageThreadsTable)
    .where(eq(messageThreadsTable.id, msg.threadId));
  if (!thread || !isParticipant(thread, userId)) {
    res.status(403).json({ message: "Not authorized to mark this message as read" }); return;
  }

  const readBy = (msg.readBy as number[]) ?? [];
  if (readBy.includes(userId)) {
    res.json(msg);
    return;
  }

  const [updated] = await db.update(studentMessagesTable)
    .set({ readBy: [...readBy, userId] })
    .where(eq(studentMessagesTable.id, msgId))
    .returning();
  res.json(updated);
});

export default router;
