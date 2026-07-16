import type { CSSProperties } from "react";

/** Formatos de saída suportados pelos adapters de vídeo (e alinhados nos keyframes). */
export const VIDEO_ASPECT_RATIOS = ["16:9", "9:16"] as const;

export type VideoAspectRatio = (typeof VIDEO_ASPECT_RATIOS)[number];

export function isVideoAspectRatio(value: unknown): value is VideoAspectRatio {
  return value === "16:9" || value === "9:16";
}

export function resolveVideoAspectRatio(
  value: string | null | undefined
): VideoAspectRatio {
  return value === "9:16" ? "9:16" : "16:9";
}

export const VIDEO_ASPECT_OPTIONS: Array<{
  value: VideoAspectRatio;
  label: string;
  hint: string;
  platforms: string;
}> = [
  {
    value: "16:9",
    label: "Paisagem",
    hint: "Widescreen horizontal",
    platforms: "YouTube · Cinema · Web",
  },
  {
    value: "9:16",
    label: "Retrato",
    hint: "Vertical full-screen",
    platforms: "TikTok · Reels · Shorts",
  },
];

/** Dimensões de export / Remotion (1080p base). */
export function videoAspectDimensions(aspectRatio: VideoAspectRatio): {
  width: number;
  height: number;
} {
  return aspectRatio === "9:16"
    ? { width: 1080, height: 1920 }
    : { width: 1920, height: 1080 };
}

/**
 * Estilo do frame de preview no editor static.
 * Retrato (9:16): altura fixa, largura derivada — evita esticar como paisagem.
 */
export function editorPreviewFrameStyle(aspectRatio: VideoAspectRatio): CSSProperties {
  if (aspectRatio === "9:16") {
    return {
      aspectRatio: "9 / 16",
      width: "min(100%, calc(min(56vh, 560px) * 9 / 16))",
    };
  }
  return {
    aspectRatio: "16 / 9",
    width: "100%",
    maxWidth: "56rem",
    maxHeight: "min(48vh, 480px)",
  };
}

/** Largura máxima dos controles abaixo do preview (alinha com o frame). */
export function editorPreviewControlsMaxWidth(aspectRatio: VideoAspectRatio): string {
  return aspectRatio === "9:16" ? "min(100%, 315px)" : "56rem";
}

export function videoAspectPlatformLabel(aspectRatio: VideoAspectRatio): string {
  return (
    VIDEO_ASPECT_OPTIONS.find((o) => o.value === aspectRatio)?.platforms ??
    aspectRatio
  );
}
