import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_CHANNEL_TYPE,
  resolveChannelType,
  type ChannelTypeId,
} from "@/lib/narrative/channel-types";

const templateCache = new Map<string, string>();

function stripAppendix(raw: string): string {
  const appendixIdx = raw.indexOf("# APPENDIX");
  let template = appendixIdx >= 0 ? raw.slice(0, appendixIdx).trimEnd() : raw;
  template = template.replace(/^> \*\*Como usar:\*\*[^\n]*\n\n/m, "");
  return template;
}

/**
 * Carrega o template base de master prompt para um tipo de canal.
 */
export function loadMasterPromptTemplateForType(channelType?: ChannelTypeId | null): string {
  const type = resolveChannelType(channelType ?? DEFAULT_CHANNEL_TYPE);
  const cached = templateCache.get(type.templateFile);
  if (cached) return cached;

  const templatesDir = join(process.cwd(), "src/lib/narrative");
  const path =
    type.templateFile === "master-prompt-narrativo.md"
      ? join(templatesDir, type.templateFile)
      : join(templatesDir, "templates", type.templateFile);

  const raw = readFileSync(path, "utf8");
  const template = stripAppendix(raw);
  templateCache.set(type.templateFile, template);
  return template;
}

export function resolveMasterPromptTemplate(input: {
  channelType?: ChannelTypeId | null;
  masterPromptTemplate?: string | null;
}): string {
  const custom = input.masterPromptTemplate?.trim();
  if (custom) return custom;
  return loadMasterPromptTemplateForType(input.channelType);
}

export function clearMasterPromptTemplateCache(): void {
  templateCache.clear();
}
