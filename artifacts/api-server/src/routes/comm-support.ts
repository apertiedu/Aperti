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
  } catch (e: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
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
  } catch (e: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
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
  } catch (e: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
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
  } catch (e: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
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
  } catch (e: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
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
  } catch (e: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
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
  } catch (e: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

// ════════════════════════════════════════════════════════════════════════════
// COMMUNICATION ANALYTICS
// ════════════════════════════════════════════════════════════════════════════

// ── GET /api/analytics/communication ────────────────────────────────────────
commSupportRouter.get("/analytics/communication", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const interval = `${days} days`;

    const { rows: [summary] } = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM message_threads_ext WHERE created_at > NOW() - $1::interval) AS total_threads,
        (SELECT COUNT(*) FROM thread_messages WHERE created_at > NOW() - $1::interval) AS total_messages,
        (SELECT COUNT(*) FROM announcements WHERE created_at > NOW() - $1::interval) AS total_announcements,
        (SELECT COUNT(*) FROM support_tickets) AS total_tickets,
        (SELECT COUNT(*) FROM support_tickets WHERE status = 'open') AS open_tickets,
        (SELECT COUNT(*) FROM support_tickets WHERE status = 'resolved') AS resolved_tickets,
        (SELECT COUNT(*) FROM collaboration_rooms WHERE created_at > NOW() - $1::interval) AS active_rooms,
        (SELECT COUNT(*) FROM class_channels) AS total_channels`,
      [interval],
    );

    const { rows: top_messagers } = await pool.query(
      `SELECT a.display_name AS name, a.role,
        COUNT(tm.id) AS message_count
       FROM thread_messages tm
       JOIN accounts a ON a.id = tm.sender_id
       WHERE tm.created_at > NOW() - $1::interval
       GROUP BY a.id, a.display_name, a.role
       ORDER BY message_count DESC LIMIT 10`,
      [interval],
    );

    const { rows: ticket_stats } = await pool.query(
      `SELECT status, COUNT(*) AS count FROM support_tickets GROUP BY status ORDER BY count DESC`,
    );

    const { rows: daily_activity } = await pool.query(
      `SELECT DATE(created_at) AS day, COUNT(*) AS count
       FROM thread_messages
       WHERE created_at > NOW() - $1::interval
       GROUP BY DATE(created_at)
       ORDER BY day ASC`,
      [interval],
    );

    const { rows: channel_activity } = await pool.query(
      `SELECT cc.name AS channel_name, c.title AS course_name,
        COUNT(cm.id) AS message_count
       FROM class_channels cc
       LEFT JOIN courses c ON c.id = cc.course_id
       LEFT JOIN channel_messages cm ON cm.channel_id = cc.id
         AND cm.created_at > NOW() - $1::interval
       GROUP BY cc.id, cc.name, c.title
       ORDER BY message_count DESC LIMIT 10`,
      [interval],
    );

    res.json({ summary, top_messagers, ticket_stats, daily_activity, channel_activity });
  } catch (e: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
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
  } catch (e: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

// ── GET /api/moderation/reports – list flagged content ──────────────────────
commSupportRouter.get("/moderation/reports", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const where = status && status !== "all" ? `WHERE ml.status = $1` : "";
    const params = status && status !== "all" ? [status] : [];
    const { rows } = await pool.query(
      `SELECT ml.*, a.display_name AS reported_by_name, a2.display_name AS resolver_name
       FROM moderation_logs ml
       JOIN accounts a ON a.id = ml.reported_by
       LEFT JOIN accounts a2 ON a2.id = ml.resolved_by
       ${where}
       ORDER BY ml.created_at DESC`,
      params,
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
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
  } catch (e: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

// ── GET /api/moderation/stats ─────────────────────────────────────────────
commSupportRouter.get("/moderation/stats", authenticate, requireRole("teacher", "admin"), async (_req: AuthRequest, res: Response) => {
  try {
    const { rows: [totals] } = await pool.query(
      `SELECT
        COUNT(*) AS total_reports,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved,
        COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) FILTER (WHERE status = 'resolved'), 0) AS avg_response_hours
       FROM moderation_logs`,
    );
    const { rows: by_type } = await pool.query(
      `SELECT content_type, COUNT(*) AS count FROM moderation_logs GROUP BY content_type ORDER BY count DESC`,
    );
    res.json({ ...totals, by_type });
  } catch (e: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

// ── GET /api/moderation/blocklist ─────────────────────────────────────────
commSupportRouter.get("/moderation/blocklist", authenticate, requireRole("teacher", "admin"), async (_req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM blocked_words ORDER BY severity DESC, word ASC`);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

// ── POST /api/moderation/blocklist ────────────────────────────────────────
commSupportRouter.post("/moderation/blocklist", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { word, severity = "medium" } = req.body;
    if (!word?.trim()) return res.status(400).json({ error: "word required" });
    const { rows: [w] } = await pool.query(
      `INSERT INTO blocked_words (word, severity, created_by) VALUES ($1, $2, $3) ON CONFLICT (word) DO UPDATE SET severity = EXCLUDED.severity RETURNING *`,
      [word.trim().toLowerCase(), severity, req.userId],
    );
    res.status(201).json(w);
  } catch (e: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

// ── DELETE /api/moderation/blocklist/:id ──────────────────────────────────
commSupportRouter.delete("/moderation/blocklist/:id", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(`DELETE FROM blocked_words WHERE id = $1`, [req.params.id]);
    res.json({ deleted: true });
  } catch (e: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

// ── PUT /api/tickets/:id – assign/update ticket (admin/teacher) ───────────
commSupportRouter.put("/tickets/:id/assign", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { assigned_to } = req.body;
    const [ticket] = await db.update(supportTicketsTable).set({
      assignedTo: assigned_to ? Number(assigned_to) : null,
      status: assigned_to ? "assigned" : "open",
      updatedAt: new Date(),
    }).where(eq(supportTicketsTable.id, id)).returning();
    res.json(ticket);
  } catch (e: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});
