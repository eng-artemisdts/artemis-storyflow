"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { EditorSettingsSchema, type EditorSettings } from "@/lib/schemas/editor";
import {
  parseEditorPersisted,
  stringifyEditorPersisted,
} from "@/lib/editor/editor-settings";

const SaveEditorSettingsSchema = z.object({
  projectId: z.string().min(1),
  settings: EditorSettingsSchema.partial(),
});

function revalidateEdit(projectId: string) {
  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath(`/projects/${projectId}/static/edit`);
}

/** Atualiza settings do editor (transição / música) em Project.editorJson. */
export async function saveEditorSettings(input: {
  projectId: string;
  settings: Partial<EditorSettings>;
}): Promise<ActionResult<{ settings: EditorSettings }>> {
  const parsed = SaveEditorSettingsSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos");
  const { projectId, settings: patch } = parsed.data;

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, videoKind: true, editorJson: true },
    });
    if (!project) return fail("Projeto não encontrado");
    if (project.videoKind !== "static") {
      return fail("Editor disponível apenas para vídeos static");
    }

    const current = parseEditorPersisted(project.editorJson);
    const next: EditorSettings = { ...current.settings, ...patch };
    await prisma.project.update({
      where: { id: project.id },
      data: { editorJson: stringifyEditorPersisted(next) },
    });
    revalidateEdit(project.id);
    return ok({ settings: next });
  } catch (err) {
    return fail(err);
  }
}

/** Remove apenas a música de fundo dos settings. */
export async function clearEditorMusic(input: {
  projectId: string;
}): Promise<ActionResult<{ settings: EditorSettings }>> {
  return saveEditorSettings({
    projectId: input.projectId,
    settings: { musicUrl: null },
  });
}
