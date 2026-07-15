"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Palette,
  Mic,
  Captions,
  Clapperboard,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  { key: "script", label: "Roteiro", href: "", icon: FileText },
  { key: "style", label: "Estilo", href: "/style", icon: Palette },
  { key: "narration", label: "Narração", href: "/narration", icon: Mic },
  { key: "transcription", label: "Transcrição", href: "/transcription", icon: Captions },
  { key: "scenes", label: "Cenas", href: "/scenes", icon: Clapperboard },
] as const;

export function StaticStepSidebar({
  projectId,
  hasScript,
  hasStyle,
  hasAudio,
  hasTranscription,
  hasBrolls,
}: {
  projectId: string;
  hasScript: boolean;
  hasStyle: boolean;
  hasAudio: boolean;
  hasTranscription: boolean;
  hasBrolls: boolean;
}) {
  const pathname = usePathname();
  const base = `/projects/${projectId}/static`;
  const progress = {
    script: hasScript,
    style: hasStyle,
    narration: hasAudio,
    transcription: hasTranscription,
    scenes: hasBrolls,
  };

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r bg-card/30">
      <nav className="flex flex-col gap-1 p-3">
        {steps.map((step, index) => {
          const href = `${base}${step.href}`;
          const active =
            step.key === "script"
              ? pathname === base || pathname === `${base}/`
              : pathname.startsWith(href);
          const done = progress[step.key];
          const Icon = step.icon;

          return (
            <Link
              key={step.key}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <span className="flex size-6 items-center justify-center rounded-full border text-[11px] font-medium">
                {index + 1}
              </span>
              <Icon className="size-4" />
              <span className="flex-1">{step.label}</span>
              {done ? (
                <CheckCircle2 className="size-4 text-emerald-500" />
              ) : (
                <Circle className="size-3.5 opacity-30" />
              )}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-1 p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground/80">Fluxo static</p>
        <p>Roteiro → Estilo → Narração → Transcrição → Cenas</p>
      </div>
    </aside>
  );
}
