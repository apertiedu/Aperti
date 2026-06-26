/**
 * AI Circuit Breaker — Aperti
 *
 * Three-state machine: CLOSED → OPEN → HALF_OPEN → CLOSED
 *
 *   CLOSED     — normal operation; failures are counted
 *   OPEN       — AI calls are rejected immediately (fast-fail)
 *   HALF_OPEN  — one probe call is allowed to test recovery
 *
 * Config (env-overridable):
 *   AI_CB_FAILURE_THRESHOLD  — failures before opening (default 5)
 *   AI_CB_RESET_TIMEOUT_MS   — ms to wait before half-open probe (default 30 000)
 *   AI_CB_WINDOW_MS          — sliding window for counting failures (default 60 000)
 */

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

const FAILURE_THRESHOLD = parseInt(process.env.AI_CB_FAILURE_THRESHOLD ?? "5", 10);
const RESET_TIMEOUT_MS  = parseInt(process.env.AI_CB_RESET_TIMEOUT_MS  ?? "30000", 10);
const WINDOW_MS         = parseInt(process.env.AI_CB_WINDOW_MS         ?? "60000", 10);

interface CircuitBreakerState {
  state: CircuitState;
  failures: number[];   // timestamps of recent failures
  openedAt: number | null;
  halfOpenProbeAllowed: boolean;
}

const circuit: CircuitBreakerState = {
  state: "CLOSED",
  failures: [],
  openedAt: null,
  halfOpenProbeAllowed: false,
};

function pruneFailures() {
  const cutoff = Date.now() - WINDOW_MS;
  circuit.failures = circuit.failures.filter(t => t > cutoff);
}

function open() {
  circuit.state = "OPEN";
  circuit.openedAt = Date.now();
  circuit.halfOpenProbeAllowed = false;
  console.warn(`[ai-circuit-breaker] OPEN — ${circuit.failures.length} failures in ${WINDOW_MS / 1000}s window`);
}

function halfOpen() {
  circuit.state = "HALF_OPEN";
  circuit.halfOpenProbeAllowed = true;
  console.info("[ai-circuit-breaker] HALF_OPEN — allowing probe request");
}

function close() {
  circuit.state = "CLOSED";
  circuit.failures = [];
  circuit.openedAt = null;
  circuit.halfOpenProbeAllowed = false;
  console.info("[ai-circuit-breaker] CLOSED — circuit recovered");
}

/**
 * Returns true when the AI call should be allowed.
 * Call this BEFORE making an AI request.
 */
export function circuitAllows(): boolean {
  pruneFailures();

  switch (circuit.state) {
    case "CLOSED":
      return true;

    case "OPEN": {
      const elapsed = Date.now() - (circuit.openedAt ?? 0);
      if (elapsed >= RESET_TIMEOUT_MS) {
        halfOpen(); // transitions state to HALF_OPEN, sets halfOpenProbeAllowed=true
        // Immediately consume the probe slot so no second concurrent call can also pass
        circuit.halfOpenProbeAllowed = false;
        return true; // this call IS the single probe
      }
      return false;
    }

    case "HALF_OPEN":
      if (circuit.halfOpenProbeAllowed) {
        circuit.halfOpenProbeAllowed = false; // consume the probe slot
        return true;
      }
      return false;
  }
}

/**
 * Call after a SUCCESSFUL AI response.
 */
export function circuitSuccess(): void {
  if (circuit.state === "HALF_OPEN") {
    close();
  }
  // CLOSED — nothing to do; failures already pruned
}

/**
 * Call after a FAILED AI response (timeout, 5xx, network error).
 */
export function circuitFailure(): void {
  circuit.failures.push(Date.now());
  pruneFailures();

  switch (circuit.state) {
    case "CLOSED":
      if (circuit.failures.length >= FAILURE_THRESHOLD) open();
      break;

    case "HALF_OPEN":
      // Probe failed — go back to OPEN
      open();
      break;

    case "OPEN":
      // Already open; just accumulating failures
      break;
  }
}

/** Read-only snapshot for monitoring endpoints. */
export function circuitStatus(): {
  state: CircuitState;
  recentFailures: number;
  openedAt: string | null;
  config: { failureThreshold: number; resetTimeoutMs: number; windowMs: number };
} {
  pruneFailures();
  return {
    state: circuit.state,
    recentFailures: circuit.failures.length,
    openedAt: circuit.openedAt ? new Date(circuit.openedAt).toISOString() : null,
    config: {
      failureThreshold: FAILURE_THRESHOLD,
      resetTimeoutMs: RESET_TIMEOUT_MS,
      windowMs: WINDOW_MS,
    },
  };
}
