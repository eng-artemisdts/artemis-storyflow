import type { ProjectBroll, ProjectBrolls } from "@/lib/schemas/brolls";
import { normalizeProjectBrollsTimes } from "@/lib/brolls/normalize-times";
import {
  EDITOR_FPS,
  type EditorCaptionFont,
  type EditorCaptionPosition,
  type EditorCaptionStyle,
  type EditorClip,
  type EditorImageMotion,
  type EditorState,
  type EditorTransition,
  type StaticCompositionProps,
} from "@/lib/schemas/editor";
import type { CaptionCue } from "@/lib/editor/captions";
import { resolveVideoAspectRatio } from "@/lib/video-aspect";

export function secToFrames(sec: number, fps = EDITOR_FPS): number {
  return Math.max(1, Math.round(sec * fps));
}

export function framesToSec(frames: number, fps = EDITOR_FPS): number {
  return frames / fps;
}

function aspectDimensions(aspectRatio: "16:9" | "9:16"): {
  width: number;
  height: number;
} {
  return aspectRatio === "9:16"
    ? { width: 1080, height: 1920 }
    : { width: 1920, height: 1080 };
}

/**
 * Duração do projeto no editor: a narração manda.
 * Com duração real do áudio, usamos ela (não estendemos além do MP3).
 * Sem áudio medido: transcrição → fim dos b-rolls.
 */
export function resolveEditorDurationSec(input: {
  audioDurationSec?: number | null;
  transcriptionDurationSec?: number | null;
  brolls: ProjectBrolls | null;
}): number {
  if (
    typeof input.audioDurationSec === "number" &&
    Number.isFinite(input.audioDurationSec) &&
    input.audioDurationSec > 0
  ) {
    return input.audioDurationSec;
  }

  const lastBrollEnd = (input.brolls?.brolls ?? []).reduce(
    (max, b) => Math.max(max, b.end),
    0
  );
  const candidates = [input.transcriptionDurationSec, lastBrollEnd].filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0
  );

  return Math.max(0.1, ...candidates, 0.1);
}

/**
 * Monta o estado inicial do editor a partir dos b-rolls + áudio de narração.
 * Clipes mantêm start/end dos b-rolls; só o último (cronológico) estende
 * até o fim do áudio se sobrar gap — sem sobrepor os anteriores.
 */
export function buildEditorStateFromAssets(input: {
  brolls: ProjectBrolls | null;
  audioUrl: string | null;
  audioDurationSec?: number | null;
  transcriptionDurationSec?: number | null;
  aspectRatio: string | null | undefined;
}): EditorState {
  const aspectRatio = resolveVideoAspectRatio(input.aspectRatio);
  const { width, height } = aspectDimensions(aspectRatio);

  // Corrige b-rolls salvos com timestamps em ms (legado / LLM).
  const brolls =
    input.brolls == null
      ? null
      : normalizeProjectBrollsTimes(
          input.brolls,
          input.audioDurationSec ?? input.transcriptionDurationSec
        );
  const list = brolls?.brolls ?? [];

  const durationSec = resolveEditorDurationSec({
    audioDurationSec: input.audioDurationSec,
    transcriptionDurationSec: input.transcriptionDurationSec,
    brolls,
  });

  const imageClips: EditorClip[] = list
    .filter((b): b is ProjectBroll & { imageUrl: string } => Boolean(b.imageUrl))
    .flatMap((b) => {
      const startSec = Number(b.start);
      const endSec = Number(b.end);
      if (!Number.isFinite(startSec) || !Number.isFinite(endSec)) return [];
      if (startSec >= durationSec) return [];
      const clippedStart = Math.max(0, startSec);
      const clippedEnd = Math.min(endSec, durationSec);
      if (clippedEnd <= clippedStart) return [];
      return [
        {
          id: `broll-${b.id}`,
          type: "image" as const,
          src: b.imageUrl,
          startSec: clippedStart,
          durationSec: clippedEnd - clippedStart,
          label: b.concept,
          brollId: b.id,
        },
      ];
    })
    .sort((a, b) => a.startSec - b.startSec || a.id.localeCompare(b.id));

  // Padding só no gap final: estende o último clipe cronológico até o fim do áudio.
  if (imageClips.length > 0) {
    const last = imageClips[imageClips.length - 1]!;
    const lastEnd = last.startSec + last.durationSec;
    if (lastEnd < durationSec - 0.05) {
      last.durationSec = durationSec - last.startSec;
    }
  }

  const narrationClips: EditorClip[] = input.audioUrl
    ? [
        {
          id: "narration-audio",
          type: "audio",
          src: input.audioUrl,
          startSec: 0,
          durationSec,
          label: "Narração",
        },
      ]
    : [];

  return {
    fps: EDITOR_FPS,
    width,
    height,
    durationSec,
    aspectRatio,
    tracks: [
      { id: "narration", label: "Narração", clips: narrationClips },
      { id: "brolls", label: "B-rolls", clips: imageClips },
    ],
    updatedAt: new Date().toISOString(),
  };
}

export function parseEditorState(raw: string | null | undefined): EditorState | null {
  if (!raw?.trim()) return null;
  try {
    const data = JSON.parse(raw) as EditorState;
    if (!data?.tracks || !Array.isArray(data.tracks)) return null;
    return data;
  } catch {
    return null;
  }
}

/** Converte EditorState → props da composition Remotion. */
export function editorStateToCompositionProps(
  state: EditorState,
  settings?: {
    transition?: EditorTransition;
    transitionMs?: number;
    imageMotion?: EditorImageMotion;
    imageMotionIntensity?: number;
    captionStyle?: EditorCaptionStyle;
    captionScale?: number;
    captionPosition?: EditorCaptionPosition;
    captionFont?: EditorCaptionFont;
    captionColor?: string;
    captionHighlightColor?: string;
    captionBgColor?: string;
    captionBgOpacity?: number;
    captionUppercase?: boolean;
    musicUrl?: string | null;
    musicVolume?: number;
  } | null,
  captionCues: CaptionCue[] = []
): StaticCompositionProps {
  const fps = state.fps || EDITOR_FPS;
  const brollTrack = state.tracks.find((t) => t.id === "brolls");
  const narrationTrack = state.tracks.find((t) => t.id === "narration");
  const audioClip = narrationTrack?.clips.find((c) => c.type === "audio");
  const durationInFrames = secToFrames(state.durationSec, fps);

  const imageClips = (brollTrack?.clips ?? [])
    .filter((c) => c.type === "image" && c.src)
    .map((c) => ({
      id: c.id,
      src: c.src,
      fromFrame: secToFrames(c.startSec, fps),
      durationInFrames: secToFrames(c.durationSec, fps),
    }))
    .sort((a, b) => a.fromFrame - b.fromFrame);

  const transition = settings?.transition ?? "crossfade";
  const transitionMs = settings?.transitionMs ?? 350;
  const crossfadeFrames =
    transition === "cut" ? 0 : Math.round(fps * (transitionMs / 1000));
  const captionStyle = settings?.captionStyle ?? "boxed";

  return {
    imageClips,
    audioSrc: audioClip?.src ?? null,
    musicSrc: settings?.musicUrl ?? null,
    musicVolume: settings?.musicVolume ?? 0.35,
    durationInFrames,
    width: state.width,
    height: state.height,
    backgroundColor: "#0a0a0a",
    crossfadeFrames,
    transition,
    imageMotion: settings?.imageMotion ?? "ken-burns",
    imageMotionIntensity: settings?.imageMotionIntensity ?? 1,
    captionCues: captionStyle === "off" ? [] : captionCues,
    captionStyle,
    captionScale: settings?.captionScale ?? 1,
    captionPosition: settings?.captionPosition ?? "bottom",
    captionFont: settings?.captionFont ?? "arial-black",
    captionColor: settings?.captionColor ?? "#FFFFFF",
    captionHighlightColor: settings?.captionHighlightColor ?? "#FFE566",
    captionBgColor: settings?.captionBgColor ?? "#000000",
    captionBgOpacity: settings?.captionBgOpacity ?? 0.72,
    captionUppercase: settings?.captionUppercase ?? false,
  };
}
