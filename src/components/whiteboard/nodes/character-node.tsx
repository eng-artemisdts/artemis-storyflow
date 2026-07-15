"use client";

import { memo, useState } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { ImageIcon, Loader2, User } from "lucide-react";
import type { CharacterNodeData } from "@/lib/whiteboard-layout";
import { AssetLightbox } from "@/components/asset-lightbox";
import { Badge } from "@/components/ui/badge";
import { NodeActions } from "@/components/whiteboard/nodes/node-actions";
import { cn } from "@/lib/utils";

export type CharacterFlowNode = Node<CharacterNodeData, "character">;

function CharacterNodeComponent({ id, data, selected }: NodeProps<CharacterFlowNode>) {
  const isGenerating = Boolean(data.isGenerating);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <div
      className={cn(
        "w-64 rounded-xl border bg-card shadow-lg transition-colors",
        selected ? "border-primary ring-2 ring-primary/40" : "border-border"
      )}
      onDoubleClick={(e) => {
        if (!data.imageUrl) return;
        e.stopPropagation();
        setLightboxOpen(true);
      }}
      title={data.imageUrl ? "Duplo clique para ampliar" : undefined}
    >
      <div className="relative aspect-square overflow-hidden rounded-t-xl bg-neutral-900">
        {data.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.imageUrl} alt={data.name} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center">
            <ImageIcon className="size-6 text-muted-foreground" />
          </div>
        )}
        {isGenerating && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Loader2 className="size-6 animate-spin text-white" />
          </div>
        )}
        <Badge className="absolute left-2 top-2 gap-1 bg-blue-600 text-white" variant="default">
          <User className="size-3" /> Personagem
        </Badge>
      </div>
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{data.name}</span>
          <NodeActions nodeId={id} kind="character" data={data} />
        </div>
        <p className="line-clamp-2 text-xs text-muted-foreground">{data.description}</p>
      </div>
      <Handle type="source" position={Position.Right} className="!size-2.5 !bg-blue-500" />
      <Handle type="target" position={Position.Left} className="!size-2.5 !bg-blue-500" />
      <AssetLightbox
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        imageUrl={data.imageUrl}
        title={data.name}
        badge="Personagem"
        description={data.description}
      />
    </div>
  );
}

export const CharacterNode = memo(CharacterNodeComponent);
