import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { logError } from "../lib/log-error";
import { auditLog, getClientIp } from "../lib/financial-audit";

export const secureDiscountsRouter = Router();

secureDiscountsRouter.use(authenticate);

/* ── POST /api/secure-discounts/validate ───────────────────────────────── */
secureDiscountsRouter.post("/validate", async (req: AuthRequest, res: Response): Promise<void> => {
  const ip = getClientIp(req as unknown as { ip?: string; headers: Record<string, string | string[] | undefined> });
  try {
    const { code, context, courseId } = req.body as {
      code: string;
      context: "platform_subscription" | "course_enrollment";
      courseId?: number;
    };

    if (!code || !context) {
      res.status(400).json({ error: "code and context are required" });
      return;
    }

    const { rows } = await pool.query(
      `SELECT * FROM coupons WHERE code = UPPER(TRIM($1)) LIMIT 1`,
      [code],
    );

    if (rows.length === 0) {
      auditLog({ actorId: req.userId ?? null, actorRole: req.role ?? "user", action: "VALIDATE_DISCOUNT", targetId: code, targetType: "coupon", ip, result: "blocked", metadata: { reason: "NOT_FOUND" } });
      res.status(404).json({ error: "Invalid discount code" });
      return;
    }

    const coupon = rows[0];

    if (!coupon.is_active) {
      res.status(400).json({ error: "This discount code is no longer active" });
      return;
    }
    if (coupon.expiry_date && new Date(coupon.expiry_date) < new Date()) {
      res.status(400).json({ error: "This discount code has expired" });
      return;
    }
    if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
      res.status(400).json({ error: "This discount code has reached its usage limit" });
      return;
    }

    if (coupon.scope !== context) {
      auditLog({ actorId: req.userId ?? null, actorRole: req.role ?? "user", action: "VALIDATE_DISCOUNT_SCOPE_MISMATCH", targetId: coupon.id, targetType: "coupon", ip, result: "blocked", metadata: { couponScope: coupon.scope, requestedContext: context } });
      res.status(403).json({ error: "This discount code cannot be used for this purchase type" });
      return;
    }

    if (coupon.scope === "teacher_courses") {
      if (!courseId) {
        res.status(400).json({ error: "courseId is required for teacher discount codes" });
        return;
      }
      const courseIds: number[] = Array.isArray(coupon.course_ids) ? coupon.course_ids : (JSON.parse(coupon.course_ids ?? "[]") as number[]);
      if (!courseIds.includes(courseId)) {
        auditLog({ actorId: req.userId ?? null, actorRole: req.role ?? "user", action: "VALIDATE_DISCOUNT_COURSE_MISMATCH", targetId: coupon.id, targetType: "coupon", ip, result: "blocked", metadata: { courseId } });
        res.status(403).json({ error: "This discount code is not valid for this course" });
        return;
      }
    }

    auditLog({ actorId: req.userId ?? null, actorRole: req.role ?? "user", action: "VALIDATE_DISCOUNT", targetId: coupon.id, targetType: "coupon", ip, result: "success" });

    res.json({
      id: coupon.id,
      code: coupon.code,
      scope: coupon.scope,
      discountType: coupon.discount_type,
      discountPercent: coupon.discount_type === "percentage" ? parseFloat(coupon.discount_percent) : null,
      discountFixed: coupon.discount_type === "fixed" ? parseFloat(coupon.discount_percent) : null,
      expiryDate: coupon.expiry_date,
    });
  } catch (err) {
    await logError(err, { route: "/api/secure-discounts/validate" });
    res.status(500).json({ error: "Failed to validate discount code" });
  }
});

/* ── GET /api/secure-discounts ─────────────────────────────────────────── */
secureDiscountsRouter.get("/", requireRole("admin", "super_admin", "teacher"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isAdmin = req.role === "admin" || req.role === "super_admin";
    const { rows } = await pool.query(
      isAdmin
        ? `SELECT c.*, a.display_name AS creator_name
           FROM coupons c LEFT JOIN accounts a ON a.id = c.created_by
           ORDER BY c.created_at DESC`
        : `SELECT c.*, a.display_name AS creator_name
           FROM coupons c LEFT JOIN accounts a ON a.id = c.created_by
           WHERE c.scope = 'teacher_courses' AND c.teacher_id = $1
           ORDER BY c.created_at DESC`,
      isAdmin ? [] : [req.userId],
    );
    res.json({ coupons: rows });
  } catch (err) {
    await logError(err, { route: "/api/secure-discounts" });
    res.status(500).json({ error: "Failed to fetch discount codes" });
  }
});

/* ── POST /api/secure-discounts ────────────────────────────────────────── */
secureDiscountsRouter.post("/", requireRole("admin", "super_admin", "teacher"), async (req: AuthRequest, res: Response): Promise<void> => {
  const ip = getClientIp(req as unknown as { ip?: string; headers: Record<string, string | string[] | undefined> });
  try {
    const { code, discountType = "percentage", value, maxUses, expiryDate, scope, courseIds } =
      req.body as {
        code: string;
        discountType: "percentage" | "fixed";
        value: number;
        maxUses?: number;
        expiryDate?: string;
        scope?: string;
        courseIds?: number[];
      };

    if (!code || !value) {
      res.status(400).json({ error: "code and value are required" });
      return;
    }

    const isAdmin = req.role === "admin" || req.role === "super_admin";
    const isTeacher = req.role === "teacher";

    if (isAdmin && scope === "teacher_courses") {
      res.status(400).json({ error: "Admins create platform-scoped discounts only. Use teacher account for teacher-scoped discounts." });
      return;
    }
    if (isTeacher && scope !== "teacher_courses") {
      res.status(403).json({ error: "Teachers may only create discounts for their own courses" });
      return;
    }

    const finalScope = isAdmin ? "platform_subscription" : "teacher_courses";
    const teacherId = isTeacher ? req.userId : null;

    if (isTeacher && courseIds && courseIds.length > 0) {
      const { rows } = await pool.query(
        `SELECT id FROM aperti_courses WHERE id = ANY($1) AND teacher_id = $2`,
        [courseIds, req.userId],
      );
      if (rows.length !== courseIds.length) {
        res.status(403).json({ error: "You do not own all specified courses" });
        return;
      }
    }

    const normalizedCode = code.toUpperCase().trim();
    const { rows: existing } = await pool.query(
      "SELECT id FROM coupons WHERE code = $1 LIMIT 1",
      [normalizedCode],
    );
    if (existing.length > 0) {
      res.status(409).json({ error: "A discount code with this name already exists" });
      return;
    }

    const { rows } = await pool.query(
      `INSERT INTO coupons
         (code, discount_percent, max_uses, expiry_date, is_active, created_by,
          scope, discount_type, teacher_id, course_ids, created_at)
       VALUES ($1, $2, $3, $4, TRUE, $5, $6, $7, $8, $9, NOW())
       RETURNING *`,
      [
        normalizedCode,
        String(value),
        maxUses ?? null,
        expiryDate ? new Date(expiryDate) : null,
        req.userId,
        finalScope,
        discountType,
        teacherId,
        JSON.stringify(courseIds ?? []),
      ],
    );

    auditLog({ actorId: req.userId!, actorRole: req.role!, action: "CREATE_DISCOUNT", targetId: rows[0].id, targetType: "coupon", ip, result: "success", metadata: { scope: finalScope, code: normalizedCode } });
    res.status(201).json(rows[0]);
  } catch (err) {
    await logError(err, { route: "/api/secure-discounts", method: "POST" });
    res.status(500).json({ error: "Failed to create discount code" });
  }
});

/* ── POST /api/secure-discounts/apply ──────────────────────────────────── */
secureDiscountsRouter.post("/apply", async (req: AuthRequest, res: Response): Promise<void> => {
  const ip = getClientIp(req as unknown as { ip?: string; headers: Record<string, string | string[] | undefined> });
  const client = await pool.connect();
  try {
    const { code, context, courseId } = req.body as {
      code: string;
      context: "platform_subscription" | "course_enrollment";
      courseId?: number;
    };

    if (!code || !context) {
      res.status(400).json({ error: "code and context are required" });
      return;
    }

    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT * FROM coupons WHERE code = UPPER(TRIM($1)) FOR UPDATE`,
      [code],
    );

    if (rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Invalid discount code" });
      return;
    }

    const coupon = rows[0];

    if (!coupon.is_active) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "This discount code is no longer active" });
      return;
    }
    if (coupon.expiry_date && new Date(coupon.expiry_date) < new Date()) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "This discount code has expired" });
      return;
    }
    if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "This discount code has reached its usage limit" });
      return;
    }
    if (coupon.scope !== context) {
      await client.query("ROLLBACK");
      auditLog({ actorId: req.userId ?? null, actorRole: req.role ?? "user", action: "APPLY_DISCOUNT_SCOPE_MISMATCH", targetId: coupon.id, targetType: "coupon", ip, result: "blocked", metadata: { couponScope: coupon.scope, requestedContext: context } });
      res.status(403).json({ error: "This discount code cannot be used for this purchase type" });
      return;
    }
    if (coupon.scope === "teacher_courses") {
      if (!courseId) {
        await client.query("ROLLBACK");
        res.status(400).json({ error: "courseId is required for teacher discount codes" });
        return;
      }
      const courseIds: number[] = Array.isArray(coupon.course_ids) ? coupon.course_ids : (JSON.parse(coupon.course_ids ?? "[]") as number[]);
      if (!courseIds.includes(courseId)) {
        await client.query("ROLLBACK");
        auditLog({ actorId: req.userId ?? null, actorRole: req.role ?? "user", action: "APPLY_DISCOUNT_COURSE_MISMATCH", targetId: coupon.id, targetType: "coupon", ip, result: "blocked", metadata: { courseId } });
        res.status(403).json({ error: "This discount code is not valid for this course" });
        return;
      }
    }

    await client.query(
      `UPDATE coupons SET used_count = used_count + 1 WHERE id = $1`,
      [coupon.id],
    );

    await client.query("COMMIT");

    auditLog({ actorId: req.userId ?? null, actorRole: req.role ?? "user", action: "APPLY_DISCOUNT", targetId: coupon.id, targetType: "coupon", ip, result: "success", metadata: { code: coupon.code, context } });

    res.json({
      id: coupon.id,
      code: coupon.code,
      scope: coupon.scope,
      discountType: coupon.discount_type,
      discountPercent: coupon.discount_type === "percentage" ? parseFloat(coupon.discount_percent) : null,
      discountFixed: coupon.discount_type === "fixed" ? parseFloat(coupon.discount_percent) : null,
      expiryDate: coupon.expiry_date,
      appliedAt: new Date().toISOString(),
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    await logError(err, { route: "/api/secure-discounts/apply" });
    res.status(500).json({ error: "Failed to apply discount code" });
  } finally {
    client.release();
  }
});

/* ── PATCH /api/secure-discounts/:id/deactivate ────────────────────────── */
secureDiscountsRouter.patch("/:id/deactivate", requireRole("admin", "super_admin", "teacher"), async (req: AuthRequest, res: Response): Promise<void> => {
  const ip = getClientIp(req as unknown as { ip?: string; headers: Record<string, string | string[] | undefined> });
  try {
    const id = parseInt(req.params.id);
    const isAdmin = req.role === "admin" || req.role === "super_admin";

    const { rows } = await pool.query("SELECT * FROM coupons WHERE id = $1 LIMIT 1", [id]);
    if (rows.length === 0) { res.status(404).json({ error: "Discount code not found" }); return; }

    const coupon = rows[0];
    if (!isAdmin && coupon.teacher_id !== req.userId) {
      res.status(403).json({ error: "You do not own this discount code" });
      return;
    }

    await pool.query("UPDATE coupons SET is_active = FALSE WHERE id = $1", [id]);
    auditLog({ actorId: req.userId!, actorRole: req.role!, action: "DEACTIVATE_DISCOUNT", targetId: id, targetType: "coupon", ip, result: "success" });
    res.json({ success: true });
  } catch (err) {
    await logError(err, { route: `/api/secure-discounts/${req.params.id}/deactivate` });
    res.status(500).json({ error: "Failed to deactivate discount code" });
  }
});
