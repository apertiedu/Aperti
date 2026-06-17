import { pool } from "@workspace/db";

export interface AIValidationSchema {
  required: string[];
  confidenceField?: string;
  source: string;
}

export interface AIValidationResult<T> {
  valid: boolean;
  data: T | null;
  fallback: boolean;
  missingFields: string[];
  confidence: number | null;
}

async function logValidationError(
  source: string,
  errorType: string,
  fieldMissing: string | null,
  rawResponse: unknown,
) {
  pool
    .query(
      `INSERT INTO system_validation_errors
         (source, error_type, field_missing, raw_response, fallback_used, created_at)
       VALUES ($1, $2, $3, $4, true, NOW())`,
      [
        source.slice(0, 200),
        errorType.slice(0, 100),
        fieldMissing?.slice(0, 100) ?? null,
        JSON.stringify(rawResponse ?? null),
      ],
    )
    .catch(() => {});
}

export async function validateAIResponse<T extends Record<string, unknown>>(
  raw: unknown,
  schema: AIValidationSchema,
  fallbackValue: T,
): Promise<AIValidationResult<T>> {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    await logValidationError(schema.source, "INVALID_RESPONSE_TYPE", null, raw);
    return { valid: false, data: fallbackValue, fallback: true, missingFields: ["<root>"], confidence: null };
  }

  const obj = raw as Record<string, unknown>;
  const missingFields: string[] = [];

  for (const field of schema.required) {
    if (!(field in obj) || obj[field] === undefined || obj[field] === null) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    for (const f of missingFields) {
      await logValidationError(schema.source, "MISSING_REQUIRED_FIELD", f, raw);
    }
    return { valid: false, data: fallbackValue, fallback: true, missingFields, confidence: null };
  }

  let confidence: number | null = null;
  if (schema.confidenceField && schema.confidenceField in obj) {
    const raw_conf = obj[schema.confidenceField];
    const parsed = typeof raw_conf === "number" ? raw_conf : parseFloat(String(raw_conf));
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
      confidence = parsed;
    } else {
      await logValidationError(schema.source, "INVALID_CONFIDENCE_VALUE", schema.confidenceField, raw);
    }
  } else if (schema.confidenceField) {
    await logValidationError(schema.source, "MISSING_CONFIDENCE_FIELD", schema.confidenceField, raw);
  }

  return { valid: true, data: obj as T, fallback: false, missingFields: [], confidence };
}

export async function validateAIGradeResponse(raw: unknown, source: string) {
  return validateAIResponse<{
    score: number;
    grade: string;
    percentage: number;
    feedback: string;
    improvements: string[];
    confidence: number;
  }>(
    raw,
    {
      source,
      required: ["score", "grade", "feedback"],
      confidenceField: "confidence",
    },
    {
      score: 0,
      grade: "U",
      percentage: 0,
      feedback: "AI validation failed — teacher review required.",
      improvements: [],
      confidence: 0.4,
    },
  );
}

export async function validateAIGenerateResponse(raw: unknown, source: string) {
  if (typeof raw === "string" && raw.trim().length > 0) {
    return { valid: true, data: raw, fallback: false, missingFields: [], confidence: null };
  }
  await logValidationError(source, "EMPTY_GENERATION_RESULT", null, raw);
  return { valid: false, data: null, fallback: true, missingFields: ["<content>"], confidence: null };
}

export async function recordSafeModeFallback(source: string, reason: string) {
  pool
    .query(
      `INSERT INTO system_validation_errors
         (source, error_type, field_missing, raw_response, fallback_used, created_at)
       VALUES ($1, $2, $3, $4, true, NOW())`,
      [source.slice(0, 200), "SAFE_MODE_FALLBACK", null, JSON.stringify({ reason })],
    )
    .catch(() => {});
}
