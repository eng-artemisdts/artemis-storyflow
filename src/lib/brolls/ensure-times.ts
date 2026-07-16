import { prisma } from "@/lib/prisma";
import { parseProjectBrolls } from "@/lib/schemas/brolls";
import {
  brollTimesLookLikeMs,
  normalizeProjectBrollsTimes,
} from "@/lib/brolls/normalize-times";
import {
  parseProjectTranscription,
  transcriptionDurationSec,
} from "@/lib/transcription";
import type { ProjectBrolls } from "@/lib/schemas/brolls";

/**
 * Se os b-rolls estão em milissegundos, normaliza para segundos e persiste.
 * Retorna sempre a versão em segundos (ou null).
 */
export async function ensureBrollsTimesInSeconds(
  projectId: string
): Promise<ProjectBrolls | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { brollsJson: true, transcriptionJson: true },
  });
  if (!project?.brollsJson) return null;

  const raw = parseProjectBrolls(project.brollsJson);
  if (!raw) return null;

  const ref =
    transcriptionDurationSec(parseProjectTranscription(project.transcriptionJson)) ??
    null;
  const maxEnd = raw.brolls.reduce((m, b) => Math.max(m, Number(b.end) || 0), 0);
  if (!brollTimesLookLikeMs(maxEnd, ref)) return raw;

  const normalized = normalizeProjectBrollsTimes(raw, ref);
  await prisma.project.update({
    where: { id: projectId },
    data: { brollsJson: JSON.stringify(normalized) },
  });
  return normalized;
}
