"use client";

import {
  BookOpen,
  Clapperboard,
  GitCompare,
  GraduationCap,
  ListOrdered,
  Sparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import {
  CHANNEL_TYPE_PRESETS,
  type ChannelTypeId,
} from "@/lib/narrative/channel-types";
import { cn } from "@/lib/utils";

const ICONS: Record<ChannelTypeId, LucideIcon> = {
  "narrative-story": Clapperboard,
  documentary: BookOpen,
  listicle: ListOrdered,
  explainer: GraduationCap,
  "case-study": BookOpen,
  comparison: GitCompare,
  tutorial: Wrench,
  custom: Sparkles,
};

export function ChannelTypePicker({
  value,
  onChange,
  className,
}: {
  value: ChannelTypeId;
  onChange: (next: ChannelTypeId) => void;
  className?: string;
}) {
  return (
    <div
      className={cn("grid grid-cols-2 gap-3 sm:grid-cols-4", className)}
      role="radiogroup"
      aria-label="Tipo de canal"
    >
      {CHANNEL_TYPE_PRESETS.map((option) => {
        const selected = value === option.id;
        const Icon = ICONS[option.id];
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.id)}
            className={cn(
              "group flex flex-col items-start gap-2 rounded-xl border px-3 py-3 text-left transition-all",
              "hover:border-primary/50 hover:bg-muted/40",
              selected
                ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                : "border-border bg-card/40"
            )}
          >
            <div
              className={cn(
                "flex size-9 items-center justify-center rounded-lg transition-colors",
                selected
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
              )}
            >
              <Icon className="size-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 space-y-0.5">
              <span className="text-sm font-medium leading-tight">{option.label}</span>
              <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                {option.hint}
              </p>
              <p className="text-[10px] text-muted-foreground/70">{option.reference}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
