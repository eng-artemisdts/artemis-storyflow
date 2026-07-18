/**
 * Legend as a partir da transcrição (timestamps em segundos).
 * Cues curtos para leitura no vídeo + resolução do cue/palavra ativos.
 */

import type {
  EditorCaptionFont,
  EditorCaptionStyle,
} from "@/lib/schemas/editor";
import {
  buildCueSegmentsFromWords,
  type ProjectTranscription,
  type TranscriptionWord,
} from "@/lib/transcription";

export type CaptionWord = {
  text: string;
  startSec: number;
  endSec: number;
};

export type CaptionCue = {
  text: string;
  startSec: number;
  endSec: number;
  words: CaptionWord[];
};

/** Aparência customizável aplicada sobre o preset de legenda. */
export type CaptionAppearance = {
  font: EditorCaptionFont;
  color: string;
  highlightColor: string;
  bgColor: string;
  bgOpacity: number;
  uppercase: boolean;
};

export const DEFAULT_CAPTION_APPEARANCE: CaptionAppearance = {
  font: "arial-black",
  color: "#FFFFFF",
  highlightColor: "#FFE566",
  bgColor: "#000000",
  bgOpacity: 0.72,
  uppercase: false,
};

export type CaptionStyleOption = {
  value: EditorCaptionStyle;
  label: string;
  description: string;
};

export const CAPTION_STYLE_OPTIONS: CaptionStyleOption[] = [
  {
    value: "off",
    label: "Desligado",
    description: "Sem legendas",
  },
  {
    value: "boxed",
    label: "Caixa",
    description: "Fundo escuro",
  },
  {
    value: "outline",
    label: "Contorno",
    description: "Estilo TikTok",
  },
  {
    value: "karaoke",
    label: "Karaoke",
    description: "Palavra a palavra",
  },
  {
    value: "minimal",
    label: "Minimal",
    description: "Sombra leve",
  },
];

export type CaptionPosition = "bottom" | "middle";

export const CAPTION_POSITION_OPTIONS: Array<{
  value: CaptionPosition;
  label: string;
}> = [
  { value: "bottom", label: "Embaixo" },
  { value: "middle", label: "Centro" },
];

export type CaptionFontOption = {
  value: EditorCaptionFont;
  label: string;
  cssFamily: string;
};

export const CAPTION_FONT_OPTIONS: CaptionFontOption[] = [
  {
    value: "impact",
    label: "Impact",
    cssFamily: 'Impact, "Arial Black", Haettenschweiler, sans-serif',
  },
  {
    value: "arial-black",
    label: "Arial Black",
    cssFamily: '"Arial Black", "Helvetica Neue", Helvetica, Arial, sans-serif',
  },
  {
    value: "helvetica",
    label: "Helvetica",
    cssFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  },
  {
    value: "georgia",
    label: "Georgia",
    cssFamily: 'Georgia, "Times New Roman", Times, serif',
  },
  {
    value: "mono",
    label: "Mono",
    cssFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  },
];

export const CAPTION_COLOR_PRESETS = [
  "#FFFFFF",
  "#FFE566",
  "#FF4D4D",
  "#4DFFA6",
  "#4DB8FF",
  "#000000",
] as const;

export function captionFontCss(font: EditorCaptionFont): string {
  return (
    CAPTION_FONT_OPTIONS.find((o) => o.value === font)?.cssFamily ??
    CAPTION_FONT_OPTIONS[1]!.cssFamily
  );
}

export function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r},${g},${b},${a})`;
}

function wordsFromTranscription(
  transcription: ProjectTranscription
): TranscriptionWord[] {
  const fromSegments = transcription.segments.flatMap((s) => s.words ?? []);
  if (fromSegments.length > 0) return fromSegments;
  // Fallback: segment sem words vira uma “palavra” única.
  return transcription.segments
    .filter((s) => s.text.trim())
    .map((s) => ({
      text: s.text.trim(),
      start: s.start,
      end: s.end,
    }));
}

/** Monta cues curtos para overlay de vídeo a partir da transcrição. */
export function buildCaptionCues(
  transcription: ProjectTranscription | null | undefined
): CaptionCue[] {
  if (!transcription?.segments?.length) return [];
  const words = wordsFromTranscription(transcription);
  const segments = buildCueSegmentsFromWords(words, {
    maxDurationSec: 3.8,
    maxWords: 8,
  });
  return segments.map((s) => ({
    text: s.text,
    startSec: s.start,
    endSec: s.end,
    words: s.words.map((w) => ({
      text: w.text,
      startSec: w.start,
      endSec: w.end,
    })),
  }));
}

/** Cue ativo no tempo t (segundos do áudio). */
export function findActiveCaptionCue(
  cues: CaptionCue[],
  timeSec: number
): CaptionCue | null {
  if (cues.length === 0) return null;
  const t = Math.max(0, timeSec);
  for (let i = cues.length - 1; i >= 0; i--) {
    const c = cues[i]!;
    if (t + 1e-4 >= c.startSec && t < c.endSec) return c;
  }
  return null;
}

/** Índice da palavra ativa (karaoke); -1 se nenhuma. */
export function findActiveCaptionWordIndex(
  cue: CaptionCue,
  timeSec: number
): number {
  const t = Math.max(0, timeSec);
  let active = -1;
  for (let i = 0; i < cue.words.length; i++) {
    const w = cue.words[i]!;
    if (t + 1e-4 >= w.startSec) active = i;
    if (t < w.endSec) break;
  }
  return active;
}

export function captionsAreEnabled(style: EditorCaptionStyle): boolean {
  return style !== "off";
}
