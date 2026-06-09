import { pool } from "@workspace/db";

async function createAlert(type: string, message: string, severity: "info" | "warning" | "critical") {
  try {
    // Deduplicate: don't create the same alert twice within 1 hour
    const { rows } = await pool.query(
      `SELECT id FROM founder_alerts
       WHERE type=$1 AND message=$2 AND created_at >= NOW()-INTERVAL '1 hour'
       LIMIT 1`,
      [type, message]
    );
    if (rows.length > 0) return;
    await pool.query(
      `INSERT INTO founder_alerts (type, message, severity) VALUES ($1,$2,$3)`,
      [type, message, severity]
    );
  } catch {
    // Never crash the worker
  }
}

async function checkPaymentFailures() {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM payment_requests
       WHERE status='rejected' AND created_at >= NOW()-INTERVAL '1 hour'`
    ).catch(() => ({ rows: [{ cnt: 0 }] }));
    const cnt = parseInt(rows[0]?.cnt ?? 0);
    if (cnt > 0) {
      await createAlert(
        "payment_failure",
        `${cnt} payment request(s) rejected in the last hour`,
        cnt >= 5 ? "critical" : "warning"
      );
    }
  } catch {}
}

async function checkAiCostSpike() {
  try {
    const { rows } = await pool.query(`
      SELECT
        SUM(tokens_used) FILTER (WHERE created_at >= NOW()-INTERVAL '1 hour')  AS last_hour,
        SUM(tokens_used) FILTER (WHERE created_at >= NOW()-INTERVAL '7 days')  AS last_7d,
        COUNT(*) FILTER (WHERE created_at >= NOW()-INTERVAL '1 hour')           AS last_hour_calls
      FROM ai_interactions`
    ).catch(() => ({ rows: [{ last_hour: 0, last_7d: 0, last_hour_calls: 0 }] }));

    const r = rows[0];
    const lastHour  = parseInt(r?.last_hour  ?? 0);
    const last7d    = parseInt(r?.last_7d    ?? 0);
    const dailyAvg  = (last7d / 7) / 24; // hourly avg
    if (dailyAvg > 0 && lastHour > dailyAvg * 1.5) {
      const spike = ((lastHour - dailyAvg) / dailyAvg * 100).toFixed(0);
      await createAlert(
        "ai_cost_spike",
        `AI token usage ${spike}% above hourly average (${lastHour.toLocaleString()} tokens in last hour)`,
        parseInt(spike) >= 100 ? "critical" : "warning"
      );
    }
  } catch {}
}

async function checkSystemHealth() {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM system_health_logs
       WHERE status != 'healthy' AND timestamp >= NOW()-INTERVAL '10 minutes'`
    ).catch(() => ({ rows: [{ cnt: 0 }] }));
    const cnt = parseInt(rows[0]?.cnt ?? 0);
    if (cnt > 0) {
      await createAlert(
        "health_warning",
        `${cnt} system health warning(s) detected in the last 10 minutes`,
        cnt >= 3 ? "critical" : "warning"
      );
    }
  } catch {}
}

async function checkPendingPayments() {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM payment_requests
       WHERE status='pending' AND created_at < NOW()-INTERVAL '24 hours'`
    ).catch(() => ({ rows: [{ cnt: 0 }] }));
    const cnt = parseInt(rows[0]?.cnt ?? 0);
    if (cnt > 0) {
      await createAlert(
        "pending_payments",
        `${cnt} payment request(s) have been pending for over 24 hours`,
        cnt >= 3 ? "warning" : "info"
      );
    }
  } catch {}
}

export function startFounderAlertsWorker() {
  async function tick() {
    await Promise.all([
      checkPaymentFailures(),
      checkAiCostSpike(),
      checkSystemHealth(),
      checkPendingPayments(),
    ]);
  }

  // Run immediately then every 5 minutes
  tick().catch(() => {});
  const interval = setInterval(() => tick().catch(() => {}), 5 * 60 * 1000);

  console.log("[founder-alerts] Background worker started (5-min interval)");
  return interval;
}
