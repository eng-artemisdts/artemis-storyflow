"use client";

import { memo, useState, useTransition } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Clock, Film, ImageIcon, Loader2, Pencil, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { generateAssetImage, updateScene } from "@/actions/asset.actions";
import { getAiClientContext } from "@/lib/ai-settings-storage";
import { DeleteEntityButton } from "@/components/assets/delete-entity-button";
import { useWhiteboardContext } from "@/components/whiteboard/whiteboard-context";
import { useWhiteboardStore } from "@/stores/whiteboard-store";
import type { SceneNodeData } from "@/lib/whiteboard-layout";
import { VideoPlayer } from "@/components/video-player";
import { VideoLightbox } from "@/components/video-lightbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type SceneFlowNode = Node<SceneNodeData, "scene">;

function SceneNodeComponent({ id, data, selected }: NodeProps<SceneFlowNode>) {
  const { projectId, trackJobs } = useWhiteboardContext();
  const updateNodeData = useWhiteboardStore((s) => s.updateNodeData);
  const removeNode = useWhiteboardStore((s) => s.removeNode);
  const selectedSceneIds = useWhiteboardStore((s) => s.selectedSceneIds);
  const toggleSceneSelection = useWhiteboardStore((s) => s.toggleSceneSelection);

  const [editOpen, setEditOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [prompt, setPrompt] = useState(data.videoPrompt);
  const [isPending, startTransition] = useTransition();

  const jobStatus = typeof data.jobStatus === "string" ? data.jobStatus : null;
  const isBusy = jobStatus === "queued" || jobStatus === "running" || Boolean(data.isGenerating);
  const isChecked = selectedSceneIds.includes(data.sceneId);

  function handleSavePrompt() {
    startTransition(async () => {
      const result = await updateScene({ sceneId: data.sceneId, videoPrompt: prompt });
      if (result.ok) {
        updateNodeData(id, { videoPrompt: prompt });
        toast.success("Prompt de vídeo atualizado");
        setEditOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleRegenerateKeyframe() {
    updateNodeData(id, { isGenerating: true });
    void (async () => {
      const result = await generateAssetImage({
        projectId,
        targetType: "scene_keyframe",
        targetId: data.sceneId,
        ai: getAiClientContext(),
      });
      if (result.ok) {
        trackJobs([result.data.jobId]);
        toast.info("Keyframe em geração");
      } else {
        updateNodeData(id, { isGenerating: false });
        toast.error(result.error);
      }
    })();
  }

  return (
    <div
      className={cn(
        "w-80 rounded-xl border bg-card shadow-lg transition-colors",
        selected ? "border-primary ring-2 ring-primary/40" : "border-border",
        isChecked && "border-violet-500"
      )}
    >
      <div
        className="relative aspect-video overflow-hidden rounded-t-xl bg-neutral-950"
        onDoubleClick={(e) => {
          if (!data.videoUrl) return;
          e.stopPropagation();
          setLightboxOpen(true);
        }}
        title={data.videoUrl ? "Duplo clique para ampliar" : undefined}
      >
        {data.videoUrl ? (
          <div className="nodrag nowheel size-full">
            <VideoPlayer
              src={data.videoUrl}
              poster={data.keyframeUrl}
              compact
              muted
              loop
              className="size-full"
            />
          </div>
        ) : data.keyframeUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.keyframeUrl} alt={data.title} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center">
            <ImageIcon className="size-6 text-muted-foreground" />
          </div>
        )}
        {isBusy && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
            <Loader2 className="size-6 animate-spin text-white" />
            {jobStatus && (
              <span className="text-xs text-white/80">
                {jobStatus === "queued" ? "na fila..." : "gerando..."}
              </span>
            )}
          </div>
        )}
        <Badge className="absolute left-2 top-2 gap-1 bg-violet-600 text-white">
          <Film className="size-3" /> Cena {data.order}
        </Badge>
        {jobStatus === "failed" && (
          <Badge variant="destructive" className="absolute right-2 top-2">
            falhou
          </Badge>
        )}
      </div>

      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium" title={data.title}>
            {data.title}
          </span>
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <Clock className="size-3" /> {data.durationSec}s
          </Badge>
        </div>
        <p className="line-clamp-2 text-xs text-muted-foreground">{data.summary}</p>

        <div className="flex items-center justify-between pt-1">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={isChecked}
              onCheckedChange={(v) => toggleSceneSelection(data.sceneId, v === true)}
            />
            Selecionar p/ vídeo
          </label>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              title="Editar prompt de vídeo"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              title={data.keyframeUrl ? "Regenerar keyframe" : "Gerar keyframe"}
              disabled={isBusy}
              onClick={handleRegenerateKeyframe}
            >
              <RefreshCw className="size-3.5" />
            </Button>
            <DeleteEntityButton
              projectId={projectId}
              targetType="scene"
              targetId={data.sceneId}
              name={data.title}
              variant="ghost"
              size="icon"
              iconOnly
              onDeleted={(nodeId) => {
                removeNode(nodeId);
                toggleSceneSelection(data.sceneId, false);
              }}
            />
          </div>
        </div>
      </div>

      <Handle type="target" position={Position.Left} className="!size-2.5 !bg-violet-500" />
      <Handle type="source" position={Position.Right} className="!size-2.5 !bg-violet-500" />

      <VideoLightbox
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        videoUrl={data.videoUrl}
        poster={data.keyframeUrl}
        title={data.title}
        badge={`Cena ${data.order}`}
        description={data.summary}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Prompt de vídeo — {data.title}</DialogTitle>
            <DialogDescription>
              Formato cinematográfico: sujeito + ação + câmera + iluminação + atmosfera + áudio.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-40 font-mono text-xs"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSavePrompt} disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const SceneNode = memo(SceneNodeComponent);
