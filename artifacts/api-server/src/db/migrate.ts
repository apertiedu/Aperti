import { pool } from "@workspace/db";

const MIGRATIONS: string[] = [
  /* ── Teacher Courses ─────────────────────────────────────────────────── */
  `CREATE TABLE IF NOT EXISTS teacher_courses (
    id                  serial PRIMARY KEY,
    teacher_account_id  integer NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    subject_id          integer REFERENCES subjects(id) ON DELETE SET NULL,
    name                text NOT NULL,
    description         text,
    board               text NOT NULL DEFAULT 'CAIE',
    level               text NOT NULL DEFAULT 'A-Level',
    session             text,
    duration_weeks      integer NOT NULL DEFAULT 12,
    language            text NOT NULL DEFAULT 'English',
    visibility          text NOT NULL DEFAULT 'draft',
    thumbnail_url       text,
    settings            jsonb NOT NULL DEFAULT '{}',
    created_at          timestamptz NOT NULL DEFAULT NOW(),
    updated_at          timestamptz NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS course_units (
    id         serial PRIMARY KEY,
    course_id  integer NOT NULL REFERENCES teacher_courses(id) ON DELETE CASCADE,
    title      text NOT NULL,
    ord        integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS course_topics (
    id       serial PRIMARY KEY,
    unit_id  integer NOT NULL REFERENCES course_units(id) ON DELETE CASCADE,
    title    text NOT NULL,
    ord      integer NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS course_lessons_map (
    id          serial PRIMARY KEY,
    topic_id    integer NOT NULL REFERENCES course_topics(id) ON DELETE CASCADE,
    title       text NOT NULL,
    type        text NOT NULL DEFAULT 'lecture',
    content_id  integer REFERENCES lesson_content(id) ON DELETE SET NULL,
    duration_min integer NOT NULL DEFAULT 60,
    ord         integer NOT NULL DEFAULT 0
  )`,
  /* ── CheckIn tokens ──────────────────────────────────────────────────── */
  `CREATE TABLE IF NOT EXISTS checkin_tokens (
    id         serial PRIMARY KEY,
    lesson_id  integer NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    token      text NOT NULL UNIQUE,
    pin        text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW()
  )`,
  /* ── Rubrics ─────────────────────────────────────────────────────────── */
  `CREATE TABLE IF NOT EXISTS rubrics (
    id                 serial PRIMARY KEY,
    teacher_account_id integer NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    homework_id        integer REFERENCES homework(id) ON DELETE SET NULL,
    subject_id         integer REFERENCES subjects(id) ON DELETE SET NULL,
    title              text NOT NULL,
    type               text NOT NULL DEFAULT 'analytic',
    max_marks          numeric(10,2) NOT NULL DEFAULT 10,
    criteria           jsonb NOT NULL DEFAULT '[]',
    created_at         timestamptz NOT NULL DEFAULT NOW(),
    updated_at         timestamptz NOT NULL DEFAULT NOW()
  )`,
  /* ── Messages ────────────────────────────────────────────────────────── */
  `CREATE TABLE IF NOT EXISTS messages (
    id              serial PRIMARY KEY,
    from_account_id integer NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    to_account_id   integer NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    subject         text,
    body            text NOT NULL,
    read            boolean NOT NULL DEFAULT false,
    created_at      timestamptz NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS announcements (
    id                 serial PRIMARY KEY,
    teacher_account_id integer NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    title              text NOT NULL,
    body               text NOT NULL,
    audience           text NOT NULL DEFAULT 'all',
    subject_id         integer REFERENCES subjects(id) ON DELETE SET NULL,
    sent_at            timestamptz,
    created_at         timestamptz NOT NULL DEFAULT NOW()
  )`,
  /* ── Column additions (idempotent) ───────────────────────────────────── */
  `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS method  text NOT NULL DEFAULT 'manual'`,
  `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT true`,
  `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS location text`,
  `ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS paper_type    text`,
  `ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS command_word  text`,
  `ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS skill         text`,
  `ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS year          integer`,
  `ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS source        text`,
  `ALTER TABLE homework ADD COLUMN IF NOT EXISTS submission_type text NOT NULL DEFAULT 'file'`,
  `ALTER TABLE homework ADD COLUMN IF NOT EXISTS rubric_id       integer`,
  `ALTER TABLE homework ADD COLUMN IF NOT EXISTS course_id       integer`,
  `ALTER TABLE homework ADD COLUMN IF NOT EXISTS unit_id         integer`,
  `ALTER TABLE homework ADD COLUMN IF NOT EXISTS estimated_mins  integer NOT NULL DEFAULT 30`,
  `ALTER TABLE homework_submissions ADD COLUMN IF NOT EXISTS file_url       text`,
  `ALTER TABLE homework_submissions ADD COLUMN IF NOT EXISTS annotation_json jsonb`,
  `ALTER TABLE homework_submissions ADD COLUMN IF NOT EXISTS is_late        boolean NOT NULL DEFAULT false`,
  `ALTER TABLE lesson_content ADD COLUMN IF NOT EXISTS template     text NOT NULL DEFAULT 'lecture'`,
  `ALTER TABLE lesson_content ADD COLUMN IF NOT EXISTS status       text NOT NULL DEFAULT 'draft'`,
  `ALTER TABLE lesson_content ADD COLUMN IF NOT EXISTS subject_id   integer`,
  `ALTER TABLE lesson_content ADD COLUMN IF NOT EXISTS published_at timestamptz`,
  `ALTER TABLE live_class_rooms ADD COLUMN IF NOT EXISTS recording_url  text`,
  `ALTER TABLE live_class_rooms ADD COLUMN IF NOT EXISTS waiting_room   boolean NOT NULL DEFAULT false`,
  `ALTER TABLE live_class_rooms ADD COLUMN IF NOT EXISTS chat_mode      text NOT NULL DEFAULT 'public'`,
  `ALTER TABLE lessons ADD COLUMN IF NOT EXISTS title       text`,
  `ALTER TABLE lessons ADD COLUMN IF NOT EXISTS description text`,
  `ALTER TABLE lessons ADD COLUMN IF NOT EXISTS end_time    text`,
  `ALTER TABLE lessons ADD COLUMN IF NOT EXISTS color       text NOT NULL DEFAULT '#00796B'`,
];

export async function runMigrations(): Promise<void> {
  for (const sql of MIGRATIONS) {
    try {
      await pool.query(sql);
    } catch {
      // already applied or non-critical — continue
    }
  }
  console.log("[migrate] Phase-2 migrations applied");
}
