"use client";

import { createContext, useContext } from "react";

interface WhiteboardContextValue {
  projectId: string;
  /** Adiciona jobs ao polling do canvas. */
  trackJobs: (jobIds: string[]) => void;
}

const WhiteboardContext = createContext<WhiteboardContextValue | null>(null);

export const WhiteboardProvider = WhiteboardContext.Provider;

export function useWhiteboardContext(): WhiteboardContextValue {
  const value = useContext(WhiteboardContext);
  if (!value) throw new Error("useWhiteboardContext deve ser usado dentro do WhiteboardCanvas");
  return value;
}
