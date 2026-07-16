"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import {
  CreateProjectSchema,
  ProjectIdSchema,
  RenameProjectSchema,
  SaveProjectStyleSchema,
  SaveVideoAspectRatioSchema,
} from "@/lib/schemas/actions";
import { resolveStylePreset } from "@/lib/resolve-style-preset";
import { fillMasterPrompt } from "@/lib/narrative/fill-master-prompt";
import { toNarrativeConfig } from "@/lib/narrative/channel-config";
import type { ChannelTypeId } from "@/lib/narrative/channel-types";
import { DEFAULT_AI_PROVIDERS } from "@/lib/ai-settings";

export async function createProject(input: {
  name: string;
  channelId: string;
  videoKind: "motion" | "static";
  targetDurationMin?: number;
  videoTopic?: string;
}): Promise<never | ActionResult> {
  const parsed = CreateProjectSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos");

  const { channelId, name, videoKind, videoTopic } = parsed.data;

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
  });
  if (!channel) return fail("Canal não encontrado");

  const targetDurationMin = parsed.data.targetDurationMin ?? channel.targetDurationMin;
  const videoAspectRatio = channel.videoAspectRatio as "16:9" | "9:16";

  // Static: tópico do cadastro → master prompt preenchido e persistido.
  const trimmedTopic = videoKind === "static" ? videoTopic.trim() : "";
  const narrativePrompt =
    videoKind === "static" && trimmedTopic
      ? fillMasterPrompt(toNarrativeConfig(channel, targetDurationMin), trimmedTopic, {
          channelType: channel.channelType as ChannelTypeId,
          masterPromptTemplate: channel.masterPromptTemplate,
        })
      : null;

  const project = await prisma.project.create({
    data: {
      name,
      channel: { connect: { id: channelId } },
      targetDurationMin,
      videoAspectRatio,
      videoKind,
      videoTopic: trimmedTopic || null,
      narrativePrompt,
      // Snapshot dos defaults globais; em runtime vale o localStorage do usuário.
      imageProvider: DEFAULT_AI_PROVIDERS.imageProvider,
      imageModel: DEFAULT_AI_PROVIDERS.imageModel,
      videoProvider: DEFAULT_AI_PROVIDERS.videoProvider,
      videoModel: DEFAULT_AI_PROVIDERS.videoModel,
      llmProvider: DEFAULT_AI_PROVIDERS.llmProvider,
      llmModel: DEFAULT_AI_PROVIDERS.llmModel,
    },
  });
  revalidatePath("/");
  revalidatePath(`/channels/${channelId}`);
  redirect(
    videoKind === "static"
      ? `/projects/${project.id}/static`
      : `/projects/${project.id}/script`
  );
}

export async function renameProject(input: {
  projectId: string;
  name: string;
}): Promise<ActionResult> {
  const parsed = RenameProjectSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos");

  try {
    await prisma.project.update({
      where: { id: parsed.data.projectId },
      data: { name: parsed.data.name },
    });
    revalidatePath(`/projects/${parsed.data.projectId}`, "layout");
    revalidatePath("/");
    return ok(undefined);
  } catch (err) {
    return fail(err);
  }
}

export async function deleteProject(input: { projectId: string }): Promise<ActionResult> {
  const parsed = ProjectIdSchema.safeParse(input);
  if (!parsed.success) return fail("Projeto inválido");

  try {
    const existing = await prisma.project.findUnique({
      where: { id: parsed.data.projectId },
      select: { channelId: true },
    });
    await prisma.project.delete({ where: { id: parsed.data.projectId } });
    revalidatePath("/");
    if (existing?.channelId) revalidatePath(`/channels/${existing.channelId}`);
    return ok(undefined);
  } catch (err) {
    return fail(err);
  }
}

export async function saveProjectStyle(input: {
  projectId: string;
  styleId: string | null;
}): Promise<ActionResult> {
  const parsed = SaveProjectStyleSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos");

  const { projectId, styleId } = parsed.data;
  if (styleId && !(await resolveStylePreset(styleId))) {
    return fail(`Estilo desconhecido: "${styleId}"`);
  }

  try {
    await prisma.project.update({ where: { id: projectId }, data: { styleId } });
    revalidatePath(`/projects/${projectId}`, "layout");
    return ok(undefined);
  } catch (err) {
    return fail(err);
  }
}

export async function saveVideoAspectRatio(input: {
  projectId: string;
  videoAspectRatio: "16:9" | "9:16";
}): Promise<ActionResult> {
  const parsed = SaveVideoAspectRatioSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos");

  const { projectId, videoAspectRatio } = parsed.data;
  try {
    await prisma.project.update({
      where: { id: projectId },
      data: { videoAspectRatio },
    });
    revalidatePath(`/projects/${projectId}`, "layout");
    revalidatePath(`/projects/${projectId}/settings`);
    return ok(undefined);
  } catch (err) {
    return fail(err);
  }
}
