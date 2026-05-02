import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { requireTenantAccess } from "../middleware/tenant";

const router: IRouter = Router();

router.get("/notifications", requireTenantAccess, async (req, res): Promise<void> => {
  const { accountId } = req.tenant;
  const rows = await db.select().from(notificationsTable)
    .where(eq(notificationsTable.accountId, accountId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);
  res.json(rows);
});

router.get("/notifications/unread-count", requireTenantAccess, async (req, res): Promise<void> => {
  const { accountId } = req.tenant;
  const { sql } = await import("drizzle-orm");
  const [result] = await db.select({ count: sql<number>`count(*)::int` })
    .from(notificationsTable)
    .where(and(eq(notificationsTable.accountId, accountId), eq(notificationsTable.isRead, false)));
  res.json({ count: result?.count ?? 0 });
});

router.post("/notifications/read-all", requireTenantAccess, async (req, res): Promise<void> => {
  const { accountId } = req.tenant;
  await db.update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.accountId, accountId));
  res.json({ message: "All notifications marked as read" });
});

router.patch("/notifications/:id/read", requireTenantAccess, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { accountId } = req.tenant;
  await db.update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.accountId, accountId)));
  res.json({ message: "Marked as read" });
});

router.delete("/notifications/:id", requireTenantAccess, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { accountId } = req.tenant;
  await db.delete(notificationsTable)
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.accountId, accountId)));
  res.json({ message: "Deleted" });
});

// Internal helper for creating notifications (used by other routes)
export async function createNotification(
  accountId: number,
  title: string,
  message: string,
  type: "info" | "warning" | "success" | "error" = "info",
  link?: string
) {
  await db.insert(notificationsTable).values({ accountId, title, message, type, link });
}

export default router;
