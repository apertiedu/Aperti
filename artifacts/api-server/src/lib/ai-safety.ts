import { db } from "@workspace/db";
import { aiInteractionsTable } from "@workspace/db";

const KEYWORD_BLACKLIST = [
  "violence", "self-harm", "suicide", "abuse", "explicit",
  "drugs", "weapon", "hate", "racist", "terrorism",
];

export interface SafeOutput<T> {
  data: T;
  confidence: number;
  sources: string[];
  flagged?: boolean;
}

export function wrapWithSafety<T>(
  data: T,
  confidence: number,
  sources: string[]
): SafeOutput<T> {
  return { data, confidence, sources };
}

export async function moderateContent(text: string): Promise<{ safe: boolean; reason?: string }> {
  const lower = text.toLowerCase();
  for (const kw of KEYWORD_BLACKLIST) {
    if (lower.includes(kw)) return { safe: false, reason: `Content flagged: contains "${kw}"` };
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const res = await fetch("https://api.openai.com/v1/moderations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({ input: text }),
      });
      const data = await res.json() as {
        results: Array<{ flagged: boolean; categories: Record<string, boolean> }>;
      };
      if (data.results?.[0]?.flagged) {
        const cats = Object.entries(data.results[0].categories)
          .filter(([, v]) => v)
          .map(([k]) => k)
          .join(", ");
        return { safe: false, reason: `OpenAI moderation flagged: ${cats}` };
      }
    } catch {
      // fallback to keyword check only
    }
  }

  return { safe: true };
}

export async function logInteraction(params: {
  userId?: number;
  module: string;
  action: string;
  inputSummary?: string;
  outputSummary?: string;
  confidence?: number;
  tokensUsed?: number;
  sources?: string[];
  fallback?: boolean;
  latencyMs?: number;
}): Promise<number> {
  try {
    const [row] = await db.insert(aiInteractionsTable).values({
      userId: params.userId ?? null,
      module: params.module,
      action: params.action,
      inputSummary: params.inputSummary?.slice(0, 500) ?? null,
      outputSummary: params.outputSummary?.slice(0, 500) ?? null,
      confidence: params.confidence != null ? String(params.confidence) : null,
      tokensUsed: params.tokensUsed ?? null,
      sources: params.sources ?? [],
      accepted: params.fallback === true ? false : null,
      latencyMs: params.latencyMs ?? 0,
    }).returning();
    return row.id;
  } catch {
    return -1;
  }
}

export async function logFallback(params: {
  userId?: number;
  module: string;
  action: string;
  inputSummary?: string;
  reason: string;
}): Promise<void> {
  await logInteraction({
    userId: params.userId,
    module: params.module,
    action: params.action,
    inputSummary: params.inputSummary,
    outputSummary: `FALLBACK: ${params.reason}`,
    confidence: 0,
    fallback: true,
    sources: ["rule_based_fallback"],
  });
}

export async function emitAIOutage(module: string, error: string, userId?: number): Promise<void> {
  const { eventBus } = await import("./event-bus");
  eventBus.emit_event("ai.outage", {
    module,
    error: error.slice(0, 500),
    userId: userId ?? null,
    timestamp: new Date().toISOString(),
  }, { actorId: userId }).catch(() => {});
}

export async function markInteractionOutcome(interactionId: number, accepted: boolean): Promise<void> {
  if (interactionId < 0) return;
  const { eq } = await import("drizzle-orm");
  await db.update(aiInteractionsTable)
    .set({ accepted })
    .where(eq(aiInteractionsTable.id, interactionId));
}
