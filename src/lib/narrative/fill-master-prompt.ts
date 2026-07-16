import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ChannelNarrativeConfig } from "@/lib/narrative/channel-config";
import { resolveChannelType, type ChannelTypeId } from "@/lib/narrative/channel-types";
import { resolveMasterPromptTemplate } from "@/lib/narrative/load-master-prompt-template";
import { resolveNarrationType } from "@/lib/narrative/narration-types";
import {
  buildReferenceCharacterSection,
  resolveReferenceCharacterLabel,
} from "@/lib/narrative/reference-character";

let minimaxVoiceoverCache: string | null = null;
let topicStructureCache: string | null = null;
let outputDisciplineCache: string | null = null;

function loadMinimaxVoiceoverRules(): string {
  if (!minimaxVoiceoverCache) {
    minimaxVoiceoverCache = readFileSync(
      join(process.cwd(), "src/lib/narrative/templates/_shared-minimax-voiceover.md"),
      "utf8"
    ).trim();
  }
  return minimaxVoiceoverCache;
}

function loadTopicStructureRules(): string {
  if (!topicStructureCache) {
    topicStructureCache = readFileSync(
      join(process.cwd(), "src/lib/narrative/templates/_shared-topic-structure-rules.md"),
      "utf8"
    ).trim();
  }
  return topicStructureCache;
}

function loadOutputDisciplineRules(): string {
  if (!outputDisciplineCache) {
    outputDisciplineCache = readFileSync(
      join(process.cwd(), "src/lib/narrative/templates/_shared-output-discipline.md"),
      "utf8"
    ).trim();
  }
  return outputDisciplineCache;
}

function applyTemplateVars(template: string, vars: Record<string, string>): string {
  let prompt = template;
  const keys = Object.keys(vars).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const token = `{{${key}}}`;
    prompt = prompt.split(token).join(vars[key]!);
  }
  return prompt;
}

/**
 * Preenche o master prompt com a config do canal + tópico do vídeo.
 */
export function fillMasterPrompt(
  config: ChannelNarrativeConfig,
  videoTopic: string,
  options?: {
    channelType?: ChannelTypeId | null;
    masterPromptTemplate?: string | null;
  }
): string {
  const brand = config.brandSignoff.trim() || "none";
  const narration = resolveNarrationType(config.narrationType);
  const channelType = resolveChannelType(options?.channelType ?? config.channelType);

  const baseVars: Record<string, string> = {
    NICHE: config.niche,
    OUTPUT_LANGUAGE: config.outputLanguage,
    CHANNEL_TYPE: channelType.id,
    NARRATION_TYPE: narration.configLabel,
    ADDRESS_FORM: config.addressForm,
    WORD_TARGET: String(config.wordTarget),
    'BRAND_SIGNOFF | "none"': brand,
    BRAND_SIGNOFF: brand,
    VIDEO_TOPIC: videoTopic.trim(),
    NARRATION_STYLE_INTRO: narration.styleIntro,
    CHECKLIST_POV: narration.checklistPov,
    REFERENCE_CHARACTER: resolveReferenceCharacterLabel(config),
    MINIMAX_VOICEOVER_RULES: loadMinimaxVoiceoverRules(),
    TOPIC_STRUCTURE_RULES: loadTopicStructureRules(),
    OUTPUT_DISCIPLINE_RULES: loadOutputDisciplineRules(),
  };

  const povRules = applyTemplateVars(narration.povRules, baseVars);
  const checklistPov = applyTemplateVars(narration.checklistPov, baseVars);
  const referenceCharacterSection = buildReferenceCharacterSection(config);

  const vars: Record<string, string> = {
    ...baseVars,
    POV_RULES: povRules,
    CHECKLIST_POV: checklistPov,
    REFERENCE_CHARACTER_SECTION: referenceCharacterSection,
  };

  const template = resolveMasterPromptTemplate({
    channelType: channelType.id,
    masterPromptTemplate: options?.masterPromptTemplate,
  });

  return applyTemplateVars(template, vars);
}
