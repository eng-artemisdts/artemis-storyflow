/**
 * Deriva WORD_* e SCENES_* do master-prompt a partir da duração alvo do vídeo.
 * Calibração: ~150 palavras/min (narrativa falada) → 18 min ≈ 2700 palavras
 * (o config original do master prompt).
 */
export const NARRATIVE_WORDS_PER_MINUTE = 150;
export const SCENE_WORD_FLOOR = 250;
export const SCENE_WORD_CEIL = 380;

export interface ScriptLengthConfig {
  wordMin: number;
  wordTarget: number;
  wordMax: number;
  scenesMin: number;
  scenesMax: number;
  sceneWords: string;
}

export function deriveScriptLengthFromDuration(durationMin: number): ScriptLengthConfig {
  const minutes = Math.max(1, Math.round(durationMin));
  const wordTarget = minutes * NARRATIVE_WORDS_PER_MINUTE;
  const wordMin = Math.round(wordTarget * 0.94);
  const wordMax = Math.round(wordTarget * 1.07);

  const scenesMin = Math.max(1, Math.floor(wordTarget / SCENE_WORD_CEIL));
  const scenesMax = Math.max(scenesMin, Math.ceil(wordTarget / SCENE_WORD_FLOOR));

  return {
    wordMin,
    wordTarget,
    wordMax,
    scenesMin,
    scenesMax,
    sceneWords: `${SCENE_WORD_FLOOR}–${SCENE_WORD_CEIL}`,
  };
}

/** Presets úteis para canais narrativos (YouTube long-form + shorts). */
export const CHANNEL_DURATION_PRESETS = [5, 8, 10, 12, 15, 18] as const;
