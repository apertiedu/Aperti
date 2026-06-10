export const AI_CONFIG = {
  provider: "openai" as const,
  model: process.env.OPENAI_MODEL || "meta/llama-3.1-70b-instruct",
  maxTokens: {
    default: 1000,
    feedback: 200,
    analysis: 1500,
    summary: 800,
    syllabus: 2000,
  },
  baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
};

const LANG_NAMES: Record<string, string> = {
  ar: "Arabic",
  fr: "French",
  es: "Spanish",
  de: "German",
  zh: "Chinese (Simplified)",
  hi: "Hindi",
  ur: "Urdu",
  tr: "Turkish",
  pt: "Portuguese",
};

export function withLanguage(systemPrompt: string, language?: string): string {
  if (!language || language === "en") return systemPrompt;
  const langName = LANG_NAMES[language] ?? language;
  return systemPrompt + `\n\nIMPORTANT: You must respond entirely in ${langName}. All explanations, feedback, and messages must be in ${langName} only.`;
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
  const phrases = LANG_PHRASES[language];
  if (!phrases) return "";
  return phrases[key] ?? "";
}

export async function openaiChat(opts: {
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
  language?: string;
}): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const system = withLanguage(opts.systemPrompt, opts.language);

  try {
    const res = await fetch(`${AI_CONFIG.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: AI_CONFIG.model,
        max_tokens: opts.maxTokens ?? AI_CONFIG.maxTokens.default,
        messages: [
          { role: "system", content: system },
          { role: "user", content: opts.userMessage },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    return data.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}
