import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ensureBrollsTimesInSeconds } from "@/actions/brolls-normalize.actions";
import { parseProjectTranscription, transcriptionDurationSec } from "@/lib/transcription";
import { parseEditorSettings } from "@/lib/editor/editor-settings";
import { parseExportState } from "@/lib/editor/export-state";
import { resolveAccessibleUploadUrl } from "@/lib/local-uploads";
import { resolveVideoAspectRatio } from "@/lib/video-aspect";
import { StaticEditView } from "@/components/editor/static-edit-view";

export const dynamic = "force-dynamic";

export default async function StaticEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      audioUrl: true,
      videoAspectRatio: true,
      transcriptionJson: true,
      videoKind: true,
      editorJson: true,
      exportedVideoUrl: true,
      exportJson: true,
    },
  });
  if (!project) notFound();

  const brolls = await ensureBrollsTimesInSeconds(project.id);
  const list = brolls?.brolls ?? [];
  const imageCount = list.filter((b) => Boolean(b.imageUrl)).length;
  const transcription = parseProjectTranscription(project.transcriptionJson);
  const editorSettings = parseEditorSettings(project.editorJson);
  const exportState = parseExportState(project.exportJson, project.exportedVideoUrl);

  const resolvedAudioUrl = await resolveAccessibleUploadUrl(project.audioUrl);
  const audioMissingOnDisk =
    Boolean(project.audioUrl?.trim()) && !resolvedAudioUrl;

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col px-6 py-6">
      <div className="mb-4 shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight">Edição</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Preview do slideshow, transição, música e exportação do MP4 final.
        </p>
      </div>
      <StaticEditView
        projectId={project.id}
        audioUrl={resolvedAudioUrl}
        audioMissingOnDisk={audioMissingOnDisk}
        aspectRatio={resolveVideoAspectRatio(project.videoAspectRatio)}
        brolls={brolls}
        imageCount={imageCount}
        totalBrolls={list.length}
        transcriptionDurationSec={transcriptionDurationSec(transcription)}
        initialSettings={editorSettings}
        initialExportState={exportState}
      />
    </div>
  );
}
