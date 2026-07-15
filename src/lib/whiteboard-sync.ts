import "server-only";
import { prisma } from "@/lib/prisma";
import type { SerializedEdge, SerializedNode } from "@/lib/whiteboard-layout";

/** Lê o grafo persistido (ou vazio) e aplica um patch, salvando de volta. */
export async function patchWhiteboard(
  projectId: string,
  patch: (graph: {
    nodes: SerializedNode[];
    edges: SerializedEdge[];
  }) => { nodes: SerializedNode[]; edges: SerializedEdge[] }
): Promise<{ nodes: SerializedNode[]; edges: SerializedEdge[] }> {
  const existing = await prisma.whiteboard.findUnique({ where: { projectId } });
  let nodes: SerializedNode[] = [];
  let edges: SerializedEdge[] = [];
  if (existing) {
    try {
      nodes = JSON.parse(existing.nodes) as SerializedNode[];
      edges = JSON.parse(existing.edges) as SerializedEdge[];
    } catch {
      // JSON corrompido — recomeça vazio e deixa o patch popular.
    }
  }

  const next = patch({ nodes, edges });
  await prisma.whiteboard.upsert({
    where: { projectId },
    create: {
      projectId,
      nodes: JSON.stringify(next.nodes),
      edges: JSON.stringify(next.edges),
    },
    update: {
      nodes: JSON.stringify(next.nodes),
      edges: JSON.stringify(next.edges),
    },
  });
  return next;
}
