"use client";

import { useState, type ReactNode, type RefObject } from "react";
import {
  ArrowLeftRight,
  Captions,
  Loader2,
  Move,
  Music2,
  Trash2,
  Upload,
} from "lucide-react";
import {
  CAPTION_COLOR_PRESETS,
  CAPTION_FONT_OPTIONS,
  CAPTION_POSITION_OPTIONS,
  CAPTION_STYLE_OPTIONS,
  IMAGE_MOTION_OPTIONS,
  TRANSITION_OPTIONS,
  transitionNeedsDuration,
} from "@/lib/editor/editor-settings";
import type {
  EditorCaptionStyle,
  EditorImageMotion,
  EditorSettings,
  EditorTransition,
} from "@/lib/schemas/editor";
import { captionFontCss } from "@/lib/editor/captions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

function TransitionPreview({ type }: { type: EditorTransition }) {
  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-md bg-neutral-950">
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

function MotionPreview({ type }: { type: EditorImageMotion }) {
  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-md bg-neutral-950">
      {type === "random" ? (
        <>
          <div className="absolute inset-[14%] translate-x-1 -translate-y-0.5 scale-110 rounded-sm bg-emerald-600/90" />
          <div className="absolute inset-[22%] -translate-x-1 translate-y-1 scale-95 rounded-sm bg-teal-500/70" />
          <div className="absolute inset-[30%] translate-x-0.5 rounded-sm bg-cyan-400/50" />
        </>
      ) : (
        <div
          className={cn(
            "absolute inset-[10%] rounded-sm bg-gradient-to-br from-emerald-600 to-teal-700",
            type === "none" && "inset-[18%]",
            type === "ken-burns" &&
              "inset-[6%] scale-110 -translate-x-1 -translate-y-0.5",
            type === "zoom-in" && "inset-[8%] scale-125",
            type === "zoom-out" && "inset-[4%] scale-90",
            type === "drift" && "inset-[10%] translate-x-2"
          )}
        />
      )}
    </div>
  );
}

function CaptionStylePreview({ type }: { type: EditorCaptionStyle }) {
  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-md bg-neutral-800">
      <div className="absolute inset-0 bg-gradient-to-br from-neutral-700 to-neutral-900" />
      {type === "off" ? (
        <span className="absolute inset-0 flex items-center justify-center text-[9px] text-muted-foreground">
          —
        </span>
      ) : (
        <span
          className={cn(
            "absolute inset-x-1 bottom-1.5 text-center text-[8px] font-black leading-tight text-white",
            type === "boxed" && "rounded bg-black/70 px-1 py-0.5",
            type === "outline" &&
              "uppercase [text-shadow:-1px_-1px_0_#000,1px_-1px_0_#000,-1px_1px_0_#000,1px_1px_0_#000]",
            type === "karaoke" && "uppercase",
            type === "minimal" && "font-bold [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]"
          )}
        >
          {type === "karaoke" ? (
            <>
              <span className="text-yellow-300">Olá</span>{" "}
              <span className="text-white/50">mundo</span>
            </>
          ) : (
            "Olá mundo"
          )}
        </span>
      )}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const normalized = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : "#FFFFFF";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="font-mono text-[10px] uppercase text-muted-foreground">
          {normalized}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={normalized}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="size-8 shrink-0 cursor-pointer rounded border border-border/70 bg-transparent p-0.5"
          aria-label={label}
        />
        <div className="flex flex-wrap gap-1">
          {CAPTION_COLOR_PRESETS.map((hex) => (
            <button
              key={hex}
              type="button"
              title={hex}
              onClick={() => onChange(hex)}
              className={cn(
                "size-5 rounded-full border border-white/20",
                normalized.toUpperCase() === hex && "ring-2 ring-primary ring-offset-1 ring-offset-background"
              )}
              style={{ backgroundColor: hex }}
              aria-label={`Usar cor ${hex}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

type ToolsTab = "transition" | "motion" | "captions";

export function EditSettingsPanel({
  settings,
  busy,
  musicInputRef,
  hasTranscription = true,
  onTransitionChange,
  onTransitionMsChange,
  onImageMotionChange,
  onImageMotionIntensityChange,
  onCaptionStyleChange,
  onCaptionScaleChange,
  onCaptionPositionChange,
  onCaptionAppearanceChange,
  onMusicVolumeChange,
  onMusicFile,
  onClearMusic,
  children,
}: {
  settings: EditorSettings;
  busy: boolean;
  musicInputRef: RefObject<HTMLInputElement | null>;
  hasTranscription?: boolean;
  onTransitionChange: (t: EditorSettings["transition"]) => void;
  onTransitionMsChange: (ms: number) => void;
  onImageMotionChange: (m: EditorSettings["imageMotion"]) => void;
  onImageMotionIntensityChange: (v: number) => void;
  onCaptionStyleChange: (s: EditorSettings["captionStyle"]) => void;
  onCaptionScaleChange: (v: number) => void;
  onCaptionPositionChange: (p: EditorSettings["captionPosition"]) => void;
  onCaptionAppearanceChange: (
    patch: Partial<
      Pick<
        EditorSettings,
        | "captionFont"
        | "captionColor"
        | "captionHighlightColor"
        | "captionBgColor"
        | "captionBgOpacity"
        | "captionUppercase"
      >
    >
  ) => void;
  onMusicVolumeChange: (v: number) => void;
  onMusicFile: (file: File | null) => void;
  onClearMusic: () => void;
  children?: ReactNode;
}) {
  const [toolsTab, setToolsTab] = useState<ToolsTab>("transition");

  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 lg:sticky lg:top-4 lg:w-72 lg:self-start xl:w-80">
      <section className="rounded-xl border bg-card/60 p-4 shadow-sm">
        <div className="mb-3 space-y-0.5">
          <h2 className="text-sm font-medium">Ferramentas</h2>
          <p className="text-xs text-muted-foreground">
            Transições, movimento e legendas.
          </p>
        </div>

        <Tabs
          value={toolsTab}
          onValueChange={(v) => {
            if (v === "motion" || v === "captions" || v === "transition") {
              setToolsTab(v);
            }
          }}
          className="gap-3"
        >
          <TabsList className="grid h-auto w-full grid-cols-3 gap-0.5 p-1">
            <TabsTrigger value="transition" className="flex-col gap-0.5 px-1 py-1.5 text-[10px] sm:text-xs">
              <ArrowLeftRight className="size-3.5" />
              Transição
            </TabsTrigger>
            <TabsTrigger value="motion" className="flex-col gap-0.5 px-1 py-1.5 text-[10px] sm:text-xs">
              <Move className="size-3.5" />
              Movimento
            </TabsTrigger>
            <TabsTrigger value="captions" className="flex-col gap-0.5 px-1 py-1.5 text-[10px] sm:text-xs">
              <Captions className="size-3.5" />
              Legendas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transition" className="mt-0 space-y-3">
            <p className="text-xs text-muted-foreground">
              Efeito entre as cenas do vídeo.
            </p>

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
              <div className="space-y-1.5 border-t pt-3">
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
          </TabsContent>

          <TabsContent value="motion" className="mt-0 space-y-3">
            <p className="text-xs text-muted-foreground">
              Anima stills durante a cena (Ken Burns).
            </p>

            <div
              className="grid grid-cols-2 gap-2"
              role="radiogroup"
              aria-label="Tipo de movimento da imagem"
            >
              {IMAGE_MOTION_OPTIONS.map((opt) => {
                const selected = settings.imageMotion === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onImageMotionChange(opt.value)}
                    className={cn(
                      "flex flex-col gap-1.5 rounded-lg border p-2 text-left transition-all",
                      selected
                        ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/25"
                        : "border-border/70 bg-background/40 hover:border-foreground/20 hover:bg-accent/40"
                    )}
                  >
                    <MotionPreview type={opt.value} />
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

            {settings.imageMotion !== "none" ? (
              <div className="space-y-1.5 border-t pt-3">
                {settings.imageMotion === "random" ? (
                  <p className="text-[10px] leading-snug text-muted-foreground">
                    Cada cena recebe um movimento diferente (Ken Burns, zoom ou
                    drift), de forma estável no preview e no export.
                  </p>
                ) : null}
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">
                    Intensidade
                  </Label>
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {settings.imageMotionIntensity.toFixed(1)}×
                  </span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={150}
                  step={10}
                  value={Math.round(settings.imageMotionIntensity * 100)}
                  onChange={(e) =>
                    onImageMotionIntensityChange(Number(e.target.value) / 100)
                  }
                  className="w-full accent-primary"
                  aria-label="Intensidade do movimento"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Sutil</span>
                  <span>Forte</span>
                </div>
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="captions" className="mt-0 space-y-3">
            <p className="text-xs text-muted-foreground">
              Overlay sincronizado com os timestamps da transcrição.
            </p>

            {!hasTranscription ? (
              <p className="rounded-lg border border-dashed bg-background/40 px-3 py-4 text-center text-[11px] leading-relaxed text-muted-foreground">
                Gere a transcrição do projeto para ativar as legendas.
              </p>
            ) : null}

            <div
              className="grid grid-cols-2 gap-2"
              role="radiogroup"
              aria-label="Estilo de legenda"
            >
              {CAPTION_STYLE_OPTIONS.map((opt) => {
                const selected = settings.captionStyle === opt.value;
                const disabled = !hasTranscription && opt.value !== "off";
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={disabled}
                    onClick={() => onCaptionStyleChange(opt.value)}
                    className={cn(
                      "flex flex-col gap-1.5 rounded-lg border p-2 text-left transition-all",
                      selected
                        ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/25"
                        : "border-border/70 bg-background/40 hover:border-foreground/20 hover:bg-accent/40",
                      disabled && "cursor-not-allowed opacity-45"
                    )}
                  >
                    <CaptionStylePreview type={opt.value} />
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

            {settings.captionStyle !== "off" ? (
              <div className="space-y-3 border-t pt-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">
                      Tamanho
                    </Label>
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                      {settings.captionScale.toFixed(2)}×
                    </span>
                  </div>
                  <input
                    type="range"
                    min={75}
                    max={150}
                    step={5}
                    value={Math.round(settings.captionScale * 100)}
                    onChange={(e) =>
                      onCaptionScaleChange(Number(e.target.value) / 100)
                    }
                    className="w-full accent-primary"
                    aria-label="Tamanho das legendas"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Menor</span>
                    <span>Maior</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Posição</Label>
                  <div
                    className="grid grid-cols-2 gap-1.5"
                    role="radiogroup"
                    aria-label="Posição das legendas"
                  >
                    {CAPTION_POSITION_OPTIONS.map((opt) => {
                      const selected = settings.captionPosition === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => onCaptionPositionChange(opt.value)}
                          className={cn(
                            "rounded-md border px-2 py-1.5 text-xs font-medium transition-all",
                            selected
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border/70 bg-background/40 text-muted-foreground hover:border-foreground/20"
                          )}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Fonte</Label>
                  <div
                    className="grid grid-cols-1 gap-1"
                    role="radiogroup"
                    aria-label="Fonte da legenda"
                  >
                    {CAPTION_FONT_OPTIONS.map((opt) => {
                      const selected = settings.captionFont === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() =>
                            onCaptionAppearanceChange({ captionFont: opt.value })
                          }
                          className={cn(
                            "rounded-md border px-2.5 py-1.5 text-left text-xs transition-all",
                            selected
                              ? "border-primary bg-primary/10"
                              : "border-border/70 bg-background/40 hover:border-foreground/20"
                          )}
                          style={{ fontFamily: captionFontCss(opt.value) }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <ColorField
                  label="Cor do texto"
                  value={settings.captionColor}
                  onChange={(captionColor) =>
                    onCaptionAppearanceChange({ captionColor })
                  }
                />

                {settings.captionStyle === "karaoke" ? (
                  <ColorField
                    label="Cor do highlight"
                    value={settings.captionHighlightColor}
                    onChange={(captionHighlightColor) =>
                      onCaptionAppearanceChange({ captionHighlightColor })
                    }
                  />
                ) : null}

                {settings.captionStyle === "boxed" ? (
                  <>
                    <ColorField
                      label="Cor do fundo"
                      value={settings.captionBgColor}
                      onChange={(captionBgColor) =>
                        onCaptionAppearanceChange({ captionBgColor })
                      }
                    />
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">
                          Opacidade do fundo
                        </Label>
                        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                          {Math.round(settings.captionBgOpacity * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={20}
                        max={100}
                        step={5}
                        value={Math.round(settings.captionBgOpacity * 100)}
                        onChange={(e) =>
                          onCaptionAppearanceChange({
                            captionBgOpacity: Number(e.target.value) / 100,
                          })
                        }
                        className="w-full accent-primary"
                        aria-label="Opacidade do fundo da legenda"
                      />
                    </div>
                  </>
                ) : null}

                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border/70 bg-background/40 px-2.5 py-2">
                  <span className="text-xs font-medium">Maiúsculas</span>
                  <input
                    type="checkbox"
                    checked={settings.captionUppercase}
                    onChange={(e) =>
                      onCaptionAppearanceChange({
                        captionUppercase: e.target.checked,
                      })
                    }
                    className="size-4 accent-primary"
                    aria-label="Forçar maiúsculas nas legendas"
                  />
                </label>
              </div>
            ) : null}
          </TabsContent>
        </Tabs>
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
