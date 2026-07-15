import "server-only";
import { prisma } from "@/lib/prisma";
import { resolveApiKey } from "@/lib/credentials";
import { resolveAiProviders } from "@/lib/channel-ai";
import { createImageProvider, createVideoProvider } from "@/lib/providers/registry";
import { storage } from "@/lib/storage";
import {
  applyCharacterSheetStyle,
  applyImageStyle,
  applyVideoStyle,
  buildReferenceRolePrefix,
  getStylePreset,
  resolveImageFamily,
  resolveVideoFamily,
} from "@/lib/style-presets";
import type { GenerationJob, Project } from "@/generated/prisma/client";
import { resolveVideoAspectRatio } from "@/lib/video-aspect";

export type ImageTargetType = "character" | "scenario" | "scene_keyframe" | "broll";
export type JobTargetType = ImageTargetType | "scene_video";

/** Máximo de jobs de vídeo rodando em paralelo por provedor. */
const MAX_CONCURRENT_VIDEO_JOBS = 2;

/** Projeto com provedores resolvidos a partir do canal. */
async function loadProjectWithChannelAi(projectId: string): Promise<Project> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { channel: true },
  });
  const ai = resolveAiProviders(project, project.channel);
  return { ...project, ...ai };
}

// ─────────────────────────────────────────────────────────────────
// Submissão de jobs de IMAGEM (personagem, cenário, keyframe de cena)
// ─────────────────────────────────────────────────────────────────

/**
 * Retorna a URL remota (acessível pelos provedores) do asset de um alvo:
 * o resultUrl do último job bem-sucedido. URLs locais (/uploads) não
 * servem como referenceImages porque o provedor não consegue baixá-las.
 */
async function getRemoteAssetUrl(
  targetType: JobTargetType,
  targetId: string
): Promise<string | null> {
  const job = await prisma.generationJob.findFirst({
    where: { targetType, targetId, status: "succeeded", resultUrl: { not: null } },
    orderBy: { updatedAt: "desc" },
  });
  return job?.resultUrl ?? null;
}

interface ImageJobSpec {
  prompt: string;
  referenceImages: string[];
}

async function buildImageJobSpec(
  project: Project,
  targetType: ImageTargetType,
  targetId: string
): Promise<ImageJobSpec> {
  // Estilo visual do projeto, adaptado ao dialeto do modelo de imagem.
  const preset = getStylePreset(project.styleId);
  const family = resolveImageFamily(project.imageModel ?? "");

  if (targetType === "character") {
    const character = await prisma.character.findUniqueOrThrow({ where: { id: targetId } });
    const prompt = preset
      ? applyCharacterSheetStyle(character.visualPrompt, preset, family)
      : character.visualPrompt;
    return { prompt, referenceImages: [] };
  }
  if (targetType === "scenario") {
    const scenario = await prisma.scenario.findUniqueOrThrow({ where: { id: targetId } });
    const prompt = preset
      ? applyImageStyle(scenario.visualPrompt, preset, family)
      : scenario.visualPrompt;
    return { prompt, referenceImages: [] };
  }

  if (targetType === "broll") {
    const brolls = parseBrollsFromProject(project);
    const brollId = Number(targetId);
    const broll = brolls.find((b) => b.id === brollId);
    if (!broll) throw new Error(`B-roll #${targetId} não encontrado`);
    // image_prompt já inclui o style suffix; enviamos como está (editável pelo usuário).
    return { prompt: broll.image_prompt, referenceImages: [] };
  }

  // Keyframe de cena: composição usando imagens de personagens/cenário
  // como referência para manter consistência visual.
  const scene = await prisma.scene.findUniqueOrThrow({ where: { id: targetId } });
  const characterIds = JSON.parse(scene.characterIds) as string[];
  const characters = await prisma.character.findMany({
    where: { id: { in: characterIds }, projectId: project.id },
  });
  const scenario = scene.scenarioId
    ? await prisma.scenario.findUnique({ where: { id: scene.scenarioId } })
    : null;

  const referenceImages: string[] = [];
  const referencedCharacterNames: string[] = [];
  for (const character of characters) {
    const url = await getRemoteAssetUrl("character", character.id);
    if (url) {
      referenceImages.push(url);
      referencedCharacterNames.push(character.name);
    }
  }
  let hasScenarioReference = false;
  if (scenario) {
    const url = await getRemoteAssetUrl("scenario", scenario.id);
    if (url) {
      referenceImages.push(url);
      hasScenarioReference = true;
    }
  }

  const parts = [
    // GPT Image / Omni exigem o papel de cada referência declarado no prompt.
    family === "gpt-image" && referenceImages.length
      ? buildReferenceRolePrefix(referencedCharacterNames, hasScenarioReference)
      : "",
    `Cinematic still frame, movie keyframe. ${scene.videoPrompt}`,
    characters.length
      ? `Characters in frame: ${characters.map((c) => `${c.name} (${c.visualPrompt})`).join("; ")}.`
      : "",
    scenario ? `Setting: ${scenario.visualPrompt}.` : "",
    referenceImages.length && family !== "gpt-image"
      ? "Keep the exact same appearance of the characters and setting shown in the reference images."
      : "",
  ].filter(Boolean);

  const basePrompt = parts.join(" ");
  const prompt = preset
    ? applyImageStyle(basePrompt, preset, family, { withConsistencyLock: true })
    : basePrompt;

  return { prompt, referenceImages };
}

function parseBrollsFromProject(project: Project): Array<{
  id: number;
  image_prompt: string;
  imageUrl?: string | null;
}> {
  const raw = (project as Project & { brollsJson?: string | null }).brollsJson;
  if (!raw?.trim()) return [];
  try {
    const data = JSON.parse(raw) as { brolls?: Array<{ id: number; image_prompt: string; imageUrl?: string | null }> };
    return Array.isArray(data.brolls) ? data.brolls : [];
  } catch {
    return [];
  }
}

/**
 * Cria um GenerationJob de imagem, submete ao provedor e retorna o job.
 * Nunca bloqueia esperando o resultado (submit → jobId → poll).
 */
export async function submitImageJob(
  projectId: string,
  targetType: ImageTargetType,
  targetId: string
): Promise<GenerationJob> {
  const project = await loadProjectWithChannelAi(projectId);
  if (!project.imageProvider || !project.imageModel) {
    throw new Error("Configure o provedor e o modelo de imagem em Configurações.");
  }

  const apiKey = await resolveApiKey(projectId, project.imageProvider);
  const provider = createImageProvider(project.imageProvider, apiKey, project.imageModel);
  const spec = await buildImageJobSpec(project, targetType, targetId);

  const job = await prisma.generationJob.create({
    data: {
      projectId,
      kind: "image",
      provider: project.imageProvider,
      model: project.imageModel,
      targetType,
      targetId,
      status: "queued",
    },
  });

  try {
    const { jobId: externalId } = await provider.generateImage({
      prompt: spec.prompt,
      referenceImages: spec.referenceImages.length ? spec.referenceImages : undefined,
      aspectRatio: resolveVideoAspectRatio(project.videoAspectRatio),
    });
    return await prisma.generationJob.update({
      where: { id: job.id },
      data: { externalId, status: "running" },
    });
  } catch (err) {
    return await prisma.generationJob.update({
      where: { id: job.id },
      data: { status: "failed", error: err instanceof Error ? err.message : String(err) },
    });
  }
}

/**
 * Edita uma imagem já gerada: usa o asset atual como referência + instrução
 * em GenerationJob.prompt (espelha o fluxo de edição de vídeo).
 */
export async function submitImageEditJob(
  projectId: string,
  targetType: ImageTargetType,
  targetId: string,
  editPrompt: string
): Promise<GenerationJob> {
  const project = await loadProjectWithChannelAi(projectId);
  if (!project.imageProvider || !project.imageModel) {
    throw new Error("Configure o provedor e o modelo de imagem em Configurações.");
  }

  const localUrl = await getLocalImageUrl(projectId, targetType, targetId);
  if (!localUrl) {
    throw new Error("Este asset ainda não tem imagem gerada para editar.");
  }

  // Preferir URL remota (fal/Replicate baixam dela); OpenAI/Gemini aceitam /uploads local.
  const remoteUrl = await getRemoteAssetUrl(targetType, targetId);
  const sourceUrl = remoteUrl ?? localUrl;
  const acceptsLocalSource =
    project.imageProvider === "openai" || project.imageProvider === "gemini";
  if (!acceptsLocalSource && sourceUrl.startsWith("/")) {
    throw new Error(
      "A imagem-fonte só existe localmente. Regenerar com fal.ai/Replicate " +
        "gera uma URL remota editável, ou use OpenAI/Gemini como provedor."
    );
  }

  const apiKey = await resolveApiKey(projectId, project.imageProvider);
  const provider = createImageProvider(project.imageProvider, apiKey, project.imageModel);
  const prompt = `${editPrompt.trim()}. Keep everything else the same.`;

  const job = await prisma.generationJob.create({
    data: {
      projectId,
      kind: "image",
      provider: project.imageProvider,
      model: project.imageModel,
      targetType,
      targetId,
      prompt: editPrompt.trim(),
      status: "queued",
    },
  });

  try {
    const { jobId: externalId } = await provider.generateImage({
      prompt,
      referenceImages: [sourceUrl],
      aspectRatio: resolveVideoAspectRatio(project.videoAspectRatio),
    });
    return await prisma.generationJob.update({
      where: { id: job.id },
      data: { externalId, status: "running" },
    });
  } catch (err) {
    return await prisma.generationJob.update({
      where: { id: job.id },
      data: { status: "failed", error: err instanceof Error ? err.message : String(err) },
    });
  }
}

async function getLocalImageUrl(
  projectId: string,
  targetType: ImageTargetType,
  targetId: string
): Promise<string | null> {
  if (targetType === "character") {
    const row = await prisma.character.findFirst({
      where: { id: targetId, projectId },
      select: { imageUrl: true },
    });
    return row?.imageUrl ?? null;
  }
  if (targetType === "scenario") {
    const row = await prisma.scenario.findFirst({
      where: { id: targetId, projectId },
      select: { imageUrl: true },
    });
    return row?.imageUrl ?? null;
  }
  if (targetType === "broll") {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { brollsJson: true },
    });
    if (!project?.brollsJson) return null;
    try {
      const data = JSON.parse(project.brollsJson) as {
        brolls?: Array<{ id: number; imageUrl?: string | null }>;
      };
      const broll = data.brolls?.find((b) => b.id === Number(targetId));
      return broll?.imageUrl ?? null;
    } catch {
      return null;
    }
  }
  const row = await prisma.scene.findFirst({
    where: { id: targetId, projectId },
    select: { keyframeUrl: true },
  });
  return row?.keyframeUrl ?? null;
}

// ─────────────────────────────────────────────────────────────────
// Fila de jobs de VÍDEO com concorrência limitada por provedor
// ─────────────────────────────────────────────────────────────────

/**
 * Cria o GenerationJob de vídeo em estado "queued" (sem submeter) e
 * depois tenta liberar a fila respeitando MAX_CONCURRENT_VIDEO_JOBS.
 */
export async function enqueueVideoJob(projectId: string, sceneId: string): Promise<GenerationJob> {
  const project = await loadProjectWithChannelAi(projectId);
  if (!project.videoProvider || !project.videoModel) {
    throw new Error("Configure o provedor e o modelo de vídeo em Configurações.");
  }

  const job = await prisma.generationJob.create({
    data: {
      projectId,
      kind: "video",
      provider: project.videoProvider,
      model: project.videoModel,
      targetType: "scene_video",
      targetId: sceneId,
      status: "queued",
    },
  });

  await pumpVideoQueue(project);
  return (await prisma.generationJob.findUnique({ where: { id: job.id } })) ?? job;
}

/**
 * Enfileira edição de um clipe já gerado. O `editPrompt` vai em
 * GenerationJob.prompt; o pump usa `scene.videoUrl` como fonte.
 */
export async function enqueueVideoEditJob(
  projectId: string,
  sceneId: string,
  editPrompt: string
): Promise<GenerationJob> {
  const project = await loadProjectWithChannelAi(projectId);
  if (!project.videoProvider || !project.videoModel) {
    throw new Error("Configure o provedor e o modelo de vídeo em Configurações.");
  }

  const scene = await prisma.scene.findFirst({ where: { id: sceneId, projectId } });
  if (!scene) throw new Error("Cena não encontrada");
  if (!scene.videoUrl) {
    throw new Error("Esta cena ainda não tem vídeo gerado para editar.");
  }

  const job = await prisma.generationJob.create({
    data: {
      projectId,
      kind: "video",
      provider: project.videoProvider,
      model: project.videoModel,
      targetType: "scene_video",
      targetId: sceneId,
      prompt: editPrompt,
      status: "queued",
    },
  });

  await pumpVideoQueue(project);
  return (await prisma.generationJob.findUnique({ where: { id: job.id } })) ?? job;
}

/**
 * Submete jobs de vídeo pendentes enquanto houver slots livres no
 * provedor. Chamada ao enfileirar e a cada polling que finaliza um job.
 */
export async function pumpVideoQueue(project: Project): Promise<void> {
  const resolved = await loadProjectWithChannelAi(project.id);
  if (!resolved.videoProvider || !resolved.videoModel) return;

  const running = await prisma.generationJob.count({
    where: {
      projectId: resolved.id,
      kind: "video",
      provider: resolved.videoProvider,
      status: "running",
    },
  });

  let slots = MAX_CONCURRENT_VIDEO_JOBS - running;
  if (slots <= 0) return;

  const pending = await prisma.generationJob.findMany({
    where: {
      projectId: resolved.id,
      kind: "video",
      provider: resolved.videoProvider,
      status: "queued",
      externalId: null,
    },
    orderBy: { createdAt: "asc" },
    take: slots,
  });
  if (pending.length === 0) return;

  const apiKey = await resolveApiKey(resolved.id, resolved.videoProvider);
  const provider = createVideoProvider(resolved.videoProvider, apiKey, resolved.videoModel);

  // Estilo visual do projeto, adaptado ao dialeto do modelo de vídeo
  // (Veo abre com o estilo, Kling/generic fecham, Omni exige cena única).
  const preset = getStylePreset(resolved.styleId);
  const videoFamily = resolveVideoFamily(resolved.videoModel);

  for (const job of pending) {
    if (slots <= 0) break;
    const scene = await prisma.scene.findUnique({ where: { id: job.targetId } });
    if (!scene) {
      await prisma.generationJob.update({
        where: { id: job.id },
        data: { status: "failed", error: "Cena não encontrada" },
      });
      continue;
    }

    const isEdit = Boolean(job.prompt?.trim());

    try {
      let externalId: string;
      if (isEdit) {
        // Edição: usa o clipe atual (local ou remoto) + instrução do job.
        // Se o clipe veio do Omni, reaproveita o interaction id (edição stateful).
        const sourceVideoUrl =
          scene.videoUrl ?? (await getRemoteAssetUrl("scene_video", scene.id));
        if (!sourceVideoUrl) {
          throw new Error("Cena sem vídeo para editar");
        }
        const priorOmni = await prisma.generationJob.findFirst({
          where: {
            projectId: resolved.id,
            targetType: "scene_video",
            targetId: scene.id,
            status: "succeeded",
            externalId: { startsWith: "omni:" },
          },
          orderBy: { createdAt: "desc" },
          select: { externalId: true },
        });
        const previousInteractionId = priorOmni?.externalId?.startsWith("omni:")
          ? priorOmni.externalId.slice(5)
          : undefined;

        const aspectRatio = resolveVideoAspectRatio(resolved.videoAspectRatio);
        ({ jobId: externalId } = await provider.generateVideo({
          prompt: job.prompt!.trim(),
          // Omni usa previousInteractionId quando existe; outros provedores
          // (ex. xAI) ignoram e editam a partir de sourceVideoUrl.
          sourceVideoUrl,
          previousInteractionId,
          aspectRatio,
          withAudio: true,
        }));
      } else {
        // image-to-video com o keyframe remoto; fallback: text-to-video.
        const keyframeRemote = await getRemoteAssetUrl("scene_keyframe", scene.id);
        const prompt = preset
          ? applyVideoStyle(scene.videoPrompt, preset, videoFamily)
          : scene.videoPrompt;
        const aspectRatio = resolveVideoAspectRatio(resolved.videoAspectRatio);
        ({ jobId: externalId } = await provider.generateVideo({
          prompt,
          imageUrl: keyframeRemote ?? undefined,
          durationSeconds: scene.durationSec,
          aspectRatio,
          withAudio: true,
        }));
      }
      await prisma.generationJob.update({
        where: { id: job.id },
        data: { externalId, status: "running" },
      });
      slots -= 1;
    } catch (err) {
      await prisma.generationJob.update({
        where: { id: job.id },
        data: { status: "failed", error: err instanceof Error ? err.message : String(err) },
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// Sincronização de status (usada pelo route handler de polling)
// ─────────────────────────────────────────────────────────────────

/**
 * Consulta o provedor, atualiza o job no banco e, em caso de sucesso,
 * baixa o asset para o storage local e propaga a URL para o alvo
 * (Character.imageUrl / Scenario.imageUrl / Scene.keyframeUrl / Scene.videoUrl).
 */
export async function syncJobStatus(jobId: string): Promise<GenerationJob> {
  const job = await prisma.generationJob.findUniqueOrThrow({ where: { id: jobId } });

  // Job de vídeo ainda na fila local: tenta liberar slots e devolve o estado.
  if (job.status === "queued" && !job.externalId && job.kind === "video") {
    const project = await prisma.project.findUniqueOrThrow({ where: { id: job.projectId } });
    await pumpVideoQueue(project);
    return prisma.generationJob.findUniqueOrThrow({ where: { id: jobId } });
  }

  if (job.status === "succeeded" || job.status === "failed" || !job.externalId) {
    return job;
  }

  const apiKey = await resolveApiKey(job.projectId, job.provider);
  const status =
    job.kind === "image"
      ? await createImageProvider(job.provider, apiKey, job.model).getJobStatus(job.externalId)
      : await createVideoProvider(job.provider, apiKey, job.model).getJobStatus(job.externalId);

  if (status.status === "queued" || status.status === "running") {
    if (status.status !== job.status) {
      return prisma.generationJob.update({
        where: { id: job.id },
        data: { status: status.status },
      });
    }
    return job;
  }

  if (status.status === "failed") {
    const updated = await prisma.generationJob.update({
      where: { id: job.id },
      data: { status: "failed", error: status.error ?? "Falha no provedor" },
    });
    await afterTerminalVideoJob(updated);
    return updated;
  }

  // succeeded
  let localUrl = status.resultUrl ?? null;
  try {
    if (status.resultUrl) {
      localUrl = await storage.saveFromUrl(status.resultUrl, `${job.targetType}-${job.targetId}`);
    }
  } catch {
    // Se o download falhar, mantém a URL remota — melhor do que perder o asset.
    localUrl = status.resultUrl ?? null;
  }

  const updated = await prisma.generationJob.update({
    where: { id: job.id },
    data: { status: "succeeded", resultUrl: status.resultUrl, error: null },
  });

  if (localUrl) {
    await propagateResult(job.projectId, job.targetType, job.targetId, localUrl);
  }
  await afterTerminalVideoJob(updated);
  return updated;
}

async function propagateResult(
  projectId: string,
  targetType: string,
  targetId: string,
  url: string
): Promise<void> {
  switch (targetType) {
    case "character":
      await prisma.character.update({ where: { id: targetId }, data: { imageUrl: url } });
      break;
    case "scenario":
      await prisma.scenario.update({ where: { id: targetId }, data: { imageUrl: url } });
      break;
    case "scene_keyframe":
      await prisma.scene.update({ where: { id: targetId }, data: { keyframeUrl: url } });
      break;
    case "scene_video":
      await prisma.scene.update({ where: { id: targetId }, data: { videoUrl: url } });
      break;
    case "broll": {
      const project = await prisma.project.findUniqueOrThrow({
        where: { id: projectId },
        select: { brollsJson: true },
      });
      if (!project.brollsJson) break;
      const data = JSON.parse(project.brollsJson) as {
        brolls: Array<Record<string, unknown>>;
        [key: string]: unknown;
      };
      const brollId = Number(targetId);
      data.brolls = data.brolls.map((b) =>
        Number(b.id) === brollId ? { ...b, imageUrl: url } : b
      );
      await prisma.project.update({
        where: { id: projectId },
        data: { brollsJson: JSON.stringify(data) },
      });
      break;
    }
  }
}

/** Ao finalizar um job de vídeo, libera o próximo da fila do provedor. */
async function afterTerminalVideoJob(job: GenerationJob): Promise<void> {
  if (job.kind !== "video") return;
  const project = await prisma.project.findUnique({ where: { id: job.projectId } });
  if (project) await pumpVideoQueue(project);
}
