import "server-only";

import { prisma } from "@/lib/prisma";
import {
  applyStylePromptOverride,
  customStyleToPreset,
  getStylePreset,
  type StylePreset,
} from "@/lib/style-presets";

export type StylePromptOverrides = Record<string, string>;

/**
 * Parseia o JSON de overrides de prompt por styleId.
 * Entradas inválidas / vazias são ignoradas.
 */
export function parseStylePromptOverrides(
  raw: string | null | undefined
): StylePromptOverrides {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: StylePromptOverrides = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof key !== "string" || !key.trim()) continue;
      if (typeof value !== "string" || !value.trim()) continue;
      out[key] = value.trim();
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeStylePromptOverrides(
  overrides: StylePromptOverrides
): string | null {
  const cleaned: StylePromptOverrides = {};
  for (const [key, value] of Object.entries(overrides)) {
    const prompt = value.trim();
    if (!key.trim() || !prompt) continue;
    cleaned[key] = prompt;
  }
  return Object.keys(cleaned).length > 0 ? JSON.stringify(cleaned) : null;
}

/**
 * Resolve um styleId: primeiro nos presets built-in, depois nos CustomStyle do DB.
 * Não aplica overrides de projeto — use `resolveProjectStylePreset` para isso.
 */
export async function resolveStylePreset(
  styleId: string | null | undefined
): Promise<StylePreset | null> {
  if (!styleId) return null;
  const builtIn = getStylePreset(styleId);
  if (builtIn) return builtIn;

  const custom = await prisma.customStyle.findUnique({ where: { id: styleId } });
  if (!custom) return null;
  return customStyleToPreset(custom);
}

/**
 * Resolve o estilo do projeto aplicando override de prompt (se houver)
 * sobre presets built-in. Custom styles já têm prompt editável no próprio registro.
 */
export async function resolveProjectStylePreset(project: {
  styleId: string | null | undefined;
  stylePromptOverrides?: string | null;
}): Promise<StylePreset | null> {
  const preset = await resolveStylePreset(project.styleId);
  if (!preset || !project.styleId) return null;

  // Custom styles: o prompt já vem do DB; overrides só afetam presets built-in.
  if (!getStylePreset(project.styleId)) return preset;

  const overrides = parseStylePromptOverrides(project.stylePromptOverrides);
  const override = overrides[project.styleId];
  if (!override) return preset;
  return applyStylePromptOverride(preset, override);
}
