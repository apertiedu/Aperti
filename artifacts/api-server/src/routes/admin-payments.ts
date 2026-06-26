import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import {
  paymentTransactionsTable, subscriptionsTable, accountsTable, revenueRecordsTable, notificationsTable,
} from "@workspace/db";
import { eq, desc, sql, and } from "drizzle-orm";
import { requireRole } from "../middleware/auth";

export const adminPaymentsRouter = Router();
adminPaymentsRouter.use(requireRole("admin", "super_admin"));

/* ── List Transactions ───────────────────────────────────────────────────── */
adminPaymentsRouter.get("/transactions", async (req: Request, res: Response) => {
  try {
    const { status, page = "1", limit = "50" } = req.query as Record<string, string>;
    const safeLimit = Math.min(Math.max(1, parseInt(limit) || 50), 200);
    const offset = (Math.max(1, parseInt(page) || 1) - 1) * safeLimit;
    const rows = await db
      .select({
        id: paymentTransactionsTable.id,
        amount: paymentTransactionsTable.amount,
        currency: paymentTransactionsTable.currency,
        method: paymentTransactionsTable.method,
        referenceNumber: paymentTransactionsTable.referenceNumber,
        screenshotUrl: paymentTransactionsTable.screenshotUrl,
        status: paymentTransactionsTable.status,
        notes: paymentTransactionsTable.notes,
        createdAt: paymentTransactionsTable.createdAt,
        verifiedAt: paymentTransactionsTable.verifiedAt,
        userId: paymentTransactionsTable.userId,
        subscriptionId: paymentTransactionsTable.subscriptionId,
        username: accountsTable.username,
        displayName: accountsTable.displayName,
        email: accountsTable.email,
      })
      .from(paymentTransactionsTable)
      .leftJoin(accountsTable, eq(paymentTransactionsTable.userId, accountsTable.id))
      .where(status ? eq(paymentTransactionsTable.status, status) : undefined as any)
      .orderBy(desc(paymentTransactionsTable.createdAt))
      .limit(safeLimit)
      .offset(offset);
    const [cnt] = await db.select({ c: sql<number>`count(*)::int` }).from(paymentTransactionsTable);
    res.json({ transactions: rows, total: cnt.c });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

/* ── Create Transaction (for users submitting payment proof) ─────────────── */
adminPaymentsRouter.post("/transactions", async (req: Request, res: Response) => {
  try {
    const { userId, subscriptionId, amount, currency = "EGP", method, referenceNumber, screenshotUrl, notes } = req.body;
    if (!userId || !amount) return res.status(400).json({ error: "userId and amount are required" });
    if (referenceNumber) {
      const existing = await db.select({ id: paymentTransactionsTable.id })
        .from(paymentTransactionsTable)
        .where(eq(paymentTransactionsTable.referenceNumber, referenceNumber))
        .limit(1);
      if (existing.length > 0) {
        return res.status(409).json({ error: "Duplicate reference number — this payment has already been submitted" });
      }
    }
    const [tx] = await db.insert(paymentTransactionsTable).values({ userId, subscriptionId, amount, currency, method: method || "instapay", referenceNumber, screenshotUrl, status: "pending", notes }).returning();
    res.status(201).json(tx);
  } catch (err) {
    res.status(500).json({ error: "Failed to create transaction" });
  }
});

/* ── Verify Transaction ──────────────────────────────────────────────────── */
adminPaymentsRouter.post("/verify", async (req: Request, res: Response) => {
  try {
    const { transactionId, notes } = req.body;
    const adminId = (req as any).userId;
    const [tx] = await db.update(paymentTransactionsTable)
      .set({ status: "verified", verifiedBy: adminId, verifiedAt: new Date(), notes })
      .where(eq(paymentTransactionsTable.id, transactionId))
      .returning();
    if (!tx) return res.status(404).json({ error: "Transaction not found" });
    if (tx.subscriptionId) {
      await db.update(subscriptionsTable).set({ status: "active", paymentStatus: "approved" }).where(eq(subscriptionsTable.id, tx.subscriptionId));
    }
    await db.insert(revenueRecordsTable).values({ date: new Date().toISOString().split("T")[0], source: "subscription", amount: tx.amount, currency: tx.currency, teacherId: tx.userId }).catch(() => {});
    res.json(tx);
  } catch (err) {
    res.status(500).json({ error: "Failed to verify transaction" });
  }
});

/* ── Reject Transaction ──────────────────────────────────────────────────── */
adminPaymentsRouter.post("/reject", async (req: Request, res: Response) => {
  try {
    const { transactionId, notes } = req.body;
    const adminId = (req as any).userId;
    if (!notes?.trim()) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }
    const [tx] = await db.update(paymentTransactionsTable)
      .set({ status: "rejected", verifiedBy: adminId, verifiedAt: new Date(), notes })
      .where(eq(paymentTransactionsTable.id, transactionId))
      .returning();
    if (!tx) return res.status(404).json({ error: "Transaction not found" });

    if (tx.subscriptionId) {
      await db.update(subscriptionsTable)
        .set({ status: "pending_review", paymentStatus: "failed" })
        .where(eq(subscriptionsTable.id, tx.subscriptionId))
        .catch(() => {});
    }

    if (tx.userId) {
      await db.insert(notificationsTable as any).values({
        accountId: tx.userId,
        type: "payment_rejected",
        title: "Payment Rejected",
        message: `Your InstaPay payment was rejected. Reason: ${notes.trim()}. Please resubmit with a valid transaction reference.`,
        isRead: false,
        link: "/checkout",
      }).catch(() => {});
    }

    res.json(tx);
  } catch (err) {
    res.status(500).json({ error: "Failed to reject transaction" });
  }
});

/* ── Revenue Report ──────────────────────────────────────────────────────── */
adminPaymentsRouter.get("/report", async (_req, res) => {
  try {
    const [totalRev, monthly, txCount] = await Promise.all([
      db.select({ total: sql<string>`coalesce(sum(amount),0)::text` }).from(revenueRecordsTable),
      db.select({ month: sql<string>`date_trunc('month', created_at::timestamptz)::text`, total: sql<string>`sum(amount)::text` }).from(revenueRecordsTable).groupBy(sql`date_trunc('month', created_at::timestamptz)`).orderBy(sql`date_trunc('month', created_at::timestamptz)`).limit(12),
      db.select({ c: sql<number>`count(*)::int` }).from(paymentTransactionsTable).where(eq(paymentTransactionsTable.status, "verified")),
    ]);
    const totalAmount = parseFloat(totalRev[0]?.total || "0");
    const mrr = totalAmount / Math.max(monthly.length, 1);
    const arr = mrr * 12;
    res.json({ totalRevenue: totalAmount, mrr, arr, monthly, verifiedTransactions: txCount[0].c });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate report" });
  }
});

/* ── Invoices List ───────────────────────────────────────────────────────── */
adminPaymentsRouter.get("/invoices", async (req: Request, res: Response) => {
  try {
    const { rows } = await db["$client"].query("SELECT i.*, a.username, a.display_name FROM invoices i LEFT JOIN accounts a ON a.id = i.account_id ORDER BY i.created_at DESC LIMIT 100").catch(() => ({ rows: [] }));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

/* ── Revenue Overview ────────────────────────────────────────────────────── */
adminPaymentsRouter.get("/revenue/overview", async (_req, res) => {
  try {
    const [total, bySource] = await Promise.all([
      db.select({ total: sql<string>`coalesce(sum(amount),0)::text` }).from(revenueRecordsTable),
      db.select({ source: revenueRecordsTable.source, total: sql<string>`sum(amount)::text` }).from(revenueRecordsTable).groupBy(revenueRecordsTable.source),
    ]);
    const totalAmount = parseFloat(total[0]?.total || "0");
    res.json({ totalRevenue: totalAmount, mrr: totalAmount / 12, arr: totalAmount, bySource });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch overview" });
  }
});
