import type { ProjectBrolls } from "@/lib/schemas/brolls";
import { formatTimestamp } from "@/lib/transcription";

/**
 * True quando os tempos parecem milissegundos (ex.: 1720 em vez de 1.72),
 * comparando o maior valor com a duração real do áudio/transcrição.
 */
export function brollTimesLookLikeMs(
  maxTime: number,
  referenceDurationSec?: number | null
): boolean {
  if (!Number.isFinite(maxTime) || maxTime <= 0) return false;
  if (referenceDurationSec && referenceDurationSec > 1) {
    const errAsSec = Math.abs(maxTime - referenceDurationSec);
    const errAsMs = Math.abs(maxTime / 1000 - referenceDurationSec);
    return errAsMs < errAsSec;
  }
  // Sem referência: valores > 10_000 quase certamente são ms em vídeos faceless.
  return maxTime > 10_000;
}

/** Normaliza start/end/duration de b-rolls já salvos (ms → s) se necessário. */
export function normalizeProjectBrollsTimes(
  data: ProjectBrolls,
  referenceDurationSec?: number | null
): ProjectBrolls {
  const maxEnd = data.brolls.reduce((m, b) => Math.max(m, Number(b.end) || 0), 0);
  if (!brollTimesLookLikeMs(maxEnd, referenceDurationSec)) return data;

  return {
    ...data,
    brolls: data.brolls.map((b) => {
      const start = Number(b.start) / 1000;
      const end = Number(b.end) / 1000;
      return {
        ...b,
        start,
        end,
        duration: Math.max(0.1, end - start),
        timestamp_seconds: start,
        timestamp_display: formatTimestamp(start),
      };
    }),
  };
}
