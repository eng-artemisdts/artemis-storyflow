import type { VideoAspectRatio } from "@/lib/video-aspect";
import {
  deriveScriptLengthFromDuration,
  type ScriptLengthConfig,
} from "@/lib/narrative/script-length";
import {
  DEFAULT_NARRATION_TYPE,
  type NarrationTypeId,
  resolveNarrationType,
} from "@/lib/narrative/narration-types";
import {
  DEFAULT_CHANNEL_TYPE,
  type ChannelTypeId,
  resolveChannelType,
} from "@/lib/narrative/channel-types";
import {
  buildReferenceCharacterSection,
  resolveReferenceCharacterLabel,
} from "@/lib/narrative/reference-character";

/** Campos do CHANNEL CONFIG do master prompt. */
export interface ChannelNarrativeConfig {
  niche: string;
  outputLanguage: string;
  channelType: ChannelTypeId;
  narrationType: NarrationTypeId;
  hasReferenceCharacter: boolean;
  referenceCharacterName: string;
  referenceCharacterDescription: string;
  addressForm: string;
  forbiddenForms: string;
  wordMin: number;
  wordTarget: number;
  wordMax: number;
  scenesMin: number;
  scenesMax: number;
  sceneWords: string;
  suspensePhrase: string;
  concreteUnits: string;
  brandSignoff: string;
}

export interface LanguagePreset {
  label: string;
  outputLanguage: string;
  addressForm: string;
  forbiddenForms: string;
  defaultSuspensePhrase: string;
}

/** Presets de idioma → forms de tratamento e frase de suspense padrão. */
export const LANGUAGE_PRESETS: readonly LanguagePreset[] = [
  {
    label: "Português (BR)",
    outputLanguage: "Brazilian Portuguese",
    addressForm: "você",
    forbiddenForms: 'no "o senhor/a senhora", no European Portuguese forms',
    defaultSuspensePhrase: "Você ainda não sabe, mas...",
  },
  {
    label: "Español (LatAm)",
    outputLanguage: "neutral Latin American Spanish",
    addressForm: "tú",
    forbiddenForms: 'no "usted", no "vos", no Spain-specific "vosotros"',
    defaultSuspensePhrase: "Todavía no lo sabes, pero...",
  },
  {
    label: "English (US)",
    outputLanguage: "US English",
    addressForm: "you",
    forbiddenForms: "no British spellings, no corporate jargon",
    defaultSuspensePhrase: "You don't know it yet, but...",
  },
] as const;

export const DEFAULT_LANGUAGE = LANGUAGE_PRESETS[0]!;

export const DEFAULT_CHANNEL_DURATION_MIN = 10;
export const DEFAULT_VIDEO_ASPECT_RATIO: VideoAspectRatio = "9:16";

const DEFAULT_CONCRETE_UNITS =
  "concrete numbers, dates, clock times, object names, and sensory details natural to this niche";

export function resolveSuspensePhrase(
  phrase: string | null | undefined,
  outputLanguage: string
): string {
  const trimmed = phrase?.trim();
  if (trimmed) return trimmed;
  const preset =
    LANGUAGE_PRESETS.find((p) => p.outputLanguage === outputLanguage) ?? DEFAULT_LANGUAGE;
  return preset.defaultSuspensePhrase;
}

export function resolveConcreteUnits(units: string | null | undefined): string {
  const trimmed = units?.trim();
  return trimmed || DEFAULT_CONCRETE_UNITS;
}

export function resolveBrandSignoff(signoff: string | null | undefined): string {
  const trimmed = signoff?.trim();
  return trimmed || "none";
}

/**
 * Monta a config efetiva para preencher o master prompt.
 * Se `durationMin` for passado (ex.: duração do projeto), recalcula WORD/SCENES.
 */
export function toNarrativeConfig(
  channel: {
    niche: string;
    description?: string | null;
    outputLanguage: string;
    channelType?: string | null;
    narrationType?: string | null;
    hasReferenceCharacter?: boolean | null;
    referenceCharacterName?: string | null;
    referenceCharacterDescription?: string | null;
    addressForm: string;
    forbiddenForms: string;
    wordMin: number;
    wordTarget: number;
    wordMax: number;
    scenesMin: number;
    scenesMax: number;
    sceneWords: string;
    suspensePhrase: string;
    concreteUnits?: string | null;
    brandSignoff: string;
  },
  durationMin?: number | null
): ChannelNarrativeConfig {
  const length: ScriptLengthConfig =
    durationMin != null && durationMin > 0
      ? deriveScriptLengthFromDuration(durationMin)
      : {
          wordMin: channel.wordMin,
          wordTarget: channel.wordTarget,
          wordMax: channel.wordMax,
          scenesMin: channel.scenesMin,
          scenesMax: channel.scenesMax,
          sceneWords: channel.sceneWords,
        };

  const niche =
    channel.description?.trim()
      ? `${channel.niche.trim()}. ${channel.description.trim()}`
      : channel.niche.trim();

  return {
    niche,
    outputLanguage: channel.outputLanguage,
    channelType: (channel.channelType as ChannelTypeId) ?? DEFAULT_CHANNEL_TYPE,
    narrationType: (channel.narrationType as NarrationTypeId) ?? DEFAULT_NARRATION_TYPE,
    hasReferenceCharacter: Boolean(channel.hasReferenceCharacter),
    referenceCharacterName: channel.referenceCharacterName?.trim() ?? "",
    referenceCharacterDescription: channel.referenceCharacterDescription?.trim() ?? "",
    addressForm: channel.addressForm,
    forbiddenForms: channel.forbiddenForms,
    ...length,
    suspensePhrase: resolveSuspensePhrase(channel.suspensePhrase, channel.outputLanguage),
    concreteUnits: resolveConcreteUnits(channel.concreteUnits),
    brandSignoff: resolveBrandSignoff(channel.brandSignoff),
  };
}

/** Monta o bloco CHANNEL CONFIG legível (para preview na UI). */
export function formatChannelConfigBlock(config: ChannelNarrativeConfig): string {
  const brand = resolveBrandSignoff(config.brandSignoff);
  const narration = resolveNarrationType(config.narrationType);
  const channelType = resolveChannelType(config.channelType);
  const refChar = resolveReferenceCharacterLabel(config);
  return [
    `NICHE:              ${config.niche}`,
    `OUTPUT_LANGUAGE:    ${config.outputLanguage}`,
    `CHANNEL_TYPE:       ${channelType.id}`,
    `NARRATION_TYPE:     ${narration.configLabel}`,
    `REFERENCE_CHARACTER: ${refChar}`,
    `ADDRESS_FORM:       ${config.addressForm}`,
    `WORD_TARGET:        ${config.wordTarget}`,
    `BRAND_SIGNOFF:      ${brand}`,
  ].join("\n");
}
