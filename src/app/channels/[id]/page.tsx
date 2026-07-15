import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Clapperboard,
  Film,
  MapPin,
  Settings,
  Users,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateProjectDialog } from "@/components/project/create-project-dialog";
import { ProjectCardMenu } from "@/components/project/project-card-menu";
import { ChannelConfigDialog } from "@/components/channel/channel-config-dialog";
import { toNarrativeConfig } from "@/lib/narrative/channel-config";
import { projectHomePath, resolveVideoKind } from "@/lib/video-kind";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const channel = await prisma.channel.findUnique({
    where: { id },
    include: {
      projects: {
        orderBy: { updatedAt: "desc" },
        include: {
          _count: { select: { characters: true, scenarios: true, scenes: true } },
        },
      },
    },
  });
  if (!channel) notFound();

  const narrativeConfig = toNarrativeConfig(channel, channel.targetDurationMin);

  const projectDialogProps = {
    channelId: channel.id,
    defaultDurationMin: channel.targetDurationMin,
    videoAspectRatio: channel.videoAspectRatio,
  };

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" asChild>
        <Link href="/">
          <ArrowLeft className="size-4" /> Canais
        </Link>
      </Button>

      <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-primary">
            <Clapperboard className="size-6" />
            <h1 className="truncate text-3xl font-semibold tracking-tight">{channel.name}</h1>
          </div>
          <p className="max-w-2xl text-muted-foreground">{channel.niche}</p>
          {channel.description && (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground/90">{channel.description}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="secondary">{channel.outputLanguage}</Badge>
            <Badge variant="outline">{channel.videoAspectRatio}</Badge>
            <Badge variant="outline">{channel.targetDurationMin} min</Badge>
            <Badge variant="outline">
              ~{channel.wordTarget.toLocaleString("pt-BR")} palavras
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/channels/${channel.id}/settings`}>
              <Settings className="size-4" /> Configurações
            </Link>
          </Button>
          <CreateProjectDialog {...projectDialogProps} />
        </div>
      </header>

      <ChannelConfigDialog
        config={narrativeConfig}
        durationMin={channel.targetDurationMin}
        videoAspectRatio={channel.videoAspectRatio}
      />

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium">Projetos</h2>
          {channel.projects.length > 0 && <CreateProjectDialog {...projectDialogProps} />}
        </div>

        {channel.projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
            <Film className="mb-4 size-10 text-muted-foreground" />
            <h3 className="text-lg font-medium">Nenhum projeto neste canal</h3>
            <p className="mb-6 mt-1 max-w-sm text-sm text-muted-foreground">
              Cada projeto é um vídeo. Informe o tópico e gere o roteiro com a voz deste canal.
            </p>
            <CreateProjectDialog {...projectDialogProps} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {channel.projects.map((project) => (
              <Card
                key={project.id}
                className="group relative transition-colors hover:border-primary/50"
              >
                <Link
                  href={projectHomePath(project.id, project.videoKind)}
                  className="absolute inset-0 z-0"
                  aria-label={`Abrir projeto ${project.name}`}
                />
                <CardHeader className="pointer-events-none">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="line-clamp-1">{project.name}</CardTitle>
                    <div className="pointer-events-auto relative z-10">
                      <ProjectCardMenu projectId={project.id} projectName={project.name} />
                    </div>
                  </div>
                  <CardDescription suppressHydrationWarning>
                    {resolveVideoKind(project.videoKind) === "static" && project.videoTopic
                      ? `Tópico: ${project.videoTopic}`
                      : `Atualizado em ${dateFormatter.format(project.updatedAt)}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pointer-events-none flex flex-wrap gap-2">
                  <Badge variant="outline" className="capitalize">
                    {resolveVideoKind(project.videoKind)}
                  </Badge>
                  <Badge variant="secondary" className="gap-1">
                    <Users className="size-3" /> {project._count.characters}
                  </Badge>
                  <Badge variant="secondary" className="gap-1">
                    <MapPin className="size-3" /> {project._count.scenarios}
                  </Badge>
                  <Badge variant="secondary" className="gap-1">
                    <Film className="size-3" /> {project._count.scenes}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
