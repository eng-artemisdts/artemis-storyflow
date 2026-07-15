"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Clock, Film, ImageIcon, Info, Loader2, Video } from "lucide-react";
import { toast } from "sonner";
import { generateVideosForScenes } from "@/actions/job.actions";
import { getAiClientContext } from "@/lib/ai-settings-storage";
import { useWhiteboardContext } from "@/components/whiteboard/whiteboard-context";
import { useWhiteboardStore } from "@/stores/whiteboard-store";
import type { SceneNodeData } from "@/lib/whiteboard-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

/** Painel lateral da etapa 4: geração de vídeo das cenas selecionadas. */
export function GenerationPanel({
  open,
  onOpenChange,
  videoProviderLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoProviderLabel: string | null;
}) {
  const { projectId, trackJobs } = useWhiteboardContext();
  const nodes = useWhiteboardStore((s) => s.nodes);
  const selectedSceneIds = useWhiteboardStore((s) => s.selectedSceneIds);
  const clearSceneSelection = useWhiteboardStore((s) => s.clearSceneSelection);
  const updateNodeData = useWhiteboardStore((s) => s.updateNodeData);
  const [isPending, startTransition] = useTransition();

  const selectedScenes = nodes
    .filter((n): n is typeof n & { data: SceneNodeData } => n.data.kind === "scene")
    .filter((n) => selectedSceneIds.includes(n.data.sceneId))
    .sort((a, b) => a.data.order - b.data.order);

  const totalDuration = selectedScenes.reduce((acc, n) => acc + n.data.durationSec, 0);

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateVideosForScenes({ projectId, sceneIds: selectedSceneIds, ai: getAiClientContext() });
      if (result.ok) {
        toast.success(`${result.data.jobIds.length} vídeos na fila (máx. 2 simultâneos)`);
        for (const node of selectedScenes) {
          updateNodeData(node.id, { jobStatus: "queued" });
        }
        trackJobs(result.data.jobIds);
        clearSceneSelection();
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-[400px] flex-col sm:max-w-[400px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Video className="size-5" /> Geração de vídeo
          </SheetTitle>
          <SheetDescription>
            Cada cena vira um job image-to-video usando o keyframe + prompt de vídeo.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4">
          <div className="rounded-lg border bg-card p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Provedor / modelo</span>
              {videoProviderLabel ? (
                <Badge variant="secondary" className="max-w-48 truncate font-mono text-[10px]">
                  {videoProviderLabel}
                </Badge>
              ) : (
                <Link href={`/projects/${projectId}/settings`} className="text-xs text-primary underline">
                  configurar
                </Link>
              )}
            </div>
            <Separator className="my-2" />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Duração total</span>
              <span className="flex items-center gap-1">
                <Clock className="size-3.5" /> ~{totalDuration}s
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">Custo estimado</span>
              <span className="text-xs text-muted-foreground">
                varia por modelo (~US$0,05–0,75/s)
              </span>
            </div>
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1 px-4">
          {selectedScenes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
              <Film className="size-6" />
              Marque o checkbox nos nós de cena do whiteboard para selecioná-las.
            </div>
          ) : (
            <ul className="space-y-2 py-2">
              {selectedScenes.map((node) => (
                <li key={node.id} className="flex items-center gap-3 rounded-md border p-2">
                  <div className="flex aspect-video w-20 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                    {node.data.keyframeUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={node.data.keyframeUrl}
                        alt={node.data.title}
                        className="size-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      #{node.data.order} {node.data.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {node.data.durationSec}s ·{" "}
                      {node.data.keyframeUrl ? "image-to-video" : "text-to-video (sem keyframe)"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>

        {selectedScenes.some((n) => !n.data.keyframeUrl) && (
          <div className="px-4">
            <Alert>
              <Info className="size-4" />
              <AlertDescription className="text-xs">
                Cenas sem keyframe usarão text-to-video puro — a consistência de personagens
                pode ser menor.
              </AlertDescription>
            </Alert>
          </div>
        )}

        <SheetFooter>
          <Button
            className="w-full"
            disabled={selectedScenes.length === 0 || isPending}
            onClick={handleGenerate}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Video className="size-4" />}
            Gerar vídeos selecionados ({selectedScenes.length})
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
