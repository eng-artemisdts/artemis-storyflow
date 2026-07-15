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
