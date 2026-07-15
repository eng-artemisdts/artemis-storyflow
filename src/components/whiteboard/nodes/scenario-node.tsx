"use client";

import { memo, useState } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { ImageIcon, Loader2, MapPin } from "lucide-react";
import type { ScenarioNodeData } from "@/lib/whiteboard-layout";
import { AssetLightbox } from "@/components/asset-lightbox";
import { Badge } from "@/components/ui/badge";
import { NodeActions } from "@/components/whiteboard/nodes/node-actions";
import { cn } from "@/lib/utils";

export type ScenarioFlowNode = Node<ScenarioNodeData, "scenario">;

function ScenarioNodeComponent({ id, data, selected }: NodeProps<ScenarioFlowNode>) {
  const isGenerating = Boolean(data.isGenerating);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <div
      className={cn(
        "w-72 rounded-xl border bg-card shadow-lg transition-colors",
        selected ? "border-primary ring-2 ring-primary/40" : "border-border"
      )}
      onDoubleClick={(e) => {
        if (!data.imageUrl) return;
        e.stopPropagation();
        setLightboxOpen(true);
      }}
      title={data.imageUrl ? "Duplo clique para ampliar" : undefined}
    >
      <div className="relative aspect-video overflow-hidden rounded-t-xl bg-neutral-900">
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
        <Badge className="absolute left-2 top-2 gap-1 bg-emerald-600 text-white">
          <MapPin className="size-3" /> Cenário
        </Badge>
      </div>
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{data.name}</span>
          <NodeActions nodeId={id} kind="scenario" data={data} />
        </div>
        <p className="line-clamp-2 text-xs text-muted-foreground">{data.description}</p>
      </div>
      <Handle type="source" position={Position.Right} className="!size-2.5 !bg-emerald-500" />
      <Handle type="target" position={Position.Left} className="!size-2.5 !bg-emerald-500" />
      <AssetLightbox
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        imageUrl={data.imageUrl}
        title={data.name}
        badge="Cenário"
        description={data.description}
      />
    </div>
  );
}

export const ScenarioNode = memo(ScenarioNodeComponent);
