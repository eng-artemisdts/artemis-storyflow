"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { runWithAiContext } from "@/lib/credentials";
import { submitCustomStylePreviewJob } from "@/lib/jobs";
import type { AiClientContext } from "@/lib/ai-settings";
import {
  CreateCustomStyleSchema,
  DeleteCustomStyleSchema,
  PreviewCustomStyleSchema,
  UpdateCustomStyleSchema,
} from "@/lib/schemas/actions";

export type CustomStyleDTO = {
  id: string;
  title: string;
  prompt: string;
  previewImageUrl: string | null;
};

function toDTO(style: {
  id: string;
  title: string;
  prompt: string;
  previewImageUrl?: string | null;
}): CustomStyleDTO {
  return {
    id: style.id,
    title: style.title,
    prompt: style.prompt,
    previewImageUrl: style.previewImageUrl ?? null,
  };
}

function revalidateStylePages(projectId?: string) {
  revalidatePath("/projects", "layout");
  if (projectId) {
    revalidatePath(`/projects/${projectId}/style`);
    revalidatePath(`/projects/${projectId}/static/style`);
  }
}

export async function createCustomStyle(input: {
  title: string;
  prompt: string;
  previewImageUrl?: string | null;
}): Promise<ActionResult<CustomStyleDTO>> {
  const parsed = CreateCustomStyleSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Dados inválidos");
  }

  try {
    const style = await prisma.customStyle.create({
      data: {
        title: parsed.data.title,
        prompt: parsed.data.prompt,
        previewImageUrl: parsed.data.previewImageUrl ?? null,
      },
    });
    revalidateStylePages();
    return ok(toDTO(style));
  } catch (err) {
    return fail(err);
  }
}

export async function updateCustomStyle(input: {
  id: string;
  title: string;
  prompt: string;
  previewImageUrl?: string | null;
}): Promise<ActionResult<CustomStyleDTO>> {
  const parsed = UpdateCustomStyleSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Dados inválidos");
  }

  try {
    const existing = await prisma.customStyle.findUnique({
      where: { id: parsed.data.id },
    });
    if (!existing) return fail("Estilo não encontrado");

    const style = await prisma.customStyle.update({
      where: { id: parsed.data.id },
      data: {
        title: parsed.data.title,
        prompt: parsed.data.prompt,
        ...(parsed.data.previewImageUrl !== undefined
          ? { previewImageUrl: parsed.data.previewImageUrl }
          : {}),
      },
    });
    revalidateStylePages();
    return ok(toDTO(style));
  } catch (err) {
    return fail(err);
  }
}

export async function deleteCustomStyle(input: {
  id: string;
}): Promise<ActionResult> {
  const parsed = DeleteCustomStyleSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Dados inválidos");
  }

  try {
    const existing = await prisma.customStyle.findUnique({
      where: { id: parsed.data.id },
    });
    if (!existing) return fail("Estilo não encontrado");

    await prisma.$transaction([
      prisma.project.updateMany({
        where: { styleId: parsed.data.id },
        data: { styleId: null },
      }),
      prisma.customStyle.delete({ where: { id: parsed.data.id } }),
    ]);

    revalidateStylePages();
    return ok(undefined);
  } catch (err) {
    return fail(err);
  }
}

/** Dispara geração de imagem de exemplo para o prompt do estilo. */
export async function generateCustomStylePreview(input: {
  projectId: string;
  prompt: string;
  styleId?: string;
  ai?: AiClientContext;
}): Promise<ActionResult<{ jobId: string }>> {
  const parsed = PreviewCustomStyleSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Dados inválidos");
  }

  try {
    return await runWithAiContext(parsed.data.ai, async () => {
      const project = await prisma.project.findUnique({
        where: { id: parsed.data.projectId },
        select: { id: true },
      });
      if (!project) return fail("Projeto não encontrado");

      if (parsed.data.styleId) {
        const style = await prisma.customStyle.findUnique({
          where: { id: parsed.data.styleId },
          select: { id: true },
        });
        if (!style) return fail("Estilo não encontrado");
      }

      const job = await submitCustomStylePreviewJob(
        parsed.data.projectId,
        parsed.data.prompt,
        parsed.data.styleId
      );
      if (job.status === "failed") {
        return fail(job.error ?? "Falha ao submeter preview");
      }
      return ok({ jobId: job.id });
    });
  } catch (err) {
    return fail(err);
  }
}
