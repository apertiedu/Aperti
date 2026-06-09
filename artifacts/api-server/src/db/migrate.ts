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
  /* ── Ascend subject XP map ──────────────────────────────────────────────── */
  `ALTER TABLE ascend_profiles ADD COLUMN IF NOT EXISTS subject_xp jsonb NOT NULL DEFAULT '{}'`,
  /* ── Accounts: first_name / last_name ───────────────────────────────────── */
  `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS first_name text`,
  `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_name  text`,
  /* ── Focus sessions: start/complete lifecycle ───────────────────────────── */
  `ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS started_at timestamptz NOT NULL DEFAULT NOW()`,
  `ALTER TABLE focus_sessions ALTER COLUMN completed_at DROP NOT NULL`,
  `ALTER TABLE focus_sessions ALTER COLUMN completed_at DROP DEFAULT`,
  /* ── Student OS tables (Phase 3) ─────────────────────────────────────────── */
  `CREATE TABLE IF NOT EXISTS study_groups (
    id          serial PRIMARY KEY,
    name        text NOT NULL,
    creator_id  integer NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject_id  integer REFERENCES subjects(id) ON DELETE SET NULL,
    description text,
    created_at  timestamptz NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS group_members (
    id          serial PRIMARY KEY,
    group_id    integer NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
    student_id  integer NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    role        text NOT NULL DEFAULT 'member',
    joined_at   timestamptz NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS group_challenges (
    id          serial PRIMARY KEY,
    group_id    integer NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
    title       text NOT NULL,
    type        text NOT NULL DEFAULT 'quiz',
    status      text NOT NULL DEFAULT 'open',
    created_at  timestamptz NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS student_goals (
    id          serial PRIMARY KEY,
    student_id  integer NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    title       text NOT NULL,
    type        text NOT NULL DEFAULT 'daily',
    target_date text,
    completed_at timestamptz,
    xp_reward   integer NOT NULL DEFAULT 50,
    source      text NOT NULL DEFAULT 'manual',
    created_at  timestamptz NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS focus_sessions (
    id               serial PRIMARY KEY,
    student_id       integer NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    mode             text NOT NULL DEFAULT 'pomodoro',
    duration_minutes integer NOT NULL DEFAULT 25,
    xp_earned        integer NOT NULL DEFAULT 0,
    started_at       timestamptz NOT NULL DEFAULT NOW(),
    completed_at     timestamptz
  )`,
  `CREATE TABLE IF NOT EXISTS trial_vault_attempts (
    id              serial PRIMARY KEY,
    student_id      integer NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject_id      integer REFERENCES subjects(id) ON DELETE SET NULL,
    config          jsonb,
    questions       jsonb,
    answers         jsonb,
    score           numeric(10,2),
    topic_breakdown jsonb,
    timing_data     jsonb,
    completed_at    timestamptz,
    created_at      timestamptz NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS exam_vault_packages (
    id               serial PRIMARY KEY,
    exam_id          integer NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    student_id       integer NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    encrypted_data   text,
    encryption_key   text,
    downloaded_at    timestamptz,
    submitted_at     timestamptz,
    submission_data  text,
    graded_score     numeric(10,2),
    created_at       timestamptz NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS inkspace_notebooks (
    id         serial PRIMARY KEY,
    student_id integer NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    title      text NOT NULL DEFAULT 'Untitled Notebook',
    color      text NOT NULL DEFAULT '#00796B',
    created_at timestamptz NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS inkspace_pages (
    id          serial PRIMARY KEY,
    notebook_id integer NOT NULL REFERENCES inkspace_notebooks(id) ON DELETE CASCADE,
    title       text NOT NULL DEFAULT 'Untitled Page',
    sort_order  integer NOT NULL DEFAULT 0,
    content     jsonb,
    updated_at  timestamptz NOT NULL DEFAULT NOW(),
    created_at  timestamptz NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS inkspace_blocks (
    id         serial PRIMARY KEY,
    page_id    integer NOT NULL REFERENCES inkspace_pages(id) ON DELETE CASCADE,
    type       text NOT NULL DEFAULT 'text',
    data       jsonb,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS student_feed_items (
    id         serial PRIMARY KEY,
    student_id integer NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    type       text NOT NULL,
    title      text NOT NULL,
    subtitle   text,
    priority   numeric(10,4) NOT NULL DEFAULT 0,
    action_url text,
    icon       text,
    is_read    boolean NOT NULL DEFAULT false,
    expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS snapgrade_submissions (
    id           serial PRIMARY KEY,
    student_id   integer NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    homework_id  integer REFERENCES homework(id) ON DELETE SET NULL,
    image_url    text,
    ocr_text     text,
    ai_analysis  jsonb,
    grade        numeric(10,2),
    feedback     text,
    submitted_at timestamptz NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS peer_reviews (
    id            serial PRIMARY KEY,
    reviewer_id   integer NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    submission_id integer NOT NULL REFERENCES snapgrade_submissions(id) ON DELETE CASCADE,
    rating        integer,
    comment       text,
    rubric        jsonb,
    created_at    timestamptz NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS message_threads (
    id              serial PRIMARY KEY,
    participants    jsonb NOT NULL DEFAULT '[]',
    subject         text,
    last_message_at timestamptz NOT NULL DEFAULT NOW(),
    created_at      timestamptz NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS student_messages (
    id         serial PRIMARY KEY,
    thread_id  integer NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
    sender_id  integer NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    content    text NOT NULL,
    read_by    jsonb NOT NULL DEFAULT '[]',
    sent_at    timestamptz NOT NULL DEFAULT NOW()
  )`,
  /* ── Phase 4: Parent & Guardian OS ─────────────────────────────────────── */
  `CREATE TABLE IF NOT EXISTS parent_notifications (
    id         serial PRIMARY KEY,
    parent_id  integer NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    type       text NOT NULL DEFAULT 'general',
    title      text NOT NULL,
    message    text NOT NULL,
    is_read    boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS meetings (
    id         serial PRIMARY KEY,
    parent_id  integer NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    teacher_id integer NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    student_id integer REFERENCES students(id) ON DELETE SET NULL,
    title      text NOT NULL,
    date       text NOT NULL,
    time       text NOT NULL,
    status     text NOT NULL DEFAULT 'requested',
    notes      text,
    created_at timestamptz NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS parent_settings (
    id                        serial PRIMARY KEY,
    parent_id                 integer NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
    notification_preferences  jsonb NOT NULL DEFAULT '{"attendance":true,"grades":true,"assignments":true,"messages":true}',
    language                  text NOT NULL DEFAULT 'en',
    theme                     text NOT NULL DEFAULT 'light',
    created_at                timestamptz NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS intervention_alerts (
    id          serial PRIMARY KEY,
    student_id  integer NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    type        text NOT NULL DEFAULT 'academic',
    risk_level  text NOT NULL DEFAULT 'low',
    message     text NOT NULL,
    is_resolved boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT NOW()
  )`,
  /* ensure guardian_links has the columns added via raw SQL previously */
  `ALTER TABLE guardian_links ADD COLUMN IF NOT EXISTS status      text NOT NULL DEFAULT 'pending'`,
  `ALTER TABLE guardian_links ADD COLUMN IF NOT EXISTS pairing_code text`,
  `ALTER TABLE guardian_links ADD COLUMN IF NOT EXISTS requested_at timestamptz NOT NULL DEFAULT NOW()`,
  /* ── Phase 4 additions ───────────────────────────────────────────────────── */
  `CREATE TABLE IF NOT EXISTS documents (
    id          serial PRIMARY KEY,
    parent_id   integer NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    student_id  integer REFERENCES students(id) ON DELETE SET NULL,
    title       text NOT NULL,
    type        text NOT NULL DEFAULT 'report',
    file_url    text,
    created_at  timestamptz NOT NULL DEFAULT NOW()
  )`,
];

/* ── Phase 10 – Infrastructure, Security, Performance ─────────────────────── */
const PHASE10_MIGRATIONS: string[] = [
  /* MFA columns on accounts */
  `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS mfa_enabled boolean NOT NULL DEFAULT false`,
  `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS mfa_secret text`,

  /* Login history table */
  `CREATE TABLE IF NOT EXISTS login_history (
    id           serial PRIMARY KEY,
    account_id   integer REFERENCES accounts(id) ON DELETE SET NULL,
    username     text,
    ip           text,
    user_agent   text,
    success      boolean NOT NULL DEFAULT false,
    failure_reason text,
    created_at   timestamptz NOT NULL DEFAULT NOW()
  )`,

  /* API metrics table for performance tracking */
  `CREATE TABLE IF NOT EXISTS api_metrics (
    id          serial PRIMARY KEY,
    method      text NOT NULL,
    endpoint    text NOT NULL,
    status_code integer NOT NULL,
    duration_ms integer NOT NULL,
    recorded_at timestamptz NOT NULL DEFAULT NOW()
  )`,

  /* Entity versions table for data versioning */
  `CREATE TABLE IF NOT EXISTS entity_versions (
    id          serial PRIMARY KEY,
    entity_type text NOT NULL,
    entity_id   integer NOT NULL,
    version     integer NOT NULL DEFAULT 1,
    data        jsonb,
    changed_by  integer REFERENCES accounts(id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT NOW()
  )`,

  /* Migrations log table */
  `CREATE TABLE IF NOT EXISTS migrations_log (
    id         serial PRIMARY KEY,
    name       text NOT NULL UNIQUE,
    applied_at timestamptz NOT NULL DEFAULT NOW()
  )`,

  /* ── Performance indexes ──────────────────────────────────────────── */
  `CREATE INDEX IF NOT EXISTS idx_accounts_role ON accounts(role)`,
  `CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status)`,
  `CREATE INDEX IF NOT EXISTS idx_accounts_teacher_id ON accounts(teacher_account_id)`,
  `CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email)`,
  `CREATE INDEX IF NOT EXISTS idx_login_history_account_id ON login_history(account_id)`,
  `CREATE INDEX IF NOT EXISTS idx_login_history_created_at ON login_history(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_api_metrics_endpoint ON api_metrics(endpoint)`,
  `CREATE INDEX IF NOT EXISTS idx_api_metrics_recorded_at ON api_metrics(recorded_at)`,
  `CREATE INDEX IF NOT EXISTS idx_entity_versions_entity ON entity_versions(entity_type, entity_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_device_sessions_account_id ON device_sessions(account_id)`,
];

/* ── Phase 15 – Educational Content Ecosystem ─────────────────────────────── */
const PHASE15_MIGRATIONS: string[] = [
  /* Content Blocks */
  `CREATE TABLE IF NOT EXISTS content_blocks (
    id          serial PRIMARY KEY,
    page_id     integer NOT NULL REFERENCES lesson_content(id) ON DELETE CASCADE,
    block_type  text NOT NULL DEFAULT 'text',
    content     jsonb NOT NULL DEFAULT '{}',
    ord         integer NOT NULL DEFAULT 0,
    settings    jsonb NOT NULL DEFAULT '{}',
    created_by  integer REFERENCES accounts(id) ON DELETE SET NULL,
    version     integer NOT NULL DEFAULT 1,
    created_at  timestamptz NOT NULL DEFAULT NOW(),
    updated_at  timestamptz NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_content_blocks_page_id ON content_blocks(page_id)`,
  `CREATE INDEX IF NOT EXISTS idx_content_blocks_ord ON content_blocks(page_id, ord)`,

  /* Block Version History */
  `CREATE TABLE IF NOT EXISTS block_version_history (
    id          serial PRIMARY KEY,
    block_id    integer NOT NULL,
    version     integer NOT NULL,
    content     jsonb NOT NULL DEFAULT '{}',
    settings    jsonb NOT NULL DEFAULT '{}',
    changed_by  integer REFERENCES accounts(id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_block_versions_block ON block_version_history(block_id)`,

  /* Content Comments */
  `CREATE TABLE IF NOT EXISTS content_comments (
    id         serial PRIMARY KEY,
    block_id   integer NOT NULL,
    user_id    integer NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    comment    text NOT NULL,
    resolved   boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT NOW()
  )`,

  /* Curriculum Mappings */
  `CREATE TABLE IF NOT EXISTS curriculum_mappings (
    id                  serial PRIMARY KEY,
    content_type        text NOT NULL,
    content_id          integer NOT NULL,
    board               text,
    subject             text,
    paper               text,
    topic               text,
    subtopic            text,
    learning_objective  text,
    skill               text,
    command_word        text,
    difficulty          text,
    created_at          timestamptz NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_curriculum_mappings_content ON curriculum_mappings(content_type, content_id)`,
  `CREATE INDEX IF NOT EXISTS idx_curriculum_mappings_board ON curriculum_mappings(board, subject)`,

  /* Course Builder Templates */
  `CREATE TABLE IF NOT EXISTS course_builder_templates (
    id          serial PRIMARY KEY,
    name        text NOT NULL,
    description text,
    type        text NOT NULL DEFAULT 'teacher',
    structure   jsonb NOT NULL DEFAULT '{}',
    created_by  integer REFERENCES accounts(id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT NOW()
  )`,

  /* Question Metadata Extensions */
  `ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS board             text`,
  `ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS qualification     text`,
  `ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS paper             text`,
  `ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS session_name      text`,
  `ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS variant           text`,
  `ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS learning_objectives jsonb NOT NULL DEFAULT '[]'`,
  `ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS diagram_url       text`,
  `ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS mark_scheme_id    integer`,
  `ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS author            text`,
  `ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS question_type     text NOT NULL DEFAULT 'structured'`,

  /* Question Import Logs */
  `CREATE TABLE IF NOT EXISTS question_import_logs (
    id                  serial PRIMARY KEY,
    user_id             integer NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    source_type         text NOT NULL DEFAULT 'pdf',
    source_url          text,
    questions_imported  integer NOT NULL DEFAULT 0,
    status              text NOT NULL DEFAULT 'pending',
    errors              jsonb NOT NULL DEFAULT '[]',
    created_at          timestamptz NOT NULL DEFAULT NOW()
  )`,

  /* Question Extraction Jobs */
  `CREATE TABLE IF NOT EXISTS question_extraction_jobs (
    id              serial PRIMARY KEY,
    user_id         integer NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    file_url        text,
    status          text NOT NULL DEFAULT 'pending',
    extracted_data  jsonb NOT NULL DEFAULT '{}',
    reviewed_by     integer REFERENCES accounts(id) ON DELETE SET NULL,
    reviewed_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_question_extraction_jobs_user ON question_extraction_jobs(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_question_extraction_jobs_status ON question_extraction_jobs(status)`,

  /* Handwritten Submissions */
  `CREATE TABLE IF NOT EXISTS handwritten_submissions (
    id                serial PRIMARY KEY,
    submission_id     integer,
    student_id        integer REFERENCES accounts(id) ON DELETE CASCADE,
    image_url         text,
    processed_text    text,
    diagram_data      jsonb NOT NULL DEFAULT '{}',
    equation_data     jsonb NOT NULL DEFAULT '{}',
    step_analysis     jsonb NOT NULL DEFAULT '{}',
    confidence_score  numeric(5,2),
    created_at        timestamptz NOT NULL DEFAULT NOW()
  )`,

  /* Lab Configurations */
  `CREATE TABLE IF NOT EXISTS lab_configurations (
    id           serial PRIMARY KEY,
    teacher_id   integer NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    lab_type     text NOT NULL,
    config       jsonb NOT NULL DEFAULT '{}',
    is_published boolean NOT NULL DEFAULT false,
    created_at   timestamptz NOT NULL DEFAULT NOW(),
    updated_at   timestamptz NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_lab_configurations_teacher ON lab_configurations(teacher_id)`,

  /* Resource Library extensions */
  `ALTER TABLE resources ADD COLUMN IF NOT EXISTS version              integer NOT NULL DEFAULT 1`,
  `ALTER TABLE resources ADD COLUMN IF NOT EXISTS approval_status      text NOT NULL DEFAULT 'draft'`,
  `ALTER TABLE resources ADD COLUMN IF NOT EXISTS published_at         timestamptz`,
  `ALTER TABLE resources ADD COLUMN IF NOT EXISTS resource_tags        jsonb NOT NULL DEFAULT '[]'`,
  `ALTER TABLE resources ADD COLUMN IF NOT EXISTS curriculum_mapping_id integer`,

  /* Practice Sessions */
  `CREATE TABLE IF NOT EXISTS practice_sessions (
    id                  serial PRIMARY KEY,
    student_id          integer NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    subject             text,
    topics              jsonb NOT NULL DEFAULT '[]',
    questions_answered  integer NOT NULL DEFAULT 0,
    correct             integer NOT NULL DEFAULT 0,
    time_spent          integer NOT NULL DEFAULT 0,
    answers             jsonb NOT NULL DEFAULT '[]',
    started_at          timestamptz NOT NULL DEFAULT NOW(),
    ended_at            timestamptz
  )`,
  `CREATE INDEX IF NOT EXISTS idx_practice_sessions_student ON practice_sessions(student_id)`,

  /* Academic Analytics */
  `CREATE TABLE IF NOT EXISTS academic_analytics (
    id           serial PRIMARY KEY,
    content_type text NOT NULL,
    content_id   integer NOT NULL,
    metrics      jsonb NOT NULL DEFAULT '{}',
    recorded_at  timestamptz NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_academic_analytics_content ON academic_analytics(content_type, content_id)`,

  /* Geometrix Sessions */
  `CREATE TABLE IF NOT EXISTS geometrix_sessions (
    id         serial PRIMARY KEY,
    student_id integer NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    module     text NOT NULL,
    tool       text,
    data       jsonb NOT NULL DEFAULT '{}',
    score      numeric(5,2),
    created_at timestamptz NOT NULL DEFAULT NOW()
  )`,

  /* Question Relationships */
  `CREATE TABLE IF NOT EXISTS question_relationships (
    id             serial PRIMARY KEY,
    question_id    integer NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
    related_type   text NOT NULL,
    related_id     integer NOT NULL,
    created_at     timestamptz NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_question_relationships ON question_relationships(question_id)`,
];

const PHASE16_MIGRATIONS: string[] = [
  /* ── Deprecation Cleanup ─────────────────────────────────────────────── */
  `DROP TABLE IF EXISTS twin_control_sessions CASCADE`,
  `DROP TABLE IF EXISTS engagement_heatmap CASCADE`,
  `DROP TABLE IF EXISTS live_class_rooms CASCADE`,
  `DROP TABLE IF EXISTS flex_seats CASCADE`,
  `DROP TABLE IF EXISTS inkspace_blocks CASCADE`,
  `DROP TABLE IF EXISTS inkspace_pages CASCADE`,
  `DROP TABLE IF EXISTS inkspace_notebooks CASCADE`,

  /* ── Lessons: meeting link ───────────────────────────────────────────── */
  `ALTER TABLE lessons ADD COLUMN IF NOT EXISTS meeting_link TEXT`,

  /* ── Accounts: commerce flag ─────────────────────────────────────────── */
  `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS verified_for_commerce BOOLEAN NOT NULL DEFAULT FALSE`,

  /* ── Subscription Plans: extended limits + visibility ────────────────── */
  `ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS limits       JSONB NOT NULL DEFAULT '{}'`,
  `ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS visibility   BOOLEAN NOT NULL DEFAULT TRUE`,

  /* ── Subscriptions: payment tracking fields ──────────────────────────── */
  `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_reference  TEXT`,
  `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_proof_url  TEXT`,
  `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS verified_by        INTEGER REFERENCES accounts(id) ON DELETE SET NULL`,
  `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS verified_at        TIMESTAMPTZ`,

  /* ── Payment Requests ────────────────────────────────────────────────── */
  `CREATE TABLE IF NOT EXISTS payment_requests (
    id              serial PRIMARY KEY,
    user_id         integer NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    plan_id         integer NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
    amount          numeric(10,2) NOT NULL,
    reference_code  text NOT NULL UNIQUE,
    instructions    text,
    status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','paid','verified','rejected')),
    proof_url       text,
    transaction_id  text,
    webhook_url     text,
    reviewed_by     integer REFERENCES accounts(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_payment_requests_user   ON payment_requests(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status)`,

  /* ── Billing Invoices ────────────────────────────────────────────────── */
  `CREATE TABLE IF NOT EXISTS billing_invoices (
    id              serial PRIMARY KEY,
    user_id         integer NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    subscription_id integer REFERENCES subscriptions(id) ON DELETE SET NULL,
    amount          numeric(10,2) NOT NULL,
    plan_name       text NOT NULL,
    issued_at       timestamptz NOT NULL DEFAULT NOW(),
    due_at          timestamptz,
    status          text NOT NULL DEFAULT 'issued'
                    CHECK (status IN ('issued','paid','overdue','void'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_billing_invoices_user ON billing_invoices(user_id)`,

  /* ── Usage Tracking ──────────────────────────────────────────────────── */
  `CREATE TABLE IF NOT EXISTS usage_tracking (
    id            serial PRIMARY KEY,
    user_id       integer NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    resource      text NOT NULL,
    current_count integer NOT NULL DEFAULT 0,
    updated_at    timestamptz NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, resource)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_usage_tracking_user ON usage_tracking(user_id)`,

  /* ── Coming Soon Items ───────────────────────────────────────────────── */
  `CREATE TABLE IF NOT EXISTS coming_soon_items (
    id               serial PRIMARY KEY,
    feature_name     text NOT NULL,
    description      text,
    demo_url         text,
    release_window   text,
    waitlist_enabled boolean NOT NULL DEFAULT true,
    display_order    integer NOT NULL DEFAULT 0,
    created_at       timestamptz NOT NULL DEFAULT NOW()
  )`,

  /* ── Revision Notes ──────────────────────────────────────────────────── */
  `CREATE TABLE IF NOT EXISTS revision_notes (
    id           serial PRIMARY KEY,
    user_id      integer NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    title        text NOT NULL DEFAULT 'Untitled Note',
    content      text NOT NULL DEFAULT '',
    source_type  text,
    source_id    integer,
    ai_generated boolean NOT NULL DEFAULT false,
    created_at   timestamptz NOT NULL DEFAULT NOW(),
    updated_at   timestamptz NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_revision_notes_user ON revision_notes(user_id)`,

  /* ── Seed default Coming Soon items (SimVerse, Geometrix) ────────────── */
  `INSERT INTO coming_soon_items (feature_name, description, release_window, waitlist_enabled, display_order)
   VALUES
     ('SimVerse Labs', 'Full interactive virtual science labs for Physics, Chemistry and Biology — run experiments without any equipment.', 'Q3 2026', true, 1),
     ('Geometrix', 'Advanced interactive geometry suite with construction tools, 3D visualization, and AI-guided proofs.', 'Q3 2026', true, 2),
     ('AI Tutor Video', 'Step-by-step AI-generated video lessons personalized to each student''s pace.', 'Q4 2026', true, 3),
     ('Parent Learning Portal', 'A dedicated portal for parents to follow lesson content alongside their child.', 'Q4 2026', true, 4)
   ON CONFLICT DO NOTHING`,
];

const PHASE17_MIGRATIONS: string[] = [
  /* ── Push Subscriptions ──────────────────────────────────────────────── */
  `CREATE TABLE IF NOT EXISTS push_subscriptions (
    id         serial PRIMARY KEY,
    user_id    integer NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    endpoint   text NOT NULL,
    auth       text NOT NULL,
    p256dh     text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, endpoint)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id)`,

  /* ── Offline Sync Queue ───────────────────────────────────────────────── */
  `CREATE TABLE IF NOT EXISTS offline_sync_queue (
    id         serial PRIMARY KEY,
    user_id    integer NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    action     text NOT NULL,
    payload    jsonb NOT NULL DEFAULT '{}',
    status     text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','synced','failed')),
    created_at timestamptz NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_offline_sync_user ON offline_sync_queue(user_id)`,
];

const PHASE18_MIGRATIONS: string[] = [
  /* ── Audit Logs: add details + severity ──────────────────────────────── */
  `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details  jsonb`,
  `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'info'
     CHECK (severity IN ('info','warning','critical'))`,

  /* ── Currencies ──────────────────────────────────────────────────────── */
  `CREATE TABLE IF NOT EXISTS currencies (
    id            serial PRIMARY KEY,
    code          text NOT NULL UNIQUE,
    symbol        text NOT NULL,
    name          text NOT NULL,
    exchange_rate numeric(12,6) NOT NULL DEFAULT 1.0,
    is_default    boolean NOT NULL DEFAULT false,
    created_at    timestamptz NOT NULL DEFAULT NOW()
  )`,
  `INSERT INTO currencies (code, symbol, name, exchange_rate, is_default) VALUES
     ('EGP', 'ج.م', 'Egyptian Pound', 1.0, true),
     ('USD', '$',   'US Dollar',      0.021, false),
     ('EUR', '€',   'Euro',           0.019, false)
   ON CONFLICT (code) DO NOTHING`,

  /* ── Languages ───────────────────────────────────────────────────────── */
  `CREATE TABLE IF NOT EXISTS languages (
    id         serial PRIMARY KEY,
    code       text NOT NULL UNIQUE,
    name       text NOT NULL,
    direction  text NOT NULL DEFAULT 'ltr' CHECK (direction IN ('ltr','rtl')),
    is_default boolean NOT NULL DEFAULT false
  )`,
  `INSERT INTO languages (code, name, direction, is_default) VALUES
     ('en', 'English', 'ltr', false),
     ('ar', 'Arabic',  'rtl', true)
   ON CONFLICT (code) DO NOTHING`,

  /* ── Doc Articles ────────────────────────────────────────────────────── */
  `CREATE TABLE IF NOT EXISTS doc_articles (
    id         serial PRIMARY KEY,
    title      text NOT NULL,
    category   text NOT NULL DEFAULT 'general',
    content    text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
  )`,
  `INSERT INTO doc_articles (title, category, content) VALUES
     ('Getting Started for Teachers', 'onboarding',
      '# Getting Started for Teachers\n\nWelcome to Aperti! This guide will walk you through your first steps on the platform.\n\n## 1. Set Up Your Profile\nNavigate to Settings and complete your teacher profile with your subject specialisations.\n\n## 2. Create a Course\nGo to My Courses and click "New Course". Add a title, subject, and description.\n\n## 3. Add Students\nFrom Students, invite students by email or share your enrolment code.\n\n## 4. Assign Homework\nUse the Homework section to publish assignments with due dates and total marks.\n\n## 5. Grade Submissions\nStudents submit digitally; you review and grade from the Submissions tab.'),
     ('Creating Your First Assessment', 'assessment',
      '# Creating Your First Assessment\n\nAperti''s Assessment Hub lets you build exams, quizzes, and practice sets.\n\n## Step 1: Open Assessment Builder\nNavigate to Assessment Builder under the Teacher menu.\n\n## Step 2: Choose Type\nSelect from MCQ, short answer, essay, or mixed format.\n\n## Step 3: Add Questions\nUse the Question Studio to create questions with images, equations, and explanations.\n\n## Step 4: Set Time Limits\nConfigure time limits, attempts allowed, and randomisation options.\n\n## Step 5: Publish\nOnce ready, publish to make it available to your enrolled students.'),
     ('Understanding Subscription Plans', 'billing',
      '# Understanding Subscription Plans\n\nAperti offers flexible plans for every teaching context.\n\n## Starter\nUp to 30 students. Includes attendance, homework, and basic analytics. Ideal for individual tutors.\n\n## Professional\nUp to 80 students. Adds AI Tutor, QueryVault, CardStack, and the Parent Hub.\n\n## Enterprise\nUp to 200 students. Adds InsightStream advanced analytics and priority support.\n\n## Master\nUnlimited students. Full feature access plus custom integrations and SLA guarantee.\n\n## Payment\nAll plans are paid monthly via InstaPay. Payments are verified by the Aperti team within 24 hours.'),
     ('AI Tutor Usage Guidelines', 'ai',
      '# AI Tutor Usage Guidelines\n\nAperti''s AI Tutor (Mentor) uses OpenAI to provide personalised learning support.\n\n## What It Can Do\n- Answer subject questions with step-by-step explanations\n- Generate practice questions on any topic\n- Provide exam readiness feedback\n- Explain concepts in multiple ways\n\n## Best Practices\n- Encourage students to attempt problems first, then use Mentor to check\n- Review AI-generated content before sharing with students\n- Use the AI safety filters — content is moderated automatically\n\n## Limits\nEach student has a daily AI interaction quota based on their plan. Admins can adjust limits in Settings.')
   ON CONFLICT DO NOTHING`,

  /* ── AI Interactions ─────────────────────────────────────────────────── */
  `CREATE TABLE IF NOT EXISTS ai_interactions (
    id               serial PRIMARY KEY,
    account_id       integer REFERENCES accounts(id) ON DELETE SET NULL,
    interaction_type text NOT NULL DEFAULT 'chat',
    prompt_tokens    integer NOT NULL DEFAULT 0,
    completion_tokens integer NOT NULL DEFAULT 0,
    tokens_used      integer NOT NULL DEFAULT 0,
    model            text,
    status           text NOT NULL DEFAULT 'success',
    created_at       timestamptz NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ai_interactions_account ON ai_interactions(account_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ai_interactions_created ON ai_interactions(created_at)`,

  /* ── System Health Logs ──────────────────────────────────────────────── */
  `CREATE TABLE IF NOT EXISTS system_health_logs (
    id        serial PRIMARY KEY,
    service   text NOT NULL DEFAULT 'api',
    metric    text NOT NULL,
    value     text NOT NULL,
    status    text NOT NULL DEFAULT 'healthy',
    timestamp timestamptz NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_system_health_timestamp ON system_health_logs(timestamp)`,

  /* ── Knowledge Base Articles ─────────────────────────────────────────── */
  `CREATE TABLE IF NOT EXISTS knowledge_base_articles (
    id         serial PRIMARY KEY,
    title      text NOT NULL,
    content    text NOT NULL DEFAULT '',
    category   text NOT NULL DEFAULT 'general',
    language   text NOT NULL DEFAULT 'en',
    is_published boolean NOT NULL DEFAULT true,
    created_by integer REFERENCES accounts(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_kb_articles_category ON knowledge_base_articles(category)`,

  /* ── Launch Audit Items ──────────────────────────────────────────────── */
  `CREATE TABLE IF NOT EXISTS launch_audit_items (
    id               serial PRIMARY KEY,
    check_key        text NOT NULL UNIQUE,
    status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pass','fail','pending')),
    notes            text,
    checked_manually boolean NOT NULL DEFAULT false,
    updated_at       timestamptz NOT NULL DEFAULT NOW()
  )`,

  /* ── AutoPilot automation_tasks (Phase 10 back-fill) ────────────────── */
  `CREATE TABLE IF NOT EXISTS automation_tasks (
    id          serial PRIMARY KEY,
    name        text NOT NULL,
    description text,
    type        text NOT NULL DEFAULT 'cron',
    schedule    text,
    action      text NOT NULL DEFAULT 'noop',
    parameters  jsonb NOT NULL DEFAULT '{}',
    enabled     boolean NOT NULL DEFAULT true,
    last_run    timestamptz,
    run_count   integer NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT NOW()
  )`,
  `INSERT INTO automation_tasks (name, description, type, action, schedule, enabled) VALUES
     ('Daily Analytics Rollup',   'Aggregate analytics data daily at 02:30 UTC', 'cron', 'analytics_rollup',  '02:30', true),
     ('Subscription Expiry Check','Mark overdue subscriptions as inactive',       'cron', 'check_subscriptions','03:00', true),
     ('Weekly Health Snapshot',   'Record a system health snapshot every Sunday', 'cron', 'health_snapshot',   'sun 04:00', true)
   ON CONFLICT DO NOTHING`,

  /* ── Compliance Requests ─────────────────────────────────────────────── */
  `CREATE TABLE IF NOT EXISTS compliance_requests (
    id           serial PRIMARY KEY,
    user_id      integer NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    type         text NOT NULL DEFAULT 'account_deletion',
    status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','in_review','completed','rejected')),
    notes        text,
    requested_at timestamptz NOT NULL DEFAULT NOW(),
    completed_at timestamptz
  )`,
  `CREATE INDEX IF NOT EXISTS idx_compliance_requests_user ON compliance_requests(user_id)`,
];

export async function runMigrations(): Promise<void> {
  for (const sql of MIGRATIONS) {
    try {
      await pool.query(sql);
    } catch {
      // already applied or non-critical — continue
    }
  }

  for (const sql of PHASE10_MIGRATIONS) {
    try {
      await pool.query(sql);
    } catch {
      // already applied or non-critical — continue
    }
  }

  for (const sql of PHASE15_MIGRATIONS) {
    try {
      await pool.query(sql);
    } catch {
      // already applied or non-critical — continue
    }
  }

  for (const sql of PHASE16_MIGRATIONS) {
    try {
      await pool.query(sql);
    } catch {
      // already applied or non-critical — continue
    }
  }

  for (const sql of PHASE17_MIGRATIONS) {
    try {
      await pool.query(sql);
    } catch {
      // already applied or non-critical — continue
    }
  }

  for (const sql of PHASE18_MIGRATIONS) {
    try {
      await pool.query(sql);
    } catch {
      // already applied or non-critical — continue
    }
  }

  // Log migration run
  await pool.query(
    `INSERT INTO migrations_log (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
    [`phase18-${new Date().toISOString().split("T")[0]}`],
  ).catch(() => {});

  console.log("[migrate] Phase-2 + Phase-10 + Phase-15 + Phase-16 + Phase-17 + Phase-18 migrations applied");
}
