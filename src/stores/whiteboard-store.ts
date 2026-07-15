"use client";

import { create } from "zustand";
import {
  applyEdgeChanges,
  applyNodeChanges,
  addEdge,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import type { WhiteboardNodeData } from "@/lib/whiteboard-layout";

export type WhiteboardNode = Node<WhiteboardNodeData>;

interface WhiteboardState {
  nodes: WhiteboardNode[];
  edges: Edge[];
  selectedSceneIds: string[];
  dirty: boolean;

  setGraph: (nodes: WhiteboardNode[], edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange<WhiteboardNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (node: WhiteboardNode) => void;
  appendGraph: (nodes: WhiteboardNode[], edges?: Edge[]) => void;
  removeNode: (nodeId: string) => void;
  updateNodeData: (nodeId: string, data: Partial<WhiteboardNodeData>) => void;
  toggleSceneSelection: (sceneId: string, selected: boolean) => void;
  clearSceneSelection: () => void;
  markSaved: () => void;
}

export const useWhiteboardStore = create<WhiteboardState>((set) => ({
  nodes: [],
  edges: [],
  selectedSceneIds: [],
  dirty: false,

  setGraph: (nodes, edges) => set({ nodes, edges, dirty: false }),

  onNodesChange: (changes) =>
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
      // Mudanças de seleção/hover não precisam persistir.
      dirty: state.dirty || changes.some((c) => c.type !== "select"),
    })),

  onEdgesChange: (changes) =>
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
      dirty: state.dirty || changes.some((c) => c.type !== "select"),
    })),

  onConnect: (connection) =>
    set((state) => ({ edges: addEdge(connection, state.edges), dirty: true })),

  addNode: (node) => set((state) => ({ nodes: [...state.nodes, node], dirty: true })),

  appendGraph: (nodes, edges = []) =>
    set((state) => ({
      nodes: [...state.nodes, ...nodes],
      edges: edges.length ? [...state.edges, ...edges] : state.edges,
      dirty: true,
    })),

  removeNode: (nodeId) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      dirty: true,
    })),

  updateNodeData: (nodeId, data) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? ({ ...n, data: { ...n.data, ...data } } as WhiteboardNode) : n
      ),
      dirty: true,
    })),

  toggleSceneSelection: (sceneId, selected) =>
    set((state) => ({
      selectedSceneIds: selected
        ? [...new Set([...state.selectedSceneIds, sceneId])]
        : state.selectedSceneIds.filter((id) => id !== sceneId),
    })),

  clearSceneSelection: () => set({ selectedSceneIds: [] }),

  markSaved: () => set({ dirty: false }),
}));
