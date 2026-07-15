"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { UploadNarrationAudioSchema } from "@/lib/schemas/actions";

export async function clearNarrationAudio(input: {
  projectId: string;
}): Promise<ActionResult> {
  const parsed = UploadNarrationAudioSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos");

  try {
    await prisma.project.update({
      where: { id: parsed.data.projectId },
      data: { audioUrl: null, audioSource: null, transcriptionJson: null, brollsJson: null },
    });
    revalidatePath(`/projects/${parsed.data.projectId}`, "layout");
    return ok(undefined);
  } catch (err) {
    return fail(err);
  }
}
