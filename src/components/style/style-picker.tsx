"use client";

import { useState, useTransition } from "react";
import { Ban, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveProjectStyle } from "@/actions/project.actions";
import { STYLE_PRESETS } from "@/lib/style-presets";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function StylePicker({
  projectId,
  currentStyleId,
}: {
  projectId: string;
  currentStyleId: string | null;
}) {
  const [selected, setSelected] = useState<string | null>(currentStyleId);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleSelect(styleId: string | null) {
    if (styleId === selected) return;
    const previous = selected;
    setSelected(styleId);
    setSavingId(styleId ?? "none");
    startTransition(async () => {
      const result = await saveProjectStyle({ projectId, styleId });
      setSavingId(null);
      if (result.ok) {
        const label = styleId
          ? STYLE_PRESETS.find((p) => p.id === styleId)?.label
          : "Sem estilo";
        toast.success(`Estilo definido: ${label}`);
      } else {
        setSelected(previous);
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* Opção "sem estilo" */}
      <button
        type="button"
        onClick={() => handleSelect(null)}
        className={cn(
          "group relative flex flex-col items-start gap-2 rounded-xl border bg-card p-5 text-left transition-colors hover:border-primary/50",
          selected === null && "border-primary ring-2 ring-primary/30"
        )}
      >
        <SelectionBadge active={selected === null} saving={savingId === "none"} />
        <span className="text-3xl leading-none">
          <Ban className="size-7 text-muted-foreground" />
        </span>
        <span className="font-medium">Sem estilo</span>
        <span className="text-sm text-muted-foreground">
          Usa os prompts exatamente como saíram da análise do roteiro, sem nenhuma
          estilização extra.
        </span>
      </button>

      {STYLE_PRESETS.map((preset) => {
        const isActive = selected === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => handleSelect(preset.id)}
            className={cn(
              "group relative flex flex-col items-start gap-2 rounded-xl border bg-card p-5 text-left transition-colors hover:border-primary/50",
              isActive && "border-primary ring-2 ring-primary/30"
            )}
          >
            <SelectionBadge active={isActive} saving={savingId === preset.id} />
            <span className="text-3xl leading-none">{preset.icon}</span>
            <span className="font-medium">{preset.label}</span>
            <span className="text-sm text-muted-foreground">{preset.description}</span>
          </button>
        );
      })}
    </div>
  );
}

function SelectionBadge({ active, saving }: { active: boolean; saving: boolean }) {
  if (saving) {
    return (
      <Badge className="absolute right-3 top-3 gap-1" variant="secondary">
        <Loader2 className="size-3 animate-spin" /> salvando
      </Badge>
    );
  }
  if (active) {
    return (
      <Badge className="absolute right-3 top-3 gap-1">
        <Check className="size-3" /> selecionado
      </Badge>
    );
  }
  return null;
}
