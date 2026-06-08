CREATE TABLE "challenge_participations" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"challenge_id" integer NOT NULL,
	"status" text DEFAULT 'joined' NOT NULL,
	"score" numeric(10, 2) DEFAULT '0',
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'weekly' NOT NULL,
	"rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"xp_reward" integer DEFAULT 200 NOT NULL,
	"start_date" text,
	"end_date" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_analytics_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"date" text NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"type" text DEFAULT 'custom' NOT NULL,
	"title" text NOT NULL,
	"target" text,
	"deadline" text,
	"progress" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"icon" text DEFAULT '🎯',
	"xp_reward" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_paths" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"course_id" integer,
	"path_type" text DEFAULT 'adaptive' NOT NULL,
	"nodes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mastery_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"course_id" integer,
	"topic_id" integer,
	"topic_name" text DEFAULT '' NOT NULL,
	"mastery_state" text DEFAULT 'not_started' NOT NULL,
	"confidence_score" integer DEFAULT 0 NOT NULL,
	"last_interacted_at" timestamp with time zone DEFAULT now(),
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "micro_assessments" (
	"id" serial PRIMARY KEY NOT NULL,
	"lesson_id" integer,
	"student_id" integer NOT NULL,
	"type" text DEFAULT 'knowledge_check' NOT NULL,
	"topic" text,
	"questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"answers" jsonb,
	"score" numeric(10, 2),
	"feedback" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offline_content" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"content_type" text DEFAULT 'lesson' NOT NULL,
	"content_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"synced_at" timestamp with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendation_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"recommendation_type" text NOT NULL,
	"resource_id" text,
	"rating" text DEFAULT 'helpful' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "challenge_participations" ADD CONSTRAINT "challenge_participations_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_participations" ADD CONSTRAINT "challenge_participations_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_created_by_accounts_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_analytics_snapshots" ADD CONSTRAINT "learning_analytics_snapshots_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_goals" ADD CONSTRAINT "learning_goals_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mastery_records" ADD CONSTRAINT "mastery_records_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "micro_assessments" ADD CONSTRAINT "micro_assessments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offline_content" ADD CONSTRAINT "offline_content_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;