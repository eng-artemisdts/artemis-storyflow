"use client";

import { useState, useTransition } from "react";
import { ImageIcon, Loader2, Pencil, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { updateVisualPrompt } from "@/actions/asset.actions";
import { AssetLightbox } from "@/components/asset-lightbox";
import { DeleteEntityButton } from "@/components/assets/delete-entity-button";
import { EditImageDialog } from "@/components/assets/edit-image-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function AssetCard({
  projectId,
  name,
  description,
  visualPrompt,
  imageUrl,
  isGenerating,
  targetType,
  targetId,
  onRegenerate,
  onEditStarted,
  onDeleted,
}: {
  projectId: string;
  name: string;
  description: string;
  visualPrompt: string;
  imageUrl: string | null;
  isGenerating: boolean;
  targetType: "character" | "scenario";
  targetId: string;
  onRegenerate: () => void;
  onEditStarted?: (jobId: string) => void;
  onDeleted?: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [prompt, setPrompt] = useState(visualPrompt);
  const [isPending, startTransition] = useTransition();

  function handleSavePrompt() {
    startTransition(async () => {
      const result = await updateVisualPrompt({ targetType, targetId, visualPrompt: prompt });
      if (result.ok) {
        toast.success("Prompt atualizado");
        setEditOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card className="overflow-hidden py-0 gap-0">
      <div className="relative aspect-video bg-muted">
        {imageUrl ? (
          <button
            type="button"
            className="block size-full cursor-zoom-in"
            title="Ampliar imagem"
            onClick={() => setLightboxOpen(true)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={name} className="size-full object-cover" />
          </button>
        ) : (
          <div className="flex size-full items-center justify-center">
            <ImageIcon className="size-6 text-muted-foreground" />
          </div>
        )}
        {isGenerating && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
            <Loader2 className="size-6 animate-spin text-white" />
          </div>
        )}
      </div>
      <CardContent className="space-y-2 p-4">
        <h3 className="font-medium">{name}</h3>
        <p className="line-clamp-2 text-xs text-muted-foreground" title={description}>
          {description}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="size-3.5" /> Prompt
          </Button>
          {imageUrl && (
            <EditImageDialog
              projectId={projectId}
              targetType={targetType}
              targetId={targetId}
              title={name}
              disabled={isGenerating}
              onStarted={onEditStarted}
            />
          )}
          <Button size="sm" variant="outline" disabled={isGenerating} onClick={onRegenerate}>
            {isGenerating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            {imageUrl ? "Regenerar" : "Gerar"}
          </Button>
          <DeleteEntityButton
            projectId={projectId}
            targetType={targetType}
            targetId={targetId}
            name={name}
            onDeleted={() => onDeleted?.()}
          />
        </div>
      </CardContent>

      <AssetLightbox
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        imageUrl={imageUrl}
        title={name}
        badge={targetType === "character" ? "Personagem" : "Cenário"}
        description={description}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Prompt visual — {name}</DialogTitle>
            <DialogDescription>
              Em inglês, otimizado para o modelo de imagem. Usado também como referência nos
              keyframes das cenas.
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
              Salvar prompt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
