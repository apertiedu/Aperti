import { db } from "@workspace/db";
import { echoMemoryTable, studentsTable, misconceptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getRelatedNodes, getRecommendations, getOrCreateNode } from "./weave-graph";
import { logInteraction } from "./ai-safety";

export interface StudentProfile {
  studentId: number;
  weakTopics: string[];
  strongTopics: string[];
  mistakeHistory: Record<string, number>;
  preferredStyle: string;
  learningPace: string;
  burnoutRisk: number;
  confidenceScore: number;
}

export interface CoreMindAnalysis {
  weakTopics: string[];
  strongTopics: string[];
  recommendedActions: string[];
  riskLevel: "low" | "medium" | "high";
  examReadiness: number;
  nextBestTopic: string | null;
  weaveRecommendations: Array<{ id: number; name: string; type: string }>;
  confidence: number;
  sources: string[];
}

export interface MentorEnhancement {
  contextualNodes: Array<{ id: number; name: string; type: string }>;
  preferredStyle: string;
  recentMistakes: Array<{ topic: string; count: number }>;
  relatedTopics: string[];
  misconceptions: string[];
  confidence: number;
  sources: string[];
}

export interface GradingEnhancement {
  misconceptions: Array<{ pattern: string; description: string; severity: string }>;
  feedbackTemplate: string;
  confidence: number;
  sources: string[];
}

export async function getStudentProfile(studentId: number): Promise<StudentProfile | null> {
  const memory = await db.query.echoMemory.findFirst({
    where: (m, { eq: E }) => E(m.studentId, studentId),
  });
  if (!memory) return null;
  return {
    studentId,
    weakTopics: (memory.weakTopics as string[]) ?? [],
    strongTopics: (memory.strongTopics as string[]) ?? [],
    mistakeHistory: (memory.mistakeHistory as Record<string, number>) ?? {},
    preferredStyle: memory.preferredStyle ?? "conceptual",
    learningPace: memory.learningPace ?? "medium",
    burnoutRisk: parseFloat(String(memory.burnoutRisk ?? 0)),
    confidenceScore: parseFloat(String(memory.confidenceScore ?? 50)),
  };
}

export async function analyzeStudent(studentId: number): Promise<CoreMindAnalysis> {
  const profile = await getStudentProfile(studentId);
  const sources: string[] = [];

  if (!profile) {
    return {
      weakTopics: [],
      strongTopics: [],
      recommendedActions: ["Complete more practice sessions to build your profile."],
      riskLevel: "low",
      examReadiness: 50,
      nextBestTopic: null,
      weaveRecommendations: [],
      confidence: 0.3,
      sources: ["No echo memory found — using defaults"],
    };
  }

  sources.push("Echo memory profile");

  const sortedWeak = Object.entries(profile.mistakeHistory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic]) => topic);

  let weaveRecs: Array<{ id: number; name: string; type: string }> = [];
  try {
    weaveRecs = await getRecommendations(studentId, "topic");
    if (weaveRecs.length > 0) sources.push("Knowledge graph prerequisites");
  } catch { /* weave may be empty */ }

  const riskLevel: "low" | "medium" | "high" =
    profile.burnoutRisk > 0.7 ? "high"
    : profile.burnoutRisk > 0.4 ? "medium"
    : "low";

  const examReadiness = Math.max(10, Math.round(profile.confidenceScore));

  const recommendedActions: string[] = [];
  if (profile.weakTopics.length > 0) {
    recommendedActions.push(`Review: ${profile.weakTopics.slice(0, 3).join(", ")}`);
  }
  if (weaveRecs.length > 0) {
    recommendedActions.push(`Cover prerequisite: ${weaveRecs[0].name}`);
  }
  if (profile.burnoutRisk > 0.5) {
    recommendedActions.push("Take a short break — burnout risk detected");
  }
  if (recommendedActions.length === 0) {
    recommendedActions.push("Great progress! Try a timed trial vault session.");
  }

  const nextBestTopic = weaveRecs[0]?.name ?? profile.weakTopics[0] ?? null;

  await logInteraction({
    userId: studentId,
    module: "coremind",
    action: "analyze",
    inputSummary: `studentId=${studentId}`,
    outputSummary: `riskLevel=${riskLevel}, nextBest=${nextBestTopic}`,
    confidence: 0.75,
    sources,
  });

  return {
    weakTopics: profile.weakTopics,
    strongTopics: profile.strongTopics,
    recommendedActions,
    riskLevel,
    examReadiness,
    nextBestTopic,
    weaveRecommendations: weaveRecs,
    confidence: 0.75,
    sources,
  };
}

export async function enhanceMentor(studentId: number, message: string): Promise<MentorEnhancement> {
  const profile = await getStudentProfile(studentId);
  const sources: string[] = [];
  const contextualNodes: Array<{ id: number; name: string; type: string }> = [];

  if (!profile) {
    return {
      contextualNodes: [],
      preferredStyle: "conceptual",
      recentMistakes: [],
      relatedTopics: [],
      misconceptions: [],
      confidence: 0.3,
      sources: ["No profile — using defaults"],
    };
  }

  sources.push("Echo memory");

  const recentMistakes = Object.entries(profile.mistakeHistory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([topic, count]) => ({ topic, count }));

  let relatedTopics: string[] = [];
  try {
    const recs = await getRecommendations(studentId, "topic");
    relatedTopics = recs.slice(0, 5).map(n => n.name);
    if (relatedTopics.length > 0) sources.push("Knowledge graph");
  } catch { /* weave may be empty */ }

  const mentionedTopic = profile.weakTopics.find(t =>
    message.toLowerCase().includes(t.toLowerCase())
  );

  let misconceptions: string[] = [];
  if (mentionedTopic) {
    try {
      const miscs = await db.select().from(misconceptionsTable)
        .where(eq(misconceptionsTable.topic, mentionedTopic))
        .limit(3);
      misconceptions = miscs.map(m => m.pattern);
      if (misconceptions.length > 0) sources.push("Misconception database");
    } catch { /* table may not exist yet */ }
  }

  return {
    contextualNodes,
    preferredStyle: profile.preferredStyle,
    recentMistakes,
    relatedTopics,
    misconceptions,
    confidence: 0.8,
    sources,
  };
}

export async function enhanceGrading(
  questionId: number,
  answer: string,
  topic?: string
): Promise<GradingEnhancement> {
  const sources: string[] = ["Mark scheme criteria"];
  const misconceptions: Array<{ pattern: string; description: string; severity: string }> = [];

  if (topic) {
    try {
      const dbMiscs = await db.select().from(misconceptionsTable)
        .where(eq(misconceptionsTable.topic, topic))
        .limit(5);
      for (const m of dbMiscs) {
        const examples = (m.examples as string[]) ?? [];
        const triggered = examples.some(ex => answer.toLowerCase().includes(ex.toLowerCase()))
          || answer.toLowerCase().includes(m.pattern.toLowerCase());
        if (triggered) {
          misconceptions.push({ pattern: m.pattern, description: m.description, severity: m.severity });
          sources.push(`Misconception: ${m.pattern}`);
        }
      }
    } catch { /* table may not exist */ }
  }

  let feedbackTemplate = "Check the mark scheme criteria for completeness.";
  if (misconceptions.length > 0) {
    feedbackTemplate = `Watch out for: ${misconceptions.map(m => m.description).join("; ")}`;
  }

  return {
    misconceptions,
    feedbackTemplate,
    confidence: misconceptions.length > 0 ? 0.85 : 0.6,
    sources,
  };
}
