import { useEffect, useRef } from "react";
import { apiFetch } from "@/lib/api";

type Severity = "warn" | "error";

interface UxGuardOptions {
  route: string;
  hasLoadingState?: boolean;
  hasErrorState?: boolean;
  hasData?: boolean;
  isAiOutput?: boolean;
  hasConfidenceBadge?: boolean;
  isMounted?: boolean;
}

function reportViolation(rule_id: string, description: string, route: string, severity: Severity = "warn") {
  apiFetch("/api/errors/ux-violation", {
    method: "POST",
    body: JSON.stringify({ route, rule_id, description, severity }),
  }).catch(() => {});
}

export function useUxGuard(opts: UxGuardOptions) {
  const {
    route,
    hasLoadingState,
    hasErrorState,
    hasData,
    isAiOutput,
    hasConfidenceBadge,
    isMounted = true,
  } = opts;

  const checked = useRef(false);

  useEffect(() => {
    if (!isMounted || checked.current) return;
    checked.current = true;

    if (hasLoadingState === false) {
      reportViolation(
        "MISSING_LOADING_STATE",
        `Page at ${route} does not implement a loading state for async data`,
        route,
        "error"
      );
    }

    if (hasErrorState === false) {
      reportViolation(
        "MISSING_ERROR_STATE",
        `Page at ${route} does not handle error conditions`,
        route,
        "error"
      );
    }

    if (isAiOutput && hasConfidenceBadge === false) {
      reportViolation(
        "MISSING_AI_CONFIDENCE_BADGE",
        `AI output on ${route} does not display a confidence indicator`,
        route,
        "warn"
      );
    }

    if (hasData === false && hasLoadingState === false) {
      reportViolation(
        "BLANK_SCREEN_RISK",
        `${route} may show a blank screen — no loading state and no data`,
        route,
        "error"
      );
    }
  }, [isMounted]);
}

export function reportUxViolation(route: string, rule_id: string, description: string, severity: Severity = "warn") {
  reportViolation(rule_id, description, route, severity);
}
