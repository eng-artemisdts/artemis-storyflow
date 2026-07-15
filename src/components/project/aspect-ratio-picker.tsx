"use client";

import { MonitorPlay, Smartphone } from "lucide-react";
import {
  VIDEO_ASPECT_OPTIONS,
  type VideoAspectRatio,
} from "@/lib/video-aspect";
import { cn } from "@/lib/utils";

function FrameGlyph({ ratio }: { ratio: VideoAspectRatio }) {
  const landscape = ratio === "16:9";
  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-md bg-gradient-to-br from-neutral-800 to-neutral-950 shadow-inner ring-1 ring-white/10",
        landscape ? "h-14 w-24" : "h-24 w-14"
      )}
      aria-hidden
    >
      <div
        className={cn(
          "absolute inset-[18%] rounded-[2px] bg-gradient-to-br from-sky-400/25 via-violet-400/15 to-fuchsia-400/20",
          "ring-1 ring-white/15"
        )}
      />
      <div className="absolute inset-x-[30%] top-[10%] h-px bg-white/20" />
      {landscape ? (
        <MonitorPlay className="relative size-5 text-sky-200/90" strokeWidth={1.75} />
      ) : (
        <Smartphone className="relative size-5 text-fuchsia-200/90" strokeWidth={1.75} />
      )}
    </div>
  );
}

export function AspectRatioPicker({
  value,
  onChange,
  className,
}: {
  value: VideoAspectRatio;
  onChange: (next: VideoAspectRatio) => void;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-3", className)} role="radiogroup" aria-label="Formato do vídeo">
      {VIDEO_ASPECT_OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "group flex flex-col items-center gap-3 rounded-xl border px-3 py-4 text-center transition-all",
              "hover:border-primary/50 hover:bg-muted/40",
              selected
                ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                : "border-border bg-card/40"
            )}
          >
            <FrameGlyph ratio={option.value} />
            <div className="space-y-0.5">
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-sm font-medium">{option.label}</span>
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 font-mono text-[10px] tracking-tight",
                    selected
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {option.value}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{option.hint}</p>
              <p className="text-[11px] text-muted-foreground/80">{option.platforms}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
