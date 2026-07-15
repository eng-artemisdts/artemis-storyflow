import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parseProjectBrolls } from "@/lib/brolls/generate-brolls";
import { getStylePreset } from "@/lib/style-presets";
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
      transcriptionJson: true,
      brollsJson: true,
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

  const style = getStylePreset(project.styleId);

  return (
    <div className="mx-auto flex h-full w-full min-w-0 max-w-6xl flex-col overflow-x-hidden px-6 py-8">
      <div className="mb-6 shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight">Cenas (b-rolls)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Análise da transcrição + estilo → lista de imagens com prompt e tempo de início/fim.
        </p>
      </div>
      <ScenesBrollsView
        projectId={project.id}
        projectName={project.name}
        hasTranscription={Boolean(project.transcriptionJson?.trim())}
        hasStyle={Boolean(project.styleId)}
        styleLabel={style?.label ?? null}
        initialBrolls={parseProjectBrolls(project.brollsJson)}
        activeJobIds={project.jobs.map((j) => j.id)}
      />
    </div>
  );
}
