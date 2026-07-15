"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type NodeTypes,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Loader2, Network, StickyNote, Video } from "lucide-react";
import { toast } from "sonner";
import { saveWhiteboard } from "@/actions/whiteboard.actions";
import { useJobPolling, type PolledJob } from "@/hooks/use-job-polling";
import { useWhiteboardStore, type WhiteboardNode } from "@/stores/whiteboard-store";
import { WhiteboardProvider } from "@/components/whiteboard/whiteboard-context";
import { CharacterNode } from "@/components/whiteboard/nodes/character-node";
import { ScenarioNode } from "@/components/whiteboard/nodes/scenario-node";
import { SceneNode } from "@/components/whiteboard/nodes/scene-node";
import { NoteNode } from "@/components/whiteboard/nodes/note-node";
import { GenerationPanel } from "@/components/whiteboard/generation-panel";
import { AddEntityDialog } from "@/components/assets/add-entity-dialog";
import { Button } from "@/components/ui/button";
import { autoLayoutNodes, type SerializedEdge, type SerializedNode } from "@/lib/whiteboard-layout";

const nodeTypes: NodeTypes = {
  character: CharacterNode,
  scenario: ScenarioNode,
  scene: SceneNode,
  note: NoteNode,
};

export function WhiteboardCanvas(props: {
  projectId: string;
  initialNodes: SerializedNode[];
  initialEdges: SerializedEdge[];
  activeJobIds: string[];
  videoProviderLabel: string | null;
  characters: Array<{ id: string; name: string }>;
  scenarios: Array<{ id: string; name: string }>;
}) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function CanvasInner({
  projectId,
  initialNodes,
  initialEdges,
  activeJobIds,
  videoProviderLabel,
  characters,
  scenarios,
}: {
  projectId: string;
  initialNodes: SerializedNode[];
  initialEdges: SerializedEdge[];
  activeJobIds: string[];
  videoProviderLabel: string | null;
  characters: Array<{ id: string; name: string }>;
  scenarios: Array<{ id: string; name: string }>;
}) {
  const {
    nodes,
    edges,
    setGraph,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    appendGraph,
    dirty,
    markSaved,
  } = useWhiteboardStore();
  const [panelOpen, setPanelOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const reactFlowRef = useRef<ReactFlowInstance<WhiteboardNode> | null>(null);
  const selectedCount = useWhiteboardStore((s) => s.selectedSceneIds.length);

  // Carrega o grafo inicial no store (uma vez por montagem).
  useEffect(() => {
    setGraph(initialNodes as WhiteboardNode[], initialEdges as Edge[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Polling de jobs: atualiza nós conforme jobs concluem ────────
  const applyJobToNodes = useCallback((job: PolledJob) => {
    const { nodes: currentNodes, updateNodeData } = useWhiteboardStore.getState();
    const node = currentNodes.find((n) => {
      const d = n.data;
      if (d.kind === "character" && job.targetType === "character")
        return d.characterId === job.targetId;
      if (d.kind === "scenario" && job.targetType === "scenario")
        return d.scenarioId === job.targetId;
      if (d.kind === "scene" && (job.targetType === "scene_keyframe" || job.targetType === "scene_video"))
        return d.sceneId === job.targetId;
      return false;
    });
    if (!node) return;

    if (job.status === "succeeded" && job.resultUrl) {
      if (job.targetType === "character" || job.targetType === "scenario") {
        updateNodeData(node.id, { imageUrl: job.resultUrl, isGenerating: false, jobStatus: null });
      } else if (job.targetType === "scene_keyframe") {
        updateNodeData(node.id, { keyframeUrl: job.resultUrl, isGenerating: false, jobStatus: null });
      } else {
        updateNodeData(node.id, { videoUrl: job.resultUrl, isGenerating: false, jobStatus: null });
      }
    } else if (job.status === "failed") {
      updateNodeData(node.id, { isGenerating: false, jobStatus: "failed" });
      toast.error(`Falha na geração: ${job.error ?? "erro desconhecido"}`);
    } else {
      updateNodeData(node.id, { jobStatus: job.status });
    }
  }, []);

  const { jobs, track } = useJobPolling({ onJobFinished: applyJobToNodes });

  // Reflete estados intermediários (queued/running) nos nós.
  useEffect(() => {
    for (const job of Object.values(jobs)) {
      if (job.status === "queued" || job.status === "running") applyJobToNodes(job);
    }
  }, [jobs, applyJobToNodes]);

  useEffect(() => {
    if (activeJobIds.length > 0) track(activeJobIds);
  }, [activeJobIds, track]);

  // ── Auto-save com debounce de 1s ────────────────────────────────
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!dirty) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const { nodes: n, edges: e } = useWhiteboardStore.getState();
      // Remove flags transitórias antes de persistir.
      const cleanNodes = n.map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: { ...node.data, isGenerating: undefined, jobStatus: undefined },
      }));
      const cleanEdges = e.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
      }));
      setSaving(true);
      void saveWhiteboard({
        projectId,
        nodes: JSON.stringify(cleanNodes),
        edges: JSON.stringify(cleanEdges),
      }).then((result) => {
        setSaving(false);
        if (result.ok) markSaved();
        else toast.error(`Auto-save falhou: ${result.error}`);
      });
    }, 1000);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [dirty, nodes, edges, projectId, markSaved]);

  // ── Auto-layout semântico (storyboard) ──────────────────────────
  const handleAutoLayout = useCallback(() => {
    const { nodes: currentNodes } = useWhiteboardStore.getState();
    if (currentNodes.length === 0) return;

    const laidOut = autoLayoutNodes(currentNodes as SerializedNode[]) as WhiteboardNode[];
    useWhiteboardStore.setState({ nodes: laidOut, dirty: true });

    requestAnimationFrame(() => {
      void reactFlowRef.current?.fitView({ padding: 0.18, duration: 280 });
    });
  }, []);

  const handleAddNote = useCallback(() => {
    addNode({
      id: `note-${Date.now()}`,
      type: "note",
      position: { x: 80 + Math.random() * 120, y: 80 + Math.random() * 120 },
      data: { kind: "note", text: "" },
    });
  }, [addNode]);

  const handleEntityCreated = useCallback(
    (payload: { node: SerializedNode; edges: SerializedEdge[] }) => {
      appendGraph(
        [payload.node as WhiteboardNode],
        payload.edges as Edge[]
      );
      requestAnimationFrame(() => {
        void reactFlowRef.current?.fitView({ padding: 0.2, duration: 280 });
      });
    },
    [appendGraph]
  );

  // Catálogo vivo: entidades já no canvas + props iniciais (após create local).
  const characterOptions = useMemo(() => {
    const fromNodes = nodes
      .filter((n) => n.data.kind === "character")
      .map((n) => ({
        id: (n.data as { characterId: string }).characterId,
        name: (n.data as { name: string }).name,
      }));
    const map = new Map(characters.map((c) => [c.id, c]));
    for (const c of fromNodes) map.set(c.id, c);
    return [...map.values()];
  }, [characters, nodes]);

  const scenarioOptions = useMemo(() => {
    const fromNodes = nodes
      .filter((n) => n.data.kind === "scenario")
      .map((n) => ({
        id: (n.data as { scenarioId: string }).scenarioId,
        name: (n.data as { name: string }).name,
      }));
    const map = new Map(scenarios.map((s) => [s.id, s]));
    for (const s of fromNodes) map.set(s.id, s);
    return [...map.values()];
  }, [scenarios, nodes]);

  const contextValue = useMemo(
    () => ({ projectId, trackJobs: track }),
    [projectId, track]
  );

  return (
    <WhiteboardProvider value={contextValue}>
      <div className="relative h-full w-full bg-neutral-950">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onInit={(instance) => {
            reactFlowRef.current = instance;
          }}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          minZoom={0.1}
          maxZoom={2}
          zoomOnDoubleClick={false}
          snapToGrid
          snapGrid={[16, 16]}
          proOptions={{ hideAttribution: true }}
          className="bg-neutral-950"
          defaultEdgeOptions={{ style: { stroke: "#525252" } }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="#404040" />
          <MiniMap
            pannable
            zoomable
            className="!bg-neutral-900"
            nodeColor={(node) => {
              switch (node.type) {
                case "character":
                  return "#2563eb";
                case "scenario":
                  return "#059669";
                case "scene":
                  return "#7c3aed";
                default:
                  return "#a16207";
              }
            }}
          />
          <Controls className="storyflow-flow-controls" showInteractive={false} />
        </ReactFlow>

        {/* Barra de ferramentas do canvas */}
        <div className="absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={handleAutoLayout}>
            <Network className="size-4" /> Auto-layout
          </Button>
          <AddEntityDialog
            projectId={projectId}
            kind="character"
            triggerVariant="secondary"
            triggerLabel="Personagem"
            onCreated={handleEntityCreated}
          />
          <AddEntityDialog
            projectId={projectId}
            kind="scenario"
            triggerVariant="secondary"
            triggerLabel="Cenário"
            onCreated={handleEntityCreated}
          />
          <AddEntityDialog
            projectId={projectId}
            kind="scene"
            triggerVariant="secondary"
            triggerLabel="Cena"
            characters={characterOptions}
            scenarios={scenarioOptions}
            onCreated={handleEntityCreated}
          />
          <Button size="sm" variant="secondary" onClick={handleAddNote}>
            <StickyNote className="size-4" /> Nota
          </Button>
          {saving && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> salvando...
            </span>
          )}
        </div>

        <div className="absolute right-4 top-4 z-10">
          <Button size="sm" onClick={() => setPanelOpen(true)}>
            <Video className="size-4" />
            Gerar vídeos {selectedCount > 0 && `(${selectedCount})`}
          </Button>
        </div>

        <GenerationPanel
          open={panelOpen}
          onOpenChange={setPanelOpen}
          videoProviderLabel={videoProviderLabel}
        />
      </div>
    </WhiteboardProvider>
  );
}
