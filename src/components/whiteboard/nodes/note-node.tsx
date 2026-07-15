"use client";

import { memo } from "react";
import { type NodeProps, type Node } from "@xyflow/react";
import type { NoteNodeData } from "@/lib/whiteboard-layout";
import { useWhiteboardStore } from "@/stores/whiteboard-store";
import { cn } from "@/lib/utils";

export type NoteFlowNode = Node<NoteNodeData, "note">;

function NoteNodeComponent({ id, data, selected }: NodeProps<NoteFlowNode>) {
  const updateNodeData = useWhiteboardStore((s) => s.updateNodeData);

  return (
    <div
      className={cn(
        "w-56 rounded-lg border border-yellow-600/40 bg-yellow-950/80 p-3 shadow-lg",
        selected && "ring-2 ring-yellow-500/50"
      )}
    >
      <textarea
        value={data.text}
        onChange={(e) => updateNodeData(id, { text: e.target.value })}
        placeholder="Anotação..."
        className="nodrag min-h-24 w-full resize-none bg-transparent text-xs text-yellow-100 placeholder:text-yellow-100/40 focus:outline-none"
      />
    </div>
  );
}

export const NoteNode = memo(NoteNodeComponent);
