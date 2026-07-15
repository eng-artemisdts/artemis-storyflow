"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
} from "react";
import {
  MediaControlBar,
  MediaController,
  MediaMuteButton,
  MediaPlayButton,
  MediaPlaybackRateButton,
  MediaTimeDisplay,
  MediaTimeRange,
  MediaVolumeRange,
} from "media-chrome/react";
import { cn } from "@/lib/utils";

const PLAYER_VARS = {
  "--media-primary-color": "hsl(var(--foreground))",
  "--media-secondary-color": "hsl(var(--card))",
  "--media-control-background": "transparent",
  "--media-control-hover-background": "hsl(var(--accent))",
  "--media-range-bar-color": "hsl(var(--primary))",
  "--media-range-track-color": "hsl(var(--muted))",
  "--media-range-thumb-background": "hsl(var(--primary))",
  "--media-icon-color": "hsl(var(--foreground))",
  "--media-text-color": "hsl(var(--foreground))",
  "--media-font-family": "inherit",
  "--media-tooltip-display": "none",
  "--media-button-icon-width": "1.1rem",
  "--media-button-icon-height": "1.1rem",
} as CSSProperties;

export type AudioPlayerHandle = {
  seek: (seconds: number) => void;
  play: () => void;
  pause: () => void;
  getCurrentTime: () => number;
};

/**
 * Player de áudio customizado (media-chrome), alinhado ao VideoPlayer.
 */
export const AudioPlayer = forwardRef<
  AudioPlayerHandle,
  {
    src: string;
    className?: string;
    onTimeUpdate?: (currentTime: number) => void;
  }
>(function AudioPlayer({ src, className, onTimeUpdate }, ref) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useImperativeHandle(ref, () => ({
    seek(seconds: number) {
      const el = audioRef.current;
      if (!el) return;
      el.currentTime = Math.max(0, seconds);
      void el.play();
    },
    play() {
      void audioRef.current?.play();
    },
    pause() {
      audioRef.current?.pause();
    },
    getCurrentTime() {
      return audioRef.current?.currentTime ?? 0;
    },
  }));

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !onTimeUpdate) return;
    const handler = () => onTimeUpdate(el.currentTime);
    el.addEventListener("timeupdate", handler);
    el.addEventListener("seeked", handler);
    return () => {
      el.removeEventListener("timeupdate", handler);
      el.removeEventListener("seeked", handler);
    };
  }, [onTimeUpdate]);

  return (
    <MediaController
      audio
      className={cn(
        "storyflow-audio-player flex w-full min-w-0 overflow-hidden rounded-xl border bg-card/60",
        className
      )}
      style={PLAYER_VARS}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} slot="media" src={src} preload="metadata" />
      <MediaControlBar className="flex w-full min-w-0 items-center gap-0.5 px-2 py-1.5">
        <MediaPlayButton className="size-9 shrink-0 rounded-md" />
        <MediaTimeDisplay className="shrink-0 px-1 font-mono text-[11px] tabular-nums text-muted-foreground" />
        <MediaTimeRange className="mx-1 h-5 min-w-0 flex-1" />
        <MediaTimeDisplay
          showDuration
          remaining
          className="hidden shrink-0 px-1 font-mono text-[11px] tabular-nums text-muted-foreground sm:inline"
        />
        <MediaMuteButton className="size-8 shrink-0 rounded-md" />
        <MediaVolumeRange className="hidden h-5 w-16 sm:block" />
        <MediaPlaybackRateButton className="hidden shrink-0 rounded-md px-1.5 text-[11px] sm:inline-flex" />
      </MediaControlBar>
    </MediaController>
  );
});
