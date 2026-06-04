import { Router, Response } from "express";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { db } from "@workspace/db";
import {
  knowledgeNodesTable, knowledgeEdgesTable,
  subjectsTable, questionBankTable, flashcardItemsTable,
  studentsTable, accountsTable, echoMemoryTable,
} from "@workspace/db";
import { eq, and, count } from "drizzle-orm";
import {
  getRelatedNodes, getIncomingNodes, findShortestPath, getRecommendations,
  getOrCreateNode, ensureEdge,
} from "../lib/weave-graph";

export const weaveRouter = Router();

// GET /weave/related?nodeId=&relation=
weaveRouter.get("/related", authenticate, async (req: AuthRequest, res: Response) => {
  const nodeId = parseInt(req.query.nodeId as string);
  const relation = req.query.relation as string | undefined;
  if (isNaN(nodeId)) return res.status(400).json({ error: "nodeId required" });
  const nodes = await getRelatedNodes(nodeId, relation);
  const incoming = await getIncomingNodes(nodeId, relation);
  res.json({ outgoing: nodes, incoming });
});

// GET /weave/path?sourceId=&targetId=
weaveRouter.get("/path", authenticate, async (req: AuthRequest, res: Response) => {
  const sourceId = parseInt(req.query.sourceId as string);
  const targetId = parseInt(req.query.targetId as string);
  if (isNaN(sourceId) || isNaN(targetId)) return res.status(400).json({ error: "sourceId and targetId required" });
  const path = await findShortestPath(sourceId, targetId);
  if (!path) return res.status(404).json({ error: "No path found between nodes" });
  res.json(path);
});

// GET /weave/recommend?studentId=&type=topic|question|resource
weaveRouter.get("/recommend", authenticate, async (req: AuthRequest, res: Response) => {
  const studentId = parseInt(req.query.studentId as string);
  const type = (req.query.type as "topic" | "question" | "resource") || "topic";
  if (isNaN(studentId)) return res.status(400).json({ error: "studentId required" });
  const recommendations = await getRecommendations(studentId, type);
  res.json({ recommendations, type, studentId });
});

// POST /weave/edges — manual edge creation (teacher/admin)
weaveRouter.post("/edges", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response) => {
  const { fromNodeId, toNodeId, relationType, weight } = req.body;
  if (!fromNodeId || !toNodeId || !relationType) {
    return res.status(400).json({ error: "fromNodeId, toNodeId, relationType required" });
  }
  await ensureEdge(fromNodeId, toNodeId, relationType, weight ?? 1);
  res.status(201).json({ success: true });
});

// GET /weave/nodes — list all nodes (for UI explorer)
weaveRouter.get("/nodes", authenticate, async (req: AuthRequest, res: Response) => {
  const type = req.query.type as string | undefined;
  let rows;
  if (type) {
    rows = await db.select().from(knowledgeNodesTable).where(eq(knowledgeNodesTable.type, type)).limit(200);
  } else {
    rows = await db.select().from(knowledgeNodesTable).limit(500);
  }
  res.json(rows);
});

// GET /weave/health — graph statistics
weaveRouter.get("/health", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const [nodeCount] = await db.select({ count: count() }).from(knowledgeNodesTable);
  const [edgeCount] = await db.select({ count: count() }).from(knowledgeEdgesTable);

  const allNodes = await db.select({ id: knowledgeNodesTable.id }).from(knowledgeNodesTable);
  const allEdges = await db.select({
    from: knowledgeEdgesTable.fromNodeId,
    to: knowledgeEdgesTable.toNodeId,
  }).from(knowledgeEdgesTable);

  const connected = new Set<number>();
  for (const e of allEdges) { connected.add(e.from); connected.add(e.to); }
  const disconnected = allNodes.filter(n => !connected.has(n.id)).length;

  const typeCountsRaw = await db.select({
    type: knowledgeNodesTable.type,
    count: count(),
  }).from(knowledgeNodesTable).groupBy(knowledgeNodesTable.type);

  res.json({
    nodeCount: Number(nodeCount.count),
    edgeCount: Number(edgeCount.count),
    disconnectedNodes: disconnected,
    nodesByType: Object.fromEntries(typeCountsRaw.map(r => [r.type, Number(r.count)])),
  });
});

// POST /weave/populate — seed the graph from existing DB data
weaveRouter.post("/populate", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const log: string[] = [];
  let nodesCreated = 0;
  let edgesCreated = 0;

  try {
    const subjects = await db.select().from(subjectsTable).limit(200);
    const topicNodeMap = new Map<string, number>();

    for (const s of subjects) {
      const id = await getOrCreateNode(s.name, "topic", { subjectId: s.id, subjectName: s.name });
      topicNodeMap.set(s.name.toLowerCase(), id);
      nodesCreated++;
    }

    // Course units handled dynamically to avoid missing-table errors
    try {
      const { courseUnitsTable: cut } = await import("@workspace/db") as any;
      if (cut) {
        const units = await db.select().from(cut).limit(500);
        for (const u of units) {
          if (!u.title) continue;
          const id = await getOrCreateNode(u.title, "topic", { unitId: u.id });
          topicNodeMap.set(u.title.toLowerCase(), id);
          nodesCreated++;
        }
      }
    } catch { /* course units table may not exist */ }

    const questions = await db.select({
      id: questionBankTable.id,
      questionText: questionBankTable.questionText,
      topic: questionBankTable.topic,
    }).from(questionBankTable).limit(1000);

    for (const q of questions) {
      const qId = await getOrCreateNode(
        `Q: ${q.questionText?.slice(0, 80) ?? "Question " + q.id}`,
        "question",
        { questionBankId: q.id, topic: q.topic }
      );
      nodesCreated++;
      if (q.topic) {
        const topicKey = q.topic.toLowerCase();
        if (!topicNodeMap.has(topicKey)) {
          const tId = await getOrCreateNode(q.topic, "topic", {});
          topicNodeMap.set(topicKey, tId);
          nodesCreated++;
        }
        await ensureEdge(qId, topicNodeMap.get(topicKey)!, "tests");
        edgesCreated++;
      }
    }

    const flashcards = await db.select({
      id: flashcardItemsTable.id,
      front: flashcardItemsTable.front,
      deckId: flashcardItemsTable.deckId,
    }).from(flashcardItemsTable).limit(500);

    for (const f of flashcards) {
      await getOrCreateNode(
        `FC: ${f.front?.slice(0, 80) ?? "Flashcard " + f.id}`,
        "flashcard",
        { flashcardId: f.id, deckId: f.deckId }
      );
      nodesCreated++;
    }

    const students = await db.select({
      id: studentsTable.id,
      accountId: studentsTable.accountId,
    }).from(studentsTable).limit(500);

    for (const s of students) {
      const sId = await getOrCreateNode(String(s.id), "student", { studentId: s.id, accountId: s.accountId });
      nodesCreated++;

      const memory = await db.query.echoMemory.findFirst({
        where: (m, { eq: E }) => E(m.studentId, s.id),
      });
      if (memory) {
        const weakTopics = (memory.weakTopics as string[]) ?? [];
        for (const wt of weakTopics) {
          const topicKey = wt.toLowerCase();
          if (!topicNodeMap.has(topicKey)) {
            const tId = await getOrCreateNode(wt, "topic", {});
            topicNodeMap.set(topicKey, tId);
            nodesCreated++;
          }
          await ensureEdge(sId, topicNodeMap.get(topicKey)!, "struggles_with", 2);
          edgesCreated++;
        }
      }
    }

    const teachers = await db.select({
      id: accountsTable.id,
      displayName: accountsTable.displayName,
    }).from(accountsTable).where(eq(accountsTable.role, "teacher")).limit(200);

    for (const t of teachers) {
      await getOrCreateNode(t.displayName || "Teacher " + t.id, "teacher", { teacherId: t.id });
      nodesCreated++;
    }

    log.push(`Created ${nodesCreated} nodes and ${edgesCreated} edges`);
    res.json({ success: true, nodesCreated, edgesCreated, log });
  } catch (err: any) {
    res.status(500).json({ error: err.message, log });
  }
});
