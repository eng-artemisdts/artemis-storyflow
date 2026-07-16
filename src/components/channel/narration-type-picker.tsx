"use client";

import { Eye, Mic2, UserRound, type LucideIcon } from "lucide-react";
import {
  NARRATION_TYPE_PRESETS,
  type NarrationTypeId,
} from "@/lib/narrative/narration-types";
import { cn } from "@/lib/utils";

const ICONS: Record<NarrationTypeId, LucideIcon> = {
  "second-person": UserRound,
  "first-person": Mic2,
  "third-person": Eye,
};

export function NarrationTypePicker({
  value,
  onChange,
  className,
}: {
  value: NarrationTypeId;
  onChange: (next: NarrationTypeId) => void;
  className?: string;
}) {
  return (
    <div
      className={cn("grid gap-3 sm:grid-cols-3", className)}
      role="radiogroup"
      aria-label="Tipo de narração"
    >
      {NARRATION_TYPE_PRESETS.map((option) => {
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
              "group flex flex-col items-center gap-3 rounded-xl border px-3 py-4 text-center transition-all",
              "hover:border-primary/50 hover:bg-muted/40",
              selected
                ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                : "border-border bg-card/40"
            )}
          >
            <div
              className={cn(
                "flex size-12 items-center justify-center rounded-xl transition-colors",
                selected
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
              )}
            >
              <Icon className="size-5" strokeWidth={1.75} />
            </div>
            <div className="space-y-0.5">
              <span className="text-sm font-medium">{option.label}</span>
              <p className="text-xs leading-relaxed text-muted-foreground">{option.hint}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
