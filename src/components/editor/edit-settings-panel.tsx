"use client";

import type { ReactNode, RefObject } from "react";
import { Music2, Loader2, Upload, Trash2 } from "lucide-react";
import {
  TRANSITION_OPTIONS,
  transitionNeedsDuration,
} from "@/lib/editor/editor-settings";
import type { EditorSettings, EditorTransition } from "@/lib/schemas/editor";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function TransitionPreview({ type }: { type: EditorTransition }) {
  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-md bg-neutral-950">
      {/* Base / outgoing */}
      <div
        className={cn(
          "absolute inset-[14%] rounded-sm bg-sky-600",
          type === "cut" && "opacity-100",
          type === "crossfade" && "opacity-50",
          type === "fade-black" && "opacity-40",
          type === "fade-white" && "opacity-40",
          type === "slide-left" && "-translate-x-[35%] opacity-90",
          type === "slide-right" && "translate-x-[35%] opacity-90",
          type === "slide-up" && "-translate-y-[30%] opacity-90",
          type === "zoom" && "scale-125 opacity-70",
          type === "wipe" && "opacity-100"
        )}
      />
      {/* Incoming */}
      <div
        className={cn(
          "absolute inset-[14%] rounded-sm bg-amber-500",
          type === "cut" && "translate-x-[42%] opacity-100",
          type === "crossfade" && "opacity-50",
          type === "fade-black" && "opacity-30",
          type === "fade-white" && "opacity-30",
          type === "slide-left" && "translate-x-[40%] opacity-95",
          type === "slide-right" && "-translate-x-[40%] opacity-95",
          type === "slide-up" && "translate-y-[40%] opacity-95",
          type === "zoom" && "scale-75 opacity-90",
          type === "wipe" && "left-1/2 right-[14%] inset-y-[14%] rounded-l-none"
        )}
      />
      {type === "fade-black" ? (
        <div className="absolute inset-0 bg-black/55" />
      ) : null}
      {type === "fade-white" ? (
        <div className="absolute inset-0 bg-white/50" />
      ) : null}
      {type === "wipe" ? (
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/70 shadow" />
      ) : null}
    </div>
  );
}

export function EditSettingsPanel({
  settings,
  busy,
  musicInputRef,
  onTransitionChange,
  onTransitionMsChange,
  onMusicVolumeChange,
  onMusicFile,
  onClearMusic,
  children,
}: {
  settings: EditorSettings;
  busy: boolean;
  musicInputRef: RefObject<HTMLInputElement | null>;
  onTransitionChange: (t: EditorSettings["transition"]) => void;
  onTransitionMsChange: (ms: number) => void;
  onMusicVolumeChange: (v: number) => void;
  onMusicFile: (file: File | null) => void;
  onClearMusic: () => void;
  children?: ReactNode;
}) {
  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 lg:sticky lg:top-4 lg:w-72 lg:self-start xl:w-80">
      <section className="rounded-xl border bg-card/60 p-4 shadow-sm">
        <div className="mb-3 space-y-0.5">
          <h2 className="text-sm font-medium">Transição</h2>
          <p className="text-xs text-muted-foreground">
            Efeito entre as cenas do vídeo.
          </p>
        </div>

        <div
          className="grid grid-cols-2 gap-2"
          role="radiogroup"
          aria-label="Tipo de transição"
        >
          {TRANSITION_OPTIONS.map((opt) => {
            const selected = settings.transition === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onTransitionChange(opt.value)}
                className={cn(
                  "flex flex-col gap-1.5 rounded-lg border p-2 text-left transition-all",
                  selected
                    ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/25"
                    : "border-border/70 bg-background/40 hover:border-foreground/20 hover:bg-accent/40"
                )}
              >
                <TransitionPreview type={opt.value} />
                <span className="px-0.5">
                  <span className="block text-xs font-medium leading-tight">
                    {opt.label}
                  </span>
                  <span className="block text-[10px] leading-snug text-muted-foreground">
                    {opt.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {transitionNeedsDuration(settings.transition) ? (
          <div className="mt-4 space-y-1.5 border-t pt-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Duração</Label>
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {(settings.transitionMs / 1000).toFixed(2)}s
              </span>
            </div>
            <input
              type="range"
              min={150}
              max={1200}
              step={50}
              value={Math.max(150, settings.transitionMs)}
              onChange={(e) => onTransitionMsChange(Number(e.target.value))}
              className="w-full accent-primary"
              aria-label="Duração da transição"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Rápida</span>
              <span>Lenta</span>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border bg-card/60 p-4 shadow-sm">
        <div className="mb-3 space-y-0.5">
          <h2 className="text-sm font-medium">Música de fundo</h2>
          <p className="text-xs text-muted-foreground">
            Sincronizada com a narração (MP3, WAV, M4A).
          </p>
        </div>

        <input
          ref={musicInputRef}
          type="file"
          accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,.mp3,.wav,.m4a"
          className="hidden"
          onChange={(e) => onMusicFile(e.target.files?.[0] ?? null)}
        />

        {settings.musicUrl ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border bg-background/60 px-3 py-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-violet-500/15 text-violet-400">
                <Music2 className="size-4" />
              </div>
              <span className="min-w-0 flex-1 truncate text-xs">
                {settings.musicUrl.split("/").pop()}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8 shrink-0"
                disabled={busy}
                onClick={onClearMusic}
                aria-label="Remover música"
              >
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
              </Button>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Volume</Label>
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {Math.round(settings.musicVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(settings.musicVolume * 100)}
                onChange={(e) => onMusicVolumeChange(Number(e.target.value) / 100)}
                className="w-full accent-primary"
                aria-label="Volume da música"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              disabled={busy}
              onClick={() => musicInputRef.current?.click()}
            >
              <Upload className="size-3.5" />
              Trocar faixa
            </Button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => musicInputRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed bg-background/30 px-4 py-6 text-center transition-colors hover:border-primary/40 hover:bg-accent/30 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="size-5 text-muted-foreground" />
            )}
            <span className="text-xs font-medium">Enviar música</span>
            <span className="text-[10px] text-muted-foreground">
              Clique para escolher o arquivo
            </span>
          </button>
        )}
      </section>
      {children}
    </aside>
  );
}
