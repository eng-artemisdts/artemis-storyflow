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
  SuggestChannelFieldSchema,
  UpdateChannelSchema,
} from "@/lib/schemas/actions";
import { deriveScriptLengthFromDuration } from "@/lib/narrative/script-length";
import { LANGUAGE_PRESETS } from "@/lib/narrative/channel-config";
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

export async function createChannel(input: {
  name: string;
  niche: string;
  description: string;
  videoAspectRatio: "16:9" | "9:16";
  targetDurationMin: number;
  outputLanguage: string;
  addressForm: string;
  forbiddenForms: string;
  suspensePhrase?: string;
  concreteUnits?: string;
  brandSignoff?: string;
}): Promise<never | ActionResult> {
  const parsed = CreateChannelSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos");

  const {
    name,
    niche,
    description,
    videoAspectRatio,
    targetDurationMin,
    outputLanguage,
    addressForm,
    forbiddenForms,
    suspensePhrase,
    concreteUnits,
    brandSignoff,
  } = parsed.data;

  const length = deriveScriptLengthFromDuration(targetDurationMin);

  const channel = await prisma.channel.create({
    data: {
      name,
      niche,
      description,
      videoAspectRatio,
      targetDurationMin,
      outputLanguage,
      addressForm,
      forbiddenForms,
      ...length,
      suspensePhrase: suspensePhrase ?? "",
      concreteUnits: concreteUnits ?? "",
      brandSignoff: brandSignoff?.trim() || "none",
    },
  });

  revalidatePath("/");
  redirect(`/channels/${channel.id}`);
}

export async function updateChannel(input: {
  channelId: string;
  name: string;
  niche: string;
  description: string;
  videoAspectRatio: "16:9" | "9:16";
  targetDurationMin: number;
  outputLanguage: string;
  addressForm: string;
  forbiddenForms: string;
  suspensePhrase?: string;
  concreteUnits?: string;
  brandSignoff?: string;
}): Promise<ActionResult> {
  const parsed = UpdateChannelSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos");

  const {
    channelId,
    name,
    niche,
    description,
    videoAspectRatio,
    targetDurationMin,
    outputLanguage,
    addressForm,
    forbiddenForms,
    suspensePhrase,
    concreteUnits,
    brandSignoff,
  } = parsed.data;

  const length = deriveScriptLengthFromDuration(targetDurationMin);

  try {
    await prisma.channel.update({
      where: { id: channelId },
      data: {
        name,
        niche,
        description,
        videoAspectRatio,
        targetDurationMin,
        outputLanguage,
        addressForm,
        forbiddenForms,
        ...length,
        suspensePhrase: suspensePhrase ?? "",
        concreteUnits: concreteUnits ?? "",
        brandSignoff: brandSignoff?.trim() || "none",
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
 * Usa LLM das Configurações globais (localStorage) ou .env.
 */
export async function suggestChannelField(input: {
  field: "niche" | "description";
  name?: string;
  niche?: string;
  description?: string;
  outputLanguage?: string;
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
      ].filter(Boolean);

      const nichePrompt = `You help configure a faceless narrative YouTube channel.
Write ONE concise niche line in ${language.outputLanguage} (max ~12 words).
It should name the thematic territory (topics the monologues cover), not marketing fluff.

Known context:
${contextLines.join("\n") || "(minimal)"}

Return { "value": "..." } with only the niche line.`;

      const descriptionPrompt = `You help configure a faceless narrative YouTube channel.
Write a short channel description in ${language.outputLanguage} (2–3 sentences).
Cover: tone, audience promise, and what kinds of second-person stories it tells.

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
