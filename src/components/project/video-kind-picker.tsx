"use client";

import { Clapperboard, Images } from "lucide-react";
import type { VideoKind } from "@/lib/video-kind";
import { cn } from "@/lib/utils";

const OPTIONS: Array<{
  value: VideoKind;
  label: string;
  hint: string;
  detail: string;
  icon: typeof Clapperboard;
}> = [
  {
    value: "motion",
    label: "Motion",
    hint: "Vídeo com cenas animadas",
    detail: "Roteiro → estilo → assets → geração",
    icon: Clapperboard,
  },
  {
    value: "static",
    label: "Static",
    hint: "Imagens estáticas / slideshow",
    detail: "Fluxo próprio — em breve",
    icon: Images,
  },
];

export function VideoKindPicker({
  value,
  onChange,
  className,
}: {
  value: VideoKind | null;
  onChange: (next: VideoKind) => void;
  className?: string;
}) {
  return (
    <div
      className={cn("grid grid-cols-2 gap-3", className)}
      role="radiogroup"
      aria-label="Tipo de vídeo"
    >
      {OPTIONS.map((option) => {
        const selected = value === option.value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "aspect-square flex flex-col items-center justify-center gap-3 rounded-xl border p-4 text-center transition-all",
              "hover:border-primary/50 hover:bg-muted/40",
              selected
                ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                : "border-border bg-card/40"
            )}
          >
            <div
              className={cn(
                "flex size-14 items-center justify-center rounded-2xl",
                selected
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Icon className="size-7" strokeWidth={1.75} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold tracking-tight">{option.label}</p>
              <p className="text-xs leading-snug text-muted-foreground">{option.hint}</p>
              <p className="text-[11px] text-muted-foreground/75">{option.detail}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
