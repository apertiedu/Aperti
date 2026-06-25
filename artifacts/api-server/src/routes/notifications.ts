import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { requireTenantAccess } from "../middleware/tenant";
import { authenticate, type AuthRequest } from "../middleware/auth";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.get("/notifications", requireTenantAccess, async (req, res): Promise<void> => {
  try {
    const { accountId } = req.tenant;
    const rows = await db.select().from(notificationsTable)
      .where(eq(notificationsTable.accountId, accountId))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to load notifications" });
  }
});

router.get("/notifications/unread-count", requireTenantAccess, async (req, res): Promise<void> => {
  try {
    const { accountId } = req.tenant;
    const [result] = await db.select({ count: sql<number>`count(*)::int` })
      .from(notificationsTable)
      .where(and(eq(notificationsTable.accountId, accountId), eq(notificationsTable.isRead, false)));
    res.json({ count: result?.count ?? 0 });
  } catch (err) {
    res.status(500).json({ error: "Failed to get unread count" });
  }
});

router.post("/notifications/read-all", requireTenantAccess, async (req, res): Promise<void> => {
  try {
    const { accountId } = req.tenant;
    await db.update(notificationsTable)
      .set({ isRead: true })
      .where(eq(notificationsTable.accountId, accountId));
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    res.status(500).json({ error: "Failed to mark notifications as read" });
  }
});

router.patch("/notifications/:id/read", requireTenantAccess, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { accountId } = req.tenant;
    await db.update(notificationsTable)
      .set({ isRead: true })
      .where(and(eq(notificationsTable.id, id), eq(notificationsTable.accountId, accountId)));
    res.json({ message: "Marked as read" });
  } catch (err) {
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

router.delete("/notifications/:id", requireTenantAccess, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { accountId } = req.tenant;
    await db.delete(notificationsTable)
      .where(and(eq(notificationsTable.id, id), eq(notificationsTable.accountId, accountId)));
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete notification" });
  }
});

/* ── Inbox endpoint — aggregated for notification center page ─────────────── */
router.get("/notifications/inbox", authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    const accountId = req.userId!;
    const { limit = "100", offset = "0" } = req.query as Record<string, string>;
    const lim = Math.min(parseInt(limit) || 100, 200);
    const off = parseInt(offset) || 0;

    function dbTypeToCategory(type: string): string {
      if (type.startsWith("enrollment")) return "enrollment";
      if (type === "submission_received" || type === "grade_approved" || type === "exam_assigned") return "submission";
      if (type === "error" || type === "warning" || type === "alert" || type === "system_notice") return "alert";
      if (type === "ticket" || type.startsWith("ticket")) return "ticket";
      if (type === "message" || type.startsWith("message")) return "message";
      return "message";
    }

    const { rows } = await pool.query(
      `SELECT id, title, message, type, is_read, link, related_entity_type, related_entity_id, created_at
       FROM notifications
       WHERE account_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [accountId, lim, off],
    );

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM notifications WHERE account_id = $1`,
      [accountId],
    );

    const items = rows.map((r: any) => ({
      id: r.id,
      type: dbTypeToCategory(r.type),
      category: r.type,
      title: r.title,
      subtitle: r.message ?? undefined,
      created_at: r.created_at,
      is_read: r.is_read,
      link: r.link,
    }));

    const counts: Record<string, number> = {};
    for (const item of items) {
      counts[item.type] = (counts[item.type] ?? 0) + 1;
    }

    res.json({ items, total: countRows[0]?.total ?? 0, counts });
  } catch {
    res.status(500).json({ error: "Failed to load notification inbox" });
  }
});

export async function createNotification(
  accountId: number,
  title: string,
  message: string,
  type: "info" | "warning" | "success" | "error" = "info",
  link?: string
) {
  try {
    await db.insert(notificationsTable).values({ accountId, title, message, type, link });
  } catch (err) {
    /* non-fatal */
  }
}

export default router;
