import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { buildEditorStateFromAssets } from "@/lib/editor/build-editor-state";
import { parseEditorSettings } from "@/lib/editor/editor-settings";
import { ensureBrollsTimesInSeconds } from "@/lib/brolls/ensure-times";
import {
  localUploadAbsolutePath,
  localUploadExists,
} from "@/lib/local-uploads";
import { prisma } from "@/lib/prisma";
import {
  parseProjectTranscription,
  slugifyForFilename,
  transcriptionDurationSec,
  type ProjectTranscription,
} from "@/lib/transcription";

/**
 * CapCut Desktop 9+ rejeita drafts gerados fora do app ("caminho desconhecido").
 * Exportamos um kit de mídia + SRT + timeline para importação manual no CapCut.
 */

const CAPCUT_INSTRUCTIONS = `# Kit CapCut — como importar

O CapCut Desktop (v9+) bloqueia projetos criados fora do app. Este ZIP traz
as mídias prontas para você montar o vídeo no CapCut em poucos minutos.

## Conteúdo

- \`media/images/\` — cenas em ordem da timeline (\`001\`, \`002\`, …)
- \`media/narration.*\` — narração
- \`media/music.*\` — música de fundo (se houver)
- \`subtitles.srt\` — legendas alinhadas (se houver transcrição)
- \`timeline.json\` — tempos de cada cena (start/end em segundos)

## Passo a passo no CapCut

1. Abra o CapCut e crie um **novo projeto** (vazio).
2. Defina o aspect ratio igual ao do projeto (16:9 ou 9:16).
3. Importe a pasta \`media/images/\` e arraste as imagens **na ordem numérica** para a timeline.
4. Ajuste a duração de cada imagem conforme \`timeline.json\` (campo \`durationSec\`), ou deixe o CapCut e corte depois com a narração.
5. Importe \`media/narration.*\` e coloque na trilha de áudio (início em 0).
6. Se existir, importe \`media/music.*\` em outra trilha e baixe o volume (~30–40%).
7. Menu de legendas → importar \`subtitles.srt\`.
8. Exporte o MP4 no CapCut.

Dica: com a narração na timeline, use “ajustar automaticamente” / sync visual se o CapCut oferecer, ou alinhe o último frame ao fim do áudio.
`;

function extensionFromPath(filePath: string, fallback: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext && ext.length <= 8) return ext;
  return fallback;
}

async function resolveLocalMediaPath(publicUrl: string): Promise<string> {
  if (publicUrl.startsWith("http://") || publicUrl.startsWith("https://")) {
    throw new Error(
      `Mídia remota não suportada no export CapCut: ${publicUrl}. Use arquivos em /uploads/.`
    );
  }
  if (!publicUrl.startsWith("/uploads/")) {
    throw new Error(`Caminho de mídia inválido: ${publicUrl}`);
  }
  if (!(await localUploadExists(publicUrl))) {
    throw new Error(`Arquivo de mídia não encontrado: ${publicUrl}`);
  }
  return localUploadAbsolutePath(publicUrl);
}

function formatSrtTimestamp(sec: number): string {
  const s = Math.max(0, sec);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = Math.floor(s % 60);
  const ms = Math.round((s - Math.floor(s)) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function transcriptionToSrt(
  transcription: ProjectTranscription,
  durationSec: number
): string {
  const lines: string[] = [];
  let index = 1;
  for (const seg of transcription.segments) {
    const text = seg.text.trim();
    if (!text) continue;
    const start = Math.max(0, Number(seg.start) || 0);
    if (start >= durationSec) continue;
    const end = Math.min(
      durationSec,
      Number.isFinite(seg.end) && seg.end > start ? seg.end : start + 1.5
    );
    lines.push(String(index));
    lines.push(
      `${formatSrtTimestamp(start)} --> ${formatSrtTimestamp(Math.max(start + 0.05, end))}`
    );
    lines.push(text);
    lines.push("");
    index += 1;
  }
  return lines.join("\n");
}

export async function buildCapcutDraftZip(
  projectId: string,
  _origin?: string
): Promise<{ buffer: Buffer; fileName: string; draftName: string }> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      videoKind: true,
      audioUrl: true,
      videoAspectRatio: true,
      transcriptionJson: true,
      editorJson: true,
    },
  });
  if (!project) throw new Error("Projeto não encontrado");
  if (project.videoKind !== "static") {
    throw new Error("Export CapCut disponível apenas para vídeos static");
  }
  if (!project.audioUrl) throw new Error("Narração ausente");

  const brolls = await ensureBrollsTimesInSeconds(project.id);
  const transcription = parseProjectTranscription(project.transcriptionJson);
  const settings = parseEditorSettings(project.editorJson);

  const editorState = buildEditorStateFromAssets({
    brolls,
    audioUrl: project.audioUrl,
    audioDurationSec: null,
    transcriptionDurationSec: transcriptionDurationSec(transcription),
    aspectRatio: project.videoAspectRatio,
  });

  const imageClips = editorState.tracks
    .find((t) => t.id === "brolls")
    ?.clips.filter((c) => c.type === "image" && c.src);
  if (!imageClips?.length) {
    throw new Error("Nenhuma imagem de cena para exportar");
  }

  const draftName =
    project.name.trim() || `Storyflow ${project.id.slice(0, 8)}`;
  const slug = slugifyForFilename(draftName);
  const zipRootName = `${slug}-capcut-kit`;
  const stagingRoot = await mkdtemp(path.join(tmpdir(), "capcut-kit-"));
  const imagesDir = path.join(stagingRoot, "media", "images");

  try {
    await mkdir(imagesDir, { recursive: true });

    const timelineImages: Array<{
      file: string;
      label?: string;
      startSec: number;
      durationSec: number;
      endSec: number;
    }> = [];

    for (let i = 0; i < imageClips.length; i++) {
      const clip = imageClips[i]!;
      const srcAbs = await resolveLocalMediaPath(clip.src);
      const ext = extensionFromPath(srcAbs, ".jpg");
      const fileName = `${String(i + 1).padStart(3, "0")}${ext}`;
      await copyFile(srcAbs, path.join(imagesDir, fileName));
      timelineImages.push({
        file: `media/images/${fileName}`,
        label: clip.label,
        startSec: clip.startSec,
        durationSec: clip.durationSec,
        endSec: clip.startSec + clip.durationSec,
      });
    }

    const narrationExt = extensionFromPath(
      await resolveLocalMediaPath(project.audioUrl),
      ".mp3"
    );
    const narrationFile = `narration${narrationExt}`;
    await copyFile(
      await resolveLocalMediaPath(project.audioUrl),
      path.join(stagingRoot, "media", narrationFile)
    );

    let musicFile: string | null = null;
    if (settings.musicUrl) {
      const musicExt = extensionFromPath(
        await resolveLocalMediaPath(settings.musicUrl),
        ".mp3"
      );
      musicFile = `music${musicExt}`;
      await copyFile(
        await resolveLocalMediaPath(settings.musicUrl),
        path.join(stagingRoot, "media", musicFile)
      );
    }

    const timeline = {
      name: draftName,
      aspectRatio: editorState.aspectRatio,
      width: editorState.width,
      height: editorState.height,
      fps: editorState.fps,
      durationSec: editorState.durationSec,
      narration: `media/${narrationFile}`,
      music: musicFile ? `media/${musicFile}` : null,
      musicVolume: settings.musicVolume,
      images: timelineImages,
    };

    await writeFile(
      path.join(stagingRoot, "timeline.json"),
      JSON.stringify(timeline, null, 2),
      "utf8"
    );
    await writeFile(
      path.join(stagingRoot, "INSTRUCOES.md"),
      CAPCUT_INSTRUCTIONS,
      "utf8"
    );

    if (transcription?.segments.length) {
      await writeFile(
        path.join(stagingRoot, "subtitles.srt"),
        transcriptionToSrt(transcription, editorState.durationSec),
        "utf8"
      );
    }

    const zip = new JSZip();
    async function addDir(absDir: string, zipPrefix: string) {
      const { readdir } = await import("node:fs/promises");
      const entries = await readdir(absDir, { withFileTypes: true });
      for (const entry of entries) {
        const abs = path.join(absDir, entry.name);
        const zipPath = zipPrefix ? `${zipPrefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          await addDir(abs, zipPath);
        } else if (entry.isFile()) {
          zip.file(zipPath, await readFile(abs));
        }
      }
    }
    await addDir(stagingRoot, zipRootName);

    const buffer = Buffer.from(
      await zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      })
    );

    return {
      buffer,
      fileName: `${slug}-capcut-kit.zip`,
      draftName,
    };
  } finally {
    await rm(stagingRoot, { recursive: true, force: true }).catch(() => {});
  }
}
