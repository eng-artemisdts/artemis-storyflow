export const TIKTOK_DURATION_PRESETS = [1, 6, 10] as const;

export type TiktokDurationPreset = (typeof TIKTOK_DURATION_PRESETS)[number];

export function formatDurationMinutes(min: number): string {
  if (min < 1) return `${Math.round(min * 60)}s`;
  return min === 1 ? "1 min" : `${min} min`;
}

export function formatDurationSeconds(totalSec: number): string {
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (sec === 0) return min === 1 ? "1 min" : `${min} min`;
  return `${min} min ${sec}s`;
}

/** Tolerância para comparar duração planejada vs meta (cenas em segundos inteiros). */
export const DURATION_MATCH_TOLERANCE_SEC = 10;

export function getDurationMismatch(
  plannedSec: number,
  targetMin: number
): { kind: "over" | "under"; deltaSec: number } | null {
  const targetSec = targetMin * 60;
  const delta = plannedSec - targetSec;
  if (Math.abs(delta) <= DURATION_MATCH_TOLERANCE_SEC) return null;
  return delta > 0
    ? { kind: "over", deltaSec: delta }
    : { kind: "under", deltaSec: -delta };
}
