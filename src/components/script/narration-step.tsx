"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Mic, Sparkles, Upload, Trash2, CircleHelp, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import {
  clearNarrationAudio,
} from "@/actions/narration.actions";
import { AudioPlayer } from "@/components/audio-player";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function NarrationStep({
  projectId,
  initialAudioUrl,
  initialAudioSource,
  hasScript,
}: {
  projectId: string;
  initialAudioUrl: string | null;
  initialAudioSource: string | null;
  hasScript: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [audioUrl, setAudioUrl] = useState(initialAudioUrl);
  const [audioSource, setAudioSource] = useState(initialAudioSource);
  const [isUploading, startUpload] = useTransition();
  const [isClearing, startClear] = useTransition();

  function handleGenerateAi() {
    toast.message("Em breve", {
      description: "A geração de narração com IA ainda não está disponível.",
    });
  }

  function handleFileChange(file: File | null) {
    if (!file) return;

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
          setAudioUrl(result.data.audioUrl);
          setAudioSource("upload");
          toast.success("Narração enviada");
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
        toast.success("Narração removida");
      } else {
        toast.error(result.error);
      }
    });
  }

  const busy = isUploading || isClearing;

  return (
    <div className="flex flex-col gap-6">
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

        <section className="flex flex-col gap-4 rounded-xl border bg-card/40 p-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
              <Upload className="size-4" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="text-sm font-medium">Upload do MP3</h2>
              <p className="text-xs text-muted-foreground">
                Envie a narração já gravada (arquivo .mp3, até 50 MB).
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
          <Button
            type="button"
            variant="outline"
            className="mt-auto w-full sm:w-auto"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {isUploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {isUploading ? "Enviando…" : audioUrl ? "Trocar MP3" : "Enviar MP3"}
          </Button>
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
