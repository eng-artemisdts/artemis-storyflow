"use client";

import { useState } from "react";
import { FolderDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

function capcutDraftsHint(): string {
  if (typeof navigator !== "undefined" && /Win/i.test(navigator.platform)) {
    return "%LocalAppData%\\CapCut\\User Data\\Projects\\com.lveditor.draft\\";
  }
  return "~/Movies/CapCut/User Data/Projects/com.lveditor.draft/";
}

export function ExportVideoPanel({ projectId }: { projectId: string }) {
  const [exportingCapcut, setExportingCapcut] = useState(false);

  async function handleExportCapcut() {
    setExportingCapcut(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/export/capcut`, {
        method: "POST",
        cache: "no-store",
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: {
          token: string;
          fileName: string;
          draftName: string;
          downloadUrl: string;
        };
        error?: string;
      };

      if (!res.ok || !json.ok || !json.data?.downloadUrl) {
        toast.error(json.error ?? "Falha ao exportar para CapCut");
        return;
      }

      // Download direto por URL (streaming no servidor — sem blob na memória).
      const a = document.createElement("a");
      a.href = json.data.downloadUrl;
      a.download = json.data.fileName;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();

      toast.message("Projeto CapCut pronto", {
        description: `Feche o CapCut, extraia a pasta em ${capcutDraftsHint()} (mantenha o nome) e reabra o app.`,
        duration: 12_000,
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
        <h2 className="text-sm font-medium">Exportar projeto</h2>
        <p className="text-xs text-muted-foreground">
          Gera um rascunho nativo do CapCut com cenas, movimentos de imagem,
          narração, transições e música para continuar a edição no app.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          className="w-full"
          disabled={exportingCapcut}
          onClick={() => void handleExportCapcut()}
        >
          {exportingCapcut ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <FolderDown className="size-3.5" />
          )}
          {exportingCapcut ? "Gerando draft CapCut…" : "Exportar para CapCut"}
        </Button>
        <p className="px-1 text-center text-[10px] leading-relaxed text-muted-foreground">
          ZIP com rascunho nativo (JSON + mídia). Extraia em{" "}
          <span className="font-mono">com.lveditor.draft</span> com o CapCut
          fechado.
        </p>
      </div>
    </section>
  );
}
