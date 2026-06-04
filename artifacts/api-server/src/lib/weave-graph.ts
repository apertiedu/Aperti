import { db } from "@workspace/db";
import { knowledgeNodesTable, knowledgeEdgesTable } from "@workspace/db";
import { eq, and, or, inArray } from "drizzle-orm";

export type NodeType = "topic" | "question" | "resource" | "student" | "teacher" | "course" | "flashcard";
export type RelationType = "prerequisite" | "related_to" | "includes" | "tests" | "struggles_with" | "teaches";

export interface WeaveNode {
  id: number;
  name: string;
  type: string;
  metadata?: Record<string, unknown>;
}

export interface WeavePath {
  nodes: WeaveNode[];
  edges: Array<{ from: number; to: number; relation: string; weight: number }>;
  length: number;
}

function parseMeta(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

export async function getOrCreateNode(
  name: string,
  type: NodeType,
  meta?: Record<string, unknown>
): Promise<number> {
  const existing = await db.query.knowledgeNodes.findFirst({
    where: (n, { and: A, eq: E }) => A(E(n.name, name), E(n.type, type)),
  });
  if (existing) return existing.id;
  const [node] = await db.insert(knowledgeNodesTable).values({
    name,
    type,
    metadata: meta ? JSON.stringify(meta) : null,
  }).returning();
  return node.id;
}

export async function ensureEdge(
  fromId: number,
  toId: number,
  relation: RelationType,
  weight = 1
): Promise<void> {
  try {
    await db.insert(knowledgeEdgesTable).values({
      fromNodeId: fromId,
      toNodeId: toId,
      relationType: relation,
      weight,
    }).onConflictDoNothing();
  } catch {
    // ignore duplicate edge errors
  }
}

export async function getRelatedNodes(
  nodeId: number,
  relation?: string
): Promise<WeaveNode[]> {
  const edges = await db.select().from(knowledgeEdgesTable).where(
    relation
      ? and(eq(knowledgeEdgesTable.fromNodeId, nodeId), eq(knowledgeEdgesTable.relationType, relation))
      : eq(knowledgeEdgesTable.fromNodeId, nodeId)
  );
  if (edges.length === 0) return [];
  const targetIds = edges.map(e => e.toNodeId);
  const nodes = await db.select().from(knowledgeNodesTable).where(inArray(knowledgeNodesTable.id, targetIds));
  return nodes.map(n => ({ id: n.id, name: n.name, type: n.type, metadata: parseMeta(n.metadata) }));
}

export async function getIncomingNodes(
  nodeId: number,
  relation?: string
): Promise<WeaveNode[]> {
  const edges = await db.select().from(knowledgeEdgesTable).where(
    relation
      ? and(eq(knowledgeEdgesTable.toNodeId, nodeId), eq(knowledgeEdgesTable.relationType, relation))
      : eq(knowledgeEdgesTable.toNodeId, nodeId)
  );
  if (edges.length === 0) return [];
  const sourceIds = edges.map(e => e.fromNodeId);
  const nodes = await db.select().from(knowledgeNodesTable).where(inArray(knowledgeNodesTable.id, sourceIds));
  return nodes.map(n => ({ id: n.id, name: n.name, type: n.type, metadata: parseMeta(n.metadata) }));
}

export async function findShortestPath(sourceId: number, targetId: number): Promise<WeavePath | null> {
  if (sourceId === targetId) {
    const n = await db.query.knowledgeNodes.findFirst({ where: (n, { eq: E }) => E(n.id, sourceId) });
    if (!n) return null;
    return { nodes: [{ id: n.id, name: n.name, type: n.type }], edges: [], length: 0 };
  }

  const allEdges = await db.select().from(knowledgeEdgesTable);
  const adj: Map<number, Array<{ to: number; relation: string; weight: number }>> = new Map();
  for (const e of allEdges) {
    if (!adj.has(e.fromNodeId)) adj.set(e.fromNodeId, []);
    adj.get(e.fromNodeId)!.push({ to: e.toNodeId, relation: e.relationType, weight: e.weight });
  }

  const visited = new Set<number>();
  const prev = new Map<number, { from: number; relation: string; weight: number }>();
  const queue: number[] = [sourceId];
  visited.add(sourceId);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr === targetId) break;
    for (const { to, relation, weight } of adj.get(curr) ?? []) {
      if (!visited.has(to)) {
        visited.add(to);
        prev.set(to, { from: curr, relation, weight });
        queue.push(to);
      }
    }
  }

  if (!prev.has(targetId)) return null;

  const pathIds: number[] = [];
  let cur = targetId;
  while (cur !== sourceId) {
    pathIds.unshift(cur);
    cur = prev.get(cur)!.from;
  }
  pathIds.unshift(sourceId);

  const nodeRows = await db.select().from(knowledgeNodesTable)
    .where(inArray(knowledgeNodesTable.id, pathIds));
  const nodeMap = new Map(nodeRows.map(n => [n.id, n]));

  const nodes: WeaveNode[] = pathIds.map(id => {
    const n = nodeMap.get(id)!;
    return { id: n.id, name: n.name, type: n.type, metadata: parseMeta(n.metadata) };
  });

  const edges = pathIds.slice(1).map((id, i) => {
    const p = prev.get(id)!;
    return { from: pathIds[i], to: id, relation: p.relation, weight: p.weight };
  });

  return { nodes, edges, length: pathIds.length - 1 };
}

export async function getRecommendations(
  studentId: number,
  type: "topic" | "question" | "resource"
): Promise<WeaveNode[]> {
  const studentNodes = await db.query.knowledgeNodes.findMany({
    where: (n, { and: A, eq: E }) => A(E(n.name, String(studentId)), E(n.type, "student")),
  });
  if (studentNodes.length === 0) return [];

  const studentNodeId = studentNodes[0].id;
  const weakEdges = await db.select().from(knowledgeEdgesTable)
    .where(and(
      eq(knowledgeEdgesTable.fromNodeId, studentNodeId),
      eq(knowledgeEdgesTable.relationType, "struggles_with")
    ));

  if (weakEdges.length === 0) return [];
  const weakTopicIds = weakEdges.map(e => e.toNodeId);

  if (type === "topic") {
    const prereqEdges = await db.select().from(knowledgeEdgesTable)
      .where(and(
        inArray(knowledgeEdgesTable.toNodeId, weakTopicIds),
        eq(knowledgeEdgesTable.relationType, "prerequisite")
      ));
    const prereqIds = prereqEdges.map(e => e.fromNodeId);
    if (prereqIds.length === 0) {
      return db.select().from(knowledgeNodesTable)
        .where(inArray(knowledgeNodesTable.id, weakTopicIds))
        .then(rows => rows.map(n => ({ id: n.id, name: n.name, type: n.type, metadata: parseMeta(n.metadata) })));
    }
    const nodes = await db.select().from(knowledgeNodesTable)
      .where(inArray(knowledgeNodesTable.id, prereqIds));
    return nodes.map(n => ({ id: n.id, name: n.name, type: n.type, metadata: parseMeta(n.metadata) }));
  }

  if (type === "question") {
    const qEdges = await db.select().from(knowledgeEdgesTable)
      .where(and(
        inArray(knowledgeEdgesTable.toNodeId, weakTopicIds),
        eq(knowledgeEdgesTable.relationType, "tests")
      ));
    if (qEdges.length === 0) return [];
    const qIds = qEdges.map(e => e.fromNodeId);
    const nodes = await db.select().from(knowledgeNodesTable)
      .where(and(inArray(knowledgeNodesTable.id, qIds), eq(knowledgeNodesTable.type, "question")));
    return nodes.map(n => ({ id: n.id, name: n.name, type: n.type, metadata: parseMeta(n.metadata) }));
  }

  if (type === "resource") {
    const rEdges = await db.select().from(knowledgeEdgesTable)
      .where(and(
        inArray(knowledgeEdgesTable.fromNodeId, weakTopicIds),
        eq(knowledgeEdgesTable.relationType, "includes")
      ));
    if (rEdges.length === 0) return [];
    const rIds = rEdges.map(e => e.toNodeId);
    const nodes = await db.select().from(knowledgeNodesTable)
      .where(and(inArray(knowledgeNodesTable.id, rIds), eq(knowledgeNodesTable.type, "resource")));
    return nodes.map(n => ({ id: n.id, name: n.name, type: n.type, metadata: parseMeta(n.metadata) }));
  }

  return [];
}
