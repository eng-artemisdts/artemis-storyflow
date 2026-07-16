import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clapperboard, Settings } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StepSidebar } from "@/components/project/step-sidebar";
import { StaticStepSidebar } from "@/components/project/static-step-sidebar";
import { ProjectMain } from "@/components/project/project-main";
import { VideoKindRouteGuard } from "@/components/project/video-kind-route-guard";
import { resolveAccessibleUploadUrl } from "@/lib/local-uploads";
import { resolveVideoKind } from "@/lib/video-kind";

export const dynamic = "force-dynamic";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      channel: { select: { id: true, name: true } },
      _count: { select: { characters: true, scenarios: true, scenes: true } },
      scenes: { select: { keyframeUrl: true, videoUrl: true } },
      characters: { select: { imageUrl: true } },
      scenarios: { select: { imageUrl: true } },
    },
  });
  if (!project) notFound();

  const videoKind = resolveVideoKind(project.videoKind);
  const isStatic = videoKind === "static";
  const accessibleAudioUrl = await resolveAccessibleUploadUrl(project.audioUrl);

  const analyzed = project._count.scenes > 0;
  const assetsDone =
    analyzed &&
    project.characters.every((c) => c.imageUrl) &&
    project.scenarios.every((s) => s.imageUrl);
  const anyVideo = project.scenes.some((s) => s.videoUrl);

  const progress = {
    script: Boolean(project.script?.trim()),
    style: Boolean(project.styleId),
    assets: analyzed,
    whiteboard: assetsDone,
    generation: anyVideo,
  };

  const backHref = project.channelId
    ? `/channels/${project.channelId}`
    : "/";

  return (
    <div className="flex h-dvh flex-col">
      <VideoKindRouteGuard projectId={project.id} videoKind={videoKind} />
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <Button variant="ghost" size="icon" className="size-8" asChild>
          <Link href={backHref} aria-label="Voltar">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex items-center gap-2">
          <Clapperboard className="size-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <span className="block truncate font-medium">{project.name}</span>
            {project.channel && (
              <span className="block truncate text-xs text-muted-foreground">
                {project.channel.name}
              </span>
            )}
          </div>
          <Badge variant="outline" className="shrink-0 capitalize">
            {videoKind}
          </Badge>
        </div>
        <div className="ml-auto">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/projects/${project.id}/settings`}>
              <Settings className="size-4" /> Configurações
            </Link>
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {isStatic ? (
          <StaticStepSidebar
            projectId={project.id}
            hasScript={Boolean(project.script?.trim())}
            hasStyle={Boolean(project.styleId)}
            hasAudio={Boolean(accessibleAudioUrl)}
            hasTranscription={Boolean(project.transcriptionJson?.trim())}
            hasBrolls={Boolean(project.brollsJson?.trim())}
            hasEditorReady={
              Boolean(accessibleAudioUrl) && Boolean(project.brollsJson?.trim())
            }
          />
        ) : (
          <StepSidebar projectId={project.id} progress={progress} />
        )}
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <ProjectMain>{children}</ProjectMain>
        </main>
      </div>
    </div>
  );
}
