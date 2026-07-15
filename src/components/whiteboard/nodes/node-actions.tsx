"use client";

import { useState, useTransition } from "react";
import { Info, Loader2, Pencil, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { generateAssetImage, updateVisualPrompt } from "@/actions/asset.actions";
import { getAiClientContext } from "@/lib/ai-settings-storage";
import { DeleteEntityButton } from "@/components/assets/delete-entity-button";
import { useWhiteboardContext } from "@/components/whiteboard/whiteboard-context";
import { useWhiteboardStore } from "@/stores/whiteboard-store";
import type { CharacterNodeData, ScenarioNodeData } from "@/lib/whiteboard-layout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

/** Botões comuns dos nós de personagem/cenário: prompt, regenerar, detalhes. */
export function NodeActions({
  nodeId,
  kind,
  data,
}: {
  nodeId: string;
  kind: "character" | "scenario";
  data: CharacterNodeData | ScenarioNodeData;
}) {
  const { projectId, trackJobs } = useWhiteboardContext();
  const updateNodeData = useWhiteboardStore((s) => s.updateNodeData);
  const removeNode = useWhiteboardStore((s) => s.removeNode);
  const [editOpen, setEditOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [prompt, setPrompt] = useState(data.visualPrompt);
  const [isPending, startTransition] = useTransition();

  const targetId = data.kind === "character" ? data.characterId : data.scenarioId;

  function handleSavePrompt() {
    startTransition(async () => {
      const result = await updateVisualPrompt({ targetType: kind, targetId, visualPrompt: prompt });
      if (result.ok) {
        updateNodeData(nodeId, { visualPrompt: prompt });
        toast.success("Prompt atualizado");
        setEditOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleRegenerate() {
    updateNodeData(nodeId, { isGenerating: true });
    void (async () => {
      const result = await generateAssetImage({ projectId, targetType: kind, targetId, ai: getAiClientContext() });
      if (result.ok) {
        trackJobs([result.data.jobId]);
        toast.info("Geração iniciada");
      } else {
        updateNodeData(nodeId, { isGenerating: false });
        toast.error(result.error);
      }
    })();
  }

  return (
    <div className="flex shrink-0 gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="size-6"
        title="Editar prompt"
        onClick={() => setEditOpen(true)}
      >
        <Pencil className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-6"
        title="Regenerar imagem"
        disabled={Boolean(data.isGenerating)}
        onClick={handleRegenerate}
      >
        {data.isGenerating ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <RefreshCw className="size-3.5" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-6"
        title="Ver detalhes"
        onClick={() => setDetailsOpen(true)}
      >
        <Info className="size-3.5" />
      </Button>
      <DeleteEntityButton
        projectId={projectId}
        targetType={kind}
        targetId={targetId}
        name={data.name}
        variant="ghost"
        size="icon"
        iconOnly
        onDeleted={(id) => removeNode(id)}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Prompt visual — {data.name}</DialogTitle>
            <DialogDescription>Em inglês, otimizado para o modelo de imagem.</DialogDescription>
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

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{data.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="mb-1 font-medium">Descrição</h4>
              <p className="text-muted-foreground">{data.description}</p>
            </div>
            <div>
              <h4 className="mb-1 font-medium">Prompt visual</h4>
              <p className="font-mono text-xs text-muted-foreground">{data.visualPrompt}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
