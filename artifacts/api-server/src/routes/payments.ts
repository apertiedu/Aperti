import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, invoicesTable, studentsTable } from "@workspace/db";
import { requireTenantAccess } from "../middleware/tenant";

const router: IRouter = Router();

router.get("/invoices", requireTenantAccess, async (req, res): Promise<void> => {
  try {
    const { teacherId, isAdmin } = req.tenant;
    const filter = !isAdmin && teacherId ? eq(invoicesTable.teacherAccountId, teacherId) : sql`1=1`;

    const rows = await db.select({
      id: invoicesTable.id,
      title: invoicesTable.title,
      description: invoicesTable.description,
      amount: invoicesTable.amount,
      currency: invoicesTable.currency,
      status: invoicesTable.status,
      dueDate: invoicesTable.dueDate,
      paidAt: invoicesTable.paidAt,
      paymentProof: invoicesTable.paymentProof,
      notes: invoicesTable.notes,
      createdAt: invoicesTable.createdAt,
      studentId: invoicesTable.studentId,
      studentName: studentsTable.studentName,
      studentCode: studentsTable.studentCode,
    }).from(invoicesTable)
      .leftJoin(studentsTable, eq(invoicesTable.studentId, studentsTable.id))
      .where(filter)
      .orderBy(desc(invoicesTable.createdAt));

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to load invoices" });
  }
});

router.post("/invoices", requireTenantAccess, async (req, res): Promise<void> => {
  try {
    const { teacherId, isAdmin, accountId } = req.tenant;
    const teacherAccountId = isAdmin ? (req.body.teacherAccountId ?? accountId) : teacherId ?? accountId;
    const { title, description, amount, currency, studentId, dueDate, notes } = req.body;

    if (!title?.trim()) { res.status(400).json({ message: "Title is required" }); return; }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { res.status(400).json({ message: "Valid amount is required" }); return; }

    const [created] = await db.insert(invoicesTable).values({
      teacherAccountId,
      studentId: studentId ? parseInt(studentId, 10) : null,
      title: title.trim(),
      description: description?.trim() || null,
      amount: String(Number(amount).toFixed(2)),
      currency: currency || "USD",
      status: "pending",
      dueDate: dueDate || null,
      notes: notes?.trim() || null,
    }).returning();

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: "Failed to create invoice" });
  }
});

router.patch("/invoices/:id", requireTenantAccess, async (req, res): Promise<void> => {
  try {
    const { teacherId, isAdmin } = req.tenant;
    const id = parseInt(req.params.id as string, 10);
    const { title, description, amount, currency, status, dueDate, notes, paymentProof } = req.body;

    const [existing] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
    if (!existing) { res.status(404).json({ message: "Invoice not found" }); return; }
    if (!isAdmin && existing.teacherAccountId !== teacherId) { res.status(403).json({ message: "Access denied" }); return; }

    const updates: Record<string, any> = {};
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (amount !== undefined) updates.amount = String(Number(amount).toFixed(2));
    if (currency !== undefined) updates.currency = currency;
    if (dueDate !== undefined) updates.dueDate = dueDate || null;
    if (notes !== undefined) updates.notes = notes?.trim() || null;
    if (paymentProof !== undefined) updates.paymentProof = paymentProof?.trim() || null;
    if (status !== undefined) {
      updates.status = status;
      if (status === "paid" && !existing.paidAt) updates.paidAt = new Date();
      if (status !== "paid") updates.paidAt = null;
    }

    const [updated] = await db.update(invoicesTable).set(updates).where(eq(invoicesTable.id, id)).returning();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update invoice" });
  }
});

router.delete("/invoices/:id", requireTenantAccess, async (req, res): Promise<void> => {
  try {
    const { teacherId, isAdmin } = req.tenant;
    const id = parseInt(req.params.id as string, 10);

    const [existing] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
    if (!existing) { res.status(404).json({ message: "Invoice not found" }); return; }
    if (!isAdmin && existing.teacherAccountId !== teacherId) { res.status(403).json({ message: "Access denied" }); return; }

    await db.delete(invoicesTable).where(eq(invoicesTable.id, id));
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete invoice" });
  }
});

router.get("/invoices/stats", requireTenantAccess, async (req, res): Promise<void> => {
  try {
    const { teacherId, isAdmin } = req.tenant;
    const filter = !isAdmin && teacherId ? eq(invoicesTable.teacherAccountId, teacherId) : sql`1=1`;

    const rows = await db.select({
      status: invoicesTable.status,
      total: sql<number>`count(*)::int`,
      totalAmount: sql<string>`sum(${invoicesTable.amount})::numeric`,
    }).from(invoicesTable).where(filter).groupBy(invoicesTable.status);

    const stats = { pending: 0, paid: 0, overdue: 0, cancelled: 0, pendingAmount: 0, paidAmount: 0 };
    for (const r of rows) {
      if (r.status === "pending") { stats.pending = r.total; stats.pendingAmount = parseFloat(r.totalAmount ?? "0"); }
      if (r.status === "paid") { stats.paid = r.total; stats.paidAmount = parseFloat(r.totalAmount ?? "0"); }
      if (r.status === "overdue") stats.overdue = r.total;
      if (r.status === "cancelled") stats.cancelled = r.total;
    }
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: "Failed to load invoice stats" });
  }
});

export default router;
