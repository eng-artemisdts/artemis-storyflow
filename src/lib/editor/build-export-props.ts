import { getAudioDurationInSeconds } from "@remotion/media-utils";
import {
  buildEditorStateFromAssets,
  editorStateToCompositionProps,
} from "@/lib/editor/build-editor-state";
import { buildCaptionCues } from "@/lib/editor/captions";
import { parseEditorSettings } from "@/lib/editor/editor-settings";
import { toAbsoluteAssetUrl } from "@/lib/editor/export-paths";
import { ensureBrollsTimesInSeconds } from "@/lib/brolls/ensure-times";
import { prisma } from "@/lib/prisma";
import type { StaticCompositionProps } from "@/lib/schemas/editor";
import {
  parseProjectTranscription,
  transcriptionDurationSec,
} from "@/lib/transcription";

export async function buildStaticExportProps(
  projectId: string,
  origin: string
): Promise<{
  props: StaticCompositionProps;
  durationSec: number;
  width: number;
  height: number;
}> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      videoKind: true,
      audioUrl: true,
      videoAspectRatio: true,
      transcriptionJson: true,
      editorJson: true,
    },
  });
  if (!project) throw new Error("Projeto não encontrado");
  if (project.videoKind !== "static") {
    throw new Error("Export disponível apenas para vídeos static");
  }
  if (!project.audioUrl) throw new Error("Narração ausente");

  const brolls = await ensureBrollsTimesInSeconds(project.id);
  const transcription = parseProjectTranscription(project.transcriptionJson);
  const settings = parseEditorSettings(project.editorJson);
  const captionCues = buildCaptionCues(transcription);

  const absoluteAudioUrl = toAbsoluteAssetUrl(project.audioUrl, origin);
  if (!absoluteAudioUrl) throw new Error("URL da narração inválida");

  let audioDurationSec: number | null = null;
  try {
    const d = await getAudioDurationInSeconds(absoluteAudioUrl);
    if (Number.isFinite(d) && d > 0) audioDurationSec = d;
  } catch {
    /* fallback: transcrição / b-rolls */
  }

  const editorState = buildEditorStateFromAssets({
    brolls,
    audioUrl: project.audioUrl,
    audioDurationSec,
    transcriptionDurationSec: transcriptionDurationSec(transcription),
    aspectRatio: project.videoAspectRatio,
  });

  const hasImages = editorState.tracks
    .find((t) => t.id === "brolls")
    ?.clips.some((c) => c.type === "image");
  if (!hasImages) throw new Error("Nenhuma imagem de cena para exportar");

  const props = editorStateToCompositionProps(
    editorState,
    settings,
    captionCues
  );
  const absolute: StaticCompositionProps = {
    ...props,
    audioSrc: absoluteAudioUrl,
    musicSrc: toAbsoluteAssetUrl(props.musicSrc ?? null, origin),
    imageClips: props.imageClips.map((clip) => ({
      ...clip,
      src: toAbsoluteAssetUrl(clip.src, origin) ?? clip.src,
    })),
  };

  return {
    props: absolute,
    durationSec: editorState.durationSec,
    width: editorState.width,
    height: editorState.height,
  };
}
