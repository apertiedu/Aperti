import { Router, Response } from "express";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { db, pool } from "@workspace/db";
import {
  supportTicketsTable,
  ticketResponsesTable,
  notificationPreferencesTable,
  moderationLogsTable,
} from "@workspace/db";
import { eq, and, desc, or } from "drizzle-orm";
import { AI_CONFIG } from "../lib/ai-config";

export const commSupportRouter = Router();

const FAQS: Record<string, string[]> = {
  technical: ["Try clearing your browser cache.", "Check your internet connection.", "Use a supported browser (Chrome/Firefox)."],
  academic: ["Reach out to your teacher directly.", "Check the course resources section.", "Review lesson content in Study Stream."],
  payment: ["Ensure your payment method is up to date.", "Contact admin for invoice queries.", "Check your subscription status in settings."],
  account: ["Use 'Forgot Password' to reset credentials.", "Contact admin to update your profile.", "Ensure your email is verified."],
  exam: ["Check the exam schedule in My Timetable.", "Contact your teacher for extension requests.", "Review exam rules in Exam Room."],
};

async function getAISuggestions(type: string, description: string): Promise<string[]> {
  const base = FAQS[type] ?? FAQS.technical;
  const key = process.env.OPENAI_API_KEY;
  if (!key) return base;
  try {
    const r = await fetch(`${AI_CONFIG.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: AI_CONFIG.model,
        max_tokens: 300,
        messages: [
          { role: "system", content: "You are a helpful support assistant. Given a ticket, suggest 3 concise self-help tips. Return a JSON array of strings." },
          { role: "user", content: `Type: ${type}\n${description}` },
        ],
      }),
    });
    const d = await r.json() as any;
    const text = d.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(text.match(/\[.*\]/s)?.[0] ?? "[]");
    return Array.isArray(parsed) ? parsed : base;
  } catch {
    return base;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// SUPPORT TICKETS
// ════════════════════════════════════════════════════════════════════════════

// ── POST /api/tickets – create ticket ───────────────────────────────────────
commSupportRouter.post("/tickets", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { subject, description, type, priority } = req.body;
    if (!subject || !description) return res.status(400).json({ error: "subject and description required" });

    const suggestions = await getAISuggestions(type || "technical", description);

    const [ticket] = await db.insert(supportTicketsTable).values({
      userId: req.userId!, subject, description,
      type: type || "technical",
      priority: priority || "normal",
      aiSuggestions: suggestions,
    }).returning();

    res.status(201).json(ticket);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/tickets – list tickets ─────────────────────────────────────────
commSupportRouter.get("/tickets", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.userId!;
    const role = req.role;

    let query = `
      SELECT t.*, u.display_name AS user_name, u.role AS user_role,
        a.display_name AS assigned_name,
        (SELECT COUNT(*) FROM ticket_responses tr WHERE tr.ticket_id = t.id) AS response_count
      FROM support_tickets t
      JOIN accounts u ON u.id = t.user_id
      LEFT JOIN accounts a ON a.id = t.assigned_to
    `;
    const params: unknown[] = [];
    if (role !== "admin" && role !== "teacher") {
      params.push(uid);
      query += ` WHERE t.user_id = $1`;
    }
    query += ` ORDER BY t.created_at DESC`;

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/tickets/:id – ticket detail ────────────────────────────────────
commSupportRouter.get("/tickets/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { rows: tickets } = await pool.query(
      `SELECT t.*, u.display_name AS user_name, a.display_name AS assigned_name FROM support_tickets t JOIN accounts u ON u.id = t.user_id LEFT JOIN accounts a ON a.id = t.assigned_to WHERE t.id = $1`,
      [id],
    );
    if (!tickets.length) return res.status(404).json({ error: "Ticket not found" });

    const { rows: responses } = await pool.query(
      `SELECT tr.*, a.display_name AS responder_name, a.role AS responder_role FROM ticket_responses tr JOIN accounts a ON a.id = tr.responder_id WHERE tr.ticket_id = $1 ORDER BY tr.created_at ASC`,
      [id],
    );
    res.json({ ticket: tickets[0], responses });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/tickets/:id – update ticket ────────────────────────────────────
commSupportRouter.put("/tickets/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { status, assigned_to, priority, message } = req.body;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (status) updates.status = status;
    if (assigned_to) updates.assignedTo = Number(assigned_to);
    if (priority) updates.priority = priority;

    const [ticket] = await db.update(supportTicketsTable).set(updates as any)
      .where(eq(supportTicketsTable.id, id)).returning();

    if (message) {
      await db.insert(ticketResponsesTable).values({
        ticketId: id, responderId: req.userId!, message,
      });
    }

    res.json(ticket);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/tickets/:id/respond ───────────────────────────────────────────
commSupportRouter.post("/tickets/:id/respond", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const ticketId = parseInt(req.params.id);
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "message required" });

    const [response] = await db.insert(ticketResponsesTable).values({
      ticketId, responderId: req.userId!, message,
    }).returning();

    if (req.role === "admin" || req.role === "teacher") {
      await db.update(supportTicketsTable).set({ status: "in_progress", updatedAt: new Date() })
        .where(eq(supportTicketsTable.id, ticketId));
    }

    res.status(201).json(response);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
// NOTIFICATION PREFERENCES
// ════════════════════════════════════════════════════════════════════════════

const DEFAULT_PREFS = [
  { category: "messages", deliveryMethod: "in_app", enabled: true, frequency: "instant" },
  { category: "announcements", deliveryMethod: "in_app", enabled: true, frequency: "instant" },
  { category: "grades", deliveryMethod: "in_app", enabled: true, frequency: "instant" },
  { category: "attendance", deliveryMethod: "in_app", enabled: true, frequency: "daily" },
  { category: "system", deliveryMethod: "in_app", enabled: true, frequency: "instant" },
];

// ── GET /api/notifications/preferences ──────────────────────────────────────
commSupportRouter.get("/notifications/preferences", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.userId!;
    let prefs = await db.select().from(notificationPreferencesTable)
      .where(eq(notificationPreferencesTable.userId, uid));

    if (prefs.length === 0) {
      const inserted = await db.insert(notificationPreferencesTable)
        .values(DEFAULT_PREFS.map((p) => ({ ...p, userId: uid }))).returning();
      prefs = inserted;
    }
    res.json(prefs);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/notifications/preferences – update prefs ───────────────────────
commSupportRouter.put("/notifications/preferences", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.userId!;
    const { preferences } = req.body; // array of { category, delivery_method, enabled, frequency }
    if (!Array.isArray(preferences)) return res.status(400).json({ error: "preferences array required" });

    const results = [];
    for (const p of preferences) {
      const existing = await db.query.notificationPreferencesTable.findFirst({
        where: and(eq(notificationPreferencesTable.userId, uid), eq(notificationPreferencesTable.category, p.category)),
      });
      if (existing) {
        const [upd] = await db.update(notificationPreferencesTable).set({
          deliveryMethod: p.delivery_method ?? existing.deliveryMethod,
          enabled: p.enabled ?? existing.enabled,
          frequency: p.frequency ?? existing.frequency,
        }).where(eq(notificationPreferencesTable.id, existing.id)).returning();
        results.push(upd);
      } else {
        const [ins] = await db.insert(notificationPreferencesTable).values({
          userId: uid, category: p.category,
          deliveryMethod: p.delivery_method || "in_app",
          enabled: p.enabled !== false, frequency: p.frequency || "instant",
        }).returning();
        results.push(ins);
      }
    }
    res.json(results);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
// COMMUNICATION ANALYTICS
// ════════════════════════════════════════════════════════════════════════════

// ── GET /api/analytics/communication ────────────────────────────────────────
commSupportRouter.get("/analytics/communication", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { rows: threadStats } = await pool.query(
      `SELECT COUNT(*) AS total_threads,
        SUM(CASE WHEN type='direct' THEN 1 ELSE 0 END) AS direct_threads,
        SUM(CASE WHEN type='class' THEN 1 ELSE 0 END) AS class_threads,
        SUM(CASE WHEN type='parent' THEN 1 ELSE 0 END) AS parent_threads
       FROM message_threads_ext WHERE created_at > NOW() - INTERVAL '30 days'`,
    );
    const { rows: msgStats } = await pool.query(
      `SELECT COUNT(*) AS total_messages,
        SUM(CASE WHEN is_read = false THEN 1 ELSE 0 END) AS unread_count,
        ROUND(AVG(EXTRACT(EPOCH FROM (CASE WHEN is_read THEN created_at ELSE NULL END)))) AS avg_read_seconds
       FROM thread_messages WHERE created_at > NOW() - INTERVAL '30 days'`,
    );
    const { rows: roomStats } = await pool.query(
      `SELECT COUNT(*) AS total_rooms, COUNT(DISTINCT user_id) AS active_members FROM collaboration_rooms r JOIN room_members rm ON rm.room_id = r.id WHERE r.created_at > NOW() - INTERVAL '30 days'`,
    );
    const { rows: ticketStats } = await pool.query(
      `SELECT status, COUNT(*) AS count FROM support_tickets WHERE created_at > NOW() - INTERVAL '30 days' GROUP BY status`,
    );
    const { rows: announcementStats } = await pool.query(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) AS delivered FROM announcements WHERE created_at > NOW() - INTERVAL '30 days'`,
    );
    const { rows: inactiveStudents } = await pool.query(
      `SELECT a.display_name, MAX(tm.created_at) AS last_active
       FROM accounts a LEFT JOIN thread_messages tm ON tm.sender_id = a.id
       WHERE a.role = 'student'
       GROUP BY a.id, a.display_name
       HAVING MAX(tm.created_at) < NOW() - INTERVAL '5 days' OR MAX(tm.created_at) IS NULL
       LIMIT 10`,
    );

    res.json({
      threads: threadStats[0],
      messages: msgStats[0],
      rooms: roomStats[0],
      tickets: ticketStats,
      announcements: announcementStats[0],
      insights: {
        inactiveStudents,
        period: "Last 30 days",
      },
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
// SAFETY & MODERATION
// ════════════════════════════════════════════════════════════════════════════

// ── POST /api/moderation/flag – report content ──────────────────────────────
commSupportRouter.post("/moderation/flag", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { content_type, content_id, reason } = req.body;
    if (!content_type || !content_id || !reason) return res.status(400).json({ error: "content_type, content_id and reason required" });

    const [log] = await db.insert(moderationLogsTable).values({
      reportedBy: req.userId!, contentType: content_type, contentId: Number(content_id), reason,
    }).returning();
    res.status(201).json(log);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/moderation/reports – list flagged content ──────────────────────
commSupportRouter.get("/moderation/reports", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT ml.*, a.display_name AS reporter_name, a2.display_name AS resolver_name
       FROM moderation_logs ml
       JOIN accounts a ON a.id = ml.reported_by
       LEFT JOIN accounts a2 ON a2.id = ml.resolved_by
       ORDER BY ml.created_at DESC`,
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/moderation/reports/:id – take action ───────────────────────────
commSupportRouter.put("/moderation/reports/:id", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { action, status } = req.body;

    const [updated] = await db.update(moderationLogsTable).set({
      action: action || null,
      status: status || "reviewed",
      resolvedBy: req.userId!,
    }).where(eq(moderationLogsTable.id, id)).returning();
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
