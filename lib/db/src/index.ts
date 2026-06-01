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
  flexSeats: schema.flexSeatsTable,
  helpdeskTickets: schema.helpdeskTicketsTable,
  homework: schema.homeworkTable,
  homeworkSubmissions: schema.homeworkSubmissionsTable,
  lessonContent: schema.lessonContentTable,
  lessons: schema.lessonsTable,
  liveClassRooms: schema.liveClassRoomsTable,
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
};

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema: querySchema });

export * from "./schema";
