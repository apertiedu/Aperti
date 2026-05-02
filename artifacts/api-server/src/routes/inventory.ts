import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { requireTenantAccess } from "../middleware/tenant";

const router: IRouter = Router();

function getTeacherId(req: any): number {
  return req.tenant.teacherId ?? req.tenant.accountId;
}

// Summary stats
router.get("/inventory/summary", requireTenantAccess, async (req, res): Promise<void> => {
  const teacherId = getTeacherId(req);
  const { rows } = await pool.query(`
    SELECT
      COUNT(*)::int AS total_items,
      COALESCE(SUM(stock_count * price), 0)::numeric AS total_stock_value,
      COUNT(CASE WHEN stock_count <= low_stock_threshold AND stock_count > 0 THEN 1 END)::int AS low_stock_count,
      COUNT(CASE WHEN stock_count = 0 THEN 1 END)::int AS out_of_stock_count
    FROM inventory_items WHERE teacher_account_id=$1 AND is_active=true
  `, [teacherId]);
  const { rows: rev } = await pool.query(`
    SELECT
      COALESCE(SUM(total_price), 0)::numeric AS total_revenue,
      COALESCE(SUM(CASE WHEN payment_status='paid' THEN total_price ELSE 0 END), 0)::numeric AS paid_revenue,
      COALESCE(SUM(CASE WHEN payment_status='unpaid' THEN total_price ELSE 0 END), 0)::numeric AS unpaid_revenue,
      COUNT(*)::int AS total_sales
    FROM inventory_sales WHERE teacher_account_id=$1
  `, [teacherId]);
  res.json({ ...rows[0], ...rev[0] });
});

// List items
router.get("/inventory", requireTenantAccess, async (req, res): Promise<void> => {
  const teacherId = getTeacherId(req);
  const { rows } = await pool.query(`
    SELECT i.*,
      COALESCE((SELECT SUM(s.quantity) FROM inventory_sales s WHERE s.item_id=i.id), 0)::int AS total_sold,
      COALESCE((SELECT SUM(s.total_price) FROM inventory_sales s WHERE s.item_id=i.id AND s.payment_status='paid'), 0)::numeric AS revenue
    FROM inventory_items i
    WHERE i.teacher_account_id=$1 AND i.is_active=true
    ORDER BY i.created_at DESC
  `, [teacherId]);
  res.json(rows);
});

// Create item
router.post("/inventory", requireTenantAccess, async (req, res): Promise<void> => {
  const teacherId = getTeacherId(req);
  const { name, itemType, description, price, stockCount, lowStockThreshold } = req.body;
  if (!name) { res.status(400).json({ message: "name required" }); return; }
  const { rows } = await pool.query(`
    INSERT INTO inventory_items (teacher_account_id, name, item_type, description, price, stock_count, low_stock_threshold)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
  `, [teacherId, name.trim(), itemType || "book", description?.trim() || null,
      parseFloat(price || "0"), parseInt(stockCount || "0", 10), parseInt(lowStockThreshold || "5", 10)]);
  res.status(201).json(rows[0]);
});

// Update item
router.patch("/inventory/:id", requireTenantAccess, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const teacherId = getTeacherId(req);
  const { name, itemType, description, price, stockCount, lowStockThreshold } = req.body;
  const sets: string[] = []; const params: unknown[] = []; let i = 1;
  if (name) { sets.push(`name=$${i++}`); params.push(name.trim()); }
  if (itemType) { sets.push(`item_type=$${i++}`); params.push(itemType); }
  if ("description" in req.body) { sets.push(`description=$${i++}`); params.push(description?.trim() || null); }
  if (price !== undefined) { sets.push(`price=$${i++}`); params.push(parseFloat(price)); }
  if (stockCount !== undefined) { sets.push(`stock_count=$${i++}`); params.push(parseInt(stockCount, 10)); }
  if (lowStockThreshold !== undefined) { sets.push(`low_stock_threshold=$${i++}`); params.push(parseInt(lowStockThreshold, 10)); }
  if (!sets.length) { res.status(400).json({ message: "Nothing to update" }); return; }
  params.push(id, teacherId);
  const { rows } = await pool.query(
    `UPDATE inventory_items SET ${sets.join(",")} WHERE id=$${i} AND teacher_account_id=$${i+1} RETURNING *`, params
  );
  if (!rows[0]) { res.status(404).json({ message: "Not found" }); return; }
  res.json(rows[0]);
});

// Soft delete item
router.delete("/inventory/:id", requireTenantAccess, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const teacherId = getTeacherId(req);
  await pool.query(`UPDATE inventory_items SET is_active=false WHERE id=$1 AND teacher_account_id=$2`, [id, teacherId]);
  res.json({ message: "Deleted" });
});

// List sales
router.get("/inventory/sales", requireTenantAccess, async (req, res): Promise<void> => {
  const teacherId = getTeacherId(req);
  const limit = parseInt((req.query.limit as string) || "50", 10);
  const { rows } = await pool.query(`
    SELECT s.*, i.name AS item_name, i.item_type,
           st.student_name, st.student_code
    FROM inventory_sales s
    JOIN inventory_items i ON i.id=s.item_id
    LEFT JOIN students st ON st.id=s.student_id
    WHERE s.teacher_account_id=$1
    ORDER BY s.sold_at DESC LIMIT $2
  `, [teacherId, limit]);
  res.json(rows);
});

// Record a sale
router.post("/inventory/sales", requireTenantAccess, async (req, res): Promise<void> => {
  const teacherId = getTeacherId(req);
  const { itemId, studentId, quantity, paymentStatus, notes } = req.body;
  if (!itemId || !quantity) { res.status(400).json({ message: "itemId and quantity required" }); return; }

  const { rows: itemRows } = await pool.query(
    `SELECT * FROM inventory_items WHERE id=$1 AND teacher_account_id=$2 AND is_active=true`, [itemId, teacherId]
  );
  if (!itemRows[0]) { res.status(404).json({ message: "Item not found" }); return; }
  const item = itemRows[0];

  const qty = parseInt(quantity, 10);
  if (qty < 1) { res.status(400).json({ message: "Quantity must be at least 1" }); return; }
  if (item.stock_count < qty) { res.status(400).json({ message: `Only ${item.stock_count} in stock` }); return; }

  const unitPrice = parseFloat(item.price);
  const totalPrice = unitPrice * qty;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(`
      INSERT INTO inventory_sales (item_id, student_id, teacher_account_id, quantity, unit_price, total_price, payment_status, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [itemId, studentId || null, teacherId, qty, unitPrice, totalPrice, paymentStatus || "paid", notes?.trim() || null]);
    await client.query(
      `UPDATE inventory_items SET stock_count = stock_count - $1 WHERE id=$2`, [qty, itemId]
    );
    await client.query("COMMIT");
    res.status(201).json({ sale: rows[0], newStock: item.stock_count - qty });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).json({ message: "Sale failed" });
  } finally { client.release(); }
});

// Restock item
router.post("/inventory/:id/restock", requireTenantAccess, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const teacherId = getTeacherId(req);
  const { quantity } = req.body;
  if (!quantity || quantity < 1) { res.status(400).json({ message: "quantity required" }); return; }
  const { rows } = await pool.query(
    `UPDATE inventory_items SET stock_count = stock_count + $1 WHERE id=$2 AND teacher_account_id=$3 RETURNING *`,
    [parseInt(quantity, 10), id, teacherId]
  );
  if (!rows[0]) { res.status(404).json({ message: "Not found" }); return; }
  res.json(rows[0]);
});

export default router;
