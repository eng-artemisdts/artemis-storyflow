"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { submitImageEditJob, submitImageJob, type ImageTargetType } from "@/lib/jobs";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { runWithAiContext } from "@/lib/credentials";
import type { AiClientContext } from "@/lib/ai-settings";
import {
  CreateCharacterSchema,
  CreateScenarioSchema,
  CreateSceneSchema,
  DeleteEntitySchema,
  EditAssetImageSchema,
  GenerateAssetImageSchema,
  ProjectIdSchema,
  UpdateSceneSchema,
  UpdateVisualPromptSchema,
} from "@/lib/schemas/actions";
import {
  appendCharacterNode,
  appendScenarioNode,
  appendSceneNode,
  entityNodeId,
  removeNodeFromGraph,
  type SerializedEdge,
  type SerializedNode,
} from "@/lib/whiteboard-layout";
import { patchWhiteboard } from "@/lib/whiteboard-sync";

export type CreatedGraphPayload = {
  node: SerializedNode;
  edges: SerializedEdge[];
};

export async function updateVisualPrompt(input: {
  targetType: "character" | "scenario";
  targetId: string;
  visualPrompt: string;
}): Promise<ActionResult> {
  const parsed = UpdateVisualPromptSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos");

  const { targetType, targetId, visualPrompt } = parsed.data;
  try {
    if (targetType === "character") {
      await prisma.character.update({ where: { id: targetId }, data: { visualPrompt } });
    } else {
      await prisma.scenario.update({ where: { id: targetId }, data: { visualPrompt } });
    }
    return ok(undefined);
  } catch (err) {
    return fail(err);
  }
}

export async function updateScene(input: {
  sceneId: string;
  videoPrompt?: string;
  title?: string;
  summary?: string;
  durationSec?: number;
}): Promise<ActionResult> {
  const parsed = UpdateSceneSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos");

  const { sceneId, ...data } = parsed.data;
  try {
    await prisma.scene.update({ where: { id: sceneId }, data });
    return ok(undefined);
  } catch (err) {
    return fail(err);
  }
}

function revalidateEntityPaths(projectId: string) {
  revalidatePath(`/projects/${projectId}/assets`);
  revalidatePath(`/projects/${projectId}/whiteboard`);
  revalidatePath(`/projects/${projectId}/generation`);
  revalidatePath(`/projects/${projectId}/static/scenes`);
  revalidatePath(`/projects/${projectId}`, "layout");
}

/** Cria personagem manualmente e anexa ao whiteboard. */
export async function createCharacter(input: {
  projectId: string;
  name: string;
  description: string;
  visualPrompt?: string;
}): Promise<ActionResult<CreatedGraphPayload & { id: string }>> {
  const parsed = CreateCharacterSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos");

  const { projectId, name, description } = parsed.data;
  const visualPrompt = parsed.data.visualPrompt?.trim() || description;

  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return fail("Projeto não encontrado");

    const character = await prisma.character.create({
      data: { projectId, name, description, visualPrompt },
    });

    let appendedNode: SerializedNode | null = null;
    await patchWhiteboard(projectId, (graph) => {
      const result = appendCharacterNode(graph, character);
      appendedNode = result.node;
      return { nodes: result.nodes, edges: result.edges };
    });

    revalidateEntityPaths(projectId);
    return ok({
      id: character.id,
      node: appendedNode!,
      edges: [],
    });
  } catch (err) {
    return fail(err);
  }
}

/** Cria cenário manualmente e anexa ao whiteboard. */
export async function createScenario(input: {
  projectId: string;
  name: string;
  description: string;
  visualPrompt?: string;
}): Promise<ActionResult<CreatedGraphPayload & { id: string }>> {
  const parsed = CreateScenarioSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos");

  const { projectId, name, description } = parsed.data;
  const visualPrompt = parsed.data.visualPrompt?.trim() || description;

  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return fail("Projeto não encontrado");

    const scenario = await prisma.scenario.create({
      data: { projectId, name, description, visualPrompt },
    });

    let appendedNode: SerializedNode | null = null;
    await patchWhiteboard(projectId, (graph) => {
      const result = appendScenarioNode(graph, scenario);
      appendedNode = result.node;
      return { nodes: result.nodes, edges: result.edges };
    });

    revalidateEntityPaths(projectId);
    return ok({
      id: scenario.id,
      node: appendedNode!,
      edges: [],
    });
  } catch (err) {
    return fail(err);
  }
}

/** Cria cena manualmente e anexa ao whiteboard (com edges opcionais). */
export async function createScene(input: {
  projectId: string;
  title: string;
  summary: string;
  videoPrompt: string;
  durationSec?: number;
  dialogue?: string | null;
  scenarioId?: string | null;
  characterIds?: string[];
}): Promise<ActionResult<CreatedGraphPayload & { id: string }>> {
  const parsed = CreateSceneSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos");

  const {
    projectId,
    title,
    summary,
    videoPrompt,
    durationSec,
    dialogue,
    scenarioId,
    characterIds = [],
  } = parsed.data;

  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return fail("Projeto não encontrado");

    if (scenarioId) {
      const scenario = await prisma.scenario.findFirst({
        where: { id: scenarioId, projectId },
      });
      if (!scenario) return fail("Cenário inválido para este projeto");
    }
    if (characterIds.length) {
      const count = await prisma.character.count({
        where: { projectId, id: { in: characterIds } },
      });
      if (count !== characterIds.length) {
        return fail("Um ou mais personagens são inválidos para este projeto");
      }
    }

    const maxOrder = await prisma.scene.aggregate({
      where: { projectId },
      _max: { order: true },
    });
    const order = (maxOrder._max.order ?? 0) + 1;

    const scene = await prisma.scene.create({
      data: {
        projectId,
        order,
        title,
        summary,
        videoPrompt,
        durationSec: durationSec ?? 8,
        dialogue: dialogue ?? null,
        scenarioId: scenarioId ?? null,
        characterIds: JSON.stringify(characterIds),
      },
    });

    let appendedNode: SerializedNode | null = null;
    let newEdges: SerializedEdge[] = [];
    await patchWhiteboard(projectId, (graph) => {
      const result = appendSceneNode(graph, {
        ...scene,
        characterIds,
      });
      appendedNode = result.node;
      newEdges = result.newEdges;
      return { nodes: result.nodes, edges: result.edges };
    });

    revalidateEntityPaths(projectId);
    return ok({
      id: scene.id,
      node: appendedNode!,
      edges: newEdges,
    });
  } catch (err) {
    return fail(err);
  }
}

/**
 * Exclui personagem/cenário/cena, limpa referências em cenas,
 * remove jobs órfãos e o nó correspondente no whiteboard.
 */
export async function deleteEntity(input: {
  projectId: string;
  targetType: "character" | "scenario" | "scene";
  targetId: string;
}): Promise<ActionResult<{ nodeId: string }>> {
  const parsed = DeleteEntitySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos");

  const { projectId, targetType, targetId } = parsed.data;
  const nodeId = entityNodeId(targetType, targetId);

  try {
    if (targetType === "character") {
      const existing = await prisma.character.findFirst({
        where: { id: targetId, projectId },
      });
      if (!existing) return fail("Personagem não encontrado");

      const scenes = await prisma.scene.findMany({ where: { projectId } });
      for (const scene of scenes) {
        const ids = JSON.parse(scene.characterIds) as string[];
        if (!ids.includes(targetId)) continue;
        await prisma.scene.update({
          where: { id: scene.id },
          data: { characterIds: JSON.stringify(ids.filter((id) => id !== targetId)) },
        });
      }
      await prisma.generationJob.deleteMany({
        where: { projectId, targetType: "character", targetId },
      });
      await prisma.character.delete({ where: { id: targetId } });
    } else if (targetType === "scenario") {
      const existing = await prisma.scenario.findFirst({
        where: { id: targetId, projectId },
      });
      if (!existing) return fail("Cenário não encontrado");

      await prisma.scene.updateMany({
        where: { projectId, scenarioId: targetId },
        data: { scenarioId: null },
      });
      await prisma.generationJob.deleteMany({
        where: { projectId, targetType: "scenario", targetId },
      });
      await prisma.scenario.delete({ where: { id: targetId } });
    } else {
      const existing = await prisma.scene.findFirst({
        where: { id: targetId, projectId },
      });
      if (!existing) return fail("Cena não encontrada");

      await prisma.generationJob.deleteMany({
        where: {
          projectId,
          targetId,
          targetType: { in: ["scene_keyframe", "scene_video"] },
        },
      });
      await prisma.scene.delete({ where: { id: targetId } });
    }

    await patchWhiteboard(projectId, (graph) => removeNodeFromGraph(graph, nodeId));
    revalidateEntityPaths(projectId);
    return ok({ nodeId });
  } catch (err) {
    return fail(err);
  }
}

/** Dispara (ou re-dispara) a geração de imagem de um alvo. */
export async function generateAssetImage(input: {
  projectId: string;
  targetType: ImageTargetType;
  targetId: string;
  ai?: AiClientContext;
}): Promise<ActionResult<{ jobId: string }>> {
  const parsed = GenerateAssetImageSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos");

  try {
    return await runWithAiContext(parsed.data.ai, async () => {
      const job = await submitImageJob(
        parsed.data.projectId,
        parsed.data.targetType,
        parsed.data.targetId
      );
      if (job.status === "failed") return fail(job.error ?? "Falha ao submeter job");
      revalidateEntityPaths(parsed.data.projectId);
      return ok({ jobId: job.id });
    });
  } catch (err) {
    return fail(err);
  }
}

/** Edita imagem gerada com instrução em linguagem natural (img2img / edits). */
export async function editAssetImage(input: {
  projectId: string;
  targetType: ImageTargetType;
  targetId: string;
  editPrompt: string;
  ai?: AiClientContext;
}): Promise<ActionResult<{ jobId: string }>> {
  const parsed = EditAssetImageSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos");

  const { projectId, targetType, targetId, editPrompt, ai } = parsed.data;
  try {
    return await runWithAiContext(ai, async () => {
      const job = await submitImageEditJob(projectId, targetType, targetId, editPrompt);
      if (job.status === "failed") return fail(job.error ?? "Falha ao iniciar a edição");
      revalidateEntityPaths(projectId);
      return ok({ jobId: job.id });
    });
  } catch (err) {
    return fail(err);
  }
}

/**
 * Dispara jobs de imagem para todos os personagens e cenários ainda sem
 * imagem. Keyframes de cena devem ser gerados depois, quando as
 * referências existirem.
 */
export async function generateAllAssetImages(input: {
  projectId: string;
  ai?: AiClientContext;
}): Promise<ActionResult<{ jobIds: string[] }>> {
  const parsed = ProjectIdSchema.safeParse(input);
  if (!parsed.success) return fail("Projeto inválido");
  const { projectId } = parsed.data;

  try {
    return await runWithAiContext(input.ai, async () => {
      const [characters, scenarios] = await Promise.all([
        prisma.character.findMany({ where: { projectId, imageUrl: null } }),
        prisma.scenario.findMany({ where: { projectId, imageUrl: null } }),
      ]);

      const jobIds: string[] = [];
      for (const character of characters) {
        const job = await submitImageJob(projectId, "character", character.id);
        if (job.status !== "failed") jobIds.push(job.id);
      }
      for (const scenario of scenarios) {
        const job = await submitImageJob(projectId, "scenario", scenario.id);
        if (job.status !== "failed") jobIds.push(job.id);
      }

      if (jobIds.length === 0 && characters.length + scenarios.length > 0) {
        return fail("Nenhum job pôde ser submetido — verifique a chave de API e o provedor.");
      }
      revalidatePath(`/projects/${projectId}/assets`);
      return ok({ jobIds });
    });
  } catch (err) {
    return fail(err);
  }
}

/** Gera keyframes para todas as cenas que ainda não têm. */
export async function generateAllKeyframes(input: {
  projectId: string;
  ai?: AiClientContext;
}): Promise<ActionResult<{ jobIds: string[] }>> {
  const parsed = ProjectIdSchema.safeParse(input);
  if (!parsed.success) return fail("Projeto inválido");
  const { projectId } = parsed.data;

  try {
    return await runWithAiContext(input.ai, async () => {
      const scenes = await prisma.scene.findMany({
        where: { projectId, keyframeUrl: null },
        orderBy: { order: "asc" },
      });
      const jobIds: string[] = [];
      for (const scene of scenes) {
        const job = await submitImageJob(projectId, "scene_keyframe", scene.id);
        if (job.status !== "failed") jobIds.push(job.id);
      }
      revalidatePath(`/projects/${projectId}/assets`);
      return ok({ jobIds });
    });
  } catch (err) {
    return fail(err);
  }
}
