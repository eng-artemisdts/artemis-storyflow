"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { resolveApiKey, runWithAiContext } from "@/lib/credentials";
import { resolveAiProviders } from "@/lib/channel-ai";
import { resolveProjectStylePreset } from "@/lib/resolve-style-preset";
import { parseProjectTranscription } from "@/lib/transcription";
import {
  buildBrollsGenerationPromptParts,
  formatBrollsGenerationPromptMd,
  generateBrollsFromTranscription,
  parseProjectBrolls,
} from "@/lib/brolls/generate-brolls";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import type { AiClientContext } from "@/lib/ai-settings";
import {
  GenerateBrollsSchema,
  ProjectIdSchema,
  UpdateBrollPromptSchema,
} from "@/lib/schemas/actions";
import type { ProjectBrolls } from "@/lib/schemas/brolls";

function revalidateScenes(projectId: string) {
  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath(`/projects/${projectId}/static/scenes`);
}

/**
 * Analisa a transcrição word-level + estilo e gera a lista de b-rolls
 * (prompts de imagem + start/end) via LLM.
 */
export async function generateProjectBrolls(input: {
  projectId: string;
  ai?: AiClientContext;
}): Promise<ActionResult<{ brolls: ProjectBrolls }>> {
  const parsed = GenerateBrollsSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos");
  const { projectId, ai } = parsed.data;

  try {
    return await runWithAiContext(ai, async () => {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { channel: true },
      });
      if (!project) return fail("Projeto não encontrado");
      if (project.videoKind !== "static") {
        return fail("Geração de b-rolls disponível apenas para vídeos static");
      }

      const transcription = parseProjectTranscription(project.transcriptionJson);
      if (!transcription) {
        return fail("Gere a transcrição antes de criar as cenas (b-rolls).");
      }

      const providers = resolveAiProviders(project);
      if (!providers.llmProvider || !providers.llmModel) {
        return fail("Configure o provedor de LLM em Configurações.");
      }

      const apiKey = await resolveApiKey(projectId, providers.llmProvider);
      const stylePreset = await resolveProjectStylePreset(project);
      const brolls = await generateBrollsFromTranscription({
        providerId: providers.llmProvider,
        apiKey,
        model: providers.llmModel,
        transcription,
        stylePreset,
        styleId: project.styleId,
        aspectRatio: project.videoAspectRatio || "16:9",
        channelNiche: project.channel?.niche ?? null,
        channelDescription: project.channel?.description ?? null,
        projectName: project.name,
      });

      await prisma.project.update({
        where: { id: project.id },
        data: { brollsJson: JSON.stringify(brolls) },
      });

      revalidateScenes(project.id);
      return ok({ brolls });
    });
  } catch (err) {
    return fail(err);
  }
}

/**
 * Retorna o prompt de geração de b-rolls em Markdown.
 * Usa o snapshot salvo; se ainda não existir, remonta a partir da
 * transcrição + estilo atuais e persiste no brollsJson.
 */
export async function getBrollsGenerationPromptMd(input: {
  projectId: string;
}): Promise<ActionResult<{ markdown: string }>> {
  const parsed = ProjectIdSchema.safeParse(input);
  if (!parsed.success) return fail("Projeto inválido");
  const { projectId } = parsed.data;

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { channel: true },
    });
    if (!project || project.videoKind !== "static") {
      return fail("Projeto static não encontrado");
    }

    const existing = parseProjectBrolls(project.brollsJson);
    if (existing?.generationPromptMd?.trim()) {
      return ok({ markdown: existing.generationPromptMd });
    }

    const transcription = parseProjectTranscription(project.transcriptionJson);
    if (!transcription) {
      return fail("Gere a transcrição antes de exportar o prompt.");
    }

    const stylePreset = await resolveProjectStylePreset(project);
    const { system, user } = buildBrollsGenerationPromptParts({
      transcription,
      stylePreset,
      channelNiche: project.channel?.niche ?? null,
      channelDescription: project.channel?.description ?? null,
      aspectRatio: project.videoAspectRatio || "16:9",
    });
    const markdown = formatBrollsGenerationPromptMd({
      projectName: project.name,
      system,
      user,
    });

    if (existing) {
      await prisma.project.update({
        where: { id: projectId },
        data: {
          brollsJson: JSON.stringify({ ...existing, generationPromptMd: markdown }),
        },
      });
      revalidateScenes(projectId);
    }

    return ok({ markdown });
  } catch (err) {
    return fail(err);
  }
}

/** Atualiza o image_prompt de um b-roll específico. */
export async function updateBrollPrompt(input: {
  projectId: string;
  brollId: number;
  imagePrompt: string;
}): Promise<ActionResult> {
  const parsed = UpdateBrollPromptSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos");
  const { projectId, brollId, imagePrompt } = parsed.data;

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { brollsJson: true, videoKind: true },
    });
    if (!project || project.videoKind !== "static") {
      return fail("Projeto static não encontrado");
    }
    const data = parseProjectBrolls(project.brollsJson);
    if (!data) return fail("Nenhuma lista de b-rolls para editar");

    const idx = data.brolls.findIndex((b) => b.id === brollId);
    if (idx < 0) return fail(`B-roll #${brollId} não encontrado`);

    data.brolls[idx] = { ...data.brolls[idx]!, image_prompt: imagePrompt };
    await prisma.project.update({
      where: { id: projectId },
      data: { brollsJson: JSON.stringify(data) },
    });
    revalidateScenes(projectId);
    return ok(undefined);
  } catch (err) {
    return fail(err);
  }
}
