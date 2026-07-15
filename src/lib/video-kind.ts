export const VIDEO_KINDS = ["motion", "static"] as const;

export type VideoKind = (typeof VIDEO_KINDS)[number];

export function isVideoKind(value: unknown): value is VideoKind {
  return value === "motion" || value === "static";
}

export function resolveVideoKind(value: string | null | undefined): VideoKind {
  return value === "static" ? "static" : "motion";
}

export function projectHomePath(projectId: string, videoKind: string | null | undefined): string {
  return resolveVideoKind(videoKind) === "static"
    ? `/projects/${projectId}/static`
    : `/projects/${projectId}/script`;
}
