import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const querySchema = {
  ...schema,
  accounts: schema.accountsTable,
  ascendProfiles: schema.ascendProfilesTable,
  attendance: schema.attendanceTable,
  auditLogs: schema.auditLogsTable,
  echoMemory: schema.echoMemoryTable,
  engagementRecords: schema.engagementRecordsTable,
  examinerReports: schema.examinerReportsTable,
  examQuestions: schema.examQuestionsTable,
  exams: schema.examsTable,
  flashcardDecks: schema.flashcardDecksTable,
  flashcardItems: schema.flashcardItemsTable,
  flashcardProgress: schema.flashcardProgressTable,
  helpdeskTickets: schema.helpdeskTicketsTable,
  homework: schema.homeworkTable,
  homeworkSubmissions: schema.homeworkSubmissionsTable,
  lessonContent: schema.lessonContentTable,
  lessons: schema.lessonsTable,
  markSchemes: schema.markSchemesTable,
  notifications: schema.notificationsTable,
  organizations: schema.organizationsTable,
  pastPapers: schema.pastPapersTable,
  questionBank: schema.questionBankTable,
  quests: schema.questsTable,
  recordings: schema.recordingsTable,
  resources: schema.resourcesTable,
  sessions: schema.sessionsTable,
  studentMarks: schema.studentMarksTable,
  students: schema.studentsTable,
  subjects: schema.subjectsTable,
  subscriptionPlans: schema.subscriptionPlansTable,
  subscriptions: schema.subscriptionsTable,
  studyGroups: schema.studyGroupsTable,
  groupMembers: schema.groupMembersTable,
  groupChallenges: schema.groupChallengesTable,
  studentGoals: schema.studentGoalsTable,
  focusSessions: schema.focusSessionsTable,
  trialVaultAttempts: schema.trialVaultAttemptsTable,
  examVaultPackages: schema.examVaultPackagesTable,
  studentFeedItems: schema.studentFeedItemsTable,
  snapgradeSubmissions: schema.snapgradeSubmissionsTable,
  peerReviews: schema.peerReviewsTable,
  messageThreads: schema.messageThreadsTable,
  studentMessages: schema.studentMessagesTable,
  simulations: schema.simulationsTable,
  simulationResults: schema.simulationResultsTable,
  aiInteractions: schema.aiInteractionsTable,
  misconceptions: schema.misconceptionsTable,
  knowledgeNodes: schema.knowledgeNodesTable,
  knowledgeEdges: schema.knowledgeEdgesTable,
  // Phase 8 — Learning Experience
  masteryRecords: schema.masteryRecordsTable,
  learningPaths: schema.learningPathsTable,
  microAssessments: schema.microAssessmentsTable,
  learningGoals: schema.learningGoalsTable,
  challenges: schema.challengesTable,
  challengeParticipations: schema.challengeParticipationsTable,
  learningAnalyticsSnapshots: schema.learningAnalyticsSnapshotsTable,
  offlineContent: schema.offlineContentTable,
  recommendationFeedback: schema.recommendationFeedbackTable,
  // Phase 7 — Communication
  messageThreadsExt: schema.messageThreadsExtTable,
  threadParticipants: schema.threadParticipantsTable,
  threadMessages: schema.threadMessagesTable,
  announcements: schema.announcementsTable,
  announcementReads: schema.announcementReadsTable,
  collaborationRooms: schema.collaborationRoomsTable,
  roomMembers: schema.roomMembersTable,
  roomMessages: schema.roomMessagesTable,
  sharedResources: schema.sharedResourcesTable,
  supportTickets: schema.supportTicketsTable,
  ticketResponses: schema.ticketResponsesTable,
  notificationPreferences: schema.notificationPreferencesTable,
  moderationLogs: schema.moderationLogsTable,
  classChannels: schema.classChannelsTable,
  channelMessages: schema.channelMessagesTable,
};

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema: querySchema });

export * from "./schema";
