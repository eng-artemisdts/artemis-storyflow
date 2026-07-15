"use server";

import { prisma } from "@/lib/prisma";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { SaveWhiteboardSchema } from "@/lib/schemas/actions";

/** Auto-save do canvas (debounce no cliente). */
export async function saveWhiteboard(input: {
  projectId: string;
  nodes: string;
  edges: string;
}): Promise<ActionResult> {
  const parsed = SaveWhiteboardSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos");

  const { projectId, nodes, edges } = parsed.data;
  try {
    // Valida que os payloads são JSON válidos antes de persistir.
    JSON.parse(nodes);
    JSON.parse(edges);
    await prisma.whiteboard.upsert({
      where: { projectId },
      create: { projectId, nodes, edges },
      update: { nodes, edges },
    });
    return ok(undefined);
  } catch (err) {
    return fail(err);
  }
}
