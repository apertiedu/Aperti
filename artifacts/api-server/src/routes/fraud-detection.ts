import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { logError } from "../lib/log-error";
import { auditLog, getClientIp } from "../lib/financial-audit";

export const fraudDetectionRouter = Router();

fraudDetectionRouter.use(authenticate);

interface FraudSignal {
  key: string;
  weight: number;
  description: string;
}

const SIGNALS: Record<string, FraudSignal> = {
  duplicate_reference:     { key: "duplicate_reference",     weight: 0.40, description: "Reference number already seen in another transaction" },
  new_account_high_value:  { key: "new_account_high_value",  weight: 0.35, description: "Account created < 7 days ago with high-value payment" },
  burst_activity:          { key: "burst_activity",          weight: 0.30, description: "3+ transactions from same user in last 60 minutes" },
  approver_collusion:      { key: "approver_collusion",      weight: 0.30, description: "Same approver approved 5+ transactions from this user" },
  repeated_failures:       { key: "repeated_failures",       weight: 0.25, description: "3+ rejected transactions in last 30 days" },
  discount_abuse:          { key: "discount_abuse",          weight: 0.25, description: "Multiple failed discount scope attempts" },
  multiple_pending:        { key: "multiple_pending",        weight: 0.20, description: "More than 2 simultaneous pending transactions" },
};

async function computeFraudScore(txId: number): Promise<{ score: number; flags: string[] }> {
  const flags: string[] = [];
  let score = 0;

  const { rows: txRows } = await pool.query(
    `SELECT pt.*, a.created_at AS account_created_at
     FROM payment_transactions pt
     LEFT JOIN accounts a ON a.id = pt.user_id
     WHERE pt.id = $1 LIMIT 1`,
    [txId],
  );
  if (txRows.length === 0) return { score: 0, flags: [] };
  const tx = txRows[0];

  const [dupeRef, burstRows, pendingRows, failedRows, discountAbuseRows, collusionRows, newAccountRows] = await Promise.allSettled([
    tx.reference_number
      ? pool.query(
          `SELECT COUNT(*)::int AS cnt FROM payment_transactions
           WHERE reference_number = $1 AND id != $2`,
          [tx.reference_number, txId],
        )
      : Promise.resolve({ rows: [{ cnt: 0 }] }),
    pool.query(
      `SELECT COUNT(*)::int AS cnt FROM payment_transactions
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '60 minutes' AND id != $2`,
      [tx.user_id, txId],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS cnt FROM payment_transactions
       WHERE user_id = $1 AND status = 'pending' AND id != $2`,
      [tx.user_id, txId],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS cnt FROM payment_transactions
       WHERE user_id = $1 AND status = 'rejected'
         AND created_at > NOW() - INTERVAL '30 days'`,
      [tx.user_id],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS cnt FROM financial_audit_log
       WHERE actor_id = $1
         AND action LIKE '%DISCOUNT%MISMATCH%'
         AND created_at > NOW() - INTERVAL '7 days'`,
      [tx.user_id],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS cnt FROM approval_log al
       JOIN payment_transactions pt2 ON pt2.id = al.transaction_id
       WHERE pt2.user_id = $1
         AND al.approved_by IN (
           SELECT approved_by FROM approval_log al2
           JOIN payment_transactions pt3 ON pt3.id = al2.transaction_id
           WHERE pt3.user_id = $1
         )
         AND al.created_at > NOW() - INTERVAL '30 days'`,
      [tx.user_id],
    ),
    pool.query(
      `SELECT EXTRACT(EPOCH FROM (NOW() - a.created_at)) / 86400 AS days_old
       FROM accounts a WHERE a.id = $1 LIMIT 1`,
      [tx.user_id],
    ),
  ]);

  if (dupeRef.status === "fulfilled" && (dupeRef.value.rows[0]?.cnt ?? 0) > 0) {
    flags.push(SIGNALS.duplicate_reference.key);
    score += SIGNALS.duplicate_reference.weight;
  }

  if (burstRows.status === "fulfilled" && (burstRows.value.rows[0]?.cnt ?? 0) >= 3) {
    flags.push(SIGNALS.burst_activity.key);
    score += SIGNALS.burst_activity.weight;
  }

  if (pendingRows.status === "fulfilled" && (pendingRows.value.rows[0]?.cnt ?? 0) > 2) {
    flags.push(SIGNALS.multiple_pending.key);
    score += SIGNALS.multiple_pending.weight;
  }

  if (failedRows.status === "fulfilled" && (failedRows.value.rows[0]?.cnt ?? 0) >= 3) {
    flags.push(SIGNALS.repeated_failures.key);
    score += SIGNALS.repeated_failures.weight;
  }

  if (discountAbuseRows.status === "fulfilled" && (discountAbuseRows.value.rows[0]?.cnt ?? 0) >= 2) {
    flags.push(SIGNALS.discount_abuse.key);
    score += SIGNALS.discount_abuse.weight;
  }

  if (collusionRows.status === "fulfilled" && (collusionRows.value.rows[0]?.cnt ?? 0) >= 5) {
    flags.push(SIGNALS.approver_collusion.key);
    score += SIGNALS.approver_collusion.weight;
  }

  if (newAccountRows.status === "fulfilled") {
    const daysOld = parseFloat(newAccountRows.value.rows[0]?.days_old ?? "999");
    const amount = parseFloat(tx.amount ?? "0");
    if (daysOld < 7 && amount >= 1000) {
      flags.push(SIGNALS.new_account_high_value.key);
      score += SIGNALS.new_account_high_value.weight;
    }
  }

  return { score: Math.min(score, 1), flags };
}

/* ── POST /api/fraud/analyze ────────────────────────────────────────────── */
fraudDetectionRouter.post(
  "/analyze",
  requireRole("admin", "super_admin", "teacher", "assistant"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const ip = getClientIp(req as unknown as { ip?: string; headers: Record<string, string | string[] | undefined> });
    try {
      const { transactionId } = req.body as { transactionId: number };
      if (!transactionId) {
        res.status(400).json({ error: "transactionId is required" });
        return;
      }

      const { score, flags } = await computeFraudScore(transactionId);

      const risk_level: "low" | "medium" | "high" =
        score >= 0.6 ? "high" : score >= 0.3 ? "medium" : "low";
      const recommended_action: "approve" | "manual_review" | "block" =
        score >= 0.7 ? "block" : score >= 0.3 ? "manual_review" : "approve";

      await pool.query(
        `INSERT INTO fraud_audit_log
           (transaction_id, fraud_risk_score, risk_level, flags, recommended_action, analyzed_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (transaction_id) DO UPDATE
           SET fraud_risk_score = $2, risk_level = $3, flags = $4,
               recommended_action = $5, analyzed_by = $6, created_at = NOW()`,
        [transactionId, score.toFixed(3), risk_level, JSON.stringify(flags), recommended_action, req.userId],
      );

      auditLog({
        actorId: req.userId!,
        actorRole: req.role!,
        action: "FRAUD_ANALYZE",
        targetId: transactionId,
        targetType: "payment_transaction",
        ip,
        result: "success",
        metadata: { risk_level, score, flags },
      });

      res.json({
        fraud_analysis: {
          transaction_id: transactionId,
          fraud_risk_score: parseFloat(score.toFixed(3)),
          risk_level,
          flags,
          recommended_action,
          signal_descriptions: flags.map((f) => SIGNALS[f]?.description ?? f),
        },
      });
    } catch (err) {
      await logError(err, { route: "/api/fraud/analyze" });
      res.status(500).json({ error: "Fraud analysis failed" });
    }
  },
);

/* ── POST /api/fraud/analyze-on-submit (internal — called from submit flow) */
fraudDetectionRouter.post(
  "/analyze-on-submit",
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { transactionId } = req.body as { transactionId: number };
      if (!transactionId) { res.status(400).json({ error: "transactionId required" }); return; }

      const { score, flags } = await computeFraudScore(transactionId);
      const risk_level = score >= 0.6 ? "high" : score >= 0.3 ? "medium" : "low";
      const recommended_action = score >= 0.7 ? "block" : score >= 0.3 ? "manual_review" : "approve";

      await pool.query(
        `INSERT INTO fraud_audit_log
           (transaction_id, fraud_risk_score, risk_level, flags, recommended_action, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (transaction_id) DO NOTHING`,
        [transactionId, score.toFixed(3), risk_level, JSON.stringify(flags), recommended_action],
      );

      res.json({ risk_level, fraud_risk_score: parseFloat(score.toFixed(3)), recommended_action, flags });
    } catch {
      res.json({ risk_level: "low", fraud_risk_score: 0, recommended_action: "approve", flags: [] });
    }
  },
);

/* ── GET /api/fraud/audit-log ───────────────────────────────────────────── */
fraudDetectionRouter.get(
  "/audit-log",
  requireRole("admin", "super_admin"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const riskLevel = (req.query as Record<string, string>).risk_level;
      const limit = Math.min(parseInt(String((req.query as Record<string, string>).limit ?? "100")), 500);

      const conditions: string[] = [];
      const params: unknown[] = [];

      if (riskLevel && ["low", "medium", "high"].includes(riskLevel)) {
        params.push(riskLevel);
        conditions.push(`fal.risk_level = $${params.length}`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      params.push(limit);

      const { rows } = await pool.query(
        `SELECT fal.*,
                pt.amount, pt.currency, pt.purpose, pt.reference_number, pt.user_id,
                u.display_name AS user_name, u.email AS user_email,
                analyzer.display_name AS analyzed_by_name
         FROM fraud_audit_log fal
         LEFT JOIN payment_transactions pt ON pt.id = fal.transaction_id
         LEFT JOIN accounts u ON u.id = pt.user_id
         LEFT JOIN accounts analyzer ON analyzer.id = fal.analyzed_by
         ${where}
         ORDER BY fal.created_at DESC
         LIMIT $${params.length}`,
        params,
      );

      const [stats] = await Promise.allSettled([
        pool.query(`
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE risk_level = 'high')::int AS high_count,
            COUNT(*) FILTER (WHERE risk_level = 'medium')::int AS medium_count,
            COUNT(*) FILTER (WHERE risk_level = 'low')::int AS low_count,
            AVG(fraud_risk_score)::numeric(4,3) AS avg_score
          FROM fraud_audit_log
          WHERE created_at > NOW() - INTERVAL '30 days'
        `),
      ]);

      res.json({
        logs: rows,
        stats: stats.status === "fulfilled" ? stats.value.rows[0] : {},
        signals: Object.values(SIGNALS),
      });
    } catch (err) {
      await logError(err, { route: "/api/fraud/audit-log" });
      res.status(500).json({ error: "Failed to fetch fraud audit log" });
    }
  },
);

/* ── GET /api/fraud/signals ─────────────────────────────────────────────── */
fraudDetectionRouter.get("/signals", requireRole("admin", "super_admin"), (_req, res) => {
  res.json({ signals: Object.values(SIGNALS) });
});
