import type { ProjectBroll } from "@/lib/schemas/brolls";
import { slugifyForFilename } from "@/lib/transcription";
import type { VideoAspectRatio } from "@/lib/video-aspect";

/** Manifesto compatível com batch tools do Google Flow (ex.: gflow-cli). */
export type GoogleFlowManifest = {
  source: "storyflow";
  version: 1;
  instructions_pt: string;
  aspect_ratio: VideoAspectRatio;
  prompts: Array<{
    id: number;
    text: string;
    concept: string;
    aspect_ratio: VideoAspectRatio;
    output_filename: string;
  }>;
};

const FLOW_INSTRUCTIONS_PT =
  "Gere as imagens no Google Flow. Ao exportar/baixar, nomeie cada arquivo com o ID da cena " +
  "(ex.: 3.png, 12.webp). Depois use “Importar do Flow” no StoryFlow para associar automaticamente.";

export function buildGoogleFlowPromptMd(
  brolls: ProjectBroll[],
  projectName: string,
  aspectRatio: VideoAspectRatio
): string {
  const title = projectName.trim()
    ? `${projectName.trim()} — prompts para Google Flow`
    : "Prompts para Google Flow";

  const sceneBlocks = brolls.map((b) => {
    const lines = [
      `## [${b.id}] ${b.concept}${b.timestamp_display ? ` · ${b.timestamp_display}` : ""}`,
      "",
      `**Arquivo:** \`${b.id}.png\``,
      "",
      b.image_prompt.trim(),
      "",
    ];
    return lines.join("\n");
  });

  return [
    `# ${title}`,
    "",
    `**Aspect ratio:** ${aspectRatio}`,
    `**Cenas:** ${brolls.length}`,
    "",
    "## Instruções",
    "",
    FLOW_INSTRUCTIONS_PT,
    "",
    "---",
    "",
    ...sceneBlocks.flatMap((block, index) =>
      index < sceneBlocks.length - 1 ? [block, "---", ""] : [block]
    ),
  ].join("\n");
}

export async function copyGoogleFlowPromptMd(
  brolls: ProjectBroll[],
  projectName: string,
  aspectRatio: VideoAspectRatio
): Promise<void> {
  const markdown = buildGoogleFlowPromptMd(brolls, projectName, aspectRatio);
  await navigator.clipboard.writeText(markdown);
}

export function buildGoogleFlowManifest(
  brolls: ProjectBroll[],
  aspectRatio: VideoAspectRatio
): GoogleFlowManifest {
  return {
    source: "storyflow",
    version: 1,
    aspect_ratio: aspectRatio,
    instructions_pt: FLOW_INSTRUCTIONS_PT,
    prompts: brolls.map((b) => ({
      id: b.id,
      text: b.image_prompt,
      concept: b.concept,
      aspect_ratio: aspectRatio,
      output_filename: String(b.id),
    })),
  };
}

/** Remove sufixos de timestamp comuns em exports do Google Flow (ex.: 3-1734567890.png). */
export function stripFlowExportTimestampSuffix(stem: string): string {
  let s = stem.trim();
  const suffixPatterns = [
    /[-_.]\d{13}$/,
    /[-_.]\d{10}$/,
    /[-_.]\d{14}$/,
    /[-_.]\d{8}$/,
    /[-_.]\d{4}-\d{2}-\d{2}(?:[Tt][-_.]?\d{2}[-_.]?\d{2}[-_.]?\d{2})?$/,
  ];

  let prev = "";
  while (s !== prev) {
    prev = s;
    for (const re of suffixPatterns) {
      s = s.replace(re, "");
    }
  }
  return s.trim();
}

/** Extrai o ID do b-roll a partir do nome do arquivo exportado pelo Flow. */
export function parseBrollIdFromFilename(filename: string): number | null {
  const base = filename.split(/[/\\]/).pop()?.trim() ?? "";
  const stem = stripFlowExportTimestampSuffix(base.replace(/\.[^.]+$/, "").trim());
  if (!stem) return null;

  const patterns = [
    /^broll[-_]?(\d+)$/i,
    /^(\d+)$/,
    /^(\d+)[-_.\s].+$/i,
    /^.+[-_.\s](\d+)$/i,
  ];

  for (const re of patterns) {
    const m = stem.match(re);
    if (m?.[1]) {
      const id = Number(m[1]);
      if (Number.isInteger(id) && id > 0) return id;
    }
  }
  return null;
}

export function isImageFilename(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".gif")
  );
}

export function isZipFilename(name: string): boolean {
  return name.toLowerCase().endsWith(".zip");
}

export function downloadGoogleFlowManifest(
  brolls: ProjectBroll[],
  projectName: string,
  aspectRatio: VideoAspectRatio
): void {
  const manifest = buildGoogleFlowManifest(brolls, aspectRatio);
  const blob = new Blob([JSON.stringify(manifest, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugifyForFilename(projectName)}-google-flow.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function isImageFile(file: File): boolean {
  const mime = file.type.toLowerCase();
  if (mime.startsWith("image/")) return true;
  return isImageFilename(file.name);
}

export function isZipFile(file: File): boolean {
  const mime = file.type.toLowerCase();
  return (
    mime === "application/zip" ||
    mime === "application/x-zip-compressed" ||
    isZipFilename(file.name)
  );
}
