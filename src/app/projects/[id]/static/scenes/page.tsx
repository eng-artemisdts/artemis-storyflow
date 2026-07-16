import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ensureBrollsTimesInSeconds } from "@/actions/brolls-normalize.actions";
import { resolveStylePreset } from "@/lib/resolve-style-preset";
import { resolveVideoAspectRatio } from "@/lib/video-aspect";
import { parseProjectTranscription } from "@/lib/transcription";
import { ScenesBrollsView } from "@/components/script/scenes-brolls-view";

export const dynamic = "force-dynamic";

export default async function StaticScenesPage({
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
      styleId: true,
      videoAspectRatio: true,
      transcriptionJson: true,
      jobs: {
        where: {
          status: { in: ["queued", "running"] },
          targetType: "broll",
        },
        select: { id: true },
      },
    },
  });
  if (!project) notFound();

  const style = await resolveStylePreset(project.styleId);
  const transcription = parseProjectTranscription(project.transcriptionJson);
  const initialBrolls = await ensureBrollsTimesInSeconds(project.id);

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col px-6 py-6">
      <div className="mb-4 shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight">Cenas (b-rolls)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Análise da transcrição + estilo → lista de imagens com prompt e tempo de início/fim.
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <ScenesBrollsView
          projectId={project.id}
          projectName={project.name}
          aspectRatio={resolveVideoAspectRatio(project.videoAspectRatio)}
          hasTranscription={Boolean(project.transcriptionJson?.trim())}
          hasStyle={Boolean(project.styleId)}
          styleLabel={style?.label ?? null}
          initialBrolls={initialBrolls}
          transcription={transcription}
          activeJobIds={project.jobs.map((j) => j.id)}
        />
      </div>
    </div>
  );
}
