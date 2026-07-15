import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ChannelNarrativeConfig } from "@/lib/narrative/channel-config";

let cachedTemplate: string | null = null;

function loadMasterPromptTemplate(): string {
  if (cachedTemplate) return cachedTemplate;
  const path = join(process.cwd(), "src/lib/narrative/master-prompt-narrativo.md");
  const raw = readFileSync(path, "utf8");
  // Remove o appendix de exemplos — só o template operacional.
  const appendixIdx = raw.indexOf("# APPENDIX");
  cachedTemplate = appendixIdx >= 0 ? raw.slice(0, appendixIdx).trimEnd() : raw;
  return cachedTemplate;
}

/**
 * Preenche o master-prompt-narrativo com a config do canal + tópico do vídeo.
 * O bloco CHANNEL CONFIG e todas as {{CHAVES}} são substituídas.
 */
export function fillMasterPrompt(
  config: ChannelNarrativeConfig,
  videoTopic: string
): string {
  const brand = config.brandSignoff.trim() || "none";
  const vars: Record<string, string> = {
    NICHE: config.niche,
    OUTPUT_LANGUAGE: config.outputLanguage,
    ADDRESS_FORM: config.addressForm,
    FORBIDDEN_FORMS: config.forbiddenForms,
    WORD_MIN: String(config.wordMin),
    WORD_TARGET: String(config.wordTarget),
    WORD_MAX: String(config.wordMax),
    SCENES_MIN: String(config.scenesMin),
    SCENES_MAX: String(config.scenesMax),
    SCENE_WORDS: config.sceneWords,
    SUSPENSE_PHRASE: config.suspensePhrase,
    CONCRETE_UNITS: config.concreteUnits,
    'BRAND_SIGNOFF | "none"': brand,
    BRAND_SIGNOFF: brand,
    VIDEO_TOPIC: videoTopic.trim(),
  };

  let prompt = loadMasterPromptTemplate();

  // Substitui chaves mais longas primeiro (ex.: BRAND_SIGNOFF | "none" antes de BRAND_SIGNOFF).
  const keys = Object.keys(vars).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const token = `{{${key}}}`;
    prompt = prompt.split(token).join(vars[key]!);
  }

  return prompt;
}
