import "server-only";

import { prisma } from "@/lib/prisma";
import {
  customStyleToPreset,
  getStylePreset,
  type StylePreset,
} from "@/lib/style-presets";

/**
 * Resolve um styleId: primeiro nos presets built-in, depois nos CustomStyle do DB.
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
