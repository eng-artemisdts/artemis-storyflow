"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import {
  ChannelIdSchema,
  CreateChannelSchema,
  PreviewChannelMasterPromptSchema,
  SuggestChannelFieldSchema,
  UpdateChannelSchema,
} from "@/lib/schemas/actions";
import { deriveScriptLengthFromDuration } from "@/lib/narrative/script-length";
import { LANGUAGE_PRESETS } from "@/lib/narrative/channel-config";
import { generateChannelMasterPromptTemplate } from "@/lib/narrative/generate-channel-master-prompt";
import type { ChannelTypeId } from "@/lib/narrative/channel-types";
import type { NarrationTypeId } from "@/lib/narrative/narration-types";
import { resolveLlmFromClient, runWithAiContext } from "@/lib/credentials";
import type { AiClientContext } from "@/lib/ai-settings";
import type { LlmProviderId } from "@/lib/providers/types";

function createSuggestionModel(providerId: string, apiKey: string, model: string) {
  switch (providerId as LlmProviderId) {
    case "gemini":
      return createGoogleGenerativeAI({ apiKey })(model);
    case "openai":
      return createOpenAI({ apiKey })(model);
    case "anthropic":
      return createAnthropic({ apiKey })(model);
    default:
      throw new Error(`Provider de LLM desconhecido: "${providerId}"`);
  }
}

type ChannelFormPayload = {
  name: string;
  niche: string;
  description: string;
  videoAspectRatio: "16:9" | "9:16";
  targetDurationMin: number;
  outputLanguage: string;
  channelType: ChannelTypeId;
  channelTypeDescription?: string;
  hasReferenceCharacter: boolean;
  referenceCharacterName?: string;
  referenceCharacterDescription?: string;
  narrationType: NarrationTypeId;
  addressForm: string;
  forbiddenForms: string;
  suspensePhrase?: string;
  concreteUnits?: string;
  brandSignoff?: string;
};

async function generateMasterPromptForChannel(
  data: ChannelFormPayload,
  ai?: AiClientContext
): Promise<string | null> {
  if (!ai) return null;

  return runWithAiContext(ai, async () => {
    const llm = resolveLlmFromClient(ai);
    const length = deriveScriptLengthFromDuration(data.targetDurationMin);
    return generateChannelMasterPromptTemplate({
      channelType: data.channelType,
      channelTypeDescription: data.channelTypeDescription,
      name: data.name,
      niche: data.niche,
      description: data.description,
      outputLanguage: data.outputLanguage,
      narrationType: data.narrationType,
      targetDurationMin: data.targetDurationMin,
      wordTarget: length.wordTarget,
      scenesMin: length.scenesMin,
      scenesMax: length.scenesMax,
      hasReferenceCharacter: data.hasReferenceCharacter,
      referenceCharacterName: data.referenceCharacterName,
      referenceCharacterDescription: data.referenceCharacterDescription,
      providerId: llm.providerId,
      apiKey: llm.apiKey,
      model: llm.model,
    });
  });
}

export async function previewChannelMasterPrompt(input: ChannelFormPayload & {
  ai?: AiClientContext;
}): Promise<ActionResult<{ masterPromptTemplate: string }>> {
  const parsed = PreviewChannelMasterPromptSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos");

  try {
    const template = await generateMasterPromptForChannel(parsed.data, parsed.data.ai);
    if (!template) {
      return fail("Configure o provedor de LLM em Configurações para gerar o master prompt.");
    }
    return ok({ masterPromptTemplate: template });
  } catch (err) {
    return fail(err);
  }
}

export async function createChannel(input: ChannelFormPayload & {
  ai?: AiClientContext;
}): Promise<never | ActionResult> {
  const parsed = CreateChannelSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos");

  const data = parsed.data;
  const length = deriveScriptLengthFromDuration(data.targetDurationMin);

  let masterPromptTemplate: string | null = null;
  try {
    masterPromptTemplate = await generateMasterPromptForChannel(data, input.ai);
  } catch {
    // salva canal mesmo se IA falhar — usa template base do channelType em runtime
  }

  const channel = await prisma.channel.create({
    data: {
      name: data.name,
      niche: data.niche,
      description: data.description,
      videoAspectRatio: data.videoAspectRatio,
      targetDurationMin: data.targetDurationMin,
      outputLanguage: data.outputLanguage,
      channelType: data.channelType,
      channelTypeDescription: data.channelTypeDescription ?? "",
      masterPromptTemplate,
      hasReferenceCharacter: data.hasReferenceCharacter,
      referenceCharacterName: data.hasReferenceCharacter
        ? (data.referenceCharacterName?.trim() ?? "")
        : "",
      referenceCharacterDescription: data.hasReferenceCharacter
        ? (data.referenceCharacterDescription?.trim() ?? "")
        : "",
      narrationType: data.narrationType,
      addressForm: data.addressForm,
      forbiddenForms: data.forbiddenForms,
      ...length,
      suspensePhrase: data.suspensePhrase ?? "",
      concreteUnits: data.concreteUnits ?? "",
      brandSignoff: data.brandSignoff?.trim() || "none",
    },
  });

  revalidatePath("/");
  redirect(`/channels/${channel.id}`);
}

export async function updateChannel(input: ChannelFormPayload & {
  channelId: string;
  ai?: AiClientContext;
}): Promise<ActionResult> {
  const parsed = UpdateChannelSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos");

  const { channelId, ...data } = parsed.data;
  const length = deriveScriptLengthFromDuration(data.targetDurationMin);

  let masterPromptTemplate: string | null | undefined = undefined;
  try {
    masterPromptTemplate = await generateMasterPromptForChannel(data, input.ai);
  } catch {
    masterPromptTemplate = undefined;
  }

  try {
    await prisma.channel.update({
      where: { id: channelId },
      data: {
        name: data.name,
        niche: data.niche,
        description: data.description,
        videoAspectRatio: data.videoAspectRatio,
        targetDurationMin: data.targetDurationMin,
        outputLanguage: data.outputLanguage,
        channelType: data.channelType,
        channelTypeDescription: data.channelTypeDescription ?? "",
        ...(masterPromptTemplate != null ? { masterPromptTemplate } : {}),
        hasReferenceCharacter: data.hasReferenceCharacter,
        referenceCharacterName: data.hasReferenceCharacter
          ? (data.referenceCharacterName?.trim() ?? "")
          : "",
        referenceCharacterDescription: data.hasReferenceCharacter
          ? (data.referenceCharacterDescription?.trim() ?? "")
          : "",
        narrationType: data.narrationType,
        addressForm: data.addressForm,
        forbiddenForms: data.forbiddenForms,
        ...length,
        suspensePhrase: data.suspensePhrase ?? "",
        concreteUnits: data.concreteUnits ?? "",
        brandSignoff: data.brandSignoff?.trim() || "none",
      },
    });
    revalidatePath(`/channels/${channelId}`);
    revalidatePath("/");
    return ok(undefined);
  } catch (err) {
    return fail(err);
  }
}

export async function deleteChannel(input: { channelId: string }): Promise<ActionResult> {
  const parsed = ChannelIdSchema.safeParse(input);
  if (!parsed.success) return fail("Canal inválido");

  try {
    await prisma.channel.delete({ where: { id: parsed.data.channelId } });
    revalidatePath("/");
    return ok(undefined);
  } catch (err) {
    return fail(err);
  }
}

const SuggestedSingleFieldSchema = z.object({
  value: z.string(),
});

/**
 * Gera nicho ou descrição com base no que já foi preenchido no formulário.
 */
export async function suggestChannelField(input: {
  field: "niche" | "description";
  name?: string;
  niche?: string;
  description?: string;
  outputLanguage?: string;
  channelType?: ChannelTypeId;
  ai?: AiClientContext;
}): Promise<ActionResult<{ value: string }>> {
  const parsed = SuggestChannelFieldSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos");

  const { field, name, niche, description, ai } = parsed.data;
  const language =
    LANGUAGE_PRESETS.find((p) => p.outputLanguage === parsed.data.outputLanguage) ??
    LANGUAGE_PRESETS[0]!;

  if (field === "niche" && !name.trim() && !description.trim()) {
    return fail("Preencha pelo menos o nome (ou a descrição) antes de gerar o nicho.");
  }
  if (field === "description" && !name.trim() && !niche.trim()) {
    return fail("Preencha pelo menos o nome ou o nicho antes de gerar a descrição.");
  }

  try {
    return await runWithAiContext(ai, async () => {
      const llm = resolveLlmFromClient(ai);
      const languageModel = createSuggestionModel(llm.providerId, llm.apiKey, llm.model);

      const contextLines = [
        name.trim() && `Channel name: ${name.trim()}`,
        niche.trim() && `Niche: ${niche.trim()}`,
        description.trim() && `Description: ${description.trim()}`,
        input.channelType && `Channel format: ${input.channelType}`,
      ].filter(Boolean);

      const nichePrompt = `You help configure a faceless YouTube channel.
Write ONE concise niche line in ${language.outputLanguage} (max ~12 words).
It should name the thematic territory (topics the videos cover), not marketing fluff.

Known context:
${contextLines.join("\n") || "(minimal)"}

Return { "value": "..." } with only the niche line.`;

      const descriptionPrompt = `You help configure a faceless YouTube channel.
Write a short channel description in ${language.outputLanguage} (2–3 sentences).
Cover: tone, audience promise, and what kinds of videos it publishes.

Known context:
${contextLines.join("\n") || "(minimal)"}

Return { "value": "..." } with only the description.`;

      const { object } = await generateObject({
        model: languageModel,
        schema: SuggestedSingleFieldSchema,
        prompt: field === "niche" ? nichePrompt : descriptionPrompt,
      });

      const value = object.value.trim();
      if (!value) return fail("A IA retornou um texto vazio. Tente de novo.");
      return ok({ value });
    });
  } catch (err) {
    return fail(err);
  }
}
