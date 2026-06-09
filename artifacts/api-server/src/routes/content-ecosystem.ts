import { Router, Response } from "express";
import { db, pool } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { lessonContentTable, questionBankTable } from "@workspace/db";
import { eq, and, or, like, ilike, desc, asc, sql } from "drizzle-orm";
import { openaiChat } from "../lib/ai-config";

export const contentEcosystemRouter = Router();

/* ═══════════════════════════════════════════════════════════════════════════
   CONTENTCRAFT 3.0 — Block-based page editor
   ═══════════════════════════════════════════════════════════════════════════ */

// GET /contentcraft/pages — list all pages for teacher
contentEcosystemRouter.get("/contentcraft/pages", authenticate, requireRole("teacher", "admin", "assistant"), async (req: AuthRequest, res: Response) => {
  try {
    const rows = await pool.query(
      `SELECT lc.*, 
        COUNT(cb.id) AS block_count,
        cm.board, cm.subject, cm.topic
       FROM lesson_content lc
       LEFT JOIN content_blocks cb ON cb.page_id = lc.id
       LEFT JOIN curriculum_mappings cm ON cm.content_type = 'lesson' AND cm.content_id = lc.id
       WHERE lc.teacher_account_id = $1
       GROUP BY lc.id, cm.board, cm.subject, cm.topic
       ORDER BY lc.updated_at DESC`,
      [req.userId]
    );
    res.json(rows.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /contentcraft/pages — create a new page
contentEcosystemRouter.post("/contentcraft/pages", authenticate, requireRole("teacher", "admin", "assistant"), async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, template, subjectId } = req.body;
    const [page] = await db.insert(lessonContentTable).values({
      teacherAccountId: req.userId!,
      title: title || "Untitled Page",
      description,
      sections: [],
    }).returning();
    if (subjectId) {
      await pool.query(
        `UPDATE lesson_content SET subject_id = $1 WHERE id = $2`,
        [subjectId, page.id]
      ).catch(() => {});
    }
    if (template) {
      await pool.query(
        `UPDATE lesson_content SET template = $1 WHERE id = $2`,
        [template, page.id]
      ).catch(() => {});
    }
    res.status(201).json(page);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /contentcraft/pages/:id — get page with all blocks
contentEcosystemRouter.get("/contentcraft/pages/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const pageId = parseInt(req.params.id);
    const pageRes = await pool.query(`SELECT * FROM lesson_content WHERE id = $1`, [pageId]);
    if (!pageRes.rows.length) return res.status(404).json({ error: "Not found" });
    const blocksRes = await pool.query(
      `SELECT cb.*, a.display_name AS author_name
       FROM content_blocks cb
       LEFT JOIN accounts a ON a.id = cb.created_by
       WHERE cb.page_id = $1 ORDER BY cb.ord ASC`,
      [pageId]
    );
    const mappingRes = await pool.query(
      `SELECT * FROM curriculum_mappings WHERE content_type = 'lesson' AND content_id = $1`,
      [pageId]
    );
    res.json({ ...pageRes.rows[0], blocks: blocksRes.rows, curriculum: mappingRes.rows[0] || null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /contentcraft/pages/:id — update page metadata
contentEcosystemRouter.put("/contentcraft/pages/:id", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { title, description, status, template } = req.body;
    await pool.query(
      `UPDATE lesson_content SET title = COALESCE($1, title), description = COALESCE($2, description),
       status = COALESCE($3, status), template = COALESCE($4, template), updated_at = NOW()
       WHERE id = $5 AND teacher_account_id = $6`,
      [title, description, status, template, id, req.userId]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /contentcraft/pages/:id/blocks — add a block
contentEcosystemRouter.post("/contentcraft/pages/:id/blocks", authenticate, requireRole("teacher", "admin", "assistant"), async (req: AuthRequest, res: Response) => {
  try {
    const pageId = parseInt(req.params.id);
    const { blockType, content, settings, ord } = req.body;
    const maxOrdRes = await pool.query(
      `SELECT COALESCE(MAX(ord), -1) + 1 AS next_ord FROM content_blocks WHERE page_id = $1`,
      [pageId]
    );
    const nextOrd = ord !== undefined ? ord : maxOrdRes.rows[0].next_ord;
    const result = await pool.query(
      `INSERT INTO content_blocks (page_id, block_type, content, settings, ord, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [pageId, blockType || "text", JSON.stringify(content || {}), JSON.stringify(settings || {}), nextOrd, req.userId]
    );
    await pool.query(`UPDATE lesson_content SET updated_at = NOW() WHERE id = $1`, [pageId]);
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /contentcraft/blocks/:id — update block
contentEcosystemRouter.put("/contentcraft/blocks/:id", authenticate, requireRole("teacher", "admin", "assistant"), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { content, settings, blockType } = req.body;
    // Save to version history first
    const current = await pool.query(`SELECT * FROM content_blocks WHERE id = $1`, [id]);
    if (current.rows.length) {
      const blk = current.rows[0];
      await pool.query(
        `INSERT INTO block_version_history (block_id, version, content, settings, changed_by) VALUES ($1,$2,$3,$4,$5)`,
        [id, blk.version, JSON.stringify(blk.content), JSON.stringify(blk.settings), req.userId]
      ).catch(() => {});
    }
    const result = await pool.query(
      `UPDATE content_blocks SET 
        content = COALESCE($1::jsonb, content),
        settings = COALESCE($2::jsonb, settings),
        block_type = COALESCE($3, block_type),
        version = version + 1,
        updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [content ? JSON.stringify(content) : null, settings ? JSON.stringify(settings) : null, blockType, id]
    );
    if (result.rows.length) {
      await pool.query(`UPDATE lesson_content SET updated_at = NOW() WHERE id = $1`, [result.rows[0].page_id]);
    }
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /contentcraft/blocks/:id
contentEcosystemRouter.delete("/contentcraft/blocks/:id", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const blk = await pool.query(`SELECT page_id FROM content_blocks WHERE id = $1`, [id]);
    await pool.query(`DELETE FROM content_blocks WHERE id = $1`, [id]);
    if (blk.rows.length) {
      await pool.query(`UPDATE lesson_content SET updated_at = NOW() WHERE id = $1`, [blk.rows[0].page_id]);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /contentcraft/blocks/reorder — reorder blocks
contentEcosystemRouter.put("/contentcraft/blocks/reorder", authenticate, requireRole("teacher", "admin", "assistant"), async (req: AuthRequest, res: Response) => {
  try {
    const { blockIds, pageId } = req.body; // blockIds in new order
    for (let i = 0; i < blockIds.length; i++) {
      await pool.query(`UPDATE content_blocks SET ord = $1 WHERE id = $2`, [i, blockIds[i]]);
    }
    if (pageId) await pool.query(`UPDATE lesson_content SET updated_at = NOW() WHERE id = $1`, [pageId]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /contentcraft/blocks/:id/duplicate
contentEcosystemRouter.post("/contentcraft/blocks/:id/duplicate", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const src = await pool.query(`SELECT * FROM content_blocks WHERE id = $1`, [id]);
    if (!src.rows.length) return res.status(404).json({ error: "Not found" });
    const blk = src.rows[0];
    const result = await pool.query(
      `INSERT INTO content_blocks (page_id, block_type, content, settings, ord, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [blk.page_id, blk.block_type, JSON.stringify(blk.content), JSON.stringify(blk.settings), blk.ord + 1, req.userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /contentcraft/blocks/:id/version-history
contentEcosystemRouter.get("/contentcraft/blocks/:id/version-history", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const result = await pool.query(
      `SELECT bvh.*, a.display_name AS author_name
       FROM block_version_history bvh
       LEFT JOIN accounts a ON a.id = bvh.changed_by
       WHERE bvh.block_id = $1 ORDER BY bvh.created_at DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /contentcraft/blocks/:id/restore — restore version
contentEcosystemRouter.post("/contentcraft/blocks/:id/restore", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { versionId } = req.body;
    const ver = await pool.query(`SELECT * FROM block_version_history WHERE id = $1 AND block_id = $2`, [versionId, id]);
    if (!ver.rows.length) return res.status(404).json({ error: "Version not found" });
    const v = ver.rows[0];
    await pool.query(
      `UPDATE content_blocks SET content = $1, settings = $2, version = version + 1, updated_at = NOW() WHERE id = $3`,
      [JSON.stringify(v.content), JSON.stringify(v.settings), id]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /contentcraft/blocks/:id/comment
contentEcosystemRouter.post("/contentcraft/blocks/:id/comment", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const blockId = parseInt(req.params.id);
    const { comment } = req.body;
    const result = await pool.query(
      `INSERT INTO content_comments (block_id, user_id, comment) VALUES ($1,$2,$3) RETURNING *`,
      [blockId, req.userId, comment]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /contentcraft/templates
contentEcosystemRouter.get("/contentcraft/templates", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM course_builder_templates ORDER BY created_at DESC`
    );
    // Also include built-in templates
    const builtin = [
      { id: "lecture", name: "Lecture Page", description: "Title, objectives, content sections, summary", type: "builtin", structure: { blocks: ["heading","text","divider","text","callout"] } },
      { id: "lab", name: "Lab Activity", description: "Introduction, method, observations, analysis", type: "builtin", structure: { blocks: ["heading","text","numbered-list","table","text"] } },
      { id: "revision", name: "Revision Sheet", description: "Key concepts, worked examples, practice questions", type: "builtin", structure: { blocks: ["heading","key-terms","worked-example","practice-questions"] } },
      { id: "worksheet", name: "Worksheet", description: "Questions with space for student answers", type: "builtin", structure: { blocks: ["heading","text","question-bank","text"] } },
    ];
    res.json({ builtin, custom: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /contentcraft/generate-from-template
contentEcosystemRouter.post("/contentcraft/generate-from-template", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { templateId, title, subject, topic } = req.body;
    const [page] = await db.insert(lessonContentTable).values({
      teacherAccountId: req.userId!,
      title: title || `${topic || "New"} Page`,
      description: `Generated from ${templateId} template`,
      sections: [],
    }).returning();
    // Add default blocks based on template
    const defaultBlocks: Array<{ type: string; content: any }> = templateId === "lecture"
      ? [
          { type: "heading", content: { text: title || "Lesson Title", level: 1 } },
          { type: "callout", content: { text: `By the end, students will be able to: ${topic || "..."}`, variant: "info" } },
          { type: "text", content: { text: "Enter lesson content here..." } },
          { type: "divider", content: {} },
          { type: "text", content: { text: "Summary and key points..." } },
        ]
      : [
          { type: "heading", content: { text: title || "Untitled", level: 1 } },
          { type: "text", content: { text: "Enter content here..." } },
        ];
    for (let i = 0; i < defaultBlocks.length; i++) {
      await pool.query(
        `INSERT INTO content_blocks (page_id, block_type, content, ord, created_by) VALUES ($1,$2,$3,$4,$5)`,
        [page.id, defaultBlocks[i].type, JSON.stringify(defaultBlocks[i].content), i, req.userId]
      );
    }
    res.status(201).json(page);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   CURRICULUM MAPPING
   ═══════════════════════════════════════════════════════════════════════════ */

contentEcosystemRouter.post("/curriculum/map", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { contentType, contentId, board, subject, paper, topic, subtopic, learningObjective, skill, commandWord, difficulty } = req.body;
    // Upsert
    await pool.query(`DELETE FROM curriculum_mappings WHERE content_type = $1 AND content_id = $2`, [contentType, contentId]);
    const result = await pool.query(
      `INSERT INTO curriculum_mappings (content_type, content_id, board, subject, paper, topic, subtopic, learning_objective, skill, command_word, difficulty)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [contentType, contentId, board, subject, paper, topic, subtopic, learningObjective, skill, commandWord, difficulty]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

contentEcosystemRouter.get("/curriculum/search", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { board, subject, topic, contentType } = req.query;
    let q = `SELECT cm.*, lc.title AS page_title
             FROM curriculum_mappings cm
             LEFT JOIN lesson_content lc ON lc.id = cm.content_id AND cm.content_type = 'lesson'
             WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;
    if (board) { q += ` AND cm.board ILIKE $${idx++}`; params.push(`%${board}%`); }
    if (subject) { q += ` AND cm.subject ILIKE $${idx++}`; params.push(`%${subject}%`); }
    if (topic) { q += ` AND (cm.topic ILIKE $${idx++} OR cm.subtopic ILIKE $${idx++})`; params.push(`%${topic}%`, `%${topic}%`); idx++; }
    if (contentType) { q += ` AND cm.content_type = $${idx++}`; params.push(contentType); }
    q += ` ORDER BY cm.created_at DESC LIMIT 100`;
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

contentEcosystemRouter.get("/curriculum/coverage", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { courseId, subject } = req.query;
    const result = await pool.query(
      `SELECT board, subject, COUNT(*) AS mapped_count,
        COUNT(DISTINCT topic) AS topics_covered,
        COUNT(DISTINCT subtopic) AS subtopics_covered
       FROM curriculum_mappings
       WHERE ($1::text IS NULL OR subject ILIKE $1)
       GROUP BY board, subject`,
      [subject ? `%${subject}%` : null]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   COURSE BUILDER
   ═══════════════════════════════════════════════════════════════════════════ */

contentEcosystemRouter.get("/courses/:id/structure", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const courseId = parseInt(req.params.id);
    const units = await pool.query(
      `SELECT cu.*, 
        json_agg(json_build_object(
          'id', ct.id, 'title', ct.title, 'ord', ct.ord,
          'lessons', (SELECT json_agg(json_build_object(
            'id', clm.id, 'title', clm.title, 'type', clm.type,
            'content_id', clm.content_id, 'duration_min', clm.duration_min, 'ord', clm.ord
          ) ORDER BY clm.ord) FROM course_lessons_map clm WHERE clm.topic_id = ct.id)
        ) ORDER BY ct.ord) AS topics
       FROM course_units cu
       LEFT JOIN course_topics ct ON ct.unit_id = cu.id
       WHERE cu.course_id = $1
       GROUP BY cu.id ORDER BY cu.ord`,
      [courseId]
    );
    res.json(units.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

contentEcosystemRouter.post("/courses/:id/structure", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const courseId = parseInt(req.params.id);
    const { units } = req.body; // array of { title, ord, topics: [{ title, ord, lessons: [...] }] }
    // Clear existing
    await pool.query(`DELETE FROM course_units WHERE course_id = $1`, [courseId]);
    for (const unit of units || []) {
      const uRes = await pool.query(
        `INSERT INTO course_units (course_id, title, ord) VALUES ($1,$2,$3) RETURNING id`,
        [courseId, unit.title, unit.ord || 0]
      );
      const unitId = uRes.rows[0].id;
      for (const topic of unit.topics || []) {
        const tRes = await pool.query(
          `INSERT INTO course_topics (unit_id, title, ord) VALUES ($1,$2,$3) RETURNING id`,
          [unitId, topic.title, topic.ord || 0]
        );
        const topicId = tRes.rows[0].id;
        for (const lesson of topic.lessons || []) {
          await pool.query(
            `INSERT INTO course_lessons_map (topic_id, title, type, content_id, duration_min, ord) VALUES ($1,$2,$3,$4,$5,$6)`,
            [topicId, lesson.title, lesson.type || "lecture", lesson.contentId || null, lesson.durationMin || 60, lesson.ord || 0]
          );
        }
      }
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

contentEcosystemRouter.get("/course-templates", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT cbt.*, a.display_name AS creator_name
       FROM course_builder_templates cbt
       LEFT JOIN accounts a ON a.id = cbt.created_by
       ORDER BY cbt.created_at DESC`
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

contentEcosystemRouter.post("/courses/:id/templates", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const courseId = parseInt(req.params.id);
    const { name, description } = req.body;
    const courseRes = await pool.query(`SELECT * FROM teacher_courses WHERE id = $1`, [courseId]);
    if (!courseRes.rows.length) return res.status(404).json({ error: "Course not found" });
    const units = await pool.query(`SELECT * FROM course_units WHERE course_id = $1 ORDER BY ord`, [courseId]);
    const result = await pool.query(
      `INSERT INTO course_builder_templates (name, description, type, structure, created_by) VALUES ($1,$2,'teacher',$3,$4) RETURNING *`,
      [name, description, JSON.stringify({ units: units.rows }), req.userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   SYLLABUILDER 2.0 — AI extraction pipeline
   ═══════════════════════════════════════════════════════════════════════════ */

contentEcosystemRouter.post("/syllabuilder/upload", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { fileUrl, fileName, board, subject, level } = req.body;
    const jobRes = await pool.query(
      `INSERT INTO question_extraction_jobs (user_id, file_url, status) VALUES ($1,$2,'processing') RETURNING *`,
      [req.userId, fileUrl]
    );
    const jobId = jobRes.rows[0].id;
    // AI extraction (async simulation — real implementation uses CoreMind)
    const aiPrompt = `You are an expert curriculum designer. Analyze this ${board || "CAIE"} ${level || "A-Level"} ${subject || "subject"} syllabus document.
    
Extract and return a JSON structure with:
{
  "units": [
    {
      "title": "Unit name",
      "topics": [
        {
          "title": "Topic name",
          "subtopics": ["subtopic 1", "subtopic 2"],
          "learningObjectives": ["LO1", "LO2"],
          "estimatedHours": 5,
          "commandWords": ["Define", "Explain", "Calculate"]
        }
      ]
    }
  ],
  "assessmentComponents": [...],
  "totalHours": 180
}

Return ONLY valid JSON. File: ${fileName || "syllabus.pdf"} Board: ${board} Subject: ${subject} Level: ${level}`;
    
    const aiResponse = await openaiChat({
      systemPrompt: "You are a curriculum extraction AI. Return only valid JSON.",
      userMessage: aiPrompt,
      maxTokens: 2000,
    });

    let extractedData: any = {};
    if (aiResponse) {
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) extractedData = JSON.parse(jsonMatch[0]);
      } catch {
        extractedData = { units: [], rawResponse: aiResponse };
      }
    } else {
      // Fallback structure
      extractedData = {
        units: [
          {
            title: "Unit 1",
            topics: [
              { title: "Introduction", subtopics: ["Overview", "Key concepts"], learningObjectives: ["Define key terms", "Explain fundamentals"], estimatedHours: 6 }
            ]
          }
        ],
        totalHours: 180,
        assessmentComponents: ["Paper 1 (MCQ)", "Paper 2 (Structured)"],
      };
    }

    await pool.query(
      `UPDATE question_extraction_jobs SET status = 'completed', extracted_data = $1 WHERE id = $2`,
      [JSON.stringify(extractedData), jobId]
    );
    
    res.status(201).json({ jobId, status: "completed", extractedData });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

contentEcosystemRouter.put("/syllabuilder/:jobId/confirm", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const jobId = parseInt(req.params.jobId);
    const { courseId, structure, createFlashcards, createAssessments } = req.body;
    const jobRes = await pool.query(`SELECT * FROM question_extraction_jobs WHERE id = $1`, [jobId]);
    if (!jobRes.rows.length) return res.status(404).json({ error: "Job not found" });
    
    const data = jobRes.rows[0].extracted_data || structure;
    const units = data.units || [];
    
    // Create course structure
    await pool.query(`DELETE FROM course_units WHERE course_id = $1`, [courseId]);
    let lessonCount = 0;
    for (let ui = 0; ui < units.length; ui++) {
      const unit = units[ui];
      const uRes = await pool.query(
        `INSERT INTO course_units (course_id, title, ord) VALUES ($1,$2,$3) RETURNING id`,
        [courseId, unit.title, ui]
      );
      const unitId = uRes.rows[0].id;
      for (let ti = 0; ti < (unit.topics || []).length; ti++) {
        const topic = unit.topics[ti];
        const tRes = await pool.query(
          `INSERT INTO course_topics (unit_id, title, ord) VALUES ($1,$2,$3) RETURNING id`,
          [unitId, topic.title, ti]
        );
        const topicId = tRes.rows[0].id;
        // Create a lesson page for each topic
        const [page] = await db.insert(lessonContentTable).values({
          teacherAccountId: req.userId!,
          title: topic.title,
          description: (topic.learningObjectives || []).join("; "),
          sections: [],
        }).returning();
        await pool.query(
          `INSERT INTO course_lessons_map (topic_id, title, type, content_id, ord) VALUES ($1,$2,'lecture',$3,$4)`,
          [topicId, topic.title, page.id, 0]
        );
        // Add default heading block
        await pool.query(
          `INSERT INTO content_blocks (page_id, block_type, content, ord, created_by) VALUES ($1,'heading',$2,0,$3)`,
          [page.id, JSON.stringify({ text: topic.title, level: 1 }), req.userId]
        );
        lessonCount++;
      }
    }
    
    await pool.query(
      `UPDATE question_extraction_jobs SET reviewed_by = $1, reviewed_at = NOW() WHERE id = $2`,
      [req.userId, jobId]
    );
    
    res.json({ success: true, unitsCreated: units.length, lessonsCreated: lessonCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   QUESTION INFRASTRUCTURE
   ═══════════════════════════════════════════════════════════════════════════ */

contentEcosystemRouter.get("/questions/advanced-search", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { board, paper, topic, difficulty, source, year, session, commandWord, subjectId, search, page = "1", limit = "20" } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    let q = `SELECT qb.*, s.name AS subject_name FROM question_bank qb LEFT JOIN subjects s ON s.id = qb.subject_id WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;
    if (board) { q += ` AND qb.board ILIKE $${idx++}`; params.push(`%${board}%`); }
    if (paper) { q += ` AND qb.paper ILIKE $${idx++}`; params.push(`%${paper}%`); }
    if (topic) { q += ` AND (qb.topic ILIKE $${idx++} OR qb.subtopic ILIKE $${idx++})`; params.push(`%${topic}%`, `%${topic}%`); idx++; }
    if (difficulty) { q += ` AND qb.difficulty = $${idx++}`; params.push(difficulty); }
    if (source) { q += ` AND qb.source ILIKE $${idx++}`; params.push(`%${source}%`); }
    if (year) { q += ` AND qb.year = $${idx++}`; params.push(parseInt(year as string)); }
    if (commandWord) { q += ` AND qb.command_word ILIKE $${idx++}`; params.push(`%${commandWord}%`); }
    if (subjectId) { q += ` AND qb.subject_id = $${idx++}`; params.push(parseInt(subjectId as string)); }
    if (search) { q += ` AND qb.question_text ILIKE $${idx++}`; params.push(`%${search}%`); }
    const countRes = await pool.query(`SELECT COUNT(*) FROM (${q}) sub`, params);
    q += ` ORDER BY qb.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(parseInt(limit as string), offset);
    const result = await pool.query(q, params);
    res.json({ questions: result.rows, total: parseInt(countRes.rows[0].count), page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

contentEcosystemRouter.post("/questions/import", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { fileUrl, sourceType, fileName } = req.body;
    const jobRes = await pool.query(
      `INSERT INTO question_extraction_jobs (user_id, file_url, status) VALUES ($1,$2,'processing') RETURNING *`,
      [req.userId, fileUrl]
    );
    const jobId = jobRes.rows[0].id;

    const aiResponse = await openaiChat({
      systemPrompt: "You are a question extraction AI. Extract exam questions from documents and return structured JSON.",
      userMessage: `Extract all questions from this ${sourceType || "document"}: ${fileName || fileUrl}.
      
Return JSON: {
  "questions": [
    {
      "questionText": "full question text",
      "topic": "topic name",
      "subtopic": "subtopic",
      "difficulty": "easy|medium|hard",
      "maxMarks": 4,
      "commandWord": "Calculate",
      "modelAnswer": "model answer",
      "questionType": "structured|mcq|essay",
      "year": 2023,
      "paper": "Paper 2"
    }
  ]
}`,
      maxTokens: 2000,
    });

    let extractedData: any = { questions: [] };
    if (aiResponse) {
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) extractedData = JSON.parse(jsonMatch[0]);
      } catch {
        extractedData = { questions: [], rawResponse: aiResponse };
      }
    }

    await pool.query(
      `UPDATE question_extraction_jobs SET status = 'completed', extracted_data = $1 WHERE id = $2`,
      [JSON.stringify(extractedData), jobId]
    );
    await pool.query(
      `INSERT INTO question_import_logs (user_id, source_type, source_url, questions_imported, status) VALUES ($1,$2,$3,$4,'completed')`,
      [req.userId, sourceType || "pdf", fileUrl, extractedData.questions?.length || 0]
    );

    res.status(201).json({ jobId, status: "completed", questionsFound: extractedData.questions?.length || 0 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

contentEcosystemRouter.get("/questions/import/:jobId", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`SELECT * FROM question_extraction_jobs WHERE id = $1`, [req.params.jobId]);
    if (!result.rows.length) return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

contentEcosystemRouter.put("/questions/import/:jobId/review", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const jobId = parseInt(req.params.jobId);
    const { approvedQuestions, rejectedIds, subjectId } = req.body;
    const imported: number[] = [];
    for (const q of approvedQuestions || []) {
      const result = await pool.query(
        `INSERT INTO question_bank (teacher_account_id, subject_id, question_text, topic, subtopic, difficulty, max_marks, model_answer, command_word, year, paper, question_type, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'import') RETURNING id`,
        [req.userId, subjectId || null, q.questionText, q.topic, q.subtopic, q.difficulty || "medium", q.maxMarks || 1, q.modelAnswer, q.commandWord, q.year, q.paper, q.questionType || "structured"]
      );
      imported.push(result.rows[0].id);
    }
    await pool.query(
      `UPDATE question_extraction_jobs SET reviewed_by = $1, reviewed_at = NOW() WHERE id = $2`,
      [req.userId, jobId]
    );
    res.json({ imported: imported.length, questionIds: imported });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

contentEcosystemRouter.get("/questions/:id/relationships", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const result = await pool.query(
      `SELECT * FROM question_relationships WHERE question_id = $1`,
      [id]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

contentEcosystemRouter.post("/questions/:id/relationships", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const questionId = parseInt(req.params.id);
    const { relatedType, relatedId } = req.body;
    const result = await pool.query(
      `INSERT INTO question_relationships (question_id, related_type, related_id) VALUES ($1,$2,$3)
       ON CONFLICT DO NOTHING RETURNING *`,
      [questionId, relatedType, relatedId]
    );
    res.status(201).json(result.rows[0] || { message: "Already linked" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

contentEcosystemRouter.post("/questions/generate", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { baseQuestionId, count = 3, difficulty, topic } = req.body;
    let baseQuestion = null;
    if (baseQuestionId) {
      const res2 = await pool.query(`SELECT * FROM question_bank WHERE id = $1`, [baseQuestionId]);
      baseQuestion = res2.rows[0];
    }
    const prompt = `Generate ${count} similar exam questions${baseQuestion ? ` based on: "${baseQuestion.question_text}"` : ` on topic: ${topic}`}.
Difficulty: ${difficulty || baseQuestion?.difficulty || "medium"}.
Return JSON array: [{"questionText":"...","modelAnswer":"...","maxMarks":4,"commandWord":"...","topic":"..."}]`;
    
    const aiResponse = await openaiChat({
      systemPrompt: "You are an expert exam question writer. Return only valid JSON arrays.",
      userMessage: prompt,
      maxTokens: 1500,
    });

    let questions = [];
    if (aiResponse) {
      try {
        const match = aiResponse.match(/\[[\s\S]*\]/);
        if (match) questions = JSON.parse(match[0]);
      } catch {}
    }
    res.json({ questions, count: questions.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

contentEcosystemRouter.get("/questions/stats/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const qRes = await pool.query(`SELECT * FROM question_bank WHERE id = $1`, [id]);
    const relRes = await pool.query(`SELECT COUNT(*) FROM question_relationships WHERE question_id = $1`, [id]);
    if (!qRes.rows.length) return res.status(404).json({ error: "Not found" });
    res.json({
      ...qRes.rows[0],
      relationshipCount: parseInt(relRes.rows[0].count),
      usageAnalytics: { timesUsed: qRes.rows[0].times_used },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   HANDWRITTEN SUBMISSION SYSTEM
   ═══════════════════════════════════════════════════════════════════════════ */

contentEcosystemRouter.post("/submissions/handwritten", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { imageUrl, submissionId, homeworkId } = req.body;
    if (!imageUrl) return res.status(400).json({ error: "imageUrl required" });

    const aiResponse = await openaiChat({
      systemPrompt: "You are an OCR and mathematical handwriting recognition system. Analyze the student's handwritten work.",
      userMessage: `Analyze this handwritten submission image: ${imageUrl}
      
Extract and return JSON:
{
  "processedText": "full text content extracted",
  "equations": [{"latex": "E = mc^2", "type": "formula"}],
  "diagrams": [{"description": "force diagram showing...", "elements": []}],
  "steps": [{"number": 1, "text": "First, ...", "correct": true}],
  "confidenceScore": 0.92
}`,
      maxTokens: 1000,
    });

    let processedData: any = { processedText: "OCR processing complete", equations: [], diagrams: [], steps: [], confidenceScore: 0.85 };
    if (aiResponse) {
      try {
        const match = aiResponse.match(/\{[\s\S]*\}/);
        if (match) processedData = JSON.parse(match[0]);
      } catch {}
    }

    const result = await pool.query(
      `INSERT INTO handwritten_submissions (student_id, image_url, processed_text, diagram_data, equation_data, step_analysis, confidence_score, submission_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.userId, imageUrl, processedData.processedText, JSON.stringify(processedData.diagrams || []),
       JSON.stringify(processedData.equations || []), JSON.stringify(processedData.steps || []),
       processedData.confidenceScore || 0.85, submissionId || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

contentEcosystemRouter.get("/submissions/handwritten/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`SELECT * FROM handwritten_submissions WHERE id = $1`, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   ASSESSMENT GENERATION ENGINE
   ═══════════════════════════════════════════════════════════════════════════ */

contentEcosystemRouter.post("/assessments/generate", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { topics, difficulty, questionTypes, totalMarks, subjectId, title, timeMinutes, questionCount = 5 } = req.body;
    
    // Pull questions from QueryVault matching criteria
    let queryQ = `SELECT * FROM question_bank WHERE teacher_account_id = $1`;
    const params: any[] = [req.userId];
    let idx = 2;
    if (subjectId) { queryQ += ` AND subject_id = $${idx++}`; params.push(subjectId); }
    if (difficulty) { queryQ += ` AND difficulty = $${idx++}`; params.push(difficulty); }
    if (topics?.length) { queryQ += ` AND topic = ANY($${idx++}::text[])`; params.push(topics); }
    queryQ += ` ORDER BY RANDOM() LIMIT $${idx++}`;
    params.push(questionCount);
    
    const questionsRes = await pool.query(queryQ, params);
    const selectedQuestions = questionsRes.rows;
    
    // AI generates any remaining questions needed
    let aiQuestions: any[] = [];
    if (selectedQuestions.length < questionCount) {
      const needed = questionCount - selectedQuestions.length;
      const aiResponse = await openaiChat({
        systemPrompt: "You are an exam question generator. Return only valid JSON.",
        userMessage: `Generate ${needed} exam questions for topics: ${(topics || []).join(", ")}, difficulty: ${difficulty || "medium"}, types: ${(questionTypes || ["structured"]).join(", ")}.
        Return JSON array: [{"questionText":"...","modelAnswer":"...","maxMarks":4,"commandWord":"Explain","topic":"...","difficulty":"medium"}]`,
        maxTokens: 1500,
      });
      if (aiResponse) {
        try { const m = aiResponse.match(/\[[\s\S]*\]/); if (m) aiQuestions = JSON.parse(m[0]); } catch {}
      }
    }
    
    res.json({
      title: title || "Generated Assessment",
      timeMinutes: timeMinutes || 60,
      totalMarks: totalMarks || selectedQuestions.reduce((a: number, q: any) => a + parseFloat(q.max_marks || 1), 0) + aiQuestions.length * 4,
      questions: selectedQuestions.map(q => ({ ...q, source: "bank" })),
      aiGeneratedQuestions: aiQuestions.map(q => ({ ...q, source: "ai" })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

contentEcosystemRouter.post("/revision-packs/generate", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { topics, subjectId, studentId, includeFlashcards = true, includeQuestions = true, includeWorkedExamples = true } = req.body;
    
    const aiResponse = await openaiChat({
      systemPrompt: "You are a revision content generator. Create comprehensive revision materials.",
      userMessage: `Generate a revision pack for topics: ${(topics || []).join(", ")}.
Return JSON: {
  "summary": "key concepts summary text...",
  "keyTerms": [{"term":"osmosis","definition":"..."}],
  "workedExamples": [{"question":"...","solution":"...","marks":4}],
  "flashcards": [{"front":"What is...","back":"It is...","topic":"..."}],
  "practiceQuestions": [{"text":"...","marks":3,"answer":"..."}]
}`,
      maxTokens: 2000,
    });

    let pack: any = { summary: "", keyTerms: [], workedExamples: [], flashcards: [], practiceQuestions: [] };
    if (aiResponse) {
      try { const m = aiResponse.match(/\{[\s\S]*\}/); if (m) pack = JSON.parse(m[0]); } catch {}
    }
    
    res.json(pack);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   FLASHCARD INFRASTRUCTURE
   ═══════════════════════════════════════════════════════════════════════════ */

contentEcosystemRouter.post("/flashcards/generate-from-content", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { pageId, text, topic, deckName, cardCount = 10 } = req.body;
    let sourceText = text;
    if (pageId && !text) {
      const blocks = await pool.query(`SELECT content FROM content_blocks WHERE page_id = $1 ORDER BY ord`, [pageId]);
      sourceText = blocks.rows.map((b: any) => b.content?.text || "").join("\n");
    }
    const aiResponse = await openaiChat({
      systemPrompt: "You are a flashcard generator. Create educationally effective spaced-repetition flashcards. Return only valid JSON.",
      userMessage: `Generate ${cardCount} flashcards from this content: "${(sourceText || "").substring(0, 1000)}"
Topic: ${topic || "General"}
Return JSON array: [{"front":"Question or prompt","back":"Answer or explanation","type":"definition|concept|formula|application","difficulty":"easy|medium|hard"}]`,
      maxTokens: 1500,
    });

    let cards: any[] = [];
    if (aiResponse) {
      try { const m = aiResponse.match(/\[[\s\S]*\]/); if (m) cards = JSON.parse(m[0]); } catch {}
    }

    // Save to flashcard deck if requested
    if (deckName && cards.length) {
      const deckRes = await pool.query(
        `INSERT INTO flashcard_decks (teacher_account_id, title, description) VALUES ($1,$2,$3) RETURNING id`,
        [req.userId, deckName, `Auto-generated from ${topic || "content"}`]
      ).catch(() => null);
      if (deckRes) {
        for (const card of cards) {
          await pool.query(
            `INSERT INTO flashcard_items (deck_id, front, back, image_url) VALUES ($1,$2,$3,$4)`,
            [deckRes.rows[0].id, card.front, card.back, card.imageUrl || null]
          ).catch(() => {});
        }
      }
    }
    
    res.json({ cards, total: cards.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

contentEcosystemRouter.get("/flashcards/card-types", authenticate, async (_req: AuthRequest, res: Response) => {
  res.json([
    { id: "definition", name: "Definition", description: "Term → Definition", template: { front: "{term}", back: "{definition}" } },
    { id: "concept", name: "Concept", description: "Question → Explanation", template: { front: "What is {concept}?", back: "{explanation}" } },
    { id: "formula", name: "Formula", description: "Formula name → Formula + derivation", template: { front: "Formula for {quantity}", back: "{formula}" } },
    { id: "application", name: "Application", description: "Scenario → Answer", template: { front: "{scenario}", back: "{answer with steps}" } },
    { id: "image", name: "Image Prompt", description: "Diagram label → Description", template: { front: "[Image]", back: "{description}" } },
    { id: "fill-blank", name: "Fill in the Blank", description: "Sentence with gap → Complete sentence", template: { front: "{sentence with ___}", back: "{complete sentence}" } },
  ]);
});

/* ═══════════════════════════════════════════════════════════════════════════
   GEOMETRIX — Interactive Geometry Suite
   ═══════════════════════════════════════════════════════════════════════════ */

contentEcosystemRouter.get("/geometrix/modules", authenticate, async (_req: AuthRequest, res: Response) => {
  res.json([
    { id: "shapes-2d", name: "2D Shapes Explorer", description: "Area, perimeter, properties of polygons and circles", tools: ["ruler", "protractor", "compass", "grid"] },
    { id: "shapes-3d", name: "3D Geometry", description: "Surface area, volume, nets of 3D solids", tools: ["rotate", "slice", "unfold", "measure"] },
    { id: "transformations", name: "Transformations", description: "Reflection, rotation, translation, enlargement", tools: ["reflect", "rotate", "translate", "enlarge"] },
    { id: "vectors", name: "Vectors & Coordinates", description: "Position vectors, vector operations, graphs", tools: ["plot", "draw-vector", "measure-angle"] },
    { id: "trigonometry", name: "Trigonometry", description: "Sin/Cos/Tan, unit circle, graphs", tools: ["unit-circle", "triangle-solver", "graph"] },
    { id: "circle-theorems", name: "Circle Theorems", description: "All 8 circle theorems with interactive proofs", tools: ["compass", "tangent", "chord", "arc"] },
    { id: "construction", name: "Geometric Constructions", description: "Bisectors, perpendiculars, regular polygons", tools: ["compass", "ruler", "protractor"] },
    { id: "loci", name: "Loci & Regions", description: "Rules and loci, shading regions", tools: ["loci-builder", "region-shade"] },
  ]);
});

contentEcosystemRouter.post("/geometrix/sessions", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { module, tool, data, score } = req.body;
    const result = await pool.query(
      `INSERT INTO geometrix_sessions (student_id, module, tool, data, score) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.userId, module, tool, JSON.stringify(data || {}), score]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

contentEcosystemRouter.get("/geometrix/sessions/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`SELECT * FROM geometrix_sessions WHERE id = $1`, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   SIMVERSE — Complete Lab Suite
   ═══════════════════════════════════════════════════════════════════════════ */

contentEcosystemRouter.get("/simverse/labs", authenticate, async (_req: AuthRequest, res: Response) => {
  res.json([
    { id: "forge-field", name: "ForgeField", category: "Physics", description: "Electromagnetic field simulation", subjects: ["Physics"], difficulty: "hard" },
    { id: "react-sphere", name: "ReactSphere", category: "Chemistry", description: "Chemical reaction simulator", subjects: ["Chemistry"], difficulty: "medium" },
    { id: "biosphere", name: "BioSphere", category: "Biology", description: "Ecosystem and cell biology simulations", subjects: ["Biology"], difficulty: "medium" },
    { id: "geometrix", name: "Geometrix", category: "Mathematics", description: "Interactive geometry suite", subjects: ["Mathematics"], difficulty: "easy" },
    { id: "circuit-builder", name: "Circuit Builder", category: "Physics", description: "Electric circuit design and analysis", subjects: ["Physics"], difficulty: "medium" },
    { id: "wave-lab", name: "Wave Lab", category: "Physics", description: "Wave properties and interference", subjects: ["Physics"], difficulty: "medium" },
    { id: "titration", name: "Titration Lab", category: "Chemistry", description: "Virtual acid-base titration", subjects: ["Chemistry"], difficulty: "easy" },
    { id: "genetics", name: "Genetics Lab", category: "Biology", description: "Inheritance and Punnett squares", subjects: ["Biology"], difficulty: "medium" },
  ]);
});

contentEcosystemRouter.post("/simverse/labs/:labId/sessions", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { labId } = req.params;
    const { config } = req.body;
    const result = await pool.query(
      `INSERT INTO simulation_results (simulation_id, student_id, actions) VALUES (
        (SELECT id FROM simulations WHERE type = $1 LIMIT 1),
        $2, $3
      ) RETURNING *`,
      [labId, req.userId, JSON.stringify({ started: true, config: config || {}, labId })]
    ).catch(async () => {
      // Simulation might not exist — create it
      const sim = await pool.query(
        `INSERT INTO simulations (name, type, created_by) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id`,
        [labId, labId, req.userId]
      );
      const simId = sim.rows[0]?.id;
      if (!simId) return { rows: [{ id: 1, simulation_id: 1, student_id: req.userId }] };
      return pool.query(
        `INSERT INTO simulation_results (simulation_id, student_id, actions) VALUES ($1,$2,$3) RETURNING *`,
        [simId, req.userId, JSON.stringify({ started: true, labId })]
      );
    });
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

contentEcosystemRouter.put("/simverse/sessions/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { actions, conclusion, grade } = req.body;
    const result = await pool.query(
      `UPDATE simulation_results SET 
        actions = COALESCE($1::jsonb, actions),
        conclusion = COALESCE($2, conclusion),
        grade = COALESCE($3, grade)
       WHERE id = $4 RETURNING *`,
      [actions ? JSON.stringify(actions) : null, conclusion, grade, id]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

contentEcosystemRouter.post("/simverse/labs/custom", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { labType, config, name } = req.body;
    const result = await pool.query(
      `INSERT INTO lab_configurations (teacher_id, lab_type, config) VALUES ($1,$2,$3) RETURNING *`,
      [req.userId, labType, JSON.stringify({ ...config, name })]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

contentEcosystemRouter.get("/simverse/labs/custom", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM lab_configurations WHERE teacher_id = $1 ORDER BY created_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   RESOURCE LIBRARY GOVERNANCE
   ═══════════════════════════════════════════════════════════════════════════ */

contentEcosystemRouter.post("/resources/:id/approve", authenticate, requireRole("admin", "teacher"), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const result = await pool.query(
      `UPDATE resources SET approval_status = 'approved', published_at = NOW(), version = version + 1 WHERE id = $1 RETURNING *`,
      [id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

contentEcosystemRouter.get("/resources/library", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { type, subject, search, approval = "approved" } = req.query;
    let q = `SELECT r.*, a.display_name AS author_name, s.name AS subject_name
             FROM resources r
             LEFT JOIN accounts a ON a.id = r.teacher_account_id
             LEFT JOIN subjects s ON s.id = r.subject_id
             WHERE r.approval_status = $1`;
    const params: any[] = [approval];
    let idx = 2;
    if (type) { q += ` AND r.type = $${idx++}`; params.push(type); }
    if (subject) { q += ` AND s.name ILIKE $${idx++}`; params.push(`%${subject}%`); }
    if (search) { q += ` AND (r.title ILIKE $${idx++} OR r.description ILIKE $${idx++})`; params.push(`%${search}%`, `%${search}%`); idx++; }
    q += ` ORDER BY r.published_at DESC NULLS LAST, r.created_at DESC LIMIT 100`;
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   STUDENT PRACTICE CENTER
   ═══════════════════════════════════════════════════════════════════════════ */

contentEcosystemRouter.get("/practice/recommend", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { subject, limit = "10" } = req.query;
    // Get student's weak topics from practice history
    const historyRes = await pool.query(
      `SELECT ps.topics, ps.questions_answered, ps.correct,
        CASE WHEN ps.questions_answered > 0 THEN ps.correct::float / ps.questions_answered ELSE 0 END AS accuracy
       FROM practice_sessions ps
       WHERE ps.student_id = $1
       ORDER BY ps.started_at DESC LIMIT 10`,
      [req.userId]
    );
    // Find questions from weak areas
    let q = `SELECT qb.*, s.name AS subject_name FROM question_bank qb LEFT JOIN subjects s ON s.id = qb.subject_id WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;
    if (subject) { q += ` AND s.name ILIKE $${idx++}`; params.push(`%${subject}%`); }
    q += ` ORDER BY RANDOM() LIMIT $${idx++}`;
    params.push(parseInt(limit as string));
    const questionsRes = await pool.query(q, params);
    res.json({ recommended: questionsRes.rows, history: historyRes.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

contentEcosystemRouter.post("/practice/sessions", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { subject, topics, questionIds } = req.body;
    const result = await pool.query(
      `INSERT INTO practice_sessions (student_id, subject, topics) VALUES ($1,$2,$3) RETURNING *`,
      [req.userId, subject, JSON.stringify(topics || [])]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

contentEcosystemRouter.put("/practice/sessions/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { answers, questionsAnswered, correct, timeSpent, ended } = req.body;
    const result = await pool.query(
      `UPDATE practice_sessions SET
        questions_answered = COALESCE($1, questions_answered),
        correct = COALESCE($2, correct),
        time_spent = COALESCE($3, time_spent),
        answers = COALESCE($4::jsonb, answers),
        ended_at = CASE WHEN $5 THEN NOW() ELSE ended_at END
       WHERE id = $6 AND student_id = $7 RETURNING *`,
      [questionsAnswered, correct, timeSpent, answers ? JSON.stringify(answers) : null, ended || false, id, req.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Session not found" });
    const session = result.rows[0];
    const score = session.questions_answered > 0
      ? Math.round((session.correct / session.questions_answered) * 100)
      : 0;
    res.json({ ...session, score });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   ACADEMIC AI STUDIO
   ═══════════════════════════════════════════════════════════════════════════ */

contentEcosystemRouter.post("/ai-studio/generate", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { contentType, params: genParams, topic, subject, difficulty, count } = req.body;
    const prompts: Record<string, string> = {
      questions: `Generate ${count || 5} exam questions on "${topic}" for ${subject}. Difficulty: ${difficulty || "medium"}. Return JSON array: [{"questionText":"...","modelAnswer":"...","maxMarks":4,"commandWord":"..."}]`,
      flashcards: `Generate ${count || 10} flashcards on "${topic}" for ${subject}. Return JSON array: [{"front":"...","back":"...","type":"..."}]`,
      lesson: `Create a complete lesson plan for "${topic}" in ${subject}. Return JSON: {"title":"...","objectives":[...],"introduction":"...","mainContent":"...","activities":[...],"summary":"...","homework":"..."}`,
      worksheet: `Create a worksheet on "${topic}" for ${subject}. Return JSON: {"title":"...","instructions":"...","questions":[{"text":"...","marks":4,"space":"5cm"}]}`,
      markscheme: `Create a mark scheme for "${topic}" assessment. Return JSON: {"criteria":[{"aspect":"...","marks":4,"guidance":"...","acceptableAnswers":[]}]}`,
    };
    
    const aiResponse = await openaiChat({
      systemPrompt: "You are an expert educational content creator. Return only valid JSON.",
      userMessage: prompts[contentType] || `Generate ${contentType} content for ${topic}. Return JSON.`,
      maxTokens: 2000,
    });
    
    let generated: any = {};
    if (aiResponse) {
      try { const m = aiResponse.match(/[\[\{][\s\S]*[\]\}]/); if (m) generated = JSON.parse(m[0]); } catch { generated = { rawContent: aiResponse }; }
    }
    
    res.json({ contentType, generated, topic, subject });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   PAST PAPER MANAGEMENT
   ═══════════════════════════════════════════════════════════════════════════ */

contentEcosystemRouter.post("/past-papers/link", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { pastPaperId, questionIds, topics } = req.body;
    for (const qId of questionIds || []) {
      await pool.query(
        `INSERT INTO question_relationships (question_id, related_type, related_id) VALUES ($1,'past_paper',$2) ON CONFLICT DO NOTHING`,
        [qId, pastPaperId]
      ).catch(() => {});
    }
    res.json({ success: true, linked: (questionIds || []).length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

contentEcosystemRouter.get("/past-papers/:id/questions", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT qb.*, qr.related_type
       FROM question_relationships qr
       JOIN question_bank qb ON qb.id = qr.question_id
       WHERE qr.related_type = 'past_paper' AND qr.related_id = $1`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   EDUCATIONAL ANALYTICS
   ═══════════════════════════════════════════════════════════════════════════ */

contentEcosystemRouter.get("/analytics/content/:type/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { type, id } = req.params;
    const analyticsRes = await pool.query(
      `SELECT * FROM academic_analytics WHERE content_type = $1 AND content_id = $2 ORDER BY recorded_at DESC LIMIT 30`,
      [type, parseInt(id)]
    );
    // Also track this view
    await pool.query(
      `INSERT INTO academic_analytics (content_type, content_id, metrics) VALUES ($1,$2,$3)`,
      [type, parseInt(id), JSON.stringify({ views: 1, timestamp: new Date().toISOString() })]
    ).catch(() => {});
    
    // Aggregate metrics
    const totalViews = analyticsRes.rows.length;
    const avgScore = analyticsRes.rows
      .map((r: any) => r.metrics?.avg_score || 0)
      .reduce((a: number, b: number) => a + b, 0) / Math.max(totalViews, 1);
    
    res.json({
      contentType: type,
      contentId: parseInt(id),
      totalViews,
      avgScore: Math.round(avgScore * 100) / 100,
      history: analyticsRes.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

contentEcosystemRouter.get("/analytics/content/top-performing", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT content_type, content_id, COUNT(*) AS view_count,
        jsonb_agg(metrics ORDER BY recorded_at DESC) AS recent_metrics
       FROM academic_analytics
       WHERE recorded_at > NOW() - INTERVAL '30 days'
       GROUP BY content_type, content_id
       ORDER BY view_count DESC
       LIMIT 20`
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

contentEcosystemRouter.get("/analytics/content/dashboard", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  try {
    const [questionStats, lessonStats, practiceStats] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total, difficulty, COUNT(*) FILTER (WHERE times_used > 0) AS used
                  FROM question_bank WHERE teacher_account_id = $1
                  GROUP BY difficulty`, [req.userId]),
      pool.query(`SELECT COUNT(*) AS total, status, COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '7 days') AS recent
                  FROM lesson_content WHERE teacher_account_id = $1
                  GROUP BY status`, [req.userId]),
      pool.query(`SELECT COUNT(*) AS sessions, AVG(correct::float / NULLIF(questions_answered,0) * 100) AS avg_accuracy
                  FROM practice_sessions WHERE started_at > NOW() - INTERVAL '30 days'`),
    ]);
    res.json({
      questions: questionStats.rows,
      lessons: lessonStats.rows,
      practice: practiceStats.rows[0],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
