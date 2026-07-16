"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Mic, Sparkles, Upload, Trash2, CircleHelp, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import {
  clearNarrationAudio,
} from "@/actions/narration.actions";
import { MinimaxNarrationPanel } from "@/components/script/minimax-narration-panel";
import { AudioPlayer } from "@/components/audio-player";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function isMp3File(file: File): boolean {
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return (
    mime === "audio/mpeg" ||
    mime === "audio/mp3" ||
    mime === "audio/x-mpeg" ||
    name.endsWith(".mp3")
  );
}

export function NarrationStep({
  projectId,
  script,
  initialAudioUrl,
  initialAudioMissing = false,
  initialAudioSource,
  hasScript,
}: {
  projectId: string;
  script: string;
  initialAudioUrl: string | null;
  initialAudioMissing?: boolean;
  initialAudioSource: string | null;
  hasScript: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [audioUrl, setAudioUrl] = useState(initialAudioUrl);
  const [audioSource, setAudioSource] = useState(initialAudioSource);
  const [isUploading, startUpload] = useTransition();
  const [isClearing, startClear] = useTransition();
  const [dragOver, setDragOver] = useState(false);

  function handleGenerateAi() {
    toast.message("Em breve", {
      description: "A geração de narração com IA ainda não está disponível.",
    });
  }

  function handleFileChange(file: File | null) {
    if (!file) return;
    if (!isMp3File(file)) {
      toast.error("Envie um arquivo MP3 (.mp3)");
      return;
    }

    startUpload(async () => {
      const formData = new FormData();
      formData.set("file", file);
      try {
        const res = await fetch(`/api/projects/${projectId}/narration/upload`, {
          method: "POST",
          body: formData,
        });
        const result = (await res.json()) as
          | { ok: true; data: { audioUrl: string } }
          | { ok: false; error: string };
        if (result.ok) {
          const replaced = Boolean(audioUrl);
          setAudioUrl(result.data.audioUrl);
          setAudioSource("upload");
          toast.success(replaced ? "Narração atualizada" : "Narração enviada", {
            description: replaced
              ? "Transcrição e cenas foram mantidas. Regenere a transcrição se o áudio mudou."
              : undefined,
          });
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error("Falha no upload da narração");
      }
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  function handleClear() {
    startClear(async () => {
      const result = await clearNarrationAudio({ projectId });
      if (result.ok) {
        setAudioUrl(null);
        setAudioSource(null);
        toast.success("Narração removida", {
          description: "Transcrição e cenas também foram apagadas.",
        });
      } else {
        toast.error(result.error);
      }
    });
  }

  const busy = isUploading || isClearing;

  return (
    <div className="flex flex-col gap-6">
      {initialAudioMissing ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
          O MP3 registrado no projeto não foi encontrado em disco. Envie o arquivo
          novamente abaixo.
        </p>
      ) : null}
      <MinimaxNarrationPanel script={script} />

      <div className="grid gap-4 md:grid-cols-2">
        <section className="flex flex-col gap-4 rounded-xl border bg-card/40 p-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
              <Sparkles className="size-4" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="text-sm font-medium">Gerar narração com IA</h2>
              <p className="text-xs text-muted-foreground">
                Transforma o roteiro em áudio falado via TTS. Em breve.
              </p>
            </div>
          </div>
          <Button
            type="button"
            className="mt-auto w-full sm:w-auto"
            onClick={handleGenerateAi}
            disabled={!hasScript}
          >
            <Mic className="size-4" />
            Gerar narração com IA
          </Button>
          {!hasScript && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CircleHelp className="size-3.5 shrink-0" />
              Salve um roteiro na etapa anterior para liberar esta opção.
            </p>
          )}
        </section>

        <section
          className={cn(
            "flex flex-col gap-4 rounded-xl border bg-card/40 p-5 transition-colors",
            dragOver && "border-primary bg-primary/5"
          )}
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy) setDragOver(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setDragOver(false);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (busy) return;
            handleFileChange(e.dataTransfer.files?.[0] ?? null);
          }}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
              <Upload className="size-4" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="text-sm font-medium">Upload do MP3</h2>
              <p className="text-xs text-muted-foreground">
                Arraste o arquivo aqui ou envie a narração já gravada (.mp3, até 50 MB).
              </p>
            </div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="audio/mpeg,audio/mp3,.mp3"
            className="hidden"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "mt-auto flex w-full flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center transition-colors sm:w-auto sm:min-w-[220px]",
              dragOver
                ? "border-primary bg-primary/10"
                : "border-border/80 bg-muted/20 hover:border-primary/40 hover:bg-muted/40",
              busy && "pointer-events-none opacity-60"
            )}
          >
            {isUploading ? (
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="size-6 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">
              {isUploading ? "Enviando…" : dragOver ? "Solte o MP3" : audioUrl ? "Trocar MP3" : "Arraste ou clique para enviar"}
            </span>
            <span className="text-xs text-muted-foreground">MP3 · até 50 MB</span>
          </button>
        </section>
      </div>

      {audioUrl && (
        <section className="space-y-3 rounded-xl border bg-card/40 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium">Narração atual</h2>
              <Badge variant="secondary">
                {audioSource === "tts" ? "IA" : "Upload"}
              </Badge>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={busy}
            >
              {isClearing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              Remover
            </Button>
          </div>
          <AudioPlayer src={audioUrl} className="w-full" />
          <div className="flex justify-end">
            <Button asChild>
              <Link href={`/projects/${projectId}/static/transcription`}>
                Ir para transcrição <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
