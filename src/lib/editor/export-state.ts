import { z } from "zod";

export const ExportStatusSchema = z.enum([
  "idle",
  "queued",
  "bundling",
  "rendering",
  "done",
  "error",
]);
export type ExportStatus = z.infer<typeof ExportStatusSchema>;

export const ProjectExportStateSchema = z.object({
  status: ExportStatusSchema.default("idle"),
  progress: z.number().min(0).max(100).default(0),
  error: z.string().nullable().default(null),
  videoUrl: z.string().nullable().default(null),
  startedAt: z.string().nullable().default(null),
  finishedAt: z.string().nullable().default(null),
  pid: z.number().int().nullable().default(null),
});

export type ProjectExportState = z.infer<typeof ProjectExportStateSchema>;

export const DEFAULT_EXPORT_STATE: ProjectExportState = {
  status: "idle",
  progress: 0,
  error: null,
  videoUrl: null,
  startedAt: null,
  finishedAt: null,
  pid: null,
};

export function parseExportState(
  raw: string | null | undefined,
  exportedVideoUrl?: string | null
): ProjectExportState {
  let parsed: ProjectExportState = { ...DEFAULT_EXPORT_STATE };
  if (raw?.trim()) {
    try {
      const data = JSON.parse(raw) as unknown;
      const result = ProjectExportStateSchema.safeParse(data);
      if (result.success) {
        parsed = { ...DEFAULT_EXPORT_STATE, ...result.data };
      }
    } catch {
      /* ignore */
    }
  }
  if (exportedVideoUrl && !parsed.videoUrl) {
    parsed = {
      ...parsed,
      videoUrl: exportedVideoUrl,
      status: parsed.status === "idle" ? "done" : parsed.status,
      progress: parsed.status === "done" || parsed.status === "idle" ? 100 : parsed.progress,
    };
  }
  return parsed;
}

export function stringifyExportState(state: ProjectExportState): string {
  return JSON.stringify(ProjectExportStateSchema.parse(state));
}
