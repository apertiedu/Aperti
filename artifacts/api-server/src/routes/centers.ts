import { Router, type IRouter } from "express";
import { requireTenantAccess } from "../middleware/tenant";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.get("/public/centers", async (req, res): Promise<void> => {
  const { teacherId } = req.query as Record<string, string>;
  const cond = teacherId ? `AND c.teacher_account_id=$1` : "";
  const params = teacherId ? [parseInt(teacherId, 10)] : [];
  const { rows } = await pool.query(`
    SELECT c.*, a.display_name AS teacher_name
    FROM centers c JOIN accounts a ON a.id=c.teacher_account_id
    WHERE c.is_active=TRUE ${cond} ORDER BY c.name
  `, params);
  res.json(rows);
});

router.get("/centers", requireTenantAccess, async (req, res): Promise<void> => {
  const { teacherId, accountId, isAdmin } = req.tenant;
  const effectiveId = isAdmin ? null : (teacherId ?? accountId);
  const { rows } = await pool.query(
    effectiveId ? `SELECT * FROM centers WHERE teacher_account_id=$1 ORDER BY name` : `SELECT * FROM centers ORDER BY name`,
    effectiveId ? [effectiveId] : []
  );
  res.json(rows);
});

router.post("/centers", requireTenantAccess, async (req, res): Promise<void> => {
  const { teacherId, accountId, isAdmin } = req.tenant;
  const effectiveId = isAdmin ? accountId : (teacherId ?? accountId);
  const { name, location, capacity } = req.body;
  if (!name?.trim()) { res.status(400).json({ message: "Name is required" }); return; }
  const { rows } = await pool.query(
    `INSERT INTO centers (teacher_account_id, name, location, capacity) VALUES ($1,$2,$3,$4) RETURNING *`,
    [effectiveId, name.trim(), location?.trim() || null, capacity || null]
  );
  res.status(201).json(rows[0]);
});

router.patch("/centers/:id", requireTenantAccess, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { teacherId, isAdmin } = req.tenant;
  const { name, location, capacity, isActive } = req.body;
  const sets: string[] = []; const params: unknown[] = []; let i = 1;
  if (name) { sets.push(`name=$${i++}`); params.push(name.trim()); }
  if ("location" in req.body) { sets.push(`location=$${i++}`); params.push(location?.trim() || null); }
  if ("capacity" in req.body) { sets.push(`capacity=$${i++}`); params.push(capacity || null); }
  if ("isActive" in req.body) { sets.push(`is_active=$${i++}`); params.push(!!isActive); }
  if (!sets.length) { res.status(400).json({ message: "Nothing to update" }); return; }
  const tenantCond = isAdmin ? "" : ` AND teacher_account_id=${teacherId}`;
  params.push(id);
  const { rows } = await pool.query(`UPDATE centers SET ${sets.join(",")} WHERE id=$${i}${tenantCond} RETURNING *`, params);
  if (!rows[0]) { res.status(404).json({ message: "Center not found" }); return; }
  res.json(rows[0]);
});

router.delete("/centers/:id", requireTenantAccess, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { teacherId, isAdmin } = req.tenant;
  const tenantCond = isAdmin ? "" : ` AND teacher_account_id=${teacherId}`;
  await pool.query(`DELETE FROM centers WHERE id=$1${tenantCond}`, [id]);
  res.json({ message: "Deleted" });
});

export default router;
