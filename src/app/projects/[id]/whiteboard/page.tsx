import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { WhiteboardCanvas } from "@/components/whiteboard/whiteboard-canvas";
import {
  seedWhiteboard,
  type SerializedEdge,
  type SerializedNode,
} from "@/lib/whiteboard-layout";

export const dynamic = "force-dynamic";

export default async function WhiteboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      characters: true,
      scenarios: true,
      scenes: { orderBy: { order: "asc" } },
      whiteboard: true,
      jobs: { where: { status: { in: ["queued", "running"] } }, select: { id: true } },
    },
  });
  if (!project) notFound();

  const scenesForSeed = project.scenes.map((s) => ({
    ...s,
    characterIds: JSON.parse(s.characterIds) as string[],
  }));
  const seeded = seedWhiteboard({
    characters: project.characters,
    scenarios: project.scenarios,
    scenes: scenesForSeed,
  });

  let nodes: SerializedNode[] = seeded.nodes;
  let edges: SerializedEdge[] = seeded.edges;
  if (project.whiteboard) {
    try {
      nodes = JSON.parse(project.whiteboard.nodes) as SerializedNode[];
      edges = JSON.parse(project.whiteboard.edges) as SerializedEdge[];
    } catch {
      // JSON corrompido — mantém o seed.
    }
  }

  // Hidrata os nós com dados frescos do banco (imagens/vídeos/prompts
  // podem ter mudado desde o último save do canvas).
  const characterById = new Map(project.characters.map((c) => [c.id, c]));
  const scenarioById = new Map(project.scenarios.map((s) => [s.id, s]));
  const sceneById = new Map(project.scenes.map((s) => [s.id, s]));

  nodes = nodes
    .map((node) => {
      if (node.data.kind === "character") {
        const fresh = characterById.get(node.data.characterId);
        if (!fresh) return null;
        return {
          ...node,
          data: {
            ...node.data,
            name: fresh.name,
            description: fresh.description,
            visualPrompt: fresh.visualPrompt,
            imageUrl: fresh.imageUrl,
          },
        };
      }
      if (node.data.kind === "scenario") {
        const fresh = scenarioById.get(node.data.scenarioId);
        if (!fresh) return null;
        return {
          ...node,
          data: {
            ...node.data,
            name: fresh.name,
            description: fresh.description,
            visualPrompt: fresh.visualPrompt,
            imageUrl: fresh.imageUrl,
          },
        };
      }
      if (node.data.kind === "scene") {
        const fresh = sceneById.get(node.data.sceneId);
        if (!fresh) return null;
        return {
          ...node,
          data: {
            ...node.data,
            order: fresh.order,
            title: fresh.title,
            summary: fresh.summary,
            videoPrompt: fresh.videoPrompt,
            dialogue: fresh.dialogue,
            durationSec: fresh.durationSec,
            keyframeUrl: fresh.keyframeUrl,
            videoUrl: fresh.videoUrl,
          },
        };
      }
      return node;
    })
    .filter((n): n is SerializedNode => n !== null);

  // Entidades do DB que ainda não estão no grafo (criadas sem sync) entram aqui.
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const character of project.characters) {
    const id = `character-${character.id}`;
    if (!nodeIds.has(id)) {
      nodes.push({
        id,
        type: "character",
        position: { x: 420, y: nodes.filter((n) => n.type === "character").length * 360 },
        data: {
          kind: "character",
          characterId: character.id,
          name: character.name,
          description: character.description,
          visualPrompt: character.visualPrompt,
          imageUrl: character.imageUrl,
        },
      });
    }
  }
  for (const scenario of project.scenarios) {
    const id = `scenario-${scenario.id}`;
    if (!nodeIds.has(id)) {
      nodes.push({
        id,
        type: "scenario",
        position: { x: 0, y: nodes.filter((n) => n.type === "scenario").length * 360 },
        data: {
          kind: "scenario",
          scenarioId: scenario.id,
          name: scenario.name,
          description: scenario.description,
          visualPrompt: scenario.visualPrompt,
          imageUrl: scenario.imageUrl,
        },
      });
    }
  }
  for (const scene of scenesForSeed) {
    const id = `scene-${scene.id}`;
    if (!nodeIds.has(id)) {
      nodes.push({
        id,
        type: "scene",
        position: {
          x: nodes.filter((n) => n.type === "scene").length * 380,
          y: 2320,
        },
        data: {
          kind: "scene",
          sceneId: scene.id,
          order: scene.order,
          title: scene.title,
          summary: scene.summary,
          videoPrompt: scene.videoPrompt,
          dialogue: scene.dialogue,
          durationSec: scene.durationSec,
          keyframeUrl: scene.keyframeUrl,
          videoUrl: scene.videoUrl,
        },
      });
      for (const characterId of scene.characterIds) {
        edges.push({
          id: `e-${id}-character-${characterId}`,
          source: `character-${characterId}`,
          target: id,
        });
      }
      if (scene.scenarioId) {
        edges.push({
          id: `e-${id}-scenario-${scene.scenarioId}`,
          source: `scenario-${scene.scenarioId}`,
          target: id,
        });
      }
    }
  }

  return (
    <WhiteboardCanvas
      projectId={project.id}
      initialNodes={nodes}
      initialEdges={edges}
      activeJobIds={project.jobs.map((j) => j.id)}
      videoProviderLabel={
        project.videoProvider ? `${project.videoProvider} · ${project.videoModel ?? ""}` : null
      }
      characters={project.characters.map((c) => ({ id: c.id, name: c.name }))}
      scenarios={project.scenarios.map((s) => ({ id: s.id, name: s.name }))}
    />
  );
}
