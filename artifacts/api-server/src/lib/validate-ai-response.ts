import { pool } from "@workspace/db";

export interface AIValidationResult {
  valid: boolean;
  warnings: string[];
  sanitized: Record<string, unknown>;
}

async function logValidationError(
  source: string,
  errorType: string,
  fieldMissing: string | null,
  rawResponse: unknown,
): Promise<void> {
  pool
    .query(
      `INSERT INTO system_validation_errors
         (source, error_type, field_missing, raw_response, fallback_used, created_at)
       VALUES ($1, $2, $3, $4, true, NOW())`,
      [source, errorType, fieldMissing, JSON.stringify(rawResponse)?.slice(0, 2000)],
    )
    .catch(() => {});
}

export async function validateAIResponse(
  response: unknown,
  source: string,
  opts: {
    requireConfidence?: boolean;
    requiredFields?: string[];
  } = {},
): Promise<AIValidationResult> {
  const warnings: string[] = [];

  if (!response || typeof response !== "object") {
    await logValidationError(source, "NULL_RESPONSE", null, response);
    return {
      valid: false,
      warnings: ["Response is null or not an object"],
      sanitized: { content: "", fallback: true, _validated: true },
    };
  }

  const obj = response as Record<string, unknown>;
  const required = ["content", ...(opts.requiredFields ?? [])];

  for (const field of required) {
    if (obj[field] === undefined || obj[field] === null) {
      warnings.push(`Missing required field: ${field}`);
      await logValidationError(source, "MISSING_FIELD", field, obj);
    }
  }

  if (opts.requireConfidence) {
    if (obj.confidence === undefined || obj.confidence === null) {
      warnings.push("Missing confidence score — defaulted to 0");
      obj.confidence = 0;
      await logValidationError(source, "MISSING_CONFIDENCE", "confidence", obj);
    } else if (typeof obj.confidence === "number" && (obj.confidence < 0 || obj.confidence > 1)) {
      warnings.push(`Confidence out of range: ${obj.confidence}`);
      obj.confidence = Math.max(0, Math.min(1, obj.confidence as number));
    }
  }

  const sanitized: Record<string, unknown> = {
    ...obj,
    content:
      typeof obj.content === "string"
        ? obj.content
        : String(obj.content ?? ""),
    _validated: true,
    _warnings: warnings.length > 0 ? warnings : undefined,
  };

  return { valid: warnings.length === 0, warnings, sanitized };
}

export function buildFallbackAIResponse(
  source: string,
  reason = "AI unavailable",
): Record<string, unknown> {
  pool
    .query(
      `INSERT INTO system_validation_errors
         (source, error_type, field_missing, raw_response, fallback_used, created_at)
       VALUES ($1, 'FALLBACK_USED', null, $2, true, NOW())`,
      [source, JSON.stringify({ reason })],
    )
    .catch(() => {});

  return {
    content: "The AI system is temporarily unavailable. Please try again shortly.",
    confidence: 0,
    fallback: true,
    _validated: true,
    reason,
  };
}
