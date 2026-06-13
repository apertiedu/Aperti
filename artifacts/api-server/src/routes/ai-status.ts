import { Router } from "express";
import { authenticate } from "../middleware/auth";
import type { Response, Request } from "express";
import { AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/settings/ai-status", authenticate, async (_req: AuthRequest, res: Response): Promise<void> => {
  const hasKey = !!process.env.OPENAI_API_KEY;
  res.json({
    aiEnabled: hasKey,
    features: {
      mentor: hasKey,
      snapgrade: true,
      trialVault: true,
      echoProfile: true,
      tutorcraft: hasKey,
    },
    fallbackMode: !hasKey ? "rule_based" : null,
    message: hasKey
      ? "AI features are fully enabled."
      : "AI key not configured — rule-based fallbacks are active for all AI features.",
  });
});

router.get("/ai/health", async (_req: Request, res: Response): Promise<void> => {
  const hasKey = !!process.env.OPENAI_API_KEY;
  res.json({
    status: hasKey ? "ok" : "degraded",
    provider: hasKey ? "openai" : null,
    model: hasKey ? "gpt-4o" : null,
    fallbackMode: !hasKey ? "rule_based" : null,
    features: {
      mentor: hasKey,
      tutorcraft: hasKey,
      snapgrade: true,
      trialVault: true,
      echoProfile: true,
      flashcardGeneration: hasKey,
      revisionPlanning: hasKey,
      assessmentBuilder: hasKey,
    },
    message: hasKey
      ? "AI provider connected. All AI features active."
      : "No AI key configured. Degraded mode: rule-based fallbacks active.",
  });
});

export default router;
