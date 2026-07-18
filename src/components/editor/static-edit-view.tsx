"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CircleHelp,
  Clapperboard,
  Loader2,
  Music2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { toast } from "sonner";
import { clearEditorMusic, saveEditorSettings } from "@/actions/editor.actions";
import { EditSettingsPanel } from "@/components/editor/edit-settings-panel";
import { ExportVideoPanel } from "@/components/editor/export-video-panel";
import { CaptionOverlay } from "@/components/editor/caption-overlay";
import { buildEditorStateFromAssets } from "@/lib/editor/build-editor-state";
import {
  buildCaptionCues,
  findActiveCaptionCue,
  type CaptionAppearance,
  type CaptionCue,
} from "@/lib/editor/captions";
import { transitionNeedsDuration } from "@/lib/editor/editor-settings";
import type { ProjectExportState } from "@/lib/editor/export-state";
import type {
  EditorCaptionPosition,
  EditorCaptionStyle,
  EditorClip,
  EditorImageMotion,
  EditorSettings,
  EditorState,
  EditorTransition,
} from "@/lib/schemas/editor";
import { DEFAULT_EDITOR_SETTINGS } from "@/lib/schemas/editor";
import {
  computeImageMotion,
  imageMotionCssTransform,
} from "@/lib/editor/image-motion";
import type { ProjectBrolls } from "@/lib/schemas/brolls";
import {
  formatTimestamp,
  type ProjectTranscription,
} from "@/lib/transcription";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  editorPreviewControlsMaxWidth,
  editorPreviewFrameStyle,
  resolveVideoAspectRatio,
  videoAspectPlatformLabel,
} from "@/lib/video-aspect";

function formatClock(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 10);
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}.${ms}`;
}

/** Clip ativo no tempo t (relógio do áudio = fonte da verdade). */
export function findActiveImageClip(
  clips: EditorClip[],
  timeSec: number
): EditorClip | null {
  if (clips.length === 0) return null;
  const t = Math.max(0, timeSec);
  for (let i = clips.length - 1; i >= 0; i--) {
    const c = clips[i]!;
    if (t + 1e-4 >= c.startSec && t < c.startSec + c.durationSec) return c;
  }
  if (t < clips[0]!.startSec) return clips[0]!;
  return clips[clips.length - 1]!;
}

export function StaticEditView({
  projectId,
  audioUrl,
  audioMissingOnDisk = false,
  aspectRatio,
  brolls,
  imageCount,
  totalBrolls,
  transcription = null,
  transcriptionDurationSec = null,
  initialSettings,
  initialExportState,
}: {
  projectId: string;
  audioUrl: string | null;
  audioMissingOnDisk?: boolean;
  aspectRatio: string;
  brolls: ProjectBrolls | null;
  imageCount: number;
  totalBrolls: number;
  transcription?: ProjectTranscription | null;
  transcriptionDurationSec?: number | null;
  initialSettings?: EditorSettings | null;
  initialExportState?: ProjectExportState | null;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const [audioDurationSec, setAudioDurationSec] = useState<number | null>(null);
  const [durationReady, setDurationReady] = useState(!audioUrl);
  const [audioLoadFailed, setAudioLoadFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [settings, setSettings] = useState<EditorSettings>(() => ({
    ...DEFAULT_EDITOR_SETTINGS,
    ...initialSettings,
  }));
  const [isSavingSettings, startSaveSettings] = useTransition();
  const [isUploadingMusic, startUploadMusic] = useTransition();
  const [isClearingMusic, startClearMusic] = useTransition();
  const resolvedAspect = resolveVideoAspectRatio(aspectRatio);

  const [editorState, setEditorState] = useState<EditorState>(() =>
    buildEditorStateFromAssets({
      brolls,
      audioUrl,
      audioDurationSec: null,
      transcriptionDurationSec,
      aspectRatio,
    })
  );

  const imageClips = useMemo(
    () =>
      (editorState.tracks.find((t) => t.id === "brolls")?.clips ?? []).filter(
        (c) => c.type === "image" && c.src
      ),
    [editorState]
  );

  const activeClip = useMemo(
    () => findActiveImageClip(imageClips, currentSec),
    [imageClips, currentSec]
  );

  const transitionMsSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intensitySaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captionScaleSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captionAppearanceSaveRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const pendingCaptionAppearanceRef = useRef<
    Partial<
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
  >({});

  const captionCues = useMemo(
    () => buildCaptionCues(transcription),
    [transcription]
  );

  const persistTransitionMs = useCallback(
    (ms: number) => {
      setSettings((prev) => ({ ...prev, transitionMs: ms }));
      if (transitionMsSaveRef.current) clearTimeout(transitionMsSaveRef.current);
      transitionMsSaveRef.current = setTimeout(() => {
        startSaveSettings(async () => {
          const result = await saveEditorSettings({ projectId, settings: { transitionMs: ms } });
          if (!result.ok) {
            toast.error(result.error);
            setSettings({ ...DEFAULT_EDITOR_SETTINGS, ...initialSettings });
          }
        });
      }, 400);
    },
    [projectId, initialSettings]
  );

  const persistImageMotionIntensity = useCallback(
    (imageMotionIntensity: number) => {
      setSettings((prev) => ({ ...prev, imageMotionIntensity }));
      if (intensitySaveRef.current) clearTimeout(intensitySaveRef.current);
      intensitySaveRef.current = setTimeout(() => {
        startSaveSettings(async () => {
          const result = await saveEditorSettings({
            projectId,
            settings: { imageMotionIntensity },
          });
          if (!result.ok) {
            toast.error(result.error);
            setSettings({ ...DEFAULT_EDITOR_SETTINGS, ...initialSettings });
          }
        });
      }, 400);
    },
    [projectId, initialSettings]
  );

  const persistCaptionScale = useCallback(
    (captionScale: number) => {
      setSettings((prev) => ({ ...prev, captionScale }));
      if (captionScaleSaveRef.current) clearTimeout(captionScaleSaveRef.current);
      captionScaleSaveRef.current = setTimeout(() => {
        startSaveSettings(async () => {
          const result = await saveEditorSettings({
            projectId,
            settings: { captionScale },
          });
          if (!result.ok) {
            toast.error(result.error);
            setSettings({ ...DEFAULT_EDITOR_SETTINGS, ...initialSettings });
          }
        });
      }, 400);
    },
    [projectId, initialSettings]
  );

  const persistCaptionAppearance = useCallback(
    (
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
    ) => {
      setSettings((prev) => ({ ...prev, ...patch }));
      pendingCaptionAppearanceRef.current = {
        ...pendingCaptionAppearanceRef.current,
        ...patch,
      };
      if (captionAppearanceSaveRef.current) {
        clearTimeout(captionAppearanceSaveRef.current);
      }
      captionAppearanceSaveRef.current = setTimeout(() => {
        const toSave = pendingCaptionAppearanceRef.current;
        pendingCaptionAppearanceRef.current = {};
        startSaveSettings(async () => {
          const result = await saveEditorSettings({
            projectId,
            settings: toSave,
          });
          if (!result.ok) {
            toast.error(result.error);
            setSettings({ ...DEFAULT_EDITOR_SETTINGS, ...initialSettings });
          }
        });
      }, 400);
    },
    [projectId, initialSettings]
  );

  useEffect(() => {
    return () => {
      if (transitionMsSaveRef.current) clearTimeout(transitionMsSaveRef.current);
      if (intensitySaveRef.current) clearTimeout(intensitySaveRef.current);
      if (captionScaleSaveRef.current) clearTimeout(captionScaleSaveRef.current);
      if (captionAppearanceSaveRef.current) {
        clearTimeout(captionAppearanceSaveRef.current);
      }
    };
  }, []);

  // Mede duração real do MP3 de narração.
  useEffect(() => {
    if (!audioUrl) {
      setAudioDurationSec(null);
      setAudioLoadFailed(false);
      setDurationReady(true);
      return;
    }
    let cancelled = false;
    setDurationReady(false);
    setAudioLoadFailed(false);
    const audio = new Audio();
    audio.preload = "metadata";
    const done = (d: number) => {
      if (cancelled) return;
      if (Number.isFinite(d) && d > 0) setAudioDurationSec(d);
      setDurationReady(true);
    };
    audio.addEventListener("loadedmetadata", () => done(audio.duration));
    audio.addEventListener("durationchange", () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) done(audio.duration);
    });
    audio.addEventListener("error", () => {
      if (cancelled) return;
      setAudioLoadFailed(true);
      setDurationReady(true);
    });
    audio.src = audioUrl;
    return () => {
      cancelled = true;
      audio.removeAttribute("src");
      audio.load();
    };
  }, [audioUrl]);

  useEffect(() => {
    setEditorState(
      buildEditorStateFromAssets({
        brolls,
        audioUrl,
        audioDurationSec,
        transcriptionDurationSec,
        aspectRatio,
      })
    );
  }, [brolls, audioUrl, audioDurationSec, transcriptionDurationSec, aspectRatio]);

  // Sync volume da música
  useEffect(() => {
    if (musicRef.current) {
      musicRef.current.volume = Math.min(1, Math.max(0, settings.musicVolume));
    }
  }, [settings.musicVolume]);

  // Relógio + sync BGM com a narração
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const a = audioRef.current;
      const m = musicRef.current;
      if (a && Number.isFinite(a.currentTime)) {
        setCurrentSec(a.currentTime);
        const isPlaying = !a.paused && !a.ended;
        setPlaying(isPlaying);
        if (m && settings.musicUrl) {
          const drift = Math.abs(m.currentTime - a.currentTime);
          if (drift > 0.35) m.currentTime = a.currentTime;
          if (isPlaying && m.paused) void m.play().catch(() => undefined);
          if (!isPlaying && !m.paused) m.pause();
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [settings.musicUrl]);

  const durationSec = Math.max(
    editorState.durationSec,
    audioDurationSec ?? 0,
    0.1
  );

  const persistSettings = useCallback(
    (patch: Partial<EditorSettings>) => {
      const next = { ...settings, ...patch };
      setSettings(next);
      startSaveSettings(async () => {
        const result = await saveEditorSettings({ projectId, settings: patch });
        if (!result.ok) {
          toast.error(result.error);
          setSettings({ ...DEFAULT_EDITOR_SETTINGS, ...initialSettings });
        }
      });
    },
    [settings, projectId, initialSettings]
  );

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      void a.play().catch(() => {
        toast.error("Não foi possível reproduzir o áudio de narração");
      });
      if (musicRef.current && settings.musicUrl) {
        musicRef.current.currentTime = a.currentTime;
        void musicRef.current.play().catch(() => undefined);
      }
    } else {
      a.pause();
      musicRef.current?.pause();
    }
  }, [settings.musicUrl]);

  const seekToSec = useCallback(
    (sec: number) => {
      const a = audioRef.current;
      const next = Math.min(durationSec, Math.max(0, sec));
      if (a) a.currentTime = next;
      if (musicRef.current) musicRef.current.currentTime = next;
      setCurrentSec(next);
    },
    [durationSec]
  );

  const stepSec = useCallback(
    (delta: number) => seekToSec(currentSec + delta),
    [currentSec, seekToSec]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        stepSec(e.shiftKey ? -1 : -1 / 30);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        stepSec(e.shiftKey ? 1 : 1 / 30);
      } else if (e.code === "Home") {
        e.preventDefault();
        seekToSec(0);
      } else if (e.code === "End") {
        e.preventDefault();
        seekToSec(durationSec);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, stepSec, seekToSec, durationSec]);

  function handleMusicUpload(file: File | null) {
    if (!file) return;
    startUploadMusic(async () => {
      const formData = new FormData();
      formData.set("file", file);
      try {
        const res = await fetch(`/api/projects/${projectId}/music/upload`, {
          method: "POST",
          body: formData,
        });
        const result = (await res.json()) as
          | { ok: true; data: { musicUrl: string; settings: EditorSettings } }
          | { ok: false; error: string };
        if (result.ok) {
          setSettings(result.data.settings);
          toast.success("Música de fundo adicionada");
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error("Falha no upload da música");
      }
      if (musicInputRef.current) musicInputRef.current.value = "";
    });
  }

  function handleClearMusic() {
    startClearMusic(async () => {
      musicRef.current?.pause();
      const result = await clearEditorMusic({ projectId });
      if (result.ok) {
        setSettings(result.data.settings);
        toast.success("Música removida");
      } else {
        toast.error(result.error);
      }
    });
  }

  const previewFrameStyle = editorPreviewFrameStyle(resolvedAspect);
  const previewControlsMaxWidth = editorPreviewControlsMaxWidth(resolvedAspect);

  if (!brolls?.brolls.length) {
    return (
      <EmptyState
        title="Cenas necessárias"
        description="Gere as cenas (b-rolls) antes de abrir o editor."
        href={`/projects/${projectId}/static/scenes`}
        cta="Ir para Cenas"
      />
    );
  }

  if (audioMissingOnDisk || audioLoadFailed) {
    return (
      <EmptyState
        title="Arquivo de narração ausente"
        description="O MP3 registrado no projeto não foi encontrado (404). Envie o áudio novamente na etapa Narração."
        href={`/projects/${projectId}/static/narration`}
        cta="Ir para Narração"
      />
    );
  }

  if (!audioUrl) {
    return (
      <EmptyState
        title="Narração necessária"
        description="Faça o upload do áudio de narração para sincronizar o slideshow."
        href={`/projects/${projectId}/static/narration`}
        cta="Ir para Narração"
      />
    );
  }

  if (imageClips.length === 0) {
    return (
      <EmptyState
        title="Imagens necessárias"
        description={`Há ${totalBrolls} cenas, mas nenhuma imagem gerada ainda. Gere as imagens na etapa Cenas.`}
        href={`/projects/${projectId}/static/scenes`}
        cta="Ir para Cenas"
      />
    );
  }

  const transitionMs =
    settings.transition === "cut" ? 0 : settings.transitionMs;

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{imageCount} imagens</Badge>
            <Badge variant="outline" className="font-mono tabular-nums">
              {formatClock(durationSec)}
            </Badge>
            <Badge variant="outline" title={videoAspectPlatformLabel(resolvedAspect)}>
              {editorState.aspectRatio}
            </Badge>
            {settings.musicUrl ? (
              <Badge variant="secondary">
                <Music2 className="size-3" /> BGM
              </Badge>
            ) : null}
            {activeClip?.label ? (
              <Badge variant="secondary" className="max-w-[14rem] truncate">
                {activeClip.label}
              </Badge>
            ) : null}
            {isSavingSettings ? (
              <Badge variant="outline" className="gap-1">
                <Loader2 className="size-3 animate-spin" /> Salvando…
              </Badge>
            ) : null}
          </div>
          <p className="max-w-2xl text-xs text-muted-foreground">
            Space play/pause · ←/→ · Shift+←/→ 1s. Transição e música aplicam no preview.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/projects/${projectId}/static/scenes`}>
            <ArrowLeft className="size-4" /> Cenas
          </Link>
        </Button>
      </div>

      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={audioUrl} preload="auto" className="hidden" />
      {settings.musicUrl ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio
          ref={musicRef}
          src={settings.musicUrl}
          preload="auto"
          loop
          className="hidden"
        />
      ) : null}

      <div className="flex min-h-0 flex-col gap-4 lg:flex-row lg:items-start">
        <EditSettingsPanel
          settings={settings}
          busy={isUploadingMusic || isClearingMusic}
          musicInputRef={musicInputRef}
          hasTranscription={captionCues.length > 0}
          onTransitionChange={(transition) => {
            const patch: Partial<EditorSettings> = { transition };
            if (!transitionNeedsDuration(transition)) patch.transitionMs = 0;
            else if (settings.transitionMs < 100) patch.transitionMs = 350;
            persistSettings(patch);
          }}
          onTransitionMsChange={persistTransitionMs}
          onImageMotionChange={(imageMotion) => persistSettings({ imageMotion })}
          onImageMotionIntensityChange={persistImageMotionIntensity}
          onCaptionStyleChange={(captionStyle) =>
            persistSettings({ captionStyle })
          }
          onCaptionScaleChange={persistCaptionScale}
          onCaptionPositionChange={(captionPosition) =>
            persistSettings({ captionPosition })
          }
          onCaptionAppearanceChange={persistCaptionAppearance}
          onMusicVolumeChange={(musicVolume) => persistSettings({ musicVolume })}
          onMusicFile={(file) => handleMusicUpload(file)}
          onClearMusic={handleClearMusic}
        >
          <ExportVideoPanel
            projectId={projectId}
            initialState={
              initialExportState ?? {
                status: "idle",
                progress: 0,
                error: null,
                videoUrl: null,
                startedAt: null,
                finishedAt: null,
                pid: null,
              }
            }
          />
        </EditSettingsPanel>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-xl border bg-neutral-950/80 p-4">
            <div
              className="relative mx-auto overflow-hidden rounded-lg bg-black shadow-lg"
              style={previewFrameStyle}
              onClick={togglePlay}
            >
              {!durationReady ? (
                <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Clapperboard className="size-8 animate-pulse opacity-40" />
                  <p className="text-sm">Medindo duração do áudio…</p>
                </div>
              ) : (
                <AudioSyncedSlideshow
                  clips={imageClips}
                  activeId={activeClip?.id ?? null}
                  currentSec={currentSec}
                  transition={settings.transition}
                  transitionMs={transitionMs}
                  imageMotion={settings.imageMotion}
                  imageMotionIntensity={settings.imageMotionIntensity}
                  captionCues={captionCues}
                  captionStyle={settings.captionStyle}
                  captionScale={settings.captionScale}
                  captionPosition={settings.captionPosition}
                  captionAppearance={{
                    font: settings.captionFont,
                    color: settings.captionColor,
                    highlightColor: settings.captionHighlightColor,
                    bgColor: settings.captionBgColor,
                    bgOpacity: settings.captionBgOpacity,
                    uppercase: settings.captionUppercase,
                  }}
                />
              )}
            </div>

            <div
              className="mt-4 flex w-full flex-col gap-3 mx-auto"
              style={{ maxWidth: previewControlsMaxWidth }}
            >
              <div className="flex items-center justify-center gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => seekToSec(0)}
                  title="Início (Home)"
                >
                  <SkipBack className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => stepSec(-1 / 30)}
                  title="Frame anterior"
                >
                  <SkipBack className="size-3.5" />
                </Button>
                <Button type="button" size="lg" className="min-w-28" onClick={togglePlay}>
                  {playing ? (
                    <>
                      <Pause className="size-4" /> Pausar
                    </>
                  ) : (
                    <>
                      <Play className="size-4" /> Play
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => stepSec(1 / 30)}
                  title="Próximo frame"
                >
                  <SkipForward className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => seekToSec(durationSec)}
                  title="Fim (End)"
                >
                  <SkipForward className="size-4" />
                </Button>
                <span className="ml-2 font-mono text-sm tabular-nums text-muted-foreground">
                  {formatClock(currentSec)} / {formatClock(durationSec)}
                </span>
              </div>

              <input
                type="range"
                min={0}
                max={durationSec}
                step={0.01}
                value={Math.min(currentSec, durationSec)}
                onChange={(e) => seekToSec(Number(e.target.value))}
                className="w-full accent-primary"
                aria-label="Posição na timeline"
              />
            </div>
          </div>

          <ReadOnlyTimeline
            state={{ ...editorState, durationSec }}
            currentSec={currentSec}
            musicUrl={settings.musicUrl}
            onSeek={seekToSec}
          />
        </div>
      </div>
    </div>
  );
}

function transitionCss(ms: number, enabled: boolean): string {
  if (!enabled) return "none";
  return [
    `opacity ${ms}ms ease-in-out`,
    `transform ${ms}ms ease-in-out`,
    `clip-path ${ms}ms ease-in-out`,
  ].join(", ");
}

function enterFromStyle(t: EditorTransition): CSSProperties {
  switch (t) {
    case "slide-left":
      return { transform: "translateX(100%)", opacity: 1 };
    case "slide-right":
      return { transform: "translateX(-100%)", opacity: 1 };
    case "slide-up":
      return { transform: "translateY(100%)", opacity: 1 };
    case "zoom":
      return { transform: "scale(1.25)", opacity: 0 };
    case "wipe":
      return { transform: "none", opacity: 1, clipPath: "inset(0 100% 0 0)" };
    case "cut":
      return { transform: "none", opacity: 0 };
    default:
      return { transform: "none", opacity: 0 };
  }
}

function settleStyle(t: EditorTransition): CSSProperties {
  return {
    transform: "none",
    opacity: 1,
    ...(t === "wipe" ? { clipPath: "inset(0 0 0 0)" } : { clipPath: "none" }),
  };
}

function exitToStyle(t: EditorTransition): CSSProperties {
  switch (t) {
    case "slide-left":
      return { transform: "translateX(-100%)", opacity: 1 };
    case "slide-right":
      return { transform: "translateX(100%)", opacity: 1 };
    case "slide-up":
      return { transform: "translateY(-100%)", opacity: 1 };
    case "zoom":
      return { transform: "scale(0.85)", opacity: 0 };
    case "wipe":
      return { transform: "none", opacity: 1, clipPath: "inset(0 0 0 0)" };
    case "cut":
      return { transform: "none", opacity: 0 };
    default:
      return { transform: "none", opacity: 0 };
  }
}

/**
 * Empilha imagem atual + anterior com transição CSS animada.
 * A primeira cena aparece já “settled” (sem enter em opacity 0) para evitar
 * tela preta no Strict Mode do React, que cancela o rAF e reentra no effect.
 * Motion contínuo (Ken Burns) é dirigido pelo tempo do áudio dentro do clipe.
 */
function AudioSyncedSlideshow({
  clips,
  activeId,
  currentSec,
  transition,
  transitionMs,
  imageMotion,
  imageMotionIntensity,
  captionCues,
  captionStyle,
  captionScale,
  captionPosition,
  captionAppearance,
}: {
  clips: EditorClip[];
  activeId: string | null;
  currentSec: number;
  transition: EditorTransition;
  transitionMs: number;
  imageMotion: EditorImageMotion;
  imageMotionIntensity: number;
  captionCues: CaptionCue[];
  captionStyle: EditorCaptionStyle;
  captionScale: number;
  captionPosition: EditorCaptionPosition;
  captionAppearance: CaptionAppearance;
}) {
  const activeClip = clips.find((c) => c.id === activeId) ?? null;
  const activeIndex = activeClip
    ? clips.findIndex((c) => c.id === activeClip.id)
    : -1;
  /** `undefined` = ainda não hidratou o id ativo (primeira cena sem animação). */
  const lastActiveIdRef = useRef<string | null | undefined>(undefined);
  const clipByIdRef = useRef(clips);
  clipByIdRef.current = clips;
  const transitionRef = useRef(transition);
  const transitionMsRef = useRef(transitionMs);
  transitionRef.current = transition;
  transitionMsRef.current = transitionMs;

  const [outgoing, setOutgoing] = useState<EditorClip | null>(null);
  const [outgoingIndex, setOutgoingIndex] = useState(-1);
  const [entered, setEntered] = useState(true);
  const [flashOpacity, setFlashOpacity] = useState(0);

  // Só reanima quando a cena ativa muda — duração/tipo de transição atualizam o CSS ao vivo.
  useEffect(() => {
    const lastId = lastActiveIdRef.current;
    const currentTransition = transitionRef.current;
    const currentTransitionMs = transitionMsRef.current;

    // Primeira sincronização: mostra a cena atual sem animação de entrada.
    if (lastId === undefined) {
      lastActiveIdRef.current = activeId;
      setEntered(true);
      setOutgoing(null);
      setOutgoingIndex(-1);
      setFlashOpacity(0);
      return;
    }

    // Mesmo clipe (ou reentrada do Strict Mode após o ref já ter avançado).
    if (lastId === activeId) {
      return;
    }

    const prevClip =
      lastId != null
        ? (clipByIdRef.current.find((c) => c.id === lastId) ?? null)
        : null;
    const prevIndex =
      lastId != null
        ? clipByIdRef.current.findIndex((c) => c.id === lastId)
        : -1;
    lastActiveIdRef.current = activeId;
    setOutgoing(prevClip);
    setOutgoingIndex(prevIndex);
    setEntered(false);

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setEntered(true));
    });

    const clearOutgoing = window.setTimeout(
      () => {
        setOutgoing(null);
        setOutgoingIndex(-1);
      },
      Math.max(currentTransitionMs, 50) + 80
    );

    let flashTimer = 0;
    if (currentTransition === "fade-black" || currentTransition === "fade-white") {
      setFlashOpacity(1);
      const half = Math.max(60, Math.round(currentTransitionMs / 2));
      flashTimer = window.setTimeout(() => setFlashOpacity(0), half);
    } else {
      setFlashOpacity(0);
    }

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(clearOutgoing);
      if (flashTimer) window.clearTimeout(flashTimer);
      // Strict Mode cancela o rAF — garante que a imagem não fique em opacity 0.
      setEntered(true);
    };
  }, [activeId]);

  const animate = transitionNeedsDuration(transition);
  const css = transitionCss(transitionMs, animate);
  const activeCaption =
    captionStyle === "off"
      ? null
      : findActiveCaptionCue(captionCues, currentSec);

  return (
    <div className="relative size-full overflow-hidden bg-neutral-950">
      {outgoing ? (
        <MotionSlideLayer
          key={`out-${outgoing.id}`}
          clip={outgoing}
          clipIndex={Math.max(0, outgoingIndex)}
          currentSec={outgoing.startSec + outgoing.durationSec}
          transitionStyle={{
            zIndex: 1,
            transition: css,
            ...(entered ? exitToStyle(transition) : settleStyle(transition)),
          }}
          imageMotion={imageMotion}
          imageMotionIntensity={imageMotionIntensity}
        />
      ) : null}
      {activeClip ? (
        <MotionSlideLayer
          key={`in-${activeClip.id}`}
          clip={activeClip}
          clipIndex={Math.max(0, activeIndex)}
          currentSec={currentSec}
          transitionStyle={{
            zIndex: 2,
            transition: css,
            ...(entered
              ? settleStyle(transition)
              : enterFromStyle(transition)),
          }}
          imageMotion={imageMotion}
          imageMotionIntensity={imageMotionIntensity}
        />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <Clapperboard className="size-8 opacity-40" />
        </div>
      )}
      {transition === "fade-black" || transition === "fade-white" ? (
        <div
          className="pointer-events-none absolute inset-0 z-[3]"
          style={{
            backgroundColor: transition === "fade-black" ? "#000" : "#fff",
            opacity: flashOpacity,
            transition: `opacity ${Math.max(60, Math.round(transitionMs / 2))}ms ease-in-out`,
          }}
        />
      ) : null}
      <CaptionOverlay
        cue={activeCaption}
        currentSec={currentSec}
        captionStyle={captionStyle}
        captionScale={captionScale}
        captionPosition={captionPosition}
        appearance={captionAppearance}
      />
    </div>
  );
}

/** Outer = transição entre cenas; inner img = Ken Burns syncado ao áudio. */
function MotionSlideLayer({
  clip,
  clipIndex,
  currentSec,
  transitionStyle,
  imageMotion,
  imageMotionIntensity,
}: {
  clip: EditorClip;
  clipIndex: number;
  currentSec: number;
  transitionStyle: CSSProperties;
  imageMotion: EditorImageMotion;
  imageMotionIntensity: number;
}) {
  const progress =
    clip.durationSec > 0
      ? Math.min(
          1,
          Math.max(0, (currentSec - clip.startSec) / clip.durationSec)
        )
      : 0;
  const motion = computeImageMotion(
    progress,
    imageMotion,
    clipIndex,
    imageMotionIntensity
  );
  const transform = imageMotionCssTransform(motion);

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={transitionStyle}
    >
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img
        src={clip.src}
        decoding="async"
        draggable={false}
        className="absolute inset-0 size-full object-cover"
        style={{
          transform,
          transformOrigin: "center center",
          willChange: transform === "none" ? undefined : "transform",
        }}
      />
    </div>
  );
}

function EmptyState({
  title,
  description,
  href,
  cta,
}: {
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="rounded-xl border border-dashed bg-card/30 p-8 text-center">
      <CircleHelp className="mx-auto mb-3 size-8 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <Button asChild variant="outline" className="mt-4">
        <Link href={href}>
          <ArrowLeft className="size-4" /> {cta}
        </Link>
      </Button>
    </div>
  );
}

const TIMELINE_LABEL_CLASS = "w-14 shrink-0";
const TIMELINE_ROW_CLASS = "flex gap-2";

function ReadOnlyTimeline({
  state,
  currentSec,
  musicUrl,
  onSeek,
}: {
  state: EditorState;
  currentSec: number;
  musicUrl: string | null;
  onSeek: (sec: number) => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const duration = Math.max(0.1, state.durationSec);
  const playheadPct = Math.min(100, (currentSec / duration) * 100);
  const brollTrack = state.tracks.find((t) => t.id === "brolls");
  const narrationTrack = state.tracks.find((t) => t.id === "narration");

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const content = contentRef.current;
      if (!content) return;
      const rect = content.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      onSeek(pct * duration);
    },
    [duration, onSeek]
  );

  return (
    <div className="shrink-0 space-y-2 rounded-xl border bg-card/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          Timeline · narração + imagens{musicUrl ? " + música" : ""}
        </p>
        <span className="font-mono text-[10px] text-muted-foreground">
          {formatTimestamp(currentSec)}
        </span>
      </div>

      <div className="relative select-none space-y-1.5">
        <div className={TIMELINE_ROW_CLASS}>
          <span className={TIMELINE_LABEL_CLASS} aria-hidden />
          <div className="relative h-5 min-w-0 flex-1 border-b border-border/60">
            {(() => {
              const step = duration > 240 ? 30 : duration > 120 ? 15 : duration > 60 ? 10 : 5;
              const marks: number[] = [];
              for (let s = 0; s <= duration; s += step) marks.push(s);
              if (marks[marks.length - 1]! < duration - 0.5) marks.push(duration);
              return marks.map((sec) => (
                <span
                  key={sec}
                  className="absolute top-0 -translate-x-1/2 font-mono text-[9px] text-muted-foreground"
                  style={{ left: `${(sec / duration) * 100}%` }}
                >
                  {formatTimestamp(sec)}
                </span>
              ));
            })()}
          </div>
        </div>

        <TrackRow label="Áudio">
          {(narrationTrack?.clips ?? []).map((clip) => (
            <div
              key={clip.id}
              className="absolute top-1 bottom-1 rounded-md bg-emerald-600/70"
              style={{
                left: `${(clip.startSec / duration) * 100}%`,
                width: `${(clip.durationSec / duration) * 100}%`,
              }}
              title={clip.label ?? "Narração"}
            />
          ))}
        </TrackRow>

        {musicUrl ? (
          <TrackRow label="Música">
            <div
              className="absolute top-1 bottom-1 rounded-md bg-violet-600/70"
              style={{ left: "0%", width: "100%" }}
              title="Música de fundo"
            />
          </TrackRow>
        ) : null}

        <TrackRow label="Imagens">
          {(brollTrack?.clips ?? []).map((clip, index) => (
            <div
              key={clip.id}
              className={cn(
                "absolute top-1 bottom-1 overflow-hidden rounded-md border border-white/10",
                index % 2 === 0 ? "bg-sky-600/80" : "bg-indigo-600/80"
              )}
              style={{
                left: `${(clip.startSec / duration) * 100}%`,
                width: `${Math.max(0.35, (clip.durationSec / duration) * 100)}%`,
              }}
              title={`${clip.label ?? clip.id} · ${formatTimestamp(clip.startSec)}–${formatTimestamp(clip.startSec + clip.durationSec)}`}
            >
              <span className="block truncate px-1.5 pt-1 text-[10px] font-medium text-white/90">
                {clip.label ?? `#${clip.brollId ?? ""}`}
              </span>
            </div>
          ))}
        </TrackRow>

        <div className={cn("pointer-events-none absolute inset-y-0 left-0 right-0", TIMELINE_ROW_CLASS)}>
          <span className={TIMELINE_LABEL_CLASS} aria-hidden />
          <div ref={contentRef} className="relative min-w-0 flex-1">
            <div
              className="absolute inset-y-0 z-10 w-px bg-red-500"
              style={{ left: `${playheadPct}%` }}
            >
              <div className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-red-500" />
            </div>
            <button
              type="button"
              className="absolute inset-0 z-[5] cursor-pointer border-0 bg-transparent p-0 pointer-events-auto"
              aria-label="Buscar posição na timeline"
              onClick={(e) => seekFromClientX(e.clientX)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function TrackRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={TIMELINE_ROW_CLASS}>
      <span
        className={cn(
          TIMELINE_LABEL_CLASS,
          "self-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
        )}
      >
        {label}
      </span>
      <div className="relative h-10 min-w-0 flex-1 rounded-md bg-muted/40">{children}</div>
    </div>
  );
}
