/**
 * ai-config.ts — backward-compat shim
 *
 * All new code should import from "../services/ai" directly.
 * This file re-exports everything so existing routes don't break.
 */
export {
  AI_CONFIG,
  AI_AVAILABLE,
  openaiChat,
  generateAIResponse,
  generateAIText,
} from "../services/ai";

export type { AIOptions, AIResponse } from "../services/ai";

// ── Language utilities (used by several routes) ───────────────────────────────

const LANG_NAMES: Record<string, string> = {
  ar: "Arabic", fr: "French", es: "Spanish", de: "German",
  zh: "Chinese (Simplified)", hi: "Hindi", ur: "Urdu",
  tr: "Turkish", pt: "Portuguese",
};

export function withLanguage(systemPrompt: string, language?: string): string {
  if (!language || language === "en") return systemPrompt;
  const name = LANG_NAMES[language] ?? language;
  return systemPrompt + `\n\nIMPORTANT: You must respond entirely in ${name}. All explanations, feedback, and messages must be in ${name} only.`;
}

export const ARABIC_PHRASES: Record<string, string> = {
  greeting: "مرحباً! كيف يمكنني مساعدتك؟",
  iDontUnderstand: "عذراً، لم أفهم سؤالك تماماً. هل يمكنك توضيح ذلك؟",
  letsPractice: "دعونا نتدرب على هذا الموضوع معاً.",
  greatWork: "عمل رائع! استمر في هذا المستوى الممتاز.",
  tryAgain: "لا بأس، حاول مرة أخرى. أنت تتحسن.",
  wellDone: "أحسنت! هذا صحيح تماماً.",
  needHelp: "هل تحتاج إلى مساعدة؟ أنا هنا للمساعدة.",
  noData: "لا تتوفر بيانات كافية حالياً.",
  keepGoing: "استمر في التعلم، أنت على المسار الصحيح!",
};

export const LANG_PHRASES: Record<string, Record<string, string>> = {
  ar: ARABIC_PHRASES,
  fr: {
    greeting: "Bonjour ! Comment puis-je vous aider ?",
    iDontUnderstand: "Désolé, je n'ai pas bien compris votre question.",
    letsPractice: "Pratiquons ce sujet ensemble.",
    greatWork: "Excellent travail ! Continuez comme ça.",
    tryAgain: "Pas de problème, essayez encore une fois.",
    wellDone: "Bien fait ! C'est tout à fait correct.",
    needHelp: "Avez-vous besoin d'aide ?",
    noData: "Données insuffisantes pour le moment.",
    keepGoing: "Continuez à apprendre, vous êtes sur la bonne voie !",
  },
};

export function getFallbackPhrase(key: string, language?: string): string {
  if (!language || language === "en") return "";
  return LANG_PHRASES[language]?.[key] ?? "";
}
