import { Router, Request, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/auth";

export const i18nRouter = Router();

i18nRouter.get("/i18n/currencies", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM currencies ORDER BY code`);
    res.json(rows);
  } catch {
    res.json([
      { id: 1, code: "EGP", symbol: "ج.م", name: "Egyptian Pound", exchange_rate: 1.0, is_default: true },
      { id: 2, code: "USD", symbol: "$", name: "US Dollar", exchange_rate: 0.021, is_default: false },
    ]);
  }
});

i18nRouter.get("/i18n/languages", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM languages ORDER BY name`);
    res.json(rows);
  } catch {
    res.json([
      { id: 1, code: "ar", name: "Arabic", direction: "rtl", is_default: true },
      { id: 2, code: "en", name: "English", direction: "ltr", is_default: false },
    ]);
  }
});

i18nRouter.put("/i18n/currencies/:id", requireRole("admin", "super_admin"), async (req: Request, res: Response) => {
  try {
    const { exchange_rate, symbol } = req.body;
    const { rows } = await pool.query(
      `UPDATE currencies SET exchange_rate=$1, symbol=$2 WHERE id=$3 RETURNING *`,
      [exchange_rate, symbol, req.params.id]
    );
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Failed to update currency" });
  }
});

i18nRouter.post("/i18n/currencies", requireRole("admin", "super_admin"), async (req: Request, res: Response) => {
  try {
    const { code, symbol, name, exchange_rate } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO currencies (code, symbol, name, exchange_rate) VALUES ($1,$2,$3,$4) RETURNING *`,
      [code, symbol, name, exchange_rate ?? 1.0]
    );
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ error: "Failed to add currency" });
  }
});
