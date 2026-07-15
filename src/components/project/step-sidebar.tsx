"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Palette,
  Sparkles,
  LayoutDashboard,
  Video,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StepProgress {
  script: boolean;
  style: boolean;
  assets: boolean;
  whiteboard: boolean;
  generation: boolean;
}

const steps = [
  { key: "script", label: "Roteiro", href: "script", icon: FileText },
  { key: "style", label: "Estilo Visual", href: "style", icon: Palette },
  { key: "assets", label: "Análise & Assets", href: "assets", icon: Sparkles },
  { key: "whiteboard", label: "Whiteboard", href: "whiteboard", icon: LayoutDashboard },
  { key: "generation", label: "Geração de Vídeo", href: "generation", icon: Video },
] as const;

export function StepSidebar({
  projectId,
  progress,
}: {
  projectId: string;
  progress: StepProgress;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r bg-card/30">
      <nav className="flex flex-col gap-1 p-3">
        {steps.map((step, index) => {
          const href = `/projects/${projectId}/${step.href}`;
          const active = pathname.startsWith(href);
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
      <div className="mt-auto p-4 text-xs text-muted-foreground">
        Roteiro → Estilo → Assets → Whiteboard → Vídeo
      </div>
    </aside>
  );
}
