import { Router } from "express";
import { authenticate } from "../middleware/auth";
import type { Response } from "express";
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

export default router;
