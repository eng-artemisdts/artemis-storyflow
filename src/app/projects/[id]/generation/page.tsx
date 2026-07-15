import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { GenerationTimeline } from "@/components/generation/generation-timeline";

export const dynamic = "force-dynamic";

export default async function GenerationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      scenes: { orderBy: { order: "asc" } },
      jobs: {
        where: { kind: "video" },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!project) notFound();

  // Job de vídeo mais recente por cena (para status na timeline).
  const latestJobByScene = new Map<string, (typeof project.jobs)[number]>();
  for (const job of project.jobs) {
    if (!latestJobByScene.has(job.targetId)) latestJobByScene.set(job.targetId, job);
  }

  return (
    <GenerationTimeline
      projectId={project.id}
      targetDurationMin={project.targetDurationMin}
      videoProvider={project.videoProvider}
      videoModel={project.videoModel}
      scenes={project.scenes.map((scene) => ({
        id: scene.id,
        order: scene.order,
        title: scene.title,
        summary: scene.summary,
        durationSec: scene.durationSec,
        keyframeUrl: scene.keyframeUrl,
        videoUrl: scene.videoUrl,
        lastJob: (() => {
          const job = latestJobByScene.get(scene.id);
          return job ? { id: job.id, status: job.status, error: job.error } : null;
        })(),
      }))}
      activeJobIds={project.jobs
        .filter((j) => j.status === "queued" || j.status === "running")
        .map((j) => j.id)}
    />
  );
}
