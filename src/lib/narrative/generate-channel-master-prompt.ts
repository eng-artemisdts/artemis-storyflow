import "server-only";
import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { ChannelTypeId } from "@/lib/narrative/channel-types";
import {
  REQUIRED_MASTER_PROMPT_PLACEHOLDERS,
  resolveChannelType,
  validateMasterPromptTemplate,
} from "@/lib/narrative/channel-types";
import {
  clearMasterPromptTemplateCache,
  loadMasterPromptTemplateForType,
} from "@/lib/narrative/load-master-prompt-template";
import type { NarrationTypeId } from "@/lib/narrative/narration-types";
import { narrationTypeLabel } from "@/lib/narrative/narration-types";
import type { LlmProviderId } from "@/lib/providers/types";

function createLanguageModel(providerId: string, apiKey: string, model: string) {
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

export interface GenerateChannelMasterPromptInput {
  channelType: ChannelTypeId;
  channelTypeDescription?: string;
  name: string;
  niche: string;
  description: string;
  outputLanguage: string;
  narrationType: NarrationTypeId;
  targetDurationMin: number;
  wordTarget: number;
  scenesMin: number;
  scenesMax: number;
  hasReferenceCharacter: boolean;
  referenceCharacterName?: string;
  referenceCharacterDescription?: string;
  providerId: string;
  apiKey: string;
  model: string;
}

const PLACEHOLDER_LIST = REQUIRED_MASTER_PROMPT_PLACEHOLDERS.join(", ");

/**
 * Gera um master prompt template personalizado para o canal via IA.
 * Fallback: template base do tipo se IA falhar ou resposta inválida.
 */
export async function generateChannelMasterPromptTemplate(
  input: GenerateChannelMasterPromptInput
): Promise<string> {
  clearMasterPromptTemplateCache();
  const typePreset = resolveChannelType(input.channelType);
  const baseTemplate = loadMasterPromptTemplateForType(input.channelType);

  const customNotes =
    input.channelType === "custom" && input.channelTypeDescription?.trim()
      ? `\nUser-defined format description (PRIORITY — shape the entire template around this):\n${input.channelTypeDescription.trim()}`
      : input.channelTypeDescription?.trim()
        ? `\nAdditional format notes from the user:\n${input.channelTypeDescription.trim()}`
        : "";

  const prompt = `You are an expert prompt engineer for faceless YouTube script generation.

Adapt the BASE MASTER PROMPT below for this specific channel. Keep it production-ready and optimized for the channel format.

CHANNEL INFO:
- Name: ${input.name}
- Niche: ${input.niche}
- Description: ${input.description}
- Format type: ${typePreset.label} (${typePreset.id})
- Format brief: ${typePreset.aiBrief}
- Output language: ${input.outputLanguage}
- Narration POV: ${narrationTypeLabel(input.narrationType)}
- Target duration: ${input.targetDurationMin} min (~${input.wordTarget} words total)
- Reference character: ${
    input.hasReferenceCharacter && input.referenceCharacterName?.trim()
      ? `yes — "${input.referenceCharacterName.trim()}"${input.referenceCharacterDescription?.trim() ? ` (${input.referenceCharacterDescription.trim()})` : ""}. A storyboard image of this character will be attached in the production flow; keep and expand the {{REFERENCE_CHARACTER_SECTION}} placeholder with clear instructions about visual consistency with the attached storyboard.`
      : "no — keep {{REFERENCE_CHARACTER_SECTION}} as the default no-character guidance."
  }
${customNotes}

CRITICAL RULES:
1. Output ONLY the adapted master prompt markdown — no explanation before or after.
2. You MUST preserve EVERY placeholder token exactly as written (double curly braces): ${PLACEHOLDER_LIST}
3. Also preserve {{BRAND_SIGNOFF | "none"}} exactly.
4. Keep CHANNEL CONFIG block, system rules, structure, checklist, {{TOPIC_STRUCTURE_RULES}}, {{MINIMAX_VOICEOVER_RULES}}, {{OUTPUT_DISCIPLINE_RULES}} placeholders, and .md output format sections.
5. Customize voice, structure hints, hook formulas, and checklist items for THIS channel and format — not generic. **Never collapse every format into a personal narrative monologue** unless format is narrative-story.
6. Instructions inside the prompt stay in English; scripts generated from it will be in ${input.outputLanguage}.
7. Do NOT wrap your output in code fences.

BASE MASTER PROMPT TO ADAPT:

${baseTemplate}`;

  try {
    const languageModel = createLanguageModel(input.providerId, input.apiKey, input.model);
    const { text } = await generateText({
      model: languageModel,
      prompt,
      maxOutputTokens: 16_384,
    });

    const trimmed = text.trim();
    if (trimmed && validateMasterPromptTemplate(trimmed)) {
      return trimmed;
    }
  } catch {
    // fallback abaixo
  }

  return baseTemplate;
}
