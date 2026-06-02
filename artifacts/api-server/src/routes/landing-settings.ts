import { Router, Response } from "express";
import { db } from "@workspace/db";
import { landingSettingsTable } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { eq } from "drizzle-orm";

export const landingSettingsRouter = Router();

const DEFAULTS: Record<string, unknown> = {
  hero_headline: "Where every mind",
  hero_headline_accent: "finds its rhythm.",
  hero_subheadline: "The intelligent operating system that unifies teaching, learning, and assessment in one breathtakingly simple platform.",
  hero_cta_primary: "Explore Courses",
  hero_cta_secondary: "Request Early Access",
  trust_badges: ["GDPR-compliant data ownership", "Dedicated onboarding support", "No lock-in contracts"],
  show_pricing: true,
  show_marketplace: true,
  show_early_access: true,
  show_testimonials: true,
  show_stats: true,
  features: [
    { icon: "BarChart3",    title: "Insight Stream",    desc: "Real-time analytics: attendance, grades, risk alerts, and AI-generated action plans." },
    { icon: "Video",        title: "LiveClass",         desc: "WebRTC-powered live classes with recording, screen-share, and interactive whiteboard." },
    { icon: "Brain",        title: "AI Mentor",         desc: "24/7 AI tutor trained on your material. Students get instant help anytime." },
    { icon: "BookOpen",     title: "QueryVault",        desc: "Smart question bank with AI generation — build balanced exams in seconds." },
    { icon: "CheckSquare",  title: "CheckIn",           desc: "QR-code or manual attendance. Auto-absence detection. CSV export." },
    { icon: "MessageSquare","title": "Parent Connect",  desc: "Automated parent WhatsApp alerts. Absence notices, performance summaries." },
  ],
};

// GET /landing-settings — public, returns all settings with defaults
landingSettingsRouter.get("/landing-settings", async (_req, res: Response) => {
  const rows = await db.select().from(landingSettingsTable);
  const settings: Record<string, unknown> = { ...DEFAULTS };
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  res.json(settings);
});

// PUT /landing-settings/:key — admin updates a setting
landingSettingsRouter.put("/landing-settings/:key", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const { key } = req.params;
  const { value } = req.body;

  await db.insert(landingSettingsTable)
    .values({ key, value })
    .onConflictDoUpdate({
      target: landingSettingsTable.key,
      set: { value, updatedAt: new Date() },
    });

  res.json({ success: true });
});

// PUT /landing-settings (bulk) — update multiple settings at once
landingSettingsRouter.put("/landing-settings", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const settings = req.body as Record<string, unknown>;

  for (const [key, value] of Object.entries(settings)) {
    await db.insert(landingSettingsTable)
      .values({ key, value })
      .onConflictDoUpdate({
        target: landingSettingsTable.key,
        set: { value, updatedAt: new Date() },
      });
  }

  res.json({ success: true });
});
