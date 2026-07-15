"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Download, Film, ImageIcon, Loader2, TriangleAlert, Video } from "lucide-react";
import { toast } from "sonner";
import { useJobPolling } from "@/hooks/use-job-polling";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { VideoPlayer } from "@/components/video-player";
import { EditVideoDialog } from "@/components/generation/edit-video-dialog";
import {
  formatDurationMinutes,
  formatDurationSeconds,
  getDurationMismatch,
} from "@/lib/duration-presets";

interface TimelineScene {
  id: string;
  order: number;
  title: string;
  summary: string;
  durationSec: number;
  keyframeUrl: string | null;
  videoUrl: string | null;
  lastJob: { id: string; status: string; error: string | null } | null;
}

export function GenerationTimeline({
  projectId,
  scenes,
  activeJobIds,
  targetDurationMin,
  videoProvider,
  videoModel,
}: {
  projectId: string;
  scenes: TimelineScene[];
  activeJobIds: string[];
  targetDurationMin: number | null;
  videoProvider: string | null;
  videoModel: string | null;
}) {
  const router = useRouter();
  const { track } = useJobPolling({
    onJobFinished: (job) => {
      if (job.status === "succeeded") {
        toast.success("Clipe pronto");
        router.refresh();
      } else {
        toast.error(`Falha na geração: ${job.error ?? "erro desconhecido"}`);
        router.refresh();
      }
    },
  });

  useEffect(() => {
    if (activeJobIds.length > 0) track(activeJobIds);
  }, [activeJobIds, track]);

  const ready = scenes.filter((s) => s.videoUrl);
  const plannedDurationSec = scenes.reduce((acc, s) => acc + s.durationSec, 0);
  const readyDurationSec = ready.reduce((acc, s) => acc + s.durationSec, 0);
  const durationMismatch =
    targetDurationMin !== null
      ? getDurationMismatch(plannedDurationSec, targetDurationMin)
      : null;

  if (scenes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <Video className="mb-4 size-10 text-muted-foreground" />
        <h2 className="text-lg font-medium">Nenhuma cena ainda</h2>
        <p className="mb-6 mt-1 max-w-sm text-sm text-muted-foreground">
          Analise o roteiro e gere os assets antes de chegar à timeline.
        </p>
        <Button asChild>
          <Link href={`/projects/${projectId}/assets`}>Ir para Análise & Assets</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Timeline</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Clipes gerados em ordem de cena. A montagem final do vídeo fica fora deste
            escaffold (TODO: concatenação com ffmpeg).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Film className="size-3" /> {ready.length}/{scenes.length} clipes prontos
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <Clock className="size-3" /> {formatDurationSeconds(readyDurationSec)} prontos
          </Badge>
          {targetDurationMin !== null && (
            <Badge variant="outline" className="gap-1">
              Meta: {formatDurationMinutes(targetDurationMin)}
            </Badge>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href={`/projects/${projectId}/whiteboard`}>Selecionar cenas no whiteboard</Link>
          </Button>
        </div>
      </div>

      {durationMismatch && (
        <Alert variant="destructive" className="mb-6">
          <TriangleAlert />
          <AlertTitle>
            {durationMismatch.kind === "over"
              ? "Roteiro acima da duração alvo"
              : "Roteiro abaixo da duração alvo"}
          </AlertTitle>
          <AlertDescription>
            {durationMismatch.kind === "over" ? (
              <>
                As cenas somam {formatDurationSeconds(plannedDurationSec)},{" "}
                {formatDurationSeconds(durationMismatch.deltaSec)} acima da meta de{" "}
                {formatDurationMinutes(targetDurationMin!)}. Ajuste durações ou reduza cenas
                no whiteboard.
              </>
            ) : (
              <>
                As cenas somam apenas {formatDurationSeconds(plannedDurationSec)} — faltam{" "}
                {formatDurationSeconds(durationMismatch.deltaSec)} para a meta de{" "}
                {formatDurationMinutes(targetDurationMin!)}. Adicione cenas ou aumente a
                duração de cada uma.
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      <ol className="space-y-4">
        {scenes.map((scene) => {
          const jobActive =
            scene.lastJob && (scene.lastJob.status === "queued" || scene.lastJob.status === "running");
          return (
            <li key={scene.id}>
              <Card>
                <CardContent className="flex flex-wrap items-center gap-5 py-4">
                  <div className="relative aspect-video w-72 shrink-0 overflow-hidden rounded-xl bg-neutral-950 ring-1 ring-white/10">
                    {scene.videoUrl ? (
                      <VideoPlayer
                        src={scene.videoUrl}
                        poster={scene.keyframeUrl}
                        className="size-full"
                      />
                    ) : scene.keyframeUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={scene.keyframeUrl}
                          alt={scene.title}
                          className="size-full object-cover opacity-50"
                        />
                        {jobActive && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                            <Loader2 className="size-5 animate-spin text-white" />
                            <span className="text-xs text-white/80">
                              {scene.lastJob?.status === "queued" ? "na fila" : "gerando..."}
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        <ImageIcon className="size-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">#{scene.order}</Badge>
                      <h3 className="truncate font-medium">{scene.title}</h3>
                      <Badge variant="secondary">{scene.durationSec}s</Badge>
                      {scene.lastJob?.status === "failed" && (
                        <Badge variant="destructive" title={scene.lastJob.error ?? undefined}>
                          falhou
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{scene.summary}</p>
                  </div>

                  {scene.videoUrl && (
                    <div className="flex flex-wrap items-center gap-2">
                      {jobActive && (
                        <Badge variant="secondary" className="gap-1">
                          <Loader2 className="size-3 animate-spin" />
                          {scene.lastJob?.status === "queued" ? "na fila" : "editando..."}
                        </Badge>
                      )}
                      <EditVideoDialog
                        projectId={projectId}
                        sceneId={scene.id}
                        sceneTitle={scene.title}
                        videoProvider={videoProvider}
                        videoModel={videoModel}
                        disabled={Boolean(jobActive)}
                        onStarted={(jobId) => track([jobId])}
                      />
                      <Button variant="outline" size="sm" asChild>
                        <a href={scene.videoUrl} download={`cena-${scene.order}.mp4`}>
                          <Download className="size-4" /> Baixar
                        </a>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
