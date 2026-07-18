"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FolderDown, Loader2, Film } from "lucide-react";
import { toast } from "sonner";
import type { ProjectExportState } from "@/lib/editor/export-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function isBusy(status: ProjectExportState["status"]) {
  return status === "queued" || status === "bundling" || status === "rendering";
}

function statusLabel(state: ProjectExportState): string {
  switch (state.status) {
    case "queued":
      return "Na fila…";
    case "bundling":
      return "Preparando…";
    case "rendering":
      return `Renderizando ${state.progress}%`;
    case "done":
      return "Pronto";
    case "error":
      return "Falhou";
    default:
      return "Exportar MP4";
  }
}

export function ExportVideoPanel({
  projectId,
  initialState,
}: {
  projectId: string;
  initialState: ProjectExportState;
}) {
  const [state, setState] = useState(initialState);
  const [starting, setStarting] = useState(false);
  const [exportingCapcut, setExportingCapcut] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/export`, {
      cache: "no-store",
    });
    const json = (await res.json()) as {
      ok: boolean;
      data?: ProjectExportState;
      error?: string;
    };
    if (json.ok && json.data) setState(json.data);
  }, [projectId]);

  useEffect(() => {
    if (!isBusy(state.status)) return;
    const id = window.setInterval(() => {
      void refresh();
    }, 1500);
    return () => window.clearInterval(id);
  }, [state.status, refresh]);

  async function handleExport() {
    setStarting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/export`, {
        method: "POST",
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: ProjectExportState;
        error?: string;
      };
      if (!json.ok || !json.data) {
        toast.error(json.error ?? "Falha ao iniciar exportação");
        return;
      }
      setState(json.data);
      if (json.data.status === "queued" || isBusy(json.data.status)) {
        toast.message("Exportação iniciada", {
          description: "O MP4 será gerado em segundo plano.",
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao exportar");
    } finally {
      setStarting(false);
    }
  }

  const busy = starting || isBusy(state.status);

  async function handleExportCapcut() {
    setExportingCapcut(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/export/capcut`, {
        cache: "no-store",
      });
      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok || !contentType.includes("application/zip")) {
        let error = "Falha ao exportar para CapCut";
        try {
          const json = (await res.json()) as { error?: string };
          if (json.error) error = json.error;
        } catch {
          /* ignore */
        }
        toast.error(error);
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const fileName = match?.[1] ?? "projeto-capcut.zip";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      toast.message("Kit CapCut baixado", {
        description:
          "O CapCut 9 bloqueia drafts externos. Abra o ZIP e siga INSTRUCOES.md para importar mídia + legendas.",
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao exportar CapCut"
      );
    } finally {
      setExportingCapcut(false);
    }
  }

  return (
    <section className="rounded-xl border bg-card/60 p-4 shadow-sm">
      <div className="mb-3 space-y-0.5">
        <h2 className="text-sm font-medium">Exportar vídeo</h2>
        <p className="text-xs text-muted-foreground">
          Gera o MP4 final com cenas, narração, transição e música. Também dá
          para baixar um kit de mídia para montar no CapCut.
        </p>
      </div>

      {isBusy(state.status) ? (
        <div className="mb-3 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{statusLabel(state)}</span>
            <span className="font-mono tabular-nums">{state.progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${Math.max(4, state.progress)}%` }}
            />
          </div>
        </div>
      ) : null}

      {state.status === "error" && state.error ? (
        <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-[11px] text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          className="w-full"
          disabled={busy}
          onClick={() => void handleExport()}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Film className="size-3.5" />
          )}
          {busy ? statusLabel(state) : state.videoUrl ? "Exportar novamente" : "Exportar MP4"}
        </Button>

        {state.videoUrl ? (
          <Button type="button" variant="outline" className="w-full" asChild>
            <a
              href={state.videoUrl}
              download
              className={cn("inline-flex items-center justify-center gap-2")}
            >
              <Download className="size-3.5" />
              Baixar MP4
            </a>
          </Button>
        ) : null}

        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={exportingCapcut}
          onClick={() => void handleExportCapcut()}
        >
          {exportingCapcut ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <FolderDown className="size-3.5" />
          )}
          {exportingCapcut ? "Gerando kit…" : "Exportar kit CapCut"}
        </Button>
      </div>
    </section>
  );
}
