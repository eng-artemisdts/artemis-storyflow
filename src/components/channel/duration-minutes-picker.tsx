"use client";

import { useMemo, useState } from "react";
import { Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatDurationMinutes } from "@/lib/duration-presets";
import {
  CHANNEL_DURATION_PRESETS,
  deriveScriptLengthFromDuration,
  NARRATIVE_WORDS_PER_MINUTE,
} from "@/lib/narrative/script-length";

export function DurationMinutesPicker({
  value,
  onChange,
  label = "Duração média dos vídeos",
  hint,
  showScriptPreview = false,
}: {
  value: number;
  onChange: (minutes: number) => void;
  label?: string;
  hint?: string;
  showScriptPreview?: boolean;
}) {
  const [customMode, setCustomMode] = useState(
    () => !CHANNEL_DURATION_PRESETS.includes(value as (typeof CHANNEL_DURATION_PRESETS)[number])
  );
  const [customMinutes, setCustomMinutes] = useState(String(value));

  const preview = useMemo(
    () => (showScriptPreview ? deriveScriptLengthFromDuration(value) : null),
    [showScriptPreview, value]
  );

  return (
    <div className="space-y-3">
      {(label || hint) && (
        <div className="space-y-1">
          {label ? <Label>{label}</Label> : null}
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {CHANNEL_DURATION_PRESETS.map((min) => (
          <button
            key={min}
            type="button"
            onClick={() => {
              setCustomMode(false);
              onChange(min);
              setCustomMinutes(String(min));
            }}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-sm font-medium transition-colors hover:border-primary/50",
              !customMode && value === min && "border-primary bg-primary/5 ring-2 ring-primary/30"
            )}
          >
            <Clock className="size-3.5 text-muted-foreground" />
            {formatDurationMinutes(min)}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setCustomMode(true)}
          className={cn(
            "rounded-xl border px-3 py-2.5 text-sm transition-colors hover:border-primary/50",
            customMode && "border-primary bg-primary/5 ring-2 ring-primary/30"
          )}
        >
          Outra duração
        </button>
        {customMode && (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={120}
              inputMode="numeric"
              value={customMinutes}
              onChange={(e) => {
                setCustomMinutes(e.target.value);
                const parsed = Number.parseInt(e.target.value, 10);
                if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 120) {
                  onChange(parsed);
                }
              }}
              className="h-11 w-28"
            />
            <span className="text-sm text-muted-foreground">minutos</span>
          </div>
        )}
      </div>

      {preview && (
        <p className="rounded-xl border border-dashed bg-muted/30 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          Roteiro estimado: ~{preview.wordTarget.toLocaleString("pt-BR")} palavras (
          {preview.wordMin}–{preview.wordMax}), {preview.scenesMin}–{preview.scenesMax} cenas
          · ~{NARRATIVE_WORDS_PER_MINUTE} palavras/min
        </p>
      )}
    </div>
  );
}
