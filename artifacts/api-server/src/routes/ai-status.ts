import { Router } from "express";
import { authenticate } from "../middleware/auth";
import type { Response, Request } from "express";
import { AuthRequest } from "../middleware/auth";
import { AI_AVAILABLE, AI_CONFIG, aiCircuitStatus } from "../services/ai";

const router = Router();

router.get("/settings/ai-status", authenticate, async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json({
    aiEnabled: AI_AVAILABLE,
    features: {
      mentor: AI_AVAILABLE,
      trialVault: true,
      echoProfile: true,
      tutorcraft: AI_AVAILABLE,
      flashcardGeneration: AI_AVAILABLE,
      revisionPlanning: AI_AVAILABLE,
      assessmentBuilder: AI_AVAILABLE,
    },
    provider: AI_AVAILABLE ? "nvidia" : null,
    model: AI_AVAILABLE ? AI_CONFIG.model : null,
    fallbackMode: !AI_AVAILABLE ? "rule_based" : null,
    message: AI_AVAILABLE
      ? `AI features fully enabled (model: ${AI_CONFIG.model}).`
      : "AI key not configured — rule-based fallbacks are active for all AI features.",
  });
});

router.get("/ai/health", async (_req: Request, res: Response): Promise<void> => {
  const cb = aiCircuitStatus();
  res.json({
    status: AI_AVAILABLE && cb.state !== "OPEN" ? "ok" : "degraded",
    provider: AI_AVAILABLE ? (process.env.NVIDIA_API_KEY ? "nvidia" : "openai") : null,
    model: AI_AVAILABLE ? AI_CONFIG.model : null,
    baseUrl: AI_AVAILABLE ? AI_CONFIG.baseUrl : null,
    fallbackMode: !AI_AVAILABLE ? "rule_based" : null,
    circuitBreaker: cb,
    features: {
      mentor: AI_AVAILABLE,
      tutorcraft: AI_AVAILABLE,
      trialVault: true,
      echoProfile: true,
      flashcardGeneration: AI_AVAILABLE,
      revisionPlanning: AI_AVAILABLE,
      assessmentBuilder: AI_AVAILABLE,
    },
    message: cb.state === "OPEN"
      ? `Circuit breaker OPEN — ${cb.recentFailures} recent failures. Requests paused for ${cb.config.resetTimeoutMs / 1000}s.`
      : AI_AVAILABLE
        ? `AI provider connected (${process.env.NVIDIA_API_KEY ? "NVIDIA" : "OpenAI"}). All AI features active.`
        : "No AI key configured. Degraded mode: rule-based fallbacks active.",
  });
});

export default router;
