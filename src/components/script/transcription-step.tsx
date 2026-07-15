"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Captions,
  CircleHelp,
  Download,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { AudioPlayer, type AudioPlayerHandle } from "@/components/audio-player";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  downloadTimestampJson,
  formatTimestamp,
  type ProjectTranscription,
  type TranscriptionSegment,
} from "@/lib/transcription";

type PollResponse =
  | { ok: true; data: { status: "processing" } }
  | { ok: true; data: { status: "completed"; transcription: ProjectTranscription } }
  | { ok: false; error: string };

export function TranscriptionStep({
  projectId,
  projectName,
  audioUrl,
  initialTranscription,
}: {
  projectId: string;
  projectName: string;
  audioUrl: string | null;
  initialTranscription: ProjectTranscription | null;
}) {
  const playerRef = useRef<AudioPlayerHandle>(null);
  const activeSegRef = useRef<HTMLButtonElement>(null);
  const [transcription, setTranscription] = useState(initialTranscription);
  const [isStarting, setIsStarting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const segments = transcription?.segments ?? [];
  const busy = isStarting || isPolling;

  const activeIndex = useMemo(() => {
    if (!segments.length) return -1;
    const t = currentTime;
    const idx = segments.findIndex((s) => t >= s.start && t < s.end);
    if (idx >= 0) return idx;
    for (let i = segments.length - 1; i >= 0; i--) {
      if (t >= segments[i]!.start) return i;
    }
    return -1;
  }, [segments, currentTime]);

  useEffect(() => {
    activeSegRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIndex]);

  const seekTo = useCallback((seconds: number) => {
    playerRef.current?.seek(seconds);
    setCurrentTime(seconds);
  }, []);

  const handleTimeUpdate = useCallback((t: number) => {
    setCurrentTime(t);
  }, []);

  async function pollUntilDone(id: string) {
    setIsPolling(true);
    try {
      for (let i = 0; i < 120; i++) {
        await new Promise((r) => setTimeout(r, i === 0 ? 1500 : 3000));
        const res = await fetch(
          `/api/projects/${projectId}/transcription/status?taskId=${encodeURIComponent(id)}`
        );
        const json = (await res.json()) as PollResponse;
        if (!json.ok) {
          toast.error(json.error);
          return;
        }
        if (json.data.status === "completed") {
          setTranscription(json.data.transcription);
          toast.success("Transcrição concluída");
          return;
        }
      }
      toast.error("A transcrição demorou demais. Tente novamente em instantes.");
    } catch {
      toast.error("Falha ao consultar status da transcrição");
    } finally {
      setIsPolling(false);
    }
  }

  async function handleTranscribe() {
    if (!audioUrl) {
      toast.error("Envie o áudio na etapa de Narração");
      return;
    }
    setIsStarting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/transcription`, {
        method: "POST",
      });
      const json = (await res.json()) as
        | { ok: true; data: { taskId: string; usedScript: boolean } }
        | { ok: false; error: string };
      if (!json.ok) {
        toast.error(json.error);
        return;
      }
      toast.message("Transcrição iniciada", {
        description: json.data.usedScript
          ? "Usando o roteiro do projeto para alinhar os timestamps."
          : "Gerando texto e timestamps a partir do áudio.",
      });
      setIsStarting(false);
      await pollUntilDone(json.data.taskId);
    } catch {
      toast.error("Falha ao iniciar transcrição");
      setIsStarting(false);
    }
  }

  function handleExport() {
    if (!transcription) return;
    downloadTimestampJson(transcription, projectName);
    toast.success("Arquivo baixado");
  }

  if (!audioUrl) {
    return (
      <div className="rounded-xl border border-dashed bg-card/30 p-8 text-center">
        <CircleHelp className="mx-auto mb-3 size-8 text-muted-foreground" />
        <p className="text-sm font-medium">Nenhuma narração disponível</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Faça o upload ou gere o áudio na etapa anterior.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href={`/projects/${projectId}/static/narration`}>
            <ArrowLeft className="size-4" /> Ir para Narração
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-4 overflow-x-hidden">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
        <AudioPlayer
          ref={playerRef}
          src={audioUrl}
          className="min-w-0 flex-1"
          onTimeUpdate={handleTimeUpdate}
        />
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button onClick={handleTranscribe} disabled={busy}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : transcription ? (
              <RefreshCw className="size-4" />
            ) : (
              <Captions className="size-4" />
            )}
            {isStarting
              ? "Enviando…"
              : isPolling
                ? "Transcrevendo…"
                : transcription
                  ? "Transcrever de novo"
                  : "Transcrever"}
          </Button>
          {transcription && (
            <Button type="button" variant="outline" onClick={handleExport}>
              <Download className="size-4" />
              Exportar JSON
            </Button>
          )}
          {transcription && (
            <Button asChild variant="outline">
              <Link href={`/projects/${projectId}/static/scenes`}>
                Ir para cenas
              </Link>
            </Button>
          )}
        </div>
      </div>

      {transcription ? (
        <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card/40">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2.5">
            <h2 className="text-sm font-medium">Linhas</h2>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {formatTimestamp(currentTime)}
            </span>
          </div>
          <div className="max-h-[min(70vh,560px)] min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain p-2 [scrollbar-color:hsl(var(--border))_transparent] [scrollbar-width:thin]">
            {segments.length === 0 ? (
              <p className="break-words p-4 text-sm text-muted-foreground">
                {transcription.text || "Sem segmentos com timestamp."}
              </p>
            ) : (
              <ul className="min-w-0 space-y-1">
                {segments.map((seg, index) => (
                  <li key={`${seg.start}-${index}`} className="min-w-0">
                    <SegmentRow
                      segment={seg}
                      active={index === activeIndex}
                      buttonRef={index === activeIndex ? activeSegRef : undefined}
                      onSeek={seekTo}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : (
        !busy && (
          <p className="text-sm text-muted-foreground">
            Clique em Transcrever para gerar as linhas com timestamps.
          </p>
        )
      )}
    </div>
  );
}

function SegmentRow({
  segment,
  active,
  buttonRef,
  onSeek,
}: {
  segment: TranscriptionSegment;
  active: boolean;
  buttonRef?: React.RefObject<HTMLButtonElement | null>;
  onSeek: (t: number) => void;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => onSeek(segment.start)}
      className={cn(
        "flex w-full min-w-0 max-w-full flex-col gap-1 overflow-hidden rounded-lg px-3 py-2.5 text-left transition-colors",
        active ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-accent/60"
      )}
    >
      <p className="w-full min-w-0 break-words text-sm leading-relaxed [overflow-wrap:anywhere]">
        {segment.text}
      </p>
      <span
        className={cn(
          "font-mono text-[11px] tabular-nums",
          active ? "text-primary" : "text-muted-foreground"
        )}
      >
        {formatTimestamp(segment.start)} → {formatTimestamp(segment.end)}
      </span>
    </button>
  );
}
