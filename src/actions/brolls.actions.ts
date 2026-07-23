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
  refreshBrollPromptsBatch,
} from "@/lib/brolls/generate-brolls";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import type { AiClientContext } from "@/lib/ai-settings";
import {
  GenerateBrollsSchema,
  ProjectIdSchema,
  RefreshBrollPromptsSchema,
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
 * Remove todos os b-rolls do projeto (lista + imagens associadas no JSON)
 * e apaga os jobs de broll para que gerações antigas não sobrescrevam
 * uma nova análise.
 */
export async function resetProjectBrolls(input: {
  projectId: string;
}): Promise<ActionResult> {
  const parsed = ProjectIdSchema.safeParse(input);
  if (!parsed.success) return fail("Projeto inválido");
  const { projectId } = parsed.data;

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, videoKind: true },
    });
    if (!project || project.videoKind !== "static") {
      return fail("Projeto static não encontrado");
    }

    await prisma.generationJob.deleteMany({
      where: { projectId, targetType: "broll" },
    });
    await prisma.project.update({
      where: { id: projectId },
      data: { brollsJson: null },
    });

    revalidateScenes(projectId);
    return ok(undefined);
  } catch (err) {
    return fail(err);
  }
}

/**
 * Remove apenas as imagens de todas as cenas, preservando lista, prompts e
 * tempos. Também cancela jobs de broll em andamento para que não reinsiram
 * URLs antigas.
 */
export async function clearProjectBrollImages(input: {
  projectId: string;
}): Promise<ActionResult<{ brolls: ProjectBrolls }>> {
  const parsed = ProjectIdSchema.safeParse(input);
  if (!parsed.success) return fail("Projeto inválido");
  const { projectId } = parsed.data;

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, videoKind: true, brollsJson: true },
    });
    if (!project || project.videoKind !== "static") {
      return fail("Projeto static não encontrado");
    }

    const current = parseProjectBrolls(project.brollsJson);
    if (!current?.brolls.length) {
      return fail("Nenhuma lista de b-rolls para limpar");
    }

    const cleared: ProjectBrolls = {
      ...current,
      brolls: current.brolls.map((b) => ({ ...b, imageUrl: null })),
    };

    await prisma.generationJob.deleteMany({
      where: { projectId, targetType: "broll" },
    });
    await prisma.project.update({
      where: { id: projectId },
      data: { brollsJson: JSON.stringify(cleared) },
    });

    revalidateScenes(projectId);
    return ok({ brolls: cleared });
  } catch (err) {
    return fail(err);
  }
}

/**
 * Atualiza os prompts de um LOTE de cenas (até 20 por chamada) com estilo,
 * canal e proporção atuais, preservando segmentação, tempos e imagens.
 * O cliente chama em lotes sequenciais para não estourar o timeout da
 * requisição em vídeos com muitas cenas; o progresso é persistido a cada lote.
 */
export async function refreshProjectBrollPromptsBatch(input: {
  projectId: string;
  brollIds: number[];
  ai?: AiClientContext;
}): Promise<ActionResult<{ brolls: ProjectBrolls }>> {
  const parsed = RefreshBrollPromptsSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos");
  const { projectId, brollIds, ai } = parsed.data;

  try {
    return await runWithAiContext(ai, async () => {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { channel: true },
      });
      if (!project || project.videoKind !== "static") {
        return fail("Projeto static não encontrado");
      }

      const current = parseProjectBrolls(project.brollsJson);
      if (!current?.brolls.length) {
        return fail("Nenhuma lista de b-rolls para atualizar");
      }
      const targets = current.brolls.filter((b) => brollIds.includes(b.id));
      if (targets.length === 0) {
        return fail("Nenhuma das cenas informadas foi encontrada");
      }

      const transcription = parseProjectTranscription(project.transcriptionJson);
      if (!transcription) {
        return fail("Gere a transcrição antes de atualizar os prompts.");
      }

      const providers = resolveAiProviders(project);
      if (!providers.llmProvider || !providers.llmModel) {
        return fail("Configure o provedor de LLM em Configurações.");
      }

      const apiKey = await resolveApiKey(projectId, providers.llmProvider);
      const stylePreset = await resolveProjectStylePreset(project);
      const updates = await refreshBrollPromptsBatch({
        providerId: providers.llmProvider,
        apiKey,
        model: providers.llmModel,
        transcription,
        brolls: targets,
        stylePreset,
        aspectRatio: project.videoAspectRatio || "16:9",
        channelNiche: project.channel?.niche ?? null,
        channelDescription: project.channel?.description ?? null,
      });

      // Relê o JSON antes de gravar para não perder edições feitas por
      // outras actions (ex.: imagem gerada) enquanto o LLM respondia.
      const fresh = await prisma.project.findUnique({
        where: { id: projectId },
        select: { brollsJson: true },
      });
      const latest = parseProjectBrolls(fresh?.brollsJson) ?? current;
      const merged: ProjectBrolls = {
        ...latest,
        brolls: latest.brolls.map((b) =>
          updates.has(b.id) ? { ...b, image_prompt: updates.get(b.id)! } : b
        ),
        styleId: project.styleId,
        styleLabel: stylePreset?.label ?? null,
        promptsUpdatedAt: new Date().toISOString(),
      };

      await prisma.project.update({
        where: { id: projectId },
        data: { brollsJson: JSON.stringify(merged) },
      });
      revalidateScenes(projectId);
      return ok({ brolls: merged });
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
