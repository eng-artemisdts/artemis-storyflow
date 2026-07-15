"use client";

import type { CSSProperties } from "react";
import {
  MediaControlBar,
  MediaController,
  MediaFullscreenButton,
  MediaMuteButton,
  MediaPlayButton,
  MediaPlaybackRateButton,
  MediaTimeDisplay,
  MediaTimeRange,
  MediaVolumeRange,
} from "media-chrome/react";
import { cn } from "@/lib/utils";

const PLAYER_VARS = {
  "--media-primary-color": "#f5f5f5",
  "--media-secondary-color": "rgba(23,23,23,0.9)",
  "--media-control-background": "transparent",
  "--media-control-hover-background": "rgba(255,255,255,0.12)",
  "--media-range-bar-color": "#e5e5e5",
  "--media-range-track-color": "rgba(255,255,255,0.2)",
  "--media-range-thumb-background": "#fff",
  "--media-font-family": "inherit",
  "--media-tooltip-display": "none",
} as CSSProperties;

/**
 * Player customizado com media-chrome (Mux).
 * `compact` reduz a barra (whiteboard); modo padrão para a Timeline.
 */
export function VideoPlayer({
  src,
  poster,
  className,
  compact = false,
  autoPlay = false,
  loop = false,
  muted = false,
}: {
  src: string;
  poster?: string | null;
  className?: string;
  compact?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
}) {
  return (
    <MediaController
      className={cn(
        "storyflow-player group relative block size-full overflow-hidden bg-neutral-950",
        className
      )}
      style={PLAYER_VARS}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        slot="media"
        src={src}
        poster={poster ?? undefined}
        playsInline
        preload="metadata"
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        className="size-full object-contain"
      />

      <MediaPlayButton
        className={cn(
          "storyflow-center-play absolute left-1/2 top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-black/55 text-white shadow-xl backdrop-blur-md transition hover:bg-black/70",
          compact ? "size-10" : "size-14"
        )}
      />

      <MediaControlBar
        className={cn(
          "absolute inset-x-0 bottom-0 z-[2] flex w-full items-center gap-0.5 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-1.5 pt-10",
          compact ? "pb-1" : "pb-1.5"
        )}
      >
        <MediaPlayButton className={cn("rounded-md text-white", compact ? "size-7" : "size-8")} />
        <MediaTimeRange className="mx-1 h-5 min-w-0 flex-1" />
        {!compact && (
          <MediaTimeDisplay showDuration className="px-1 text-[11px] tabular-nums text-white/90" />
        )}
        <MediaMuteButton className={cn("rounded-md text-white", compact ? "size-7" : "size-8")} />
        {!compact && <MediaVolumeRange className="hidden h-5 w-16 sm:block" />}
        {!compact && (
          <MediaPlaybackRateButton className="hidden rounded-md px-1.5 text-[11px] text-white sm:inline-flex" />
        )}
        {!compact && <MediaFullscreenButton className="size-8 rounded-md text-white" />}
      </MediaControlBar>
    </MediaController>
  );
}
