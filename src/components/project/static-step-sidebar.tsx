"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Palette,
  Mic,
  Captions,
  Clapperboard,
  Film,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProjectSidebarCollapsed } from "@/hooks/use-project-sidebar-collapsed";

const steps = [
  {
    key: "script",
    label: "Roteiro",
    hint: "Texto narrativo",
    href: "",
    icon: FileText,
  },
  {
    key: "style",
    label: "Estilo",
    hint: "Visual das cenas",
    href: "/style",
    icon: Palette,
  },
  {
    key: "narration",
    label: "Narração",
    hint: "Áudio da voz",
    href: "/narration",
    icon: Mic,
  },
  {
    key: "transcription",
    label: "Transcrição",
    hint: "Timestamps",
    href: "/transcription",
    icon: Captions,
  },
  {
    key: "scenes",
    label: "Cenas",
    hint: "B-rolls e imagens",
    href: "/scenes",
    icon: Clapperboard,
  },
  {
    key: "edit",
    label: "Edição",
    hint: "Montagem final",
    href: "/edit",
    icon: Film,
  },
] as const;

export function StaticStepSidebar({
  projectId,
  hasScript,
  hasStyle,
  hasAudio,
  hasTranscription,
  hasBrolls,
  hasEditorReady,
}: {
  projectId: string;
  hasScript: boolean;
  hasStyle: boolean;
  hasAudio: boolean;
  hasTranscription: boolean;
  hasBrolls: boolean;
  hasEditorReady: boolean;
}) {
  const pathname = usePathname();
  const { collapsed, toggle, hydrated } = useProjectSidebarCollapsed();
  const base = `/projects/${projectId}/static`;
  const progress = {
    script: hasScript,
    style: hasStyle,
    narration: hasAudio,
    transcription: hasTranscription,
    scenes: hasBrolls,
    edit: hasEditorReady,
  };
  const doneCount = steps.filter((s) => progress[s.key]).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <TooltipProvider delayDuration={300}>
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r bg-muted/20 transition-[width] duration-200 ease-out",
          collapsed ? "w-[4.25rem]" : "w-60",
          !hydrated && "opacity-0"
        )}
      >
        <div className={cn("border-b", collapsed ? "px-2 py-3" : "px-4 py-4")}>
          <div
            className={cn(
              "flex items-center",
              collapsed ? "justify-center" : "justify-between gap-2"
            )}
          >
            {!collapsed && (
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Fluxo static
              </p>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={toggle}
                  aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
                >
                  {collapsed ? (
                    <PanelLeftOpen className="size-4" />
                  ) : (
                    <PanelLeftClose className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {collapsed ? "Expandir" : "Recolher"}
              </TooltipContent>
            </Tooltip>
          </div>

          {!collapsed && (
            <>
              <div className="mt-3 flex items-end justify-between gap-2">
                <p className="text-sm font-medium tabular-nums">
                  {doneCount}
                  <span className="text-muted-foreground">/{steps.length}</span>
                </p>
                <p className="text-[11px] text-muted-foreground">{pct}% concluído</p>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </>
          )}
          {collapsed && (
            <div className="mx-auto mt-3 h-1 w-8 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>

        <nav
          className={cn(
            "relative flex flex-1 flex-col gap-1 overflow-hidden",
            collapsed ? "p-2" : "p-3"
          )}
        >
          {!collapsed && (
            <div
              aria-hidden
              className="pointer-events-none absolute top-7 bottom-7 left-[1.625rem] w-px bg-border"
            />
          )}
          {steps.map((step, index) => {
            const href = `${base}${step.href}`;
            const active =
              step.key === "script"
                ? pathname === base || pathname === `${base}/`
                : pathname.startsWith(href);
            const done = progress[step.key];
            const Icon = step.icon;

            const link = (
              <Link
                href={href}
                className={cn(
                  "group relative z-[1] flex items-center rounded-xl text-sm transition-all duration-200",
                  collapsed
                    ? "justify-center px-0 py-2.5"
                    : "gap-3 px-2.5 py-2.5",
                  active
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                )}
                aria-label={step.label}
              >
                {collapsed ? (
                  <span
                    className={cn(
                      "relative flex size-9 items-center justify-center rounded-full border transition-colors",
                      done &&
                        !active &&
                        "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
                      active && "border-primary bg-primary text-primary-foreground",
                      !done &&
                        !active &&
                        "border-border bg-muted/50 text-muted-foreground group-hover:border-foreground/20"
                    )}
                  >
                    {done && !active ? (
                      <Check className="size-3.5" strokeWidth={2.5} />
                    ) : (
                      <Icon className="size-4" aria-hidden />
                    )}
                    {active && (
                      <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-primary ring-2 ring-background" />
                    )}
                  </span>
                ) : (
                  <>
                    <span
                      className={cn(
                        "relative flex size-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors",
                        done &&
                          !active &&
                          "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
                        active && "border-primary bg-primary text-primary-foreground",
                        !done &&
                          !active &&
                          "border-border bg-muted/50 text-muted-foreground group-hover:border-foreground/20"
                      )}
                    >
                      {done && !active ? (
                        <Check className="size-3.5" strokeWidth={2.5} />
                      ) : (
                        index + 1
                      )}
                    </span>

                    <span className="flex min-w-0 flex-1 items-center gap-2.5">
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
                          active ? "text-primary" : "opacity-70"
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 leading-tight">
                        <span
                          className={cn(
                            "block truncate font-medium",
                            active && "text-foreground"
                          )}
                        >
                          {step.label}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                          {step.hint}
                        </span>
                      </span>
                    </span>

                    {active && (
                      <span
                        className="size-1.5 shrink-0 rounded-full bg-primary"
                        aria-hidden
                      />
                    )}
                  </>
                )}
              </Link>
            );

            if (!collapsed) return <div key={step.key}>{link}</div>;

            return (
              <Tooltip key={step.key}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" className="max-w-[12rem]">
                  <p className="font-medium">{step.label}</p>
                  <p className="text-background/70">{step.hint}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {!collapsed && (
          <div className="border-t px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
            Complete as etapas em sequência. O progresso é salvo automaticamente.
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}
