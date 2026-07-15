import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AssetsView } from "@/components/assets/assets-view";

export const dynamic = "force-dynamic";

export default async function AssetsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      characters: { orderBy: { name: "asc" } },
      scenarios: { orderBy: { name: "asc" } },
      scenes: { orderBy: { order: "asc" } },
      jobs: {
        where: { status: { in: ["queued", "running"] } },
        select: { id: true },
      },
    },
  });
  if (!project) notFound();

  return (
    <AssetsView
      projectId={project.id}
      hasScript={Boolean(project.script?.trim())}
      characters={project.characters}
      scenarios={project.scenarios}
      scenes={project.scenes}
      activeJobIds={project.jobs.map((j) => j.id)}
    />
  );
}
