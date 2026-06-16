import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { logError } from "../lib/log-error";
import { createFraudAlert } from "../lib/ledger-engine";
import { AI_CONFIG } from "../lib/ai";

export const aiAnomalyRouter = Router();

aiAnomalyRouter.use(authenticate, requireRole("admin", "super_admin"));

interface Signal { name: string; triggered: boolean; weight: number; detail?: string }

async function computeUserSignals(userId: number): Promise<Signal[]> {
  const signals: Signal[] = [];

  const { rows: burstRows } = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM payment_transactions
     WHERE user_id=$1 AND created_at > NOW() - INTERVAL '24 hours'`,
    [userId],
  );
  signals.push({ name: "burst_payments_24h", triggered: burstRows[0].cnt >= 5, weight: 0.35, detail: `${burstRows[0].cnt} payments in 24h` });

  const { rows: refundRows } = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM refund_requests rr
     JOIN payment_transactions pt ON pt.id = rr.transaction_id
     WHERE pt.user_id=$1 AND rr.created_at > NOW() - INTERVAL '30 days'`,
    [userId],
  ).catch(() => ({ rows: [{ cnt: 0 }] }));
  signals.push({ name: "high_refund_frequency", triggered: refundRows[0].cnt >= 2, weight: 0.3, detail: `${refundRows[0].cnt} refunds in 30 days` });

  const { rows: disputeRows } = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM disputes d
     JOIN payment_transactions pt ON pt.id = d.transaction_id
     WHERE pt.user_id=$1 AND d.created_at > NOW() - INTERVAL '30 days'`,
    [userId],
  ).catch(() => ({ rows: [{ cnt: 0 }] }));
  signals.push({ name: "dispute_frequency", triggered: disputeRows[0].cnt >= 1, weight: 0.3, detail: `${disputeRows[0].cnt} disputes in 30 days` });

  const { rows: fraudRows } = await pool.query(
    `SELECT AVG(fraud_risk_score)::numeric(4,3) AS avg_score,
            COUNT(*) FILTER (WHERE fraud_risk_score >= 0.28 AND fraud_risk_score <= 0.35)::int AS near_threshold
     FROM fraud_audit_log fal
     JOIN payment_transactions pt ON pt.id = fal.transaction_id
     WHERE pt.user_id=$1 AND fal.created_at > NOW() - INTERVAL '30 days'`,
    [userId],
  ).catch(() => ({ rows: [{ avg_score: 0, near_threshold: 0 }] }));
  const avgScore = parseFloat(fraudRows[0]?.avg_score ?? "0");
  signals.push({ name: "high_avg_fraud_score", triggered: avgScore >= 0.4, weight: 0.25, detail: `avg fraud score ${avgScore}` });
  signals.push({ name: "threshold_probing", triggered: fraudRows[0]?.near_threshold >= 3, weight: 0.2, detail: `${fraudRows[0]?.near_threshold} near-threshold attempts` });

  return signals;
}

async function computeTeacherSignals(teacherId: number): Promise<Signal[]> {
  const signals: Signal[] = [];

  const { rows: revenueRows } = await pool.query(
    `SELECT
       COALESCE(SUM(le.amount) FILTER (WHERE le.created_at > NOW() - INTERVAL '7 days'),0)::numeric(12,2) AS this_week,
       COALESCE(SUM(le.amount) / NULLIF(EXTRACT(MONTH FROM AGE(NOW(), MIN(le.created_at))),0),0)::numeric(12,2) AS monthly_avg
     FROM ledger_entries le
     JOIN payment_transactions pt ON pt.id = le.transaction_id
     JOIN aperti_courses c ON c.id = pt.target_id
     WHERE le.account_type='teacher_revenue' AND le.entry_type='credit' AND le.is_reversal=FALSE
       AND c.teacher_id=$1`,
    [teacherId],
  ).catch(() => ({ rows: [{ this_week: 0, monthly_avg: 0 }] }));
  const thisWeek = parseFloat(revenueRows[0]?.this_week ?? "0");
  const monthlyAvg = parseFloat(revenueRows[0]?.monthly_avg ?? "0");
  const spike = monthlyAvg > 0 && thisWeek > monthlyAvg * 3;
  signals.push({ name: "revenue_spike", triggered: spike, weight: 0.35, detail: `this week ${thisWeek} EGP vs avg ${monthlyAvg} EGP/month` });

  const { rows: payoutRows } = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM teacher_payouts WHERE teacher_id=$1 AND status='pending'`,
    [teacherId],
  ).catch(() => ({ rows: [{ cnt: 0 }] }));
  signals.push({ name: "many_pending_payouts", triggered: payoutRows[0].cnt >= 3, weight: 0.2, detail: `${payoutRows[0].cnt} pending payouts` });

  const { rows: disputeRows } = await pool.query(
    `SELECT COUNT(*)::int AS cnt
     FROM disputes d
     JOIN payment_transactions pt ON pt.id = d.transaction_id
     JOIN aperti_courses c ON c.id = pt.target_id
     WHERE c.teacher_id=$1 AND d.created_at > NOW() - INTERVAL '30 days'`,
    [teacherId],
  ).catch(() => ({ rows: [{ cnt: 0 }] }));
  signals.push({ name: "high_dispute_rate", triggered: disputeRows[0].cnt >= 2, weight: 0.3, detail: `${disputeRows[0].cnt} disputes on teacher courses in 30 days` });

  return signals;
}

function computeRiskScore(signals: Signal[]): number {
  const triggered = signals.filter((s) => s.triggered);
  if (triggered.length === 0) return 0;
  const raw = triggered.reduce((s, sig) => s + sig.weight, 0);
  return parseFloat(Math.min(raw, 1).toFixed(3));
}

function recommendedAction(score: number): "monitor" | "review" | "block" {
  if (score >= 0.7) return "block";
  if (score >= 0.4) return "review";
  return "monitor";
}

async function generatePredictionText(
  entityType: string,
  entityId: string,
  signals: Signal[],
  score: number,
): Promise<string> {
  const triggered = signals.filter((s) => s.triggered).map((s) => `${s.name}: ${s.detail ?? "triggered"}`);
  if (triggered.length === 0) return `No anomalous signals detected for ${entityType} #${entityId}.`;

  if (!AI_CONFIG.isConfigured) {
    return `${entityType} #${entityId} shows ${triggered.length} anomaly signal(s): ${triggered.join("; ")}. Risk score: ${score}. Recommended action: ${recommendedAction(score)}.`;
  }

  try {
    const prompt = `You are a financial risk analyst. Summarize this anomaly report in 2 sentences max.
Entity: ${entityType} #${entityId}
Risk score: ${score}
Signals triggered: ${triggered.join(", ")}
Output only the summary, no JSON.`;

    const response = await fetch(`${AI_CONFIG.baseURL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${AI_CONFIG.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: AI_CONFIG.model, messages: [{ role: "user", content: prompt }], max_tokens: 120, temperature: 0.3 }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content?.trim() ?? triggered.join("; ");
  } catch {
    return triggered.join("; ");
  }
}

/* ── POST /api/ai-anomaly/analyze ───────────────────────────────────────── */
aiAnomalyRouter.post("/analyze", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { entity_type, entity_id } = req.body as { entity_type: "user" | "teacher"; entity_id: number };
    if (!entity_type || !entity_id) {
      res.status(400).json({ error: "entity_type and entity_id are required" });
      return;
    }

    const signals = entity_type === "teacher"
      ? await computeTeacherSignals(entity_id)
      : await computeUserSignals(entity_id);

    const score = computeRiskScore(signals);
    const action = recommendedAction(score);
    const prediction = await generatePredictionText(entity_type, String(entity_id), signals, score);
    const triggeredSignals = signals.filter((s) => s.triggered).map((s) => s.name);

    const { rows } = await pool.query(
      `INSERT INTO anomaly_predictions (entity_id, entity_type, risk_score, prediction, recommended_action, signals, analyzed_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7)
       ON CONFLICT (entity_id, entity_type) DO UPDATE
         SET risk_score=$3, prediction=$4, recommended_action=$5, signals=$6, analyzed_at=NOW(), created_by=$7
       RETURNING *`,
      [String(entity_id), entity_type, score, prediction, action, JSON.stringify(triggeredSignals), req.userId],
    );

    if (score >= 0.4) {
      await createFraudAlert({
        severity: score >= 0.7 ? "high" : "medium",
        type: `anomaly_${entity_type}`,
        entityId: entity_id,
        entityType: entity_type,
        message: `AI anomaly detected on ${entity_type} #${entity_id}: ${prediction.slice(0, 200)}`,
        metadata: { risk_score: score, recommended_action: action, signals: triggeredSignals },
      });
    }

    res.json({ prediction: rows[0], signals, score, recommended_action: action });
  } catch (err) {
    await logError(err, { route: "POST /api/ai-anomaly/analyze" });
    res.status(500).json({ error: "Anomaly analysis failed" });
  }
});

/* ── POST /api/ai-anomaly/batch-scan ────────────────────────────────────── */
aiAnomalyRouter.post("/batch-scan", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { entity_type = "user" } = req.body as { entity_type?: "user" | "teacher" };

    const query = entity_type === "teacher"
      ? `SELECT DISTINCT c.teacher_id AS id FROM aperti_courses c JOIN payment_transactions pt ON pt.target_id = c.id WHERE pt.status IN ('verified','approved') LIMIT 50`
      : `SELECT DISTINCT pt.user_id AS id FROM payment_transactions pt WHERE pt.created_at > NOW() - INTERVAL '30 days' LIMIT 100`;

    const { rows: entities } = await pool.query(query);
    const results: Array<{ entity_id: number; risk_score: number; recommended_action: string; status: string }> = [];

    for (const e of entities) {
      try {
        const signals = entity_type === "teacher"
          ? await computeTeacherSignals(e.id)
          : await computeUserSignals(e.id);
        const score = computeRiskScore(signals);
        const action = recommendedAction(score);
        const triggeredSignals = signals.filter((s) => s.triggered).map((s) => s.name);
        const prediction = triggeredSignals.length > 0
          ? `${entity_type} #${e.id}: ${triggeredSignals.join(", ")}`
          : `No anomalies detected.`;

        await pool.query(
          `INSERT INTO anomaly_predictions (entity_id, entity_type, risk_score, prediction, recommended_action, signals, analyzed_at, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7)
           ON CONFLICT (entity_id, entity_type) DO UPDATE
             SET risk_score=$3, prediction=$4, recommended_action=$5, signals=$6, analyzed_at=NOW(), created_by=$7`,
          [String(e.id), entity_type, score, prediction, action, JSON.stringify(triggeredSignals), req.userId],
        );

        if (score >= 0.7) {
          await createFraudAlert({
            severity: "high",
            type: `batch_anomaly_${entity_type}`,
            entityId: e.id,
            entityType: entity_type,
            message: `Batch scan: HIGH risk anomaly on ${entity_type} #${e.id}. Score: ${score}. Signals: ${triggeredSignals.join(", ")}`,
            metadata: { risk_score: score, signals: triggeredSignals },
          });
        }

        results.push({ entity_id: e.id, risk_score: score, recommended_action: action, status: "analyzed" });
      } catch {
        results.push({ entity_id: e.id, risk_score: 0, recommended_action: "monitor", status: "error" });
      }
    }

    const high = results.filter((r) => r.recommended_action === "block").length;
    const review = results.filter((r) => r.recommended_action === "review").length;
    res.json({ results, summary: { total: results.length, high_risk: high, needs_review: review } });
  } catch (err) {
    await logError(err, { route: "POST /api/ai-anomaly/batch-scan" });
    res.status(500).json({ error: "Batch scan failed" });
  }
});

/* ── GET /api/ai-anomaly/predictions ────────────────────────────────────── */
aiAnomalyRouter.get("/predictions", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { action, entity_type } = req.query as Record<string, string>;
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (action) { params.push(action); conditions.push(`recommended_action = $${params.length}`); }
    if (entity_type) { params.push(entity_type); conditions.push(`entity_type = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT ap.*, a.display_name AS created_by_name
       FROM anomaly_predictions ap
       LEFT JOIN accounts a ON a.id = ap.created_by
       ${where}
       ORDER BY risk_score DESC, analyzed_at DESC LIMIT 200`,
      params,
    );

    const { rows: stats } = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE recommended_action='block')::int AS high_risk,
        COUNT(*) FILTER (WHERE recommended_action='review')::int AS needs_review,
        COUNT(*) FILTER (WHERE recommended_action='monitor')::int AS monitoring,
        ROUND(AVG(risk_score)::numeric, 3) AS avg_risk_score,
        COUNT(*) FILTER (WHERE analyzed_at > NOW() - INTERVAL '24 hours')::int AS analyzed_last_24h
      FROM anomaly_predictions
    `);

    res.json({ predictions: rows, stats: stats[0] ?? {} });
  } catch (err) {
    await logError(err, { route: "GET /api/ai-anomaly/predictions" });
    res.status(500).json({ error: "Failed to fetch predictions" });
  }
});
