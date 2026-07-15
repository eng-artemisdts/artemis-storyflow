import Link from "next/link";
import { Clapperboard, Plus, Radio, Film, Settings2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChannelCardMenu } from "@/components/channel/channel-card-menu";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

export default async function HomePage() {
  const channels = await prisma.channel.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { projects: true } },
    },
  });

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <header className="mb-10 flex items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-primary">
            <Clapperboard className="size-7" />
            <h1 className="text-3xl font-semibold tracking-tight">StoryFlow</h1>
          </div>
          <p className="text-muted-foreground">
            Canais → projetos motion (roteiro) ou static (master prompt narrativo).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/settings">
              <Settings2 className="size-4" /> Configurações
            </Link>
          </Button>
          <Button asChild>
            <Link href="/channels/new">
              <Plus className="size-4" /> Novo canal
            </Link>
          </Button>
        </div>
      </header>

      {channels.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-24 text-center">
          <Radio className="mb-4 size-10 text-muted-foreground" />
          <h2 className="text-lg font-medium">Nenhum canal ainda</h2>
          <p className="mb-6 mt-1 max-w-sm text-sm text-muted-foreground">
            Crie um canal com nome, nicho e formato dos vídeos. Depois adicione projetos e
            gere roteiros a partir de um tópico.
          </p>
          <Button asChild>
            <Link href="/channels/new">
              <Plus className="size-4" /> Criar primeiro canal
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {channels.map((channel) => (
            <Card
              key={channel.id}
              className="group relative transition-colors hover:border-primary/50"
            >
              <Link
                href={`/channels/${channel.id}`}
                className="absolute inset-0 z-0"
                aria-label={`Abrir canal ${channel.name}`}
              />
              <CardHeader className="pointer-events-none">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="line-clamp-1">{channel.name}</CardTitle>
                  <div className="pointer-events-auto relative z-10">
                    <ChannelCardMenu channelId={channel.id} channelName={channel.name} />
                  </div>
                </div>
                <CardDescription className="line-clamp-2">
                  {channel.description?.trim() || channel.niche}
                </CardDescription>
              </CardHeader>
              <CardContent className="pointer-events-none space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{channel.videoAspectRatio}</Badge>
                  <Badge variant="secondary">{channel.targetDurationMin} min</Badge>
                  <Badge variant="secondary" className="gap-1">
                    <Film className="size-3" /> {channel._count.projects} projetos
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                  Atualizado em {formatDate(channel.updatedAt)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
