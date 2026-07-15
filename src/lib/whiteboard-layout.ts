/**
 * Tipos dos nós do whiteboard (React Flow) e seed de layout automático.
 * Compartilhado entre server (seed pós-análise) e client (render).
 */

export interface CharacterNodeData {
  kind: "character";
  characterId: string;
  name: string;
  description: string;
  visualPrompt: string;
  imageUrl: string | null;
  [key: string]: unknown;
}

export interface ScenarioNodeData {
  kind: "scenario";
  scenarioId: string;
  name: string;
  description: string;
  visualPrompt: string;
  imageUrl: string | null;
  [key: string]: unknown;
}

export interface SceneNodeData {
  kind: "scene";
  sceneId: string;
  order: number;
  title: string;
  summary: string;
  videoPrompt: string;
  dialogue: string | null;
  durationSec: number;
  keyframeUrl: string | null;
  videoUrl: string | null;
  [key: string]: unknown;
}

export interface NoteNodeData {
  kind: "note";
  text: string;
  [key: string]: unknown;
}

export type WhiteboardNodeData =
  | CharacterNodeData
  | ScenarioNodeData
  | SceneNodeData
  | NoteNodeData;

export interface SerializedNode {
  id: string;
  type: "character" | "scenario" | "scene" | "note";
  position: { x: number; y: number };
  data: WhiteboardNodeData;
}

export interface SerializedEdge {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
}

interface SeedInput {
  characters: Array<{
    id: string;
    name: string;
    description: string;
    visualPrompt: string;
    imageUrl: string | null;
  }>;
  scenarios: Array<{
    id: string;
    name: string;
    description: string;
    visualPrompt: string;
    imageUrl: string | null;
  }>;
  scenes: Array<{
    id: string;
    order: number;
    title: string;
    summary: string;
    videoPrompt: string;
    dialogue: string | null;
    durationSec: number;
    keyframeUrl: string | null;
    videoUrl: string | null;
    characterIds: string[];
    scenarioId: string | null;
  }>;
}

const COLUMN_GAP = 420;
const CHARACTER_ROW_GAP = 360;
const SCENARIO_ROW_GAP = 360;
const SCENE_COL_GAP = 380;
const NOTE_COL_GAP = 240;
const TIMELINE_PADDING = 160;

/** Posiciona nós existentes no layout de storyboard (cenários → personagens → cenas). */
export function autoLayoutNodes<T extends SerializedNode>(nodes: T[]): T[] {
  const scenarios = nodes.filter((n) => n.data.kind === "scenario");
  const characters = nodes.filter((n) => n.data.kind === "character");
  const scenes = nodes.filter((n) => n.data.kind === "scene");
  const notes = nodes.filter((n) => n.data.kind === "note");

  const positions = new Map<string, { x: number; y: number }>();

  scenarios.forEach((node, i) => {
    positions.set(node.id, { x: 0, y: i * SCENARIO_ROW_GAP });
  });

  characters.forEach((node, i) => {
    positions.set(node.id, { x: COLUMN_GAP, y: i * CHARACTER_ROW_GAP });
  });

  const timelineY =
    Math.max(scenarios.length * SCENARIO_ROW_GAP, characters.length * CHARACTER_ROW_GAP) +
    TIMELINE_PADDING;

  [...scenes]
    .sort((a, b) => {
      if (a.data.kind === "scene" && b.data.kind === "scene") {
        return a.data.order - b.data.order;
      }
      return 0;
    })
    .forEach((node, i) => {
      positions.set(node.id, { x: i * SCENE_COL_GAP, y: timelineY });
    });

  const notesX = Math.max(scenes.length * SCENE_COL_GAP, COLUMN_GAP * 2) + 80;
  notes.forEach((node, i) => {
    positions.set(node.id, { x: notesX, y: i * NOTE_COL_GAP });
  });

  return nodes.map((node) => {
    const position = positions.get(node.id);
    return position ? { ...node, position } : node;
  });
}

/**
 * Layout inicial: cenários na coluna 0, personagens na coluna 1,
 * cenas em linha do tempo horizontal abaixo, com edges
 * cena → personagens e cena → cenário.
 */
export function seedWhiteboard(input: SeedInput): {
  nodes: SerializedNode[];
  edges: SerializedEdge[];
} {
  const nodes: SerializedNode[] = [];
  const edges: SerializedEdge[] = [];

  input.scenarios.forEach((scenario, i) => {
    nodes.push({
      id: `scenario-${scenario.id}`,
      type: "scenario",
      position: { x: 0, y: i * SCENARIO_ROW_GAP },
      data: { kind: "scenario", scenarioId: scenario.id, ...pick(scenario) },
    });
  });

  input.characters.forEach((character, i) => {
    nodes.push({
      id: `character-${character.id}`,
      type: "character",
      position: { x: COLUMN_GAP, y: i * CHARACTER_ROW_GAP },
      data: { kind: "character", characterId: character.id, ...pick(character) },
    });
  });

  const timelineY =
    Math.max(input.scenarios.length * SCENARIO_ROW_GAP, input.characters.length * CHARACTER_ROW_GAP) +
    TIMELINE_PADDING;

  [...input.scenes]
    .sort((a, b) => a.order - b.order)
    .forEach((scene, i) => {
      const sceneNodeId = `scene-${scene.id}`;
      nodes.push({
        id: sceneNodeId,
        type: "scene",
        position: { x: i * SCENE_COL_GAP, y: timelineY },
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
          id: `e-${sceneNodeId}-character-${characterId}`,
          source: `character-${characterId}`,
          target: sceneNodeId,
          animated: false,
        });
      }
      if (scene.scenarioId) {
        edges.push({
          id: `e-${sceneNodeId}-scenario-${scene.scenarioId}`,
          source: `scenario-${scene.scenarioId}`,
          target: sceneNodeId,
          animated: false,
        });
      }
    });

  return { nodes, edges };
}

function pick(entity: {
  name: string;
  description: string;
  visualPrompt: string;
  imageUrl: string | null;
}): { name: string; description: string; visualPrompt: string; imageUrl: string | null } {
  return {
    name: entity.name,
    description: entity.description,
    visualPrompt: entity.visualPrompt,
    imageUrl: entity.imageUrl,
  };
}

function nextSlot(nodes: SerializedNode[], type: SerializedNode["type"], gapX: number, gapY: number) {
  const ofType = nodes.filter((n) => n.type === type);
  if (ofType.length === 0) {
    if (type === "character") return { x: COLUMN_GAP, y: 0 };
    if (type === "scene") return { x: 0, y: 800 };
    if (type === "note") return { x: COLUMN_GAP * 2, y: 0 };
    return { x: 0, y: 0 };
  }
  const maxY = Math.max(...ofType.map((n) => n.position.y));
  const maxX = Math.max(...ofType.map((n) => n.position.x));
  if (type === "scene") return { x: maxX + gapX, y: ofType[0]?.position.y ?? 800 };
  return { x: ofType[0]?.position.x ?? 0, y: maxY + gapY };
}

/** Remove um nó e todas as edges ligadas a ele. */
export function removeNodeFromGraph(
  graph: { nodes: SerializedNode[]; edges: SerializedEdge[] },
  nodeId: string
): { nodes: SerializedNode[]; edges: SerializedEdge[] } {
  return {
    nodes: graph.nodes.filter((n) => n.id !== nodeId),
    edges: graph.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
  };
}

export function entityNodeId(
  targetType: "character" | "scenario" | "scene",
  targetId: string
): string {
  return `${targetType}-${targetId}`;
}

/** Anexa um personagem ao grafo sem reescrever o layout existente. */
export function appendCharacterNode(
  graph: { nodes: SerializedNode[]; edges: SerializedEdge[] },
  character: {
    id: string;
    name: string;
    description: string;
    visualPrompt: string;
    imageUrl: string | null;
  }
): { nodes: SerializedNode[]; edges: SerializedEdge[]; node: SerializedNode } {
  const node: SerializedNode = {
    id: `character-${character.id}`,
    type: "character",
    position: nextSlot(graph.nodes, "character", COLUMN_GAP, CHARACTER_ROW_GAP),
    data: { kind: "character", characterId: character.id, ...pick(character) },
  };
  return { nodes: [...graph.nodes, node], edges: graph.edges, node };
}

/** Anexa um cenário ao grafo sem reescrever o layout existente. */
export function appendScenarioNode(
  graph: { nodes: SerializedNode[]; edges: SerializedEdge[] },
  scenario: {
    id: string;
    name: string;
    description: string;
    visualPrompt: string;
    imageUrl: string | null;
  }
): { nodes: SerializedNode[]; edges: SerializedEdge[]; node: SerializedNode } {
  const node: SerializedNode = {
    id: `scenario-${scenario.id}`,
    type: "scenario",
    position: nextSlot(graph.nodes, "scenario", COLUMN_GAP, SCENARIO_ROW_GAP),
    data: { kind: "scenario", scenarioId: scenario.id, ...pick(scenario) },
  };
  return { nodes: [...graph.nodes, node], edges: graph.edges, node };
}

/** Anexa uma cena + edges para personagens/cenário vinculados. */
export function appendSceneNode(
  graph: { nodes: SerializedNode[]; edges: SerializedEdge[] },
  scene: {
    id: string;
    order: number;
    title: string;
    summary: string;
    videoPrompt: string;
    dialogue: string | null;
    durationSec: number;
    keyframeUrl: string | null;
    videoUrl: string | null;
    characterIds: string[];
    scenarioId: string | null;
  }
): {
  nodes: SerializedNode[];
  edges: SerializedEdge[];
  node: SerializedNode;
  newEdges: SerializedEdge[];
} {
  const sceneNodeId = `scene-${scene.id}`;
  const node: SerializedNode = {
    id: sceneNodeId,
    type: "scene",
    position: nextSlot(graph.nodes, "scene", SCENE_COL_GAP, SCENE_COL_GAP),
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
  };

  const newEdges: SerializedEdge[] = [];
  for (const characterId of scene.characterIds) {
    newEdges.push({
      id: `e-${sceneNodeId}-character-${characterId}`,
      source: `character-${characterId}`,
      target: sceneNodeId,
      animated: false,
    });
  }
  if (scene.scenarioId) {
    newEdges.push({
      id: `e-${sceneNodeId}-scenario-${scene.scenarioId}`,
      source: `scenario-${scene.scenarioId}`,
      target: sceneNodeId,
      animated: false,
    });
  }

  return {
    nodes: [...graph.nodes, node],
    edges: [...graph.edges, ...newEdges],
    node,
    newEdges,
  };
}
