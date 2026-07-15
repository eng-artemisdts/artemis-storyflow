"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { enqueueVideoEditJob, enqueueVideoJob } from "@/lib/jobs";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { runWithAiContext } from "@/lib/credentials";
import type { AiClientContext } from "@/lib/ai-settings";
import {
  EditSceneVideoSchema,
  GenerateVideosSchema,
  ProjectIdSchema,
} from "@/lib/schemas/actions";

export async function generateVideosForScenes(input: {
  projectId: string;
  sceneIds: string[];
  ai?: AiClientContext;
}): Promise<ActionResult<{ jobIds: string[] }>> {
  const parsed = GenerateVideosSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos");

  const { projectId, sceneIds, ai } = parsed.data;
  try {
    return await runWithAiContext(ai, async () => {
      const scenes = await prisma.scene.findMany({
        where: { id: { in: sceneIds }, projectId },
      });
      if (scenes.length === 0) return fail("Nenhuma cena válida selecionada");

      const jobIds: string[] = [];
      const errors: string[] = [];
      for (const scene of scenes) {
        const job = await enqueueVideoJob(projectId, scene.id);
        if (job.status === "failed") {
          errors.push(`${scene.title}: ${job.error ?? "falha"}`);
        } else {
          jobIds.push(job.id);
        }
      }
      if (jobIds.length === 0) {
        return fail(errors[0] ?? "Nenhum job pôde ser criado");
      }
      return ok({ jobIds });
    });
  } catch (err) {
    return fail(err);
  }
}

export async function editSceneVideo(input: {
  projectId: string;
  sceneId: string;
  editPrompt: string;
  ai?: AiClientContext;
}): Promise<ActionResult<{ jobId: string }>> {
  const parsed = EditSceneVideoSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos");

  const { projectId, sceneId, editPrompt, ai } = parsed.data;
  try {
    return await runWithAiContext(ai, async () => {
      const job = await enqueueVideoEditJob(projectId, sceneId, editPrompt);
      if (job.status === "failed") {
        return fail(job.error ?? "Falha ao iniciar a edição");
      }
      revalidatePath(`/projects/${projectId}/generation`);
      revalidatePath(`/projects/${projectId}/whiteboard`);
      return ok({ jobId: job.id });
    });
  } catch (err) {
    return fail(err);
  }
}

export async function getActiveJobs(input: {
  projectId: string;
}): Promise<ActionResult<{ jobIds: string[] }>> {
  const parsed = ProjectIdSchema.safeParse(input);
  if (!parsed.success) return fail("Projeto inválido");

  try {
    const jobs = await prisma.generationJob.findMany({
      where: { projectId: parsed.data.projectId, status: { in: ["queued", "running"] } },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    return ok({ jobIds: jobs.map((j) => j.id) });
  } catch (err) {
    return fail(err);
  }
}
