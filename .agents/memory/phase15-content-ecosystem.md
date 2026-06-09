---
name: Phase 15 Content Ecosystem
description: Educational Content Ecosystem — DB tables, API routes, and frontend pages added in Phase 15
---

## New DB Tables (migrate.ts PHASE15_MIGRATIONS)
- `content_blocks` — block-based page content (page_id FK lesson_content, block_type, content jsonb, ord, version)
- `block_version_history` — per-block version snapshots (block_id, version, content, settings)
- `content_comments` — inline block comments (block_id, user_id, comment, resolved)
- `curriculum_mappings` — board/subject/topic/skill tags on any content_type+content_id
- `course_builder_templates` — saved course structure templates
- `question_import_logs` — audit log for PDF/doc imports
- `question_extraction_jobs` — AI extraction job state (file_url, status, extracted_data jsonb)
- `handwritten_submissions` — AI-processed handwriting (image_url, processed_text, equation_data, diagram_data, step_analysis, confidence_score)
- `lab_configurations` — teacher-configured custom lab sessions
- `practice_sessions` — student adaptive practice (subject, topics, correct/answered counts, time_spent)
- `academic_analytics` — content view/engagement tracking (content_type, content_id, metrics jsonb)
- `geometrix_sessions` — geometry tool usage (student_id, module, tool, data, score)
- `question_relationships` — links between questions and related content (past_paper, lesson, etc.)

## question_bank column extensions
board, qualification, paper, session_name, variant, learning_objectives, diagram_url, mark_scheme_id, author, question_type

## resources table extensions
version, approval_status, published_at, resource_tags, curriculum_mapping_id

## API Route File
`artifacts/api-server/src/routes/content-ecosystem.ts` — registered as `contentEcosystemRouter` in routes/index.ts (no prefix, routes have their own paths)

## Key API Endpoints
- ContentCraft: GET/POST /contentcraft/pages, GET/PUT /contentcraft/pages/:id, POST /contentcraft/pages/:id/blocks, PUT/DELETE /contentcraft/blocks/:id, PUT /contentcraft/blocks/reorder, POST /contentcraft/blocks/:id/duplicate, GET /contentcraft/blocks/:id/version-history, POST /contentcraft/blocks/:id/restore, POST /contentcraft/blocks/:id/comment, GET /contentcraft/templates, POST /contentcraft/generate-from-template
- Curriculum: POST /curriculum/map, GET /curriculum/search, GET /curriculum/coverage
- Course Builder: GET/POST /courses/:id/structure, GET /course-templates, POST /courses/:id/templates
- Syllabuilder 2.0: POST /syllabuilder/upload (AI extraction), PUT /syllabuilder/:jobId/confirm
- Question Infrastructure: GET /questions/advanced-search, POST /questions/import, GET /questions/import/:jobId, PUT /questions/import/:jobId/review, GET/POST /questions/:id/relationships, POST /questions/generate, GET /questions/stats/:id
- Handwriting: POST /submissions/handwritten, GET /submissions/handwritten/:id
- Assessment: POST /assessments/generate, POST /revision-packs/generate
- Flashcards: POST /flashcards/generate-from-content, GET /flashcards/card-types
- InkSpace AI: POST /inkspace/ai/convert, GET /inkspace/templates
- Geometrix: GET /geometrix/modules, POST /geometrix/sessions, GET /geometrix/sessions/:id
- SimVerse: GET /simverse/labs, POST /simverse/labs/:labId/sessions, PUT /simverse/sessions/:id, POST/GET /simverse/labs/custom
- Resources: POST /resources/:id/approve, GET /resources/library
- Practice: GET /practice/recommend, POST/PUT /practice/sessions, PUT /practice/sessions/:id
- AI Studio: POST /ai-studio/generate (contentType: questions|flashcards|lesson|worksheet|markscheme)
- Past Papers: POST /past-papers/link, GET /past-papers/:id/questions
- Analytics: GET /analytics/content/:type/:id, GET /analytics/content/top-performing, GET /analytics/content/dashboard

## Frontend Pages
- `/teacher/contentcraft` + `/:pageId` → ContentCraftStudio (block editor, version history, templates)
- `/courses/:courseId/builder` → CourseBuilder (unit>topic>lesson hierarchy, AI structure gen)
- `/teacher/question-studio` → QuestionStudio (bank + AI generator + advanced filters)
- `/teacher/questions/import` → QuestionImport (3-step AI extraction wizard)
- `/teacher/analytics/content` → ContentAnalytics (dashboard + difficulty bars + top content)
- `/practice` (student) → PracticeCenter (adaptive sessions, self-marking, results)
- `/submit/handwritten` (student) → HandwrittenSubmit (AI OCR, equations, diagrams, steps)
- `/resources/library` (shared) → ResourcesLibrary (governed library with approval controls)
- `/simverse/labs` (shared) → SimverseLabs (8 lab catalogue + session runner modal)
- `/simverse/geometrix` (shared) → SimverseGeometrix (8 interactive canvas geometry modules)

**Why:**
Structured this way to keep all Phase 15 endpoints in one route file (content-ecosystem.ts) for discoverability. No prefix is used — each route includes its own path segment. Block-based content uses lesson_content as the parent table with content_blocks as children (not a separate pages table) to avoid schema fragmentation.
